// momment. AIO verification Edge Function.
// Strategy: call Gemini + GPT first, then call xAI/Grok only as a tie-breaker.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

type AioVerdict =
  | "supports"
  | "refutes"
  | "ambiguous"
  | "invalid_evidence"
  | "insufficient_evidence";

type ProviderName = "gemini" | "gpt" | "xai";

type AssertionRow = {
  id: string;
  event_id: string;
  rule_id: string;
  proposer_id: string;
  claim_text: string;
  asserted_outcome: string;
  status: string;
};

type RuleRow = {
  id: string;
  question: string;
  resolution_criteria: string;
  supported_outcomes: string[];
  min_evidence_count: number;
  min_publisher_trust: number;
  source_requirements: Record<string, unknown>;
  prompt_version: string | null;
  prompt_hash: string | null;
};

type EvidenceInput = {
  url: string;
};

type EvidenceItem = {
  id?: string;
  url: string;
  canonical_url: string | null;
  title: string | null;
  publisher: string | null;
  publisher_domain: string | null;
  publisher_trust_weight: number | null;
  published_at: string | null;
  content_hash: string | null;
  metadata_hash: string | null;
  metadata: Record<string, unknown>;
};

type VerificationInput = {
  assertion: AssertionRow;
  rule: RuleRow;
  evidence: EvidenceItem[];
};

type ProviderResult = {
  provider: ProviderName;
  modelId: string;
  verdict: AioVerdict;
  assertedOutcome: string | null;
  confidence: number;
  reasoningSummary: string;
  rawOutput: Record<string, unknown>;
  promptVersion: string;
  promptHash: string;
  inputHash: string;
  outputHash: string;
  ok: boolean;
  error?: string;
};

type AggregateResult = {
  verdict: AioVerdict;
  confidence: number;
  status: "evidence_captured" | "llm_verified" | "rejected" | "challenge_period";
  metadata: Record<string, unknown>;
};

