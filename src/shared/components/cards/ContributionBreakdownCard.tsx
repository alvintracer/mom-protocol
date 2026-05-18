"use client";

import type { ContributionBreakdown, Creator } from "@/shared/types/domain";
import { useI18n } from "@/shared/i18n/LanguageProvider";

export function ContributionBreakdownCard({
  breakdown,
  creator,
}: {
  breakdown: ContributionBreakdown;
  creator: Creator;
}) {
  const { dictionary, t } = useI18n();
  const rows = [
    [t(dictionary.contribution.predictionAccuracy), breakdown.predictionAccuracy],
    [t(dictionary.contribution.evidenceQuality), breakdown.evidenceQuality],
    [t(dictionary.contribution.discussionImpact), breakdown.discussionImpact],
    [t(dictionary.contribution.attentionSpread), breakdown.attentionSpread],
  ] as const;

  return (
    <article className="rounded-2xl border border-border bg-background p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-4 mb-5 pb-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full bg-zinc-100 dark:bg-zinc-800 shrink-0" />
          <div>
            <p className="text-[14px] font-black text-foreground tracking-tight">{t(creator.name)}</p>
            <p className="text-[12px] font-medium text-muted-foreground">@{creator.handle}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
            {t(dictionary.common.contributionRatio)}
          </p>
          <p className="text-xl font-black text-blue-600 dark:text-blue-400">
            {breakdown.contributionRatio}%
          </p>
        </div>
      </div>
      
      <div className="space-y-3.5">
        {rows.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1.5 flex items-center justify-between text-[12px]">
              <span className="font-semibold text-muted-foreground">{label}</span>
              <span className="font-bold text-foreground">{value}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500/80 dark:bg-blue-500"
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
