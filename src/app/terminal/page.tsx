"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/shared/lib/supabase/client";

// ─── Types ──────────────────────────────────────

type AssertionRow = {
  id: string;
  claim_text: string;
  asserted_outcome: string;
  status: string;
  bond_amount: number;
  aggregate_verdict: string | null;
  aggregate_confidence: number | null;
  finalized_outcome: string | null;
  created_at: string;
  proposer_id: string | null;
  proposer: { handle: string | null; display_name: string | null } | null;
  rule: { question: string; title: string } | null;
  event: { title: string } | null;
};

type RuleRow = {
  id: string;
  event_id: string;
  title: string;
  question: string;
  supported_outcomes: string[];
  bond_amount: number;
  status: string;
};

type EvidenceRow = {
  id: string;
  url: string;
  title: string | null;
  publisher: string | null;
  publisher_domain: string | null;
  publisher_trust_weight: number | null;
  content_hash: string | null;
  captured_at: string;
};

type LlmRow = {
  id: string;
  model_id: string;
  provider: string;
  verdict: string;
  confidence: number;
  reasoning_summary: string | null;
  created_at: string;
};

// ─── Helpers ────────────────────────────────────

function truncHash(s: string, len = 8) {
  return s.length > len ? s.slice(0, len) + "…" : s;
}