type SupabaseClientLike = ReturnType<typeof createClient<any, "public", any>>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const confidenceThreshold = numberFromEnv("AIO_CONFIDENCE_THRESHOLD", 0.7);
const promptVersion = Deno.env.get("AIO_PROMPT_VERSION") ?? "aio-verifier-v1";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const body = (await request.json()) as {
      assertion_id?: string;
      evidence_urls?: string[];
    };

    if (!body.assertion_id) {
      return json({ error: "assertion_id_required" }, 400);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: assertion, error: assertionError } = await supabase
      .from("aio_assertions")
      .select("*")
      .eq("id", body.assertion_id)
      .maybeSingle<AssertionRow>();

    if (assertionError || !assertion) {
      return json({ error: "assertion_not_found", detail: assertionError?.message }, 404);
    }

    const { data: rule, error: ruleError } = await supabase
      .from("attention_rules")
      .select("*")
      .eq("id", assertion.rule_id)
      .maybeSingle<RuleRow>();

    if (ruleError || !rule) {
      return json({ error: "rule_not_found", detail: ruleError?.message }, 404);
    }

    const evidence = await ensureEvidenceItems(
      supabase,
      assertion,
      body.evidence_urls ?? [],
    );

    if (evidence.length < rule.min_evidence_count) {
      return json(
        {
          error: "insufficient_evidence",
          min_evidence_count: rule.min_evidence_count,
          evidence_count: evidence.length,
        },
        400,
      );
    }

    const verificationInput = { assertion, rule, evidence };
    const firstPass = await Promise.all([
      runProvider("gemini", verificationInput),
      runProvider("gpt", verificationInput),
    ]);

    const tieBreakerNeeded = shouldCallTieBreaker(firstPass, assertion.asserted_outcome);
    const results = tieBreakerNeeded
      ? [...firstPass, await runProvider("xai", verificationInput)]
      : firstPass;

    await insertVerificationRows(supabase, assertion.id, results);

    const aggregate = aggregateResults(results, assertion.asserted_outcome, tieBreakerNeeded);
    const llmBundleHash = await sha256Hex(JSON.stringify(results.map(resultForHash)));

    const { error: updateError } = await supabase
      .from("aio_assertions")
      .update({
        status: aggregate.status,
        aggregate_verdict: aggregate.verdict,
        aggregate_confidence: aggregate.confidence,
        llm_bundle_hash: llmBundleHash,
        aggregate_metadata: aggregate.metadata,
        challenge_ends_at:
          aggregate.status === "challenge_period"
            ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            : undefined,
      })
      .eq("id", assertion.id);

    if (updateError) {
      return json({ error: "assertion_update_failed", detail: updateError.message }, 500);
    }

    return json({
      assertion_id: assertion.id,
      aggregate_verdict: aggregate.verdict,
      aggregate_confidence: aggregate.confidence,
      status: aggregate.status,
      tie_breaker_called: tieBreakerNeeded,
      provider_count: results.length,
      providers: results.map((result) => ({
        provider: result.provider,
        model_id: result.modelId,
        verdict: result.verdict,
        asserted_outcome: result.assertedOutcome,
        confidence: result.confidence,
        ok: result.ok,
      })),
    });
  } catch (error) {
    return json(
      {
        error: "aio_verify_failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

async function ensureEvidenceItems(
  supabase: SupabaseClientLike,
  assertion: AssertionRow,
  evidenceUrls: string[],
) {
  const { data: existingRows, error } = await supabase
    .from("aio_evidence_items")
    .select("*")
    .eq("assertion_id", assertion.id);

  if (error) {
    throw new Error(`evidence_select_failed: ${error.message}`);
  }

  const existing = (existingRows ?? []) as EvidenceItem[];
  const existingUrls = new Set(existing.map((item) => item.url));
  const newUrls = evidenceUrls
    .map((url) => url.trim())
    .filter((url) => url && !existingUrls.has(url))
    .map((url) => ({ url }));

  if (newUrls.length === 0) {
    return existing;
  }

  const captured = await Promise.all(newUrls.map(captureEvidenceLite));
  const rows = captured.map((item) => ({
    assertion_id: assertion.id,
    submitted_by: assertion.proposer_id,
    ...item,
  }));

  const { data: insertedRows, error: insertError } = await supabase
    .from("aio_evidence_items")
    .insert(rows)
    .select("*");

  if (insertError) {
    throw new Error(`evidence_insert_failed: ${insertError.message}`);
  }

  return [...existing, ...((insertedRows ?? []) as EvidenceItem[])];
}

async function captureEvidenceLite(input: EvidenceInput): Promise<EvidenceItem> {
  const canonicalUrl = canonicalizeUrl(input.url);
  const domain = canonicalUrl ? new URL(canonicalUrl).hostname.replace(/^www\./, "") : null;
  let html = "";
  let status = 0;
  let finalUrl = input.url;

  try {
    const response = await fetch(input.url, {
      headers: {
        "user-agent": "momment-aio-evidence-lite/0.1",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10_000),
    });
    status = response.status;
    finalUrl = response.url || input.url;
    html = (await response.text()).slice(0, 250_000);
  } catch {
    html = "";
  }

  const title = pickMeta(html, "og:title") ?? pickTitle(html);
  const publisher =
    pickMeta(html, "og:site_name") ?? pickMeta(html, "article:publisher") ?? domain;
  const publishedAt =
    normalizeDate(
      pickMeta(html, "article:published_time") ??
        pickMeta(html, "publish_date") ??
        pickMeta(html, "date"),
    ) ?? null;
  const description = pickMeta(html, "og:description") ?? pickMeta(html, "description");
  const textExcerpt = extractReadableText(html);
  const contentHash = await sha256Hex(html || input.url);
  const metadata = {
    captured_status: status,
    final_url: finalUrl,
    description,
    text_excerpt: textExcerpt,
    capture_mode: textExcerpt ? "metadata_text_excerpt_hash" : "metadata_hash_only",
    html_sample_size: html.length,
    text_excerpt_size: textExcerpt.length,
  };
  const metadataHash = await sha256Hex(JSON.stringify(metadata));

  return {
    url: input.url,
    canonical_url: canonicalUrl,
    title,
    publisher,
    publisher_domain: domain,
    publisher_trust_weight: null,
    published_at: publishedAt,
    content_hash: contentHash,
    metadata_hash: metadataHash,
    metadata,
  };
}

async function runProvider(
  provider: ProviderName,
  input: VerificationInput,
): Promise<ProviderResult> {
  const prompt = buildPrompt(input);
  const promptHash = await sha256Hex(prompt);
  const inputHash = await sha256Hex(JSON.stringify(input));

  try {
    const { modelId, rawText, rawJson } =
      provider === "gemini"
        ? await callGemini(prompt)
        : provider === "gpt"
          ? await callOpenAI(prompt)
          : await callXai(prompt);
    const parsed = parseProviderJson(rawText);
    const rawOutput = rawJson ?? { text: rawText };
    const outputHash = await sha256Hex(JSON.stringify(rawOutput));

    return {
      provider,
      modelId,
      verdict: normalizeVerdict(parsed.verdict),
      assertedOutcome:
        typeof parsed.asserted_outcome === "string" ? parsed.asserted_outcome : null,
      confidence: normalizeConfidence(parsed.confidence),
      reasoningSummary:
        typeof parsed.reasoning_summary === "string"
          ? parsed.reasoning_summary.slice(0, 2000)
          : "",
      rawOutput,
      promptVersion,
      promptHash,
      inputHash,
      outputHash,
      ok: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const rawOutput = {
      error: errorMessage,
    };

    return {
      provider,
      modelId: modelIdForProvider(provider),
      verdict: "insufficient_evidence",
      assertedOutcome: null,
      confidence: 0,
      reasoningSummary: `Provider error: ${errorMessage}`.slice(0, 2000),
      rawOutput,
      promptVersion,
      promptHash,
      inputHash,
      outputHash: await sha256Hex(JSON.stringify(rawOutput)),
      ok: false,
      error: rawOutput.error,
    };
  }
}

function buildPrompt(input: VerificationInput) {
  return [
    "You are momment. AIO, a fact-verification oracle layer.",
    "momment. is not a betting platform. Verify whether evidence supports an already submitted assertion.",
    "Evaluate the Claim and Asserted outcome exactly, not just the question title.",
    "Pay special attention to negation and date cutoffs.",
    "For before/after deadline questions, evidence that an event happened after the cutoff can support a claim that the event did not happen before the cutoff.",
    "Do not refute a negative-before-deadline claim merely because the event eventually happened later.",
    "Critical temporal rule: if the claim says 'X did not happen before DATE' and the evidence says 'X happened after DATE', the verdict is supports, not refutes.",
    "Critical temporal rule: only refute 'X did not happen before DATE' when the evidence shows X happened before DATE.",
    "Example: Claim='OpenAI did not release GPT-5 before December 2024'; Evidence='GPT-5 was released on August 8, 2025'; Verdict='supports'.",
    "Return strict JSON only. No markdown.",
    "",
    "JSON schema:",
    JSON.stringify({
      verdict: "supports | refutes | ambiguous | insufficient_evidence",
      asserted_outcome: "string or null",
      confidence: "number from 0 to 1",
      reasoning_summary: "short evidence-grounded explanation",
    }),
    "",
    `Question: ${input.rule.question}`,
    `Resolution criteria: ${input.rule.resolution_criteria}`,
    `Supported outcomes: ${input.rule.supported_outcomes.join(", ")}`,
    `Claim: ${input.assertion.claim_text}`,
    `Asserted outcome: ${input.assertion.asserted_outcome}`,
    "",
    "Evidence Lite metadata:",
    JSON.stringify(
      input.evidence.map((item) => ({
        url: item.url,
        canonical_url: item.canonical_url,
        title: item.title,
        publisher: item.publisher,
        publisher_domain: item.publisher_domain,
        published_at: item.published_at,
        description: item.metadata.description,
        text_excerpt: item.metadata.text_excerpt,
        capture_status: item.metadata.captured_status,
      })),
      null,
      2,
    ),
  ].join("\n");
}

async function callGemini(prompt: string) {
  const apiKey = requiredEnv("GEMINI_API_KEY");
  const configuredModel = Deno.env.get("GEMINI_MODEL");
  const fallbackModels = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash-lite-preview-09-2025",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite-001",
    "gemini-1.5-flash-latest",
  ];
  const modelCandidates = [
    ...new Set([configuredModel, ...fallbackModels].filter((model): model is string => Boolean(model))),
  ];
  const errors: string[] = [];

  for (const modelId of modelCandidates) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      const message = `gemini_error_${response.status}_${modelId}: ${await response.text()}`;
      errors.push(message);
      if (response.status === 404) {
        continue;
      }
      throw new Error(message);
    }

    const rawJson = await response.json();
    const rawText = rawJson?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawText !== "string") {
      throw new Error(`gemini_empty_response_${modelId}`);
    }

    return { modelId, rawText, rawJson };
  }

  throw new Error(errors.join(" | ") || "gemini_no_model_available");
}

