"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  RiArrowRightLine,
  RiBarChartBoxLine,
  RiCheckLine,
  RiFireLine,
  RiLoginBoxLine,
  RiShieldCheckLine,
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";

type OutcomeCount = {
  outcome: string;
  count: number;
};

type PredictionWidgetProps = {
  attentionId: string;
  attentionSlug: string;
  outcomeOptions: string[];
  /** Posts with selected_outcome filled in */
  outcomeCounts: OutcomeCount[];
  isLoggedIn: boolean;
};

const OUTCOME_COLORS: Record<string, { bg: string; border: string; text: string; bar: string }> = {
  yes: { bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/30", text: "text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500" },
  no: { bg: "bg-rose-50 dark:bg-rose-500/10", border: "border-rose-200 dark:border-rose-500/30", text: "text-rose-700 dark:text-rose-400", bar: "bg-rose-500" },
  above: { bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/30", text: "text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500" },
  below: { bg: "bg-rose-50 dark:bg-rose-500/10", border: "border-rose-200 dark:border-rose-500/30", text: "text-rose-700 dark:text-rose-400", bar: "bg-rose-500" },
  in_range: { bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-200 dark:border-amber-500/30", text: "text-amber-700 dark:text-amber-400", bar: "bg-amber-500" },
};

const DEFAULT_COLOR = { bg: "bg-blue-50 dark:bg-blue-500/10", border: "border-blue-200 dark:border-blue-500/30", text: "text-blue-700 dark:text-blue-400", bar: "bg-blue-500" };

function getColor(outcome: string) {
  return OUTCOME_COLORS[outcome.toLowerCase()] ?? DEFAULT_COLOR;
}

function formatOutcomeLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return "YES";
  if (normalized === "no") return "NO";
  if (normalized === "above") return "Above";
  if (normalized === "below") return "Below";
  if (normalized === "in_range") return "In range";
  return value.trim();
}

export function PredictionWidget({
  attentionId,
  attentionSlug,
  outcomeOptions,
  outcomeCounts,
  isLoggedIn,
}: PredictionWidgetProps) {
  const { dictionary, t } = useI18n();
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

  const totalPredictions = useMemo(
    () => outcomeCounts.reduce((sum, item) => sum + item.count, 0),
    [outcomeCounts],
  );

  const countsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of outcomeCounts) {
      map.set(item.outcome.toLowerCase(), item.count);
    }
    return map;
  }, [outcomeCounts]);

  const postHref = selectedOutcome
    ? `/posts/new?attention=${encodeURIComponent(attentionId)}&outcome=${encodeURIComponent(selectedOutcome)}`
    : `/posts/new?attention=${encodeURIComponent(attentionId)}`;

  return (
    <section className="rounded-2xl border border-border bg-background shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <RiFireLine className="size-5 text-orange-500" />
        <h2 className="text-[15px] font-black text-foreground">
          {t(dictionary.attentionDetail.predict)}
        </h2>
      </div>

      {/* Prediction Distribution */}
      {totalPredictions > 0 ? (
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground">
              {t(dictionary.attentionDetail.distribution)}
            </span>
            <span className="text-xs font-bold text-muted-foreground">
              {totalPredictions} {t(dictionary.attentionDetail.participantsCount)}
            </span>
          </div>
          {/* Bar chart */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/50">
            {outcomeOptions.map((option) => {
              const count = countsMap.get(option.toLowerCase()) ?? 0;
              if (count === 0) return null;
              const pct = (count / totalPredictions) * 100;
              const color = getColor(option);
              return (
                <div
                  key={option}
                  className={`${color.bar} transition-all duration-500 first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${pct}%` }}
                  title={`${formatOutcomeLabel(option)}: ${pct.toFixed(0)}%`}
                />
              );
            })}
          </div>
          {/* Legend */}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {outcomeOptions.map((option) => {
              const count = countsMap.get(option.toLowerCase()) ?? 0;
              const pct = totalPredictions > 0 ? ((count / totalPredictions) * 100).toFixed(0) : "0";
              const color = getColor(option);
              return (
                <div key={option} className="flex items-center gap-1.5 text-xs font-bold">
                  <div className={`size-2.5 rounded-full ${color.bar}`} />
                  <span className={color.text}>{formatOutcomeLabel(option)}</span>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {t(dictionary.attentionDetail.noOutcomeYet)}
          </p>
        </div>
      )}

      {/* Outcome selection */}
      <div className="px-4 py-3">
        <p className="text-xs font-bold text-muted-foreground mb-2">
          {t(dictionary.attentionDetail.selectOutcome)}
        </p>
        <div className="grid gap-2">
          {outcomeOptions.map((option) => {
            const isSelected = selectedOutcome === option;
            const color = getColor(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => setSelectedOutcome(isSelected ? null : option)}
                className={`relative flex items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all ${
                  isSelected
                    ? `${color.bg} ${color.border} ${color.text} ring-1 ring-offset-1 ring-offset-background`
                    : "border-border bg-background text-foreground hover:border-blue-300 dark:hover:border-blue-500/50"
                }`}
              >
                <span className="text-sm font-black">{formatOutcomeLabel(option)}</span>
                {isSelected ? (
                  <RiCheckLine className={`size-5 ${color.text}`} />
                ) : (
                  <RiBarChartBoxLine className="size-4 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-border px-4 py-3">
        {isLoggedIn ? (
          <Link
            href={postHref}
            className={`flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-black transition-colors ${
              selectedOutcome
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-zinc-100 dark:bg-zinc-800 text-muted-foreground cursor-default"
            }`}
          >
            {selectedOutcome ? (
              <>
                {t(dictionary.attentionDetail.predictAndPost)}
                <RiArrowRightLine className="size-4" />
              </>
            ) : (
              t(dictionary.attentionDetail.selectOutcome)
            )}
          </Link>
        ) : (
          <Link
            href={`/auth/login?next=/a/${attentionSlug}`}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-blue-600 text-sm font-black text-white hover:bg-blue-700"
          >
            <RiLoginBoxLine className="size-4" />
            {t(dictionary.attentionDetail.loginToPredict)}
          </Link>
        )}
      </div>

      {/* AIO trust note */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-start gap-2 text-xs font-bold text-muted-foreground leading-5">
          <RiShieldCheckLine className="mt-0.5 size-4 shrink-0 text-blue-500" />
          {t(dictionary.attentionDetail.aioCaseExplanation)}
        </div>
      </div>
    </section>
  );
}
