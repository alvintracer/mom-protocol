"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  RiAlarmWarningLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiBrainLine,
  RiCheckboxCircleLine,
  RiFilter3Line,
  RiFlashlightLine,
  RiGiftLine,
  RiLightbulbLine,
  RiLineChartLine,
  RiLoader4Line,
  RiQuestionLine,
  RiShieldCheckLine,
  RiShieldStarLine,
  RiTimerLine,
} from "react-icons/ri";

import {

  AioEvidenceList,
  AioLlmResults,
  AioStatusPipeline,
} from "@/shared/components/aio/AioStatusPipeline";
import { useI18n } from "@/shared/i18n/LanguageProvider";
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
  verdict:
    | "supports"
    | "refutes"
    | "ambiguous"
    | "invalid_evidence"
    | "insufficient_evidence";
  confidence: number;
  reasoning_summary: string | null;
  created_at: string;
};



// ─── Component ──────────────────────────────────

export default function OracleDashboardPage() {
  const { dictionary, t } = useI18n();
  const aio = dictionary.aio;
  const pages = dictionary.pages;

  const [assertions, setAssertions] = useState<AssertionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [llmVerifications, setLlmVerifications] = useState<LlmRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [showAioExplainer, setShowAioExplainer] = useState(false);
  const [showVerifierRewards, setShowVerifierRewards] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "finalized" | "rejected">("all");
  const [finalizingIds, setFinalizingIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Fetch current user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  // ─── Stats ─────────────────────────────────
  const stats = useMemo(() => {
    const total = assertions.length;
    const pending = assertions.filter(
      (a) => ["submitted", "evidence_captured", "llm_verified", "challenge_period"].includes(a.status),
    ).length;
    const finalized = assertions.filter((a) => a.status === "finalized").length;
    const rejected = assertions.filter((a) => a.status === "rejected").length;
    return { total, pending, finalized, rejected };
  }, [assertions]);

  // ─── Filtered Assertions ───────────────────
  const filteredAssertions = useMemo(() => {
    if (filter === "all") return assertions;
    if (filter === "pending") return assertions.filter((a) => ["submitted", "evidence_captured", "llm_verified", "challenge_period"].includes(a.status));
    if (filter === "finalized") return assertions.filter((a) => a.status === "finalized");
    if (filter === "rejected") return assertions.filter((a) => a.status === "rejected");
    return assertions;
  }, [assertions, filter]);

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
      (supabase as any)
        .from("aio_llm_verifications")
        .select("*")
        .eq("assertion_id", assertionId)
        .order("created_at", { ascending: false }),
    ]);

    setEvidence((evRes.data as EvidenceRow[]) ?? []);
    setLlmVerifications((llmRes.data as LlmRow[]) ?? []);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAssertions();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAssertions]);

  useEffect(() => {
    if (!expandedId) return;

    const timer = window.setTimeout(() => {
      loadDetails(expandedId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [expandedId, loadDetails]);

  const handleRunVerification = useCallback(
    async (assertionId: string) => {
      setVerifyingIds((current) => new Set(current).add(assertionId));
      setVerifyNotice(null);

      try {
        const supabase = createClient();
        const { data, error } = await supabase.functions.invoke<{ error?: string }>(
          "aio-verify",
          {
            body: { assertion_id: assertionId },
          },
        );

        if (error || data?.error) {
          throw new Error(error?.message ?? data?.error ?? "aio_verify_failed");
        }

        setVerifyNotice(t(aio.llm.verificationStarted));
        await loadAssertions();
        if (expandedId === assertionId) {
          await loadDetails(assertionId);
        }
      } catch (error) {
        setVerifyNotice(error instanceof Error ? error.message : "aio_verify_failed");
      } finally {
        setVerifyingIds((current) => {
          const next = new Set(current);
          next.delete(assertionId);
          return next;
        });
      }
    },
    [aio.llm.verificationStarted, expandedId, loadAssertions, loadDetails, t],
  );

  const handleFinalize = useCallback(
    async (assertionId: string, outcome: string) => {
      setFinalizingIds((current) => new Set(current).add(assertionId));
      try {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).rpc("finalize_aio_assertion", {
          target_assertion_id: assertionId,
          outcome: outcome,
        });

        if (!error) {
          await loadAssertions();
          if (expandedId === assertionId) {
            await loadDetails(assertionId);
          }
        }
      } finally {
        setFinalizingIds((current) => {
          const next = new Set(current);
          next.delete(assertionId);
          return next;
        });
      }
    },
    [expandedId, loadAssertions, loadDetails],
  );

  const isFinalizable = (a: AssertionRow) =>
    a.status === "challenge_period" &&
    a.aggregate_verdict === "supports" &&
    currentUserId != null &&
    a.proposer_id === currentUserId;

  const aioFeatures = [
    {
      icon: <RiBrainLine className="size-5" />,
      title: t(pages.oracleFeature1Title),
      desc: t(pages.oracleFeature1Desc),
    },
    {
      icon: <RiLightbulbLine className="size-5" />,
      title: t(pages.oracleFeature2Title),
      desc: t(pages.oracleFeature2Desc),
    },
    {
      icon: <RiShieldStarLine className="size-5" />,
      title: t(pages.oracleFeature3Title),
      desc: t(pages.oracleFeature3Desc),
    },
  ];

  const verifierRewards = [
    t(pages.oracleReward1),
    t(pages.oracleReward3),
  ];

  return (
    <div className="space-y-6 px-4 py-6">
      {/* ─── Hero Section ─────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_50%,#334155_100%)] p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <RiShieldCheckLine className="size-6 text-blue-400" />
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                {t(pages.oracleTitle)}
              </h1>
            </div>
            <p className="mt-2 max-w-xl text-[15px] font-medium leading-6 text-zinc-300">
              {t(pages.oracleHeroSubtitle)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatChip
              label={t(pages.oracleStatsTotal)}
              value={stats.total}
              color="bg-blue-500/20 text-blue-300"
            />
            <StatChip
              label={t(pages.oracleStatsPending)}
              value={stats.pending}
              color="bg-amber-500/20 text-amber-300"
            />

            <StatChip
              label={t(pages.oracleStatsFinalized)}
              value={stats.finalized}
              color="bg-emerald-500/20 text-emerald-300"
            />
          </div>
        </div>
        {/* Terminal mode toggle */}
        <div className="mt-4 flex items-center justify-end">
          <Link
            href="/terminal"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-zinc-300 transition-all hover:bg-white/10 hover:text-white"
          >
            <span className="font-mono text-blue-400">&gt;_</span>
            Terminal Mode
          </Link>
        </div>
      </section>

      {/* ─── AIO Explainer (Collapsible) ──────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <button
          type="button"
          onClick={() => setShowAioExplainer((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
              <RiQuestionLine className="size-5" />
            </div>
            <span className="text-[15px] font-black text-foreground">
              {t(pages.oracleWhatIsTitle)}
            </span>
          </div>
          {showAioExplainer ? (
            <RiArrowUpSLine className="size-5 text-muted-foreground" />
          ) : (
            <RiArrowDownSLine className="size-5 text-muted-foreground" />
          )}
        </button>

        {showAioExplainer ? (
          <div className="border-t border-border px-5 pb-5 pt-4">
            <p className="text-sm font-medium leading-6 text-muted-foreground">
              {t(pages.oracleWhatIsBody)}
            </p>

            {/* AIO Pipeline Visual */}
            <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-0">
              {["근거 URL 제출", "출처·원문 추출", "다중 AI 교차검증", "확정 및 보상"].map(
                (step, idx) => (
                  <div key={step} className="flex items-center gap-0 sm:flex-1">
                    <div className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border bg-zinc-50 text-xs font-black text-foreground dark:bg-zinc-900/50 sm:rounded-none sm:first:rounded-l-lg sm:last:rounded-r-lg">
                      {step}
                    </div>
                    {idx < 3 ? (
                      <div className="hidden h-px w-3 bg-border sm:block" />
                    ) : null}
                  </div>
                ),
              )}
            </div>

            {/* Feature Cards */}
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {aioFeatures.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-border bg-zinc-50 p-4 dark:bg-zinc-900/50"
                >
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    {f.icon}
                    <h3 className="text-sm font-black text-foreground">{f.title}</h3>
                  </div>
                  <p className="mt-2 text-xs font-medium leading-5 text-muted-foreground">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* ─── Verifier Rewards (Collapsible) ───── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <button
          type="button"
          onClick={() => setShowVerifierRewards((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <RiGiftLine className="size-5" />
            </div>
            <span className="text-[15px] font-black text-foreground">
              {t(pages.oracleVerifierTitle)}
            </span>
          </div>
          {showVerifierRewards ? (
            <RiArrowUpSLine className="size-5 text-muted-foreground" />
          ) : (
            <RiArrowDownSLine className="size-5 text-muted-foreground" />
          )}
        </button>

        {showVerifierRewards ? (
          <div className="border-t border-border px-5 pb-5 pt-4">
            <p className="text-sm font-medium leading-5 text-muted-foreground">
              {t(pages.oracleVerifierDesc)}
            </p>
            <div className="mt-4 space-y-2">
              {verifierRewards.map((reward, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-xl border border-border bg-zinc-50 p-3 dark:bg-zinc-900/50"
                >
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-black text-emerald-600">
                    {idx + 1}
                  </div>
                  <p className="text-sm font-bold text-foreground">{reward}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* ─── Verification Cost ────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="flex items-center gap-4 px-5 py-4">
          <div className="flex size-9 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <RiAlarmWarningLine className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-black text-foreground">
              {t(pages.oracleVerificationCostTitle)}
            </h3>
            <p className="mt-1 text-sm font-medium leading-5 text-muted-foreground">
              {t(pages.oracleVerificationCostDesc)}
            </p>
          </div>
          <div className="shrink-0 rounded-full border border-amber-300/40 bg-amber-500/10 px-4 py-2 text-sm font-black text-amber-600">
            {t(pages.oracleVerificationCostValue)}
          </div>
        </div>
      </section>

      {/* ─── Assertions List ──────────────────── */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <RiLineChartLine className="size-5 text-blue-600" />
            <h2 className="text-xl font-black text-foreground">
              {t(aio.assertion.title)}
            </h2>
          </div>
          {verifyNotice ? (
            <p className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted-foreground">
              {verifyNotice}
            </p>
          ) : null}
        </div>

        {/* Filter Tabs */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <RiFilter3Line className="size-4 text-muted-foreground" />
          {([
            { key: "all", label: `All (${stats.total})` },
            { key: "pending", label: `${t(pages.oracleStatsPending)} (${stats.pending})` },
            { key: "finalized", label: `${t(dictionary.aio.status.finalized)} (${stats.finalized})` },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors ${
                filter === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-muted-foreground hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RiLoader4Line className="size-6 animate-spin text-blue-500" />
          </div>
        ) : filteredAssertions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-12 text-center">
            <RiShieldCheckLine className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              {t(aio.assertion.empty)}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAssertions.map((a) => (
              <article
                key={a.id}
                className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-colors"
              >
                {/* Header */}
                <button
                  onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={a.status} />
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {a.asserted_outcome.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-2 text-[14px] font-bold leading-5 text-foreground">
                      {a.claim_text}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
                      <span>{a.proposer?.display_name || a.proposer?.handle || "—"}</span>
                      <span>·</span>
                      <span>{new Date(a.created_at).toLocaleDateString()}</span>
                      {a.rule && (
                        <>
                          <span>·</span>
                          <span className="truncate">{a.rule.question}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="hidden shrink-0 items-end gap-3 sm:flex">
                    <AioStatusPipeline status={a.status as Parameters<typeof AioStatusPipeline>[0]["status"]} />
                  </div>
                </button>

                {/* Expanded detail */}
                {expandedId === a.id && (
                  <div className="border-t border-border bg-zinc-50/50 p-4 dark:bg-zinc-900/10">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <RiLoader4Line className="size-5 animate-spin text-blue-500" />
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {/* Mobile pipeline */}
                        <div className="sm:hidden">
                          <AioStatusPipeline status={a.status as Parameters<typeof AioStatusPipeline>[0]["status"]} />
                        </div>

                        {/* Evidence */}
                        <div>
                          <h3 className="mb-2 text-[13px] font-black text-foreground">
                            {t(aio.evidence.title)}
                          </h3>
                          <AioEvidenceList items={evidence} />
                        </div>

                        {/* LLM Verifications */}
                        <div>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-[13px] font-black text-foreground">
                              {t(aio.llm.title)}
                            </h3>
                            <button
                              type="button"
                              onClick={() => handleRunVerification(a.id)}
                              disabled={verifyingIds.has(a.id)}
                              className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-xs font-black text-foreground transition-colors hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {verifyingIds.has(a.id) ? (
                                <RiLoader4Line className="size-4 animate-spin" />
                              ) : (
                                <RiFlashlightLine className="size-4 text-blue-600" />
                              )}
                              {llmVerifications.length > 0
                                ? t(aio.llm.rerunVerification)
                                : t(aio.llm.runVerification)}
                            </button>
                          </div>
                          <AioLlmResults verifications={llmVerifications} />
                        </div>


                        {/* Finalize Button */}
                        {isFinalizable(a) && (
                          <button
                            type="button"
                            disabled={finalizingIds.has(a.id)}
                            onClick={() => handleFinalize(a.id, a.asserted_outcome)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-4 py-3 text-sm font-black text-emerald-600 transition-colors hover:bg-emerald-500/10"
                          >
                            {finalizingIds.has(a.id) ? (
                              <RiLoader4Line className="size-4 animate-spin" />
                            ) : (
                              <RiCheckboxCircleLine className="size-4" />
                            )}
                            {finalizingIds.has(a.id) ? t(aio.resolution.finalizing) : t(aio.resolution.finalize)}
                            <span className="text-[11px] font-medium text-emerald-400">→ {a.asserted_outcome.toUpperCase()}</span>
                          </button>
                        )}

                        {/* Resolution */}
                        {a.finalized_outcome && (
                          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4">
                            <h3 className="text-[13px] font-black text-emerald-700 dark:text-emerald-400">
                              {t(aio.resolution.title)}
                            </h3>
                            <p className="mt-1 text-lg font-black text-foreground">
                              {a.finalized_outcome.toUpperCase()}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${color}`}>
      <span className="tabular-nums">{value}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { dictionary, t } = useI18n();
  const config: Record<string, { color: string; label: string }> = {
    submitted: { color: "bg-blue-500/10 text-blue-600", label: t(dictionary.aio.status.submitted) },
    evidence_captured: { color: "bg-cyan-500/10 text-cyan-600", label: t(dictionary.aio.status.evidenceCaptured) },
    llm_verified: { color: "bg-indigo-500/10 text-indigo-600", label: t(dictionary.aio.status.llmVerified) },
    challenge_period: { color: "bg-indigo-500/10 text-indigo-600", label: t(dictionary.aio.status.llmVerified) },
    finalized: { color: "bg-emerald-500/10 text-emerald-600", label: t(dictionary.aio.status.finalized) },
    rejected: { color: "bg-rose-500/10 text-rose-600", label: t(dictionary.aio.status.rejected) },
  };

  const c = config[status] ?? { color: "bg-zinc-500/10 text-zinc-600", label: status };

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${c.color}`}>
      {c.label}
    </span>
  );
}