function pad(s: string, len: number) {
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

const STATUS_ICONS: Record<string, string> = {
  submitted: "[▪]",
  evidence_captured: "[◆]",
  llm_verified: "[✓]",
  challenge_period: "[✓]",
  finalized: "[●]",
  rejected: "[✗]",
};

const VERDICT_CHARS: Record<string, string> = {
  supports: "PASS",
  refutes: "FAIL",
  ambiguous: "AMBG",
  invalid_evidence: "INVL",
  insufficient_evidence: "INSF",
};

// ─── Component ──────────────────────────────────

export default function TerminalOraclePage() {
  const [assertions, setAssertions] = useState<AssertionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [llmVerifications, setLlmVerifications] = useState<LlmRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [clock, setClock] = useState("");
  const [cursorBlink, setCursorBlink] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  // Submit form state
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [submitOutcome, setSubmitOutcome] = useState("");
  const [submitClaim, setSubmitClaim] = useState("");
  const [submitUrls, setSubmitUrls] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setCursorBlink((v) => !v), 530);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const total = assertions.length;
    const pending = assertions.filter((a) => ["submitted", "evidence_captured", "llm_verified", "challenge_period"].includes(a.status)).length;
    const finalized = assertions.filter((a) => a.status === "finalized").length;
    return { total, pending, finalized };
  }, [assertions]);

  const loadAssertions = useCallback(async () => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("aio_assertions")
      .select("*, proposer:profiles!proposer_id(handle, display_name), rule:attention_rules!rule_id(question, title), event:events!event_id(title)")
      .order("created_at", { ascending: false })
      .limit(20);
    setAssertions((data as AssertionRow[]) ?? []);
    setLoading(false);
  }, []);

  const loadDetails = useCallback(async (assertionId: string) => {
    setDetailLoading(true);
    const supabase = createClient();
    const [evRes, llmRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("aio_evidence_items").select("*").eq("assertion_id", assertionId).order("created_at"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("aio_llm_verifications").select("*").eq("assertion_id", assertionId).order("created_at", { ascending: false }),
    ]);
    setEvidence((evRes.data as EvidenceRow[]) ?? []);
    setLlmVerifications((llmRes.data as LlmRow[]) ?? []);
    setDetailLoading(false);
  }, []);

  // Fetch current user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  // Load active rules for submit form
  const loadRules = useCallback(async () => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("attention_rules")
      .select("id, event_id, title, question, supported_outcomes, bond_amount, status")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(20);
    setRules((data as RuleRow[]) ?? []);
  }, []);

  const handleFinalize = useCallback(async (assertionId: string, outcome: string) => {
    setFinalizingId(assertionId);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("finalize_aio_assertion", {
        target_assertion_id: assertionId,
        outcome: outcome,
      });
      await loadAssertions();
      if (expandedId === assertionId) await loadDetails(assertionId);
    } finally {
      setFinalizingId(null);
    }
  }, [expandedId, loadAssertions, loadDetails]);

  const handleVerify = useCallback(async (assertionId: string) => {
    setVerifyingId(assertionId);
    try {
      const supabase = createClient();
      await supabase.functions.invoke("aio-verify", {
        body: { assertion_id: assertionId },
      });
      await loadAssertions();
      if (expandedId === assertionId) await loadDetails(assertionId);
    } finally {
      setVerifyingId(null);
    }
  }, [expandedId, loadAssertions, loadDetails]);

  const handleSubmitAssertion = useCallback(async () => {
    if (!selectedRuleId || !submitOutcome || submitClaim.trim().length < 10) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const rule = rules.find((r) => r.id === selectedRuleId);
      if (!rule) throw new Error("rule_not_found");
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: assertionId, error } = await (supabase as any).rpc("submit_aio_assertion", {
        p_event_id: rule.event_id,
        p_rule_id: rule.id,
        p_claim_text: submitClaim.trim(),
        p_asserted_outcome: submitOutcome,
        p_original_language: "ko",
      });
      if (error) throw new Error(error.message);
      // Submit evidence URLs if provided
      const urls = submitUrls.split("\n").map((u) => u.trim()).filter((u) => u.startsWith("http"));
      if (urls.length > 0 && assertionId) {
        await supabase.functions.invoke("aio-verify", {
          body: { assertion_id: assertionId, evidence_urls: urls },
        });
      }
      setSubmitResult(`OK assertion_id=${typeof assertionId === "string" ? assertionId.slice(0, 16) : assertionId}`);
      setSubmitClaim("");
      setSubmitOutcome("");
      setSubmitUrls("");
      await loadAssertions();
    } catch (err) {
      setSubmitResult(`ERR ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setSubmitting(false);
    }
  }, [selectedRuleId, submitOutcome, submitClaim, submitUrls, rules, loadAssertions]);

  useEffect(() => { loadAssertions(); }, [loadAssertions]);
  useEffect(() => { if (expandedId) loadDetails(expandedId); }, [expandedId, loadDetails]);
  useEffect(() => { if (showSubmitForm) loadRules(); }, [showSubmitForm, loadRules]);

  return (
    <div className="px-4 py-5 sm:px-6 ">
      {/* Header */}
      <header className="mb-6">
        <pre className="t-bright text-[9px] leading-tight sm:text-[11px]" >
{` ███╗   ███╗ ██████╗ ███╗   ███╗     ██████╗ ██████╗  █████╗  ██████╗██╗     ███████╗
 ████╗ ████║██╔═══██╗████╗ ████║    ██╔═══██╗██╔══██╗██╔══██╗██╔════╝██║     ██╔════╝
 ██╔████╔██║██║   ██║██╔████╔██║    ██║   ██║██████╔╝███████║██║     ██║     █████╗  
 ██║╚██╔╝██║██║   ██║██║╚██╔╝██║    ██║   ██║██╔══██╗██╔══██║██║     ██║     ██╔══╝  
 ██║ ╚═╝ ██║╚██████╔╝██║ ╚═╝ ██║    ╚██████╔╝██║  ██║██║  ██║╚██████╗███████╗███████╗
 ╚═╝     ╚═╝ ╚═════╝ ╚═╝     ╚═╝     ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚══════╝`}
        </pre>
        <div className="mt-2 flex items-center justify-between text-[10px]">
          <span className="t-dim">momment. Oracle v0.1</span>
          <span className="t-dim">{clock}</span>
        </div>
        <div className="mt-1 h-px t-bg2" />
      </header>

      {/* System Status */}
      <section className="mb-6">
        <div className="text-[11px] t-bright" >
          <span className="t-dim">$</span> system.status
          <span className={`ml-1 ${cursorBlink ? "opacity-100" : "opacity-0"}`}>█</span>
        </div>
        <div className="mt-2 border t-border p-3">
          <div className="grid grid-cols-3 gap-4 text-[11px]">
            <div>
              <span className="t-dim">ASSERTIONS</span><br />
              <span className="t-bright text-sm font-bold" >{loading ? "..." : stats.total}</span>
            </div>
            <div>
              <span className="t-dim">PENDING</span><br />
              <span className="t-amber text-sm font-bold">{loading ? "..." : stats.pending}</span>
            </div>
            <div>
              <span className="t-dim">FINALIZED</span><br />
              <span className="t-cyan text-sm font-bold">{loading ? "..." : stats.finalized}</span>
            </div>
          </div>
          <div className="mt-3 h-px t-bg2" />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] t-dim">
            <span>NET: giwa-sepolia</span>
            <span>PROTO: AIO/adaptive-2+1</span>
            <span>BOND: MOM_POINT</span>
          </div>
        </div>
      </section>

      {/* On-chain Contract */}
      <section className="mb-6">
        <div className="text-[11px] t-bright">
          <span className="t-dim">$</span> contract.info
        </div>
        <div className="mt-2 border t-border p-3 text-[10px] space-y-1">
          <div>
            <span className="t-dim">AIO_ORACLE  </span>
            <a href={`${process.env.NEXT_PUBLIC_GIWA_EXPLORER_URL || "https://sepolia-explorer.giwa.io"}/address/${process.env.NEXT_PUBLIC_AIO_ORACLE_ADDRESS || "0x7482f2b8d5c85de8037145a6b0282be66163ae8a"}`} target="_blank" rel="noopener noreferrer" className="t-blue hover:underline">
              {(process.env.NEXT_PUBLIC_AIO_ORACLE_ADDRESS || "0x7482f2b8d5c85de8037145a6b0282be66163ae8a").slice(0, 22)}...
            </a>
          </div>
          <div>
            <span className="t-dim">MOCK_USDC   </span>
            <a href={`${process.env.NEXT_PUBLIC_GIWA_EXPLORER_URL || "https://sepolia-explorer.giwa.io"}/address/${process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "0xbe39d68b83b32c35a9800ab15b785e848e706528"}`} target="_blank" rel="noopener noreferrer" className="t-blue hover:underline">
              {(process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "0xbe39d68b83b32c35a9800ab15b785e848e706528").slice(0, 22)}...
            </a>
          </div>
          <div>
            <span className="t-dim">VERSION     </span>
            <span className="t-bright">v0.1</span>
            <span className="t-dim ml-3">SEAL: auto</span>
            <span className="t-dim ml-3">OWNER: master</span>
          </div>
        </div>
      </section>

      {/* Assertions */}
      <section>
        <div className="text-[11px] t-bright mb-2" >
          <span className="t-dim">$</span> aio.list --recent 20
        </div>

        {loading ? (
          <div className="py-8 text-center text-[11px] t-dim">
            Loading...<span className="animate-pulse">█</span>
          </div>
        ) : assertions.length === 0 ? (
          <div className="border t-border p-6 text-center text-[11px] t-dim">
            No assertions found. Run `aio.submit` to begin.
          </div>
        ) : (
          <div className="border t-border overflow-hidden">
            {/* Header row */}
            <div className="flex gap-2 border-b t-border t-bg px-3 py-1.5 text-[10px] t-dim">
              <span className="w-10">STS</span>
              <span className="w-12">OUT</span>
              <span className="flex-1">CLAIM</span>
              <span className="hidden sm:block w-24">PROPOSER</span>
              <span className="w-20 text-right">DATE</span>
            </div>

            {assertions.map((a) => (
              <div key={a.id}>
                <button
                  onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  className="flex w-full gap-2 px-3 py-2 text-left text-[11px] transition-colors hover:bg-[rgba(59,130,246,0.04)]"
                >
                  <span className="w-10 shrink-0">
                    <span className={a.status === "finalized" ? "t-cyan" : a.status === "rejected" ? "t-red" : "t-amber"}>
                      {STATUS_ICONS[a.status] ?? `[${a.status.charAt(0).toUpperCase()}]`}
                    </span>
                  </span>
                  <span className="w-12 shrink-0 font-bold t-bright" >
                    {a.asserted_outcome.toUpperCase().slice(0, 4)}
                  </span>
                  <span className="flex-1 truncate t-white" >
                    {a.claim_text}
                  </span>
                  <span className="hidden sm:block w-24 shrink-0 truncate t-dim">
                    {a.proposer?.handle ?? a.proposer?.display_name ?? "—"}
                  </span>
                  <span className="w-20 shrink-0 text-right t-dim">
                    {new Date(a.created_at).toISOString().slice(2, 10).replace(/-/g, ".")}
                  </span>
                </button>

                {/* Expanded Detail */}
                {expandedId === a.id && (
                  <div className="border-t t-border t-bg px-3 py-3">
                    {detailLoading ? (
                      <div className="py-4 text-[10px] t-dim">Fetching...<span className="animate-pulse">█</span></div>
                    ) : (
                      <div className="space-y-4">
                        {/* Meta */}
                        <div className="text-[10px] space-y-0.5">
                          <Row label="ID" value={truncHash(a.id, 16)} />
                          <Row label="STATUS" value={a.status === "challenge_period" ? "LLM_VERIFIED" : a.status.toUpperCase()} cls={a.status === "finalized" ? "t-cyan" : a.status === "rejected" ? "t-red" : "t-amber"} />
                          <Row label="OUTCOME" value={a.asserted_outcome.toUpperCase()} bold />
                          {a.rule && <Row label="RULE" value={a.rule.question.slice(0, 60)} />}
                          {a.finalized_outcome && <Row label="FINAL" value={`${a.finalized_outcome.toUpperCase()} OK`} cls="t-cyan" bold />}
                        </div>

                        {/* Pipeline */}
                        <div>
                          <div className="text-[10px] t-dim mb-1">--- PIPELINE ---</div>
                          <div className="flex items-center gap-0 text-[10px]">
                            {["submitted", "evidence_captured", "llm_verified", "finalized"].map((step, idx) => {
                              const order = ["submitted", "evidence_captured", "llm_verified", "finalized"];
                              const normalizedStatus = a.status === "challenge_period" ? "llm_verified" : a.status;
                              const done = order.indexOf(step) <= order.indexOf(normalizedStatus) || a.status === "finalized";
                              return (
                                <span key={step} className="flex items-center">
                                  {idx > 0 && <span className={`mx-0.5 ${done ? "t-bright" : "t-dim"}`} style={done ? { textShadow: "0 0 5px rgba(255,255,255,0.15)" } : {}}>--</span>}
                                  <span className={done ? "t-cyan" : "t-dim"}>{done ? "[#]" : "[ ]"}</span>
                                </span>
                              );
                            })}
                          </div>
                          <div className="flex gap-0 text-[8px] t-dim mt-0.5">
                            <span className="w-[24px] text-center">SUB</span>
                            <span className="w-[18px]" />
                            <span className="w-[24px] text-center">EVI</span>
                            <span className="w-[18px]" />
                            <span className="w-[24px] text-center">LLM</span>
                            <span className="w-[18px]" />
                            <span className="w-[24px] text-center">FIN</span>
                          </div>
                        </div>

                        {/* Evidence */}
                        <div>
                          <div className="text-[10px] t-dim mb-1">--- EVIDENCE ({evidence.length}) ---</div>
                          {evidence.length === 0 ? (
                            <div className="text-[10px] t-dim">No evidence captured.</div>
                          ) : (
                            <div className="space-y-1">
                              {evidence.map((ev) => (
                                <div key={ev.id} className="text-[10px] border-l-2 t-border pl-2">
                                  <div className="t-bright" >{ev.title || ev.url}</div>
                                  <div className="t-dim flex flex-wrap gap-3">
                                    <span>src: {ev.publisher_domain ?? "unknown"}</span>
                                    {ev.content_hash && <span>hash: {truncHash(ev.content_hash)}</span>}
                                    {ev.publisher_trust_weight != null && <span>trust: {(ev.publisher_trust_weight * 100).toFixed(0)}%</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* LLM Verification */}
                        <div>
                          <div className="text-[10px] t-dim mb-1">--- LLM VERIFY ({llmVerifications.length}) ---</div>
                          {llmVerifications.length === 0 ? (
                            <div className="text-[10px] t-dim">Pending verification.</div>
                          ) : (
                            <div className="text-[10px]">
                              <div className="t-dim">{pad("PROVIDER", 10)}{pad("MODEL", 20)}{pad("VRDT", 6)}{pad("CONF", 6)}REASON</div>
                              <div className="h-px t-bg2 my-0.5" />
                              {llmVerifications.map((v) => (
                                <div key={v.id} className="flex">
                                  <span className="t-dim w-[10ch] shrink-0">{v.provider}</span>
                                  <span className="t-bright w-[20ch] shrink-0 truncate" >{v.model_id}</span>
                                  <span className={`w-[6ch] shrink-0 font-bold ${v.verdict === "supports" ? "t-cyan" : v.verdict === "refutes" ? "t-red" : "t-amber"}`}>
                                    {VERDICT_CHARS[v.verdict] ?? v.verdict.slice(0, 4).toUpperCase()}
                                  </span>
                                  <span className="t-bright w-[6ch] shrink-0" >{v.confidence.toFixed(0)}%</span>
                                  <span className="t-dim flex-1 truncate">{v.reasoning_summary?.slice(0, 70) ?? "—"}</span>
                                </div>
                              ))}
                              {llmVerifications.length >= 2 && (
                                <>
                                  <div className="h-px t-bg2 my-0.5" />
                                  <div className="t-dim">
                                    consensus: {llmVerifications.length}/{llmVerifications.length}
                                    <span className={`ml-2 font-bold ${llmVerifications.every((v) => v.verdict === llmVerifications[0].verdict) ? "t-cyan" : "t-amber"}`}>
                                      {llmVerifications.every((v) => v.verdict === llmVerifications[0].verdict) ? "UNANIMOUS" : "SPLIT"}
                                    </span>
                                    <span className="ml-2">
                                      avg: {(llmVerifications.reduce((s, v) => s + v.confidence, 0) / llmVerifications.length).toFixed(1)}%
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* ─── Action Buttons ─── */}
                        <div className="flex flex-wrap gap-2 mt-1">
                          {/* Re-verify */}
                          <button
                            onClick={() => handleVerify(a.id)}
                            disabled={verifyingId === a.id}
                            className="border t-border px-2 py-1 text-[10px] t-blue hover:t-bg2 transition-colors disabled:opacity-40"
                          >
                            {verifyingId === a.id ? "[...] VERIFYING" : "[⚡] aio.verify"}
                          </button>
                          {/* Finalize — proposer only */}
                          {(a.status === "llm_verified" || a.status === "challenge_period") &&
                            currentUserId && a.proposer_id === currentUserId && (
                            <button
                              onClick={() => handleFinalize(a.id, a.asserted_outcome)}
                              disabled={finalizingId === a.id}
                              className="border t-border px-2 py-1 text-[10px] t-cyan hover:t-bg2 transition-colors disabled:opacity-40"
                            >
                              {finalizingId === a.id ? "[...] FINALIZING" : `[●] aio.finalize → ${a.asserted_outcome.toUpperCase()}`}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Submit Form ─── */}
      <section className="mt-6">
        <button
          onClick={() => setShowSubmitForm((v) => !v)}
          className="text-[11px] t-bright"
        >
          <span className="t-dim">$</span> aio.submit {showSubmitForm ? "--collapse" : "--new"}
        </button>

        {showSubmitForm && (
          <div className="mt-2 border t-border p-3 space-y-3">
            {!currentUserId ? (
              <div className="text-[10px] t-red">ERR: login required</div>
            ) : (
              <>
                {/* Rule select */}
                <div>
                  <div className="text-[10px] t-dim mb-1">RULE_ID (select):</div>
                  <select
                    value={selectedRuleId}
                    onChange={(e) => {
                      setSelectedRuleId(e.target.value);
                      setSubmitOutcome("");
                    }}
                    className="w-full bg-transparent border t-border text-[10px] t-bright px-2 py-1 outline-none"
                  >
                    <option value="">-- select rule --</option>
                    {rules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title || r.question.slice(0, 50)} (bond: {r.bond_amount})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Outcome */}
                {selectedRuleId && (() => {
                  const rule = rules.find((r) => r.id === selectedRuleId);
                  if (!rule) return null;
                  return (
                    <div>
                      <div className="text-[10px] t-dim mb-1">OUTCOME:</div>
                      <div className="flex gap-2">
                        {(rule.supported_outcomes as string[])
                          .filter((o) => o.toLowerCase() !== "ambiguous")
                          .map((o) => (
                          <button
                            key={o}
                            onClick={() => setSubmitOutcome(o)}
                            className={`border px-2 py-0.5 text-[10px] font-bold transition-colors ${
                              submitOutcome === o ? "t-border t-cyan" : "t-border t-dim hover:t-bright"
                            }`}
                          >
                            {o.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Claim */}
                <div>
                  <div className="text-[10px] t-dim mb-1">CLAIM_TEXT:</div>
                  <textarea
                    value={submitClaim}
                    onChange={(e) => setSubmitClaim(e.target.value)}
                    placeholder="assertion claim (min 10 chars)"
                    rows={2}
                    className="w-full bg-transparent border t-border text-[10px] t-bright px-2 py-1 outline-none resize-none placeholder:t-dim"
                  />
                </div>

                {/* Evidence URLs */}
                <div>
                  <div className="text-[10px] t-dim mb-1">EVIDENCE_URLS (one per line):</div>
                  <textarea
                    value={submitUrls}
                    onChange={(e) => setSubmitUrls(e.target.value)}
                    placeholder="https://..."
                    rows={2}
                    className="w-full bg-transparent border t-border text-[10px] t-bright px-2 py-1 outline-none resize-none placeholder:t-dim font-mono"
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmitAssertion}
                  disabled={submitting || !selectedRuleId || !submitOutcome || submitClaim.trim().length < 10}
                  className="border t-border px-3 py-1 text-[10px] t-cyan hover:t-bg2 transition-colors disabled:opacity-30"
                >
                  {submitting ? "[...] SUBMITTING" : "[►] EXECUTE aio.submit"}
                </button>

                {submitResult && (
                  <div className={`text-[10px] ${submitResult.startsWith("OK") ? "t-cyan" : "t-red"}`}>
                    {submitResult}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-8 text-[9px] t-dim">
        <div className="h-px t-bg2 mb-2" />
        <div className="flex justify-between">
          <span>momment. AIO Protocol</span>
          <span>giwa-sepolia</span>
        </div>
      </footer>
    </div>
  );
}

// Helper sub-component
function Row({ label, value, cls, bold }: { label: string; value: string; cls?: string; bold?: boolean }) {
  return (
    <div>
      <span className="t-dim">{label.padEnd(8)}</span>
      <span className={`${cls ?? "t-bright"} ${bold ? "font-bold" : ""}`} >
        {value}
      </span>
    </div>
  );
}
