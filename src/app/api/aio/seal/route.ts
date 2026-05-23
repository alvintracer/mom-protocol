/**
 * POST /api/aio/seal
 * Automatically seals an assertion + verification + resolution on-chain
 * when finalized. Called server-side after finalize_aio_assertion.
 *
 * Body: { assertion_id: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  toHex,
  type Hex,
  pad,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  giwaSepolia,
  AIO_ORACLE_ADDRESS,
  MOM_AIO_ABI_FULL,
} from "@/shared/lib/contracts/aio-contract";

// ─── Helpers ────────────────────────────────────

function uuidToBytes32(uuid: string): Hex {
  return pad(`0x${uuid.replace(/-/g, "")}` as Hex, { size: 32 });
}

function hashString(s: string): Hex {
  return keccak256(toHex(s));
}

// ─── Handler ────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { assertion_id } = await request.json();

    if (!assertion_id) {
      return NextResponse.json({ error: "assertion_id required" }, { status: 400 });
    }

    const privateKey = process.env.MASTER_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: "Server not configured for sealing" }, { status: 500 });
    }

    // ─── Fetch assertion data from Supabase ────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data: assertion, error: assertionError } = await supabase
      .from("aio_assertions")
      .select("*, rule:attention_rules!rule_id(question, resolution_criteria, supported_outcomes)")
      .eq("id", assertion_id)
      .single();

    if (assertionError || !assertion) {
      return NextResponse.json({ error: "Assertion not found" }, { status: 404 });
    }

    // Fetch evidence
    const { data: evidence } = await supabase
      .from("aio_evidence_items")
      .select("url, content_hash, publisher_domain")
      .eq("assertion_id", assertion_id)
      .order("created_at");

    // Fetch LLM verifications
    const { data: llmVerifications } = await supabase
      .from("aio_llm_verifications")
      .select("model_id, provider, verdict, confidence, reasoning_summary")
      .eq("assertion_id", assertion_id);

    // ─── Build hashes ──────────────────────────

    const assertionId = uuidToBytes32(assertion_id);

    // Assertion hash = hash of core assertion data
    const assertionPayload = JSON.stringify({
      claim_text: assertion.claim_text,
      asserted_outcome: assertion.asserted_outcome,
      bond_amount: assertion.bond_amount,
      created_at: assertion.created_at,
    });
    const assertionHash = hashString(assertionPayload);

    // Rule hash
    const rule = assertion.rule as { question: string; resolution_criteria: string; supported_outcomes: unknown } | null;
    const rulePayload = JSON.stringify({
      question: rule?.question ?? "",
      resolution_criteria: rule?.resolution_criteria ?? "",
      supported_outcomes: rule?.supported_outcomes ?? [],
    });
    const ruleHash = hashString(rulePayload);

    // Evidence bundle hash
    const evidencePayload = JSON.stringify(
      (evidence ?? []).map((e) => ({
        url: e.url,
        content_hash: e.content_hash,
        publisher_domain: e.publisher_domain,
      })),
    );
    const evidenceHash = hashString(evidencePayload);

    // LLM bundle hash
    const llmPayload = JSON.stringify(
      (llmVerifications ?? []).map((v) => ({
        model_id: v.model_id,
        provider: v.provider,
        verdict: v.verdict,
        confidence: v.confidence,
      })),
    );
    const llmBundleHash = hashString(llmPayload);

    // Verdict (aggregate)
    const verdictStr = assertion.aggregate_verdict || "unknown";
    const verdictHash = hashString(verdictStr);
    const confidence = Math.round((assertion.aggregate_confidence ?? 0) * 100); // basis points

    // Resolution hash
    const resolutionPayload = JSON.stringify({
      finalized_outcome: assertion.finalized_outcome,
      aggregate_verdict: assertion.aggregate_verdict,
      aggregate_confidence: assertion.aggregate_confidence,
      assertion_id: assertion_id,
    });
    const resolutionHash = hashString(resolutionPayload);
    const finalOutcomeHash = hashString(assertion.finalized_outcome || "unknown");

    // ─── Send transactions ─────────────────────

    const account = privateKeyToAccount(`0x${privateKey.replace(/^0x/, "")}` as Hex);

    const walletClient = createWalletClient({
      account,
      chain: giwaSepolia,
      transport: http(process.env.NEXT_PUBLIC_GIWA_RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: giwaSepolia,
      transport: http(process.env.NEXT_PUBLIC_GIWA_RPC_URL),
    });

    const txHashes: string[] = [];

    // 1. Seal Assertion
    try {
      const isSealed = await publicClient.readContract({
        address: AIO_ORACLE_ADDRESS,
        abi: MOM_AIO_ABI_FULL,
        functionName: "isAssertionSealed",
        args: [assertionId],
      });

      if (!isSealed) {
        const tx1 = await walletClient.writeContract({
          address: AIO_ORACLE_ADDRESS,
          abi: MOM_AIO_ABI_FULL,
          functionName: "sealAssertion",
          args: [assertionId, assertionHash, ruleHash, evidenceHash],
        });
        await publicClient.waitForTransactionReceipt({ hash: tx1 });
        txHashes.push(tx1);
      }
    } catch (e) {
      console.error("sealAssertion error:", e);
    }

    // 2. Seal Verification
    try {
      const isSealed = await publicClient.readContract({
        address: AIO_ORACLE_ADDRESS,
        abi: MOM_AIO_ABI_FULL,
        functionName: "isVerificationSealed",
        args: [assertionId],
      });

      if (!isSealed) {
        const tx2 = await walletClient.writeContract({
          address: AIO_ORACLE_ADDRESS,
          abi: MOM_AIO_ABI_FULL,
          functionName: "sealVerification",
          args: [assertionId, llmBundleHash, verdictHash, confidence],
        });
        await publicClient.waitForTransactionReceipt({ hash: tx2 });
        txHashes.push(tx2);
      }
    } catch (e) {
      console.error("sealVerification error:", e);
    }

    // 3. Seal Resolution (only if finalized)
    if (assertion.finalized_outcome) {
      try {
        const isSealed = await publicClient.readContract({
          address: AIO_ORACLE_ADDRESS,
          abi: MOM_AIO_ABI_FULL,
          functionName: "isResolutionSealed",
          args: [assertionId],
        });

        if (!isSealed) {
          const tx3 = await walletClient.writeContract({
            address: AIO_ORACLE_ADDRESS,
            abi: MOM_AIO_ABI_FULL,
            functionName: "sealResolution",
            args: [assertionId, resolutionHash, finalOutcomeHash],
          });
          await publicClient.waitForTransactionReceipt({ hash: tx3 });
          txHashes.push(tx3);
        }
      } catch (e) {
        console.error("sealResolution error:", e);
      }
    }

    // ─── Update DB with tx hash ────────────────

    if (txHashes.length > 0) {
      await supabase
        .from("aio_assertions")
        .update({ onchain_tx_hash: txHashes[0] })
        .eq("id", assertion_id);
    }

    return NextResponse.json({
      success: true,
      assertion_id,
      tx_hashes: txHashes,
      seals: {
        assertion: assertionHash,
        rule: ruleHash,
        evidence: evidenceHash,
        llm_bundle: llmBundleHash,
        resolution: resolutionHash,
      },
    });
  } catch (error) {
    console.error("Seal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seal failed" },
      { status: 500 },
    );
  }
}