async function callOpenAI(prompt: string) {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const modelId = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`openai_error_${response.status}: ${await response.text()}`);
  }

  const rawJson = await response.json();
  const rawText = rawJson?.choices?.[0]?.message?.content;
  if (typeof rawText !== "string") {
    throw new Error("openai_empty_response");
  }

  return { modelId, rawText, rawJson };
}

async function callXai(prompt: string) {
  const apiKey = requiredEnv("XAI_API_KEY");
  const modelId = Deno.env.get("XAI_MODEL") ?? "grok-4.3";
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(`xai_error_${response.status}: ${await response.text()}`);
  }

  const rawJson = await response.json();
  const rawText = rawJson?.choices?.[0]?.message?.content;
  if (typeof rawText !== "string") {
    throw new Error("xai_empty_response");
  }

  return { modelId, rawText, rawJson };
}

async function insertVerificationRows(
  supabase: SupabaseClientLike,
  assertionId: string,
  results: ProviderResult[],
) {
  const rows = results.map((result) => ({
    assertion_id: assertionId,
    evidence_item_id: null,
    model_id: result.modelId,
    provider: result.provider,
    prompt_version: result.promptVersion,
    prompt_hash: result.promptHash,
    input_hash: result.inputHash,
    output_hash: result.outputHash,
    verdict: result.verdict,
    confidence: Math.round(result.confidence * 100),
    reasoning_summary: result.reasoningSummary,
    raw_output: {
      ...result.rawOutput,
      ok: result.ok,
      error: result.error,
      normalized: {
        verdict: result.verdict,
        asserted_outcome: result.assertedOutcome,
        confidence: result.confidence,
      },
    },
  }));

  const { error } = await supabase.from("aio_llm_verifications").insert(rows);

  if (error) {
    throw new Error(`verification_insert_failed: ${error.message}`);
  }
}

