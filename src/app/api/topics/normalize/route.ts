import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

/* ─── env ─── */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/* ─── types ─── */
type NormalizedTopic = {
  raw: string;
  slug: string;
  kind: "ai_keyword" | "entity" | "category";
  canonical_label: string;
  labels: { ko: string; en: string; es: string };
};

type LLMBatchResponse = {
  topics: NormalizedTopic[];
};

/**
 * POST /api/topics/normalize
 *
 * Accepts an ARRAY of raw topic strings, normalizes them all in a
 * **single** GPT call, upserts into the `topics` table, and returns
 * the normalized results with their DB ids.
 *
 * Body: { rawTopics: string[] }
 * Response: { topics: Array<{ id, slug, kind, canonical_label, labels, raw }> }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Support both singular and plural for backward compat
    const rawTopics: string[] = Array.isArray(body.rawTopics)
      ? body.rawTopics
      : body.rawTopic
        ? [body.rawTopic]
        : [];

    const trimmed = rawTopics
      .map((r: string) => (typeof r === "string" ? r.trim() : ""))
      .filter((r) => r.length >= 1)
      .slice(0, 10); // safety cap

    if (trimmed.length === 0) {
      return NextResponse.json({ error: "rawTopics required" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch existing topics for dedup context
    const { data: existingTopics } = await supabase
      .from("topics")
      .select("slug, canonical_label")
      .order("created_at", { ascending: true })
      .limit(200);

    const existingSlugs = (existingTopics ?? []).map(
      (t: { slug: string }) => t.slug,
    );

    // ── Normalize via GPT (single call for ALL raw topics) ──
    let normalized: NormalizedTopic[];

    if (!OPENAI_API_KEY) {
      normalized = trimmed.map(fallbackNormalize);
    } else {
      const gptResult = await batchNormalizeViaGPT(trimmed, existingSlugs);
      // Fill in any missing ones with fallback
      normalized = trimmed.map((raw) => {
        const found = gptResult.find(
          (n) => n.raw?.toLowerCase() === raw.toLowerCase(),
        );
        return found ?? fallbackNormalize(raw);
      });
    }

    // ── Upsert all into DB ──
    const results: Array<{
      id: string;
      slug: string;
      kind: string;
      canonical_label: string;
      labels: Record<string, string>;
      raw: string;
    }> = [];

    for (const topic of normalized) {
      const slug = topic.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      if (!slug) continue;

      // Check if this is an existing topic that GPT matched
      if (existingSlugs.includes(slug)) {
        const { data: existing } = await supabase
          .from("topics")
          .select("id, slug, kind, canonical_label, labels")
          .eq("slug", slug)
          .single();

        if (existing) {
          results.push({ ...existing, raw: topic.raw });
          continue;
        }
      }

      // Upsert new topic
      const { data: upserted } = await supabase
        .from("topics")
        .upsert(
          {
            slug,
            kind: topic.kind,
            canonical_label: topic.canonical_label,
            labels: topic.labels,
            created_by: "user",
          },
          { onConflict: "slug" },
        )
        .select("id, slug, kind, canonical_label, labels")
        .single();

      if (upserted) {
        results.push({ ...upserted, raw: topic.raw });
      }
    }

    return NextResponse.json({ topics: results });
  } catch (err) {
    console.error("[topics/normalize]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/* ─── GPT batch normalization (single call) ─── */
async function batchNormalizeViaGPT(
  rawInputs: string[],
  existingSlugs: string[],
): Promise<NormalizedTopic[]> {
  const inputList = rawInputs.map((r, i) => `${i + 1}. "${r}"`).join("\n");

  const prompt = `You are a topic normalization engine for a social platform called "moment." covering crypto, finance, sports, politics, gaming, tech, and culture.

Normalize ALL of the following user-typed topics:
${inputList}

## Rules
1. PREFER matching to existing topics from the list below. Use the EXACT slug.
2. Only create a new topic if nothing in the existing list matches.
3. New topics: slug = lowercase English with hyphens (e.g., "spot-bitcoin-etf").
4. canonical_label = title case English.
5. labels: provide translations in ko, en, es.
6. kind: "category" (broad), "entity" (proper noun), or "ai_keyword" (specific concept).
7. Do NOT create overly generic or time-bound topics.
8. IMPORTANT: The "raw" field MUST match the original user input exactly.

## Existing Topic Slugs
${existingSlugs.slice(0, 150).join(", ")}

## Response Format (JSON only, no markdown)
{"topics":[{"raw":"삼성전자","slug":"samsung-electronics","kind":"entity","canonical_label":"Samsung Electronics","labels":{"ko":"삼성전자","en":"Samsung Electronics","es":"Samsung Electronics"}}]}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.05,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error("[topics/normalize] OpenAI error:", response.status);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content) as LLMBatchResponse;
    return parsed.topics ?? [];
  } catch (err) {
    console.error("[topics/normalize] GPT parse error:", err);
    return [];
  }
}

/* ─── Fallback (no GPT) ─── */
function fallbackNormalize(raw: string): NormalizedTopic {
  const slug =
    raw
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9가-힣-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || `topic-${Date.now()}`;

  return {
    raw,
    slug,
    kind: "ai_keyword",
    canonical_label: raw,
    labels: { ko: raw, en: raw, es: raw },
  };
}
