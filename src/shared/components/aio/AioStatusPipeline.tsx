"use client";

import { useState } from "react";

import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiFlashlightLine,
  RiLoader4Line,
  RiQuestionLine,
  RiShieldCheckLine,
  RiTimerLine,
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";

// ─── Types ───────────────────────────────────────

type AssertionStatus =
  | "draft"
  | "builder_verification_window"
  | "open_verification_window"
  | "submitted"
  | "evidence_captured"
  | "llm_verified"
  | "finalized"
  | "rejected"
  | "cancelled";

type Verdict =
  | "supports"
  | "refutes"
  | "ambiguous"
  | "invalid_evidence"
  | "insufficient_evidence";

type LlmVerification = {
  id: string;
  model_id: string;
  provider: string;
  verdict: Verdict;
  confidence: number;
  reasoning_summary: string | null;
};

type EvidenceItem = {
  id: string;
  url: string;
  title: string | null;
  publisher: string | null;
  publisher_domain: string | null;
  publisher_trust_weight: number | null;
  content_hash: string | null;
  captured_at: string;
};



// ─── 1. Status Pipeline ───────────────────────────

const PIPELINE_STEPS: AssertionStatus[] = [
  "builder_verification_window",
  "open_verification_window",
  "evidence_captured",
  "llm_verified",
  "finalized",
];