function shouldCallTieBreaker(results: ProviderResult[], assertedOutcome: string) {
  const [first, second] = results;

  if (!first?.ok || !second?.ok) {
    return true;
  }

  if (first.confidence < confidenceThreshold || second.confidence < confidenceThreshold) {
    return true;
  }

  if (
    first.verdict === "ambiguous" ||
    second.verdict === "ambiguous" ||
    first.verdict === "insufficient_evidence" ||
    second.verdict === "insufficient_evidence" ||
    first.verdict === "invalid_evidence" ||
    second.verdict === "invalid_evidence"
  ) {
    return true;
  }

  return !sameOutcomeSupport(first, second, assertedOutcome) && first.verdict !== second.verdict;
}

function aggregateResults(
  results: ProviderResult[],
  assertedOutcome: string,
  tieBreakerCalled: boolean,
): AggregateResult {
  const usable = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);
  const supporting = usable.filter(
    (result) =>
      result.verdict === "supports" &&
      outcomeMatches(result.assertedOutcome, assertedOutcome),
  );
  const refuting = usable.filter((result) => result.verdict === "refutes");
  const insufficient = usable.filter(
    (result) =>
      result.verdict === "insufficient_evidence" || result.verdict === "invalid_evidence",
  );
  const ambiguous = usable.filter((result) => result.verdict === "ambiguous");
  // Combined "negative" = anything that is NOT supports (refutes + insufficient + invalid)
  const negative = usable.filter((result) => result.verdict !== "supports" && result.verdict !== "ambiguous");
  const supportConfidence = average(supporting.map((result) => result.confidence));
  const providerSummary = results.map((result) => ({
    provider: result.provider,
    model_id: result.modelId,
    ok: result.ok,
    verdict: result.verdict,
    asserted_outcome: result.assertedOutcome,
    confidence: result.confidence,
    error: result.error,
  }));

  const baseMetadata = {
    consensus_method: "adaptive_2_plus_1",
    confidence_threshold: confidenceThreshold,
    tie_breaker_called: tieBreakerCalled,
    tie_breaker_provider: tieBreakerCalled ? "xai" : null,
    provider_count: results.length,
    providers: providerSummary,
  };

  // If 2+ providers failed entirely, retry is required
  if (failed.length >= 2) {
    return {
      verdict: "insufficient_evidence",
      confidence: 0,
      status: "evidence_captured",
      metadata: { ...baseMetadata, decision: "provider_failure_retry_required" },
    };
  }

  // If 1+ provider failed AND no usable provider supports → reject
  // (failed provider should never help push toward finalization)
  if (failed.length >= 1 && supporting.length === 0) {
    return {
      verdict: "insufficient_evidence",
      confidence: 0,
      status: "rejected",
      metadata: { ...baseMetadata, decision: "rejected_provider_error_no_support" },
    };
  }

  // Strong support: 2+ support with high confidence
  if (supporting.length >= 2 && supportConfidence >= confidenceThreshold) {
    return {
      verdict: "supports",
      confidence: supportConfidence,
      status: "challenge_period",
      metadata: { ...baseMetadata, decision: "accepted_to_challenge_period" },
    };
  }

  // Strong refutation: 2+ refutes
  if (refuting.length >= 2) {
    return {
      verdict: "refutes",
      confidence: average(refuting.map((result) => result.confidence)),
      status: "rejected",
      metadata: { ...baseMetadata, decision: "rejected_by_refutation" },
    };
  }

  // Strong insufficient: 2+ insufficient/invalid
  if (insufficient.length >= 2) {
    return {
      verdict: "insufficient_evidence",
      confidence: average(insufficient.map((result) => result.confidence)),
      status: "rejected",
      metadata: { ...baseMetadata, decision: "rejected_by_insufficient_evidence" },
    };
  }

  // Mixed negative: refutes + insufficient combined >= 2 → reject
  // (e.g. 1 refutes + 1 insufficient = no support for the claim)
  if (negative.length >= 2 && supporting.length === 0) {
    return {
      verdict: "refutes",
      confidence: average(negative.map((result) => result.confidence)),
      status: "rejected",
      metadata: { ...baseMetadata, decision: "rejected_by_mixed_negative" },
    };
  }

  // Ambiguous consensus
  if (ambiguous.length >= 2) {
    return {
      verdict: "ambiguous",
      confidence: average(ambiguous.map((result) => result.confidence)),
      status: "rejected",
      metadata: { ...baseMetadata, decision: "rejected_ambiguous" },
    };
  }

  // No consensus at all → reject (do NOT allow finalization without clear support)
  return {
    verdict: "ambiguous",
    confidence: average(usable.map((result) => result.confidence)),
    status: "rejected",
    metadata: { ...baseMetadata, decision: "rejected_no_consensus" },
  };
}

function sameOutcomeSupport(
  first: ProviderResult,
  second: ProviderResult,
  assertedOutcome: string,
) {
  return (
    first.verdict === "supports" &&
    second.verdict === "supports" &&
    outcomeMatches(first.assertedOutcome, assertedOutcome) &&
    outcomeMatches(second.assertedOutcome, assertedOutcome)
  );
}

function outcomeMatches(value: string | null, assertedOutcome: string) {
  if (!value) {
    return false;
  }

  return normalizeOutcome(value) === normalizeOutcome(assertedOutcome);
}

function normalizeOutcome(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeVerdict(value: unknown): AioVerdict {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "supports") return "supports";
  if (normalized === "refutes") return "refutes";
  if (normalized === "ambiguous") return "ambiguous";
  if (normalized === "invalid_evidence") return "invalid_evidence";
  if (normalized === "insufficient_evidence") return "insufficient_evidence";
  if (normalized === "insufficient") return "insufficient_evidence";

  return "ambiguous";
}

function normalizeConfidence(value: unknown) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(1, Math.max(0, numeric > 1 ? numeric / 100 : numeric));
}

function parseProviderJson(rawText: string) {
  const trimmed = rawText.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    return JSON.parse(withoutFence) as Record<string, unknown>;
  } catch {
    const jsonStart = withoutFence.indexOf("{");
    const jsonEnd = withoutFence.lastIndexOf("}");

    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(withoutFence.slice(jsonStart, jsonEnd + 1)) as Record<
        string,
        unknown
      >;
    }

    throw new Error(`invalid_provider_json: ${withoutFence.slice(0, 500)}`);
  }
}

function resultForHash(result: ProviderResult) {
  return {
    provider: result.provider,
    model_id: result.modelId,
    verdict: result.verdict,
    asserted_outcome: result.assertedOutcome,
    confidence: result.confidence,
    output_hash: result.outputHash,
  };
}

function modelIdForProvider(provider: ProviderName) {
  if (provider === "gemini") return Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
  if (provider === "gpt") return Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
  return Deno.env.get("XAI_MODEL") ?? "grok-4.3";
}

function pickTitle(html: string) {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null);
}

function pickMeta(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const propertyPattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const contentFirstPattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
    "i",
  );

  return decodeHtml(
    propertyPattern.exec(html)?.[1]?.trim() ??
      contentFirstPattern.exec(html)?.[1]?.trim() ??
      null,
  );
}

function extractReadableText(html: string) {
  if (!html) {
    return "";
  }

  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ");
  const articleMatch =
    /<article[^>]*>([\s\S]*?)<\/article>/i.exec(withoutNoise)?.[1] ??
    /<main[^>]*>([\s\S]*?)<\/main>/i.exec(withoutNoise)?.[1] ??
    withoutNoise;
  const withBreaks = articleMatch
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const text = decodeHtmlLong(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, 12_000);
}

function decodeHtml(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .slice(0, 500);
}

function decodeHtmlLong(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");
}

function normalizeDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function canonicalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`missing_env_${name}`);
  }

  return value;
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(Deno.env.get(name));
  return Number.isFinite(value) ? value : fallback;
}