export function AioStatusPipeline({ status }: { status: AssertionStatus }) {
  const { dictionary, t } = useI18n();
  const s = dictionary.aio.status;

  const statusLabels: Record<string, string> = {
    builder_verification_window: t(s.builderVerification),
    open_verification_window: t(s.openVerification),
    submitted: t(s.submitted),
    evidence_captured: t(s.evidenceCaptured),
    llm_verified: t(s.llmVerified),
    finalized: t(s.finalized),
  };

  const displayStatus =
    status === "submitted"
      ? "evidence_captured"
      : status === "rejected" || status === "cancelled"
        ? "llm_verified"
        : status;
  const currentIdx = PIPELINE_STEPS.indexOf(displayStatus);
  const isRejected = status === "rejected";

  return (
    <div className="flex items-center gap-1">
      {PIPELINE_STEPS.map((step, idx) => {
        const isDone = idx < currentIdx || status === "finalized";
        const isCurrent = idx === currentIdx;
        const isError = isCurrent && isRejected;

        return (
          <div key={step} className="flex items-center gap-1">
            {idx > 0 && (
              <div className={`h-0.5 w-4 rounded-full ${isDone ? "bg-emerald-500" : "bg-border"}`} />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`flex size-6 items-center justify-center rounded-full text-[10px] font-black ${
                  isError
                    ? "bg-rose-500/10 text-rose-600"
                    : isDone
                      ? "bg-emerald-500/10 text-emerald-600"
                      : isCurrent
                        ? "bg-blue-500/10 text-blue-600 ring-2 ring-blue-500/30"
                        : "bg-zinc-100 text-muted-foreground dark:bg-zinc-800"
                }`}
              >
                {isError ? (
                  <RiCloseCircleLine className="size-3.5" />
                ) : isDone ? (
                  <RiCheckboxCircleLine className="size-3.5" />
                ) : isCurrent ? (
                  <RiLoader4Line className="size-3.5 animate-spin" />
                ) : (
                  idx + 1
                )}
              </div>
              <span className="max-w-[60px] text-center text-[8px] font-bold leading-tight text-muted-foreground">
                {statusLabels[step] ?? step}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 2. Evidence List ────────────────────────────

export function AioEvidenceList({ items }: { items: EvidenceItem[] }) {
  const { dictionary, t } = useI18n();
  const e = dictionary.aio.evidence;

  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-sm font-medium text-muted-foreground">
        {t(e.pending)}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-border/60 bg-zinc-50/50 p-3 dark:bg-zinc-900/20"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-foreground">
                {item.title || item.url}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                {item.publisher_domain || item.publisher}
              </p>
            </div>
            {item.content_hash && (
              <span className="shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-black text-emerald-600">
                {t(e.captured)}
              </span>
            )}
          </div>
          {item.publisher_trust_weight != null && (
            <div className="mt-1.5 flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
              <span>{t(e.trustWeight)}: {(item.publisher_trust_weight * 100).toFixed(0)}%</span>
              {item.content_hash && (
                <span className="truncate font-mono text-[9px]">#{item.content_hash.slice(0, 8)}</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── 3. LLM Verification Results ────────────────

export function AioLlmResults({ verifications }: { verifications: LlmVerification[] }) {
  const { dictionary, t } = useI18n();
  const l = dictionary.aio.llm;

  if (verifications.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm font-medium text-muted-foreground">
        <RiLoader4Line className="size-4 animate-spin" />
        {t(l.pending)}
      </div>
    );
  }

  const verdictConfig: Record<Verdict, { color: string; label: string }> = {
    supports: { color: "text-emerald-600 bg-emerald-500/10", label: t(l.supports) },
    refutes: { color: "text-rose-600 bg-rose-500/10", label: t(l.refutes) },
    ambiguous: { color: "text-amber-600 bg-amber-500/10", label: t(l.ambiguous) },
    invalid_evidence: { color: "text-zinc-600 bg-zinc-500/10", label: t(l.invalidEvidence) },
    insufficient_evidence: { color: "text-zinc-600 bg-zinc-500/10", label: t(l.insufficientEvidence) },
  };

  return (
    <div className="space-y-2">
      {verifications.map((v) => {
        const vc = verdictConfig[v.verdict];
        return (
          <div key={v.id} className="rounded-xl border border-border/60 bg-zinc-50/50 p-3 dark:bg-zinc-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-muted-foreground">{v.provider}</span>
                <span className="text-[11px] font-medium text-muted-foreground">{v.model_id}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${vc.color}`}>
                {vc.label}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center gap-1">
                <RiFlashlightLine className="size-3 text-blue-500" />
                <span className="text-[11px] font-black tabular-nums text-foreground">
                  {v.confidence.toFixed(0)}%
                </span>
              </div>
              {v.reasoning_summary && (
                <p className="flex-1 truncate text-[11px] font-medium text-muted-foreground">
                  {v.reasoning_summary}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 5. Rule Summary Card ────────────────────────

export function AioRuleSummary({
  rule,
}: {
  rule: {
    question: string;
    resolution_criteria: string;
    supported_outcomes: string[];
    challenge_period_seconds: number;
    min_evidence_count: number;
    bond_amount: number;
  } | null;
}) {
  const { dictionary, t } = useI18n();
  const r = dictionary.aio.rule;

  if (!rule) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-zinc-50/50 px-4 py-6 dark:bg-zinc-900/20">
        <RiQuestionLine className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">{t(r.noRule)}</p>
      </div>
    );
  }

  const challengeHours = Math.round(rule.challenge_period_seconds / 3600);

  return (
    <div className="space-y-3 rounded-2xl border border-border/80 bg-background p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <RiShieldCheckLine className="size-4 text-blue-500" />
        <h3 className="text-[14px] font-black text-foreground">{t(r.question)}</h3>
      </div>
      <p className="text-[13px] font-medium leading-5 text-foreground">{rule.question}</p>

      <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
        <p className="text-[11px] font-black text-muted-foreground">{t(r.criteria)}</p>
        <p className="mt-1 text-[12px] font-medium leading-5 text-foreground">
          {rule.resolution_criteria}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <RuleStat icon={<RiTimerLine className="size-3.5" />} label={t(r.challengeWindow)} value={`${challengeHours}${t(r.hours)}`} />
        <RuleStat icon={<RiShieldCheckLine className="size-3.5" />} label={t(r.minEvidence)} value={String(rule.min_evidence_count)} />
        <RuleStat icon={<RiFlashlightLine className="size-3.5" />} label={t(r.bondAmount)} value={`${rule.bond_amount} MOM`} />
        <div className="rounded-lg border border-border px-2.5 py-2">
          <p className="text-[10px] font-black text-muted-foreground">{t(r.outcomes)}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {rule.supported_outcomes
              .filter((o) => o.toLowerCase() !== "ambiguous")
              .map((o) => (
                <span key={o} className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-400">
                  {o.toUpperCase()}
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RuleStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-2.5 py-2">
      <div className="flex items-center gap-1 text-muted-foreground">{icon}</div>
      <p className="mt-0.5 text-[10px] font-black text-muted-foreground">{label}</p>
      <p className="text-[12px] font-black tabular-nums text-foreground">{value}</p>
    </div>
  );
}
