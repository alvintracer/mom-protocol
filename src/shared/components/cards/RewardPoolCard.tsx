"use client";

import type { RewardPool } from "@/shared/types/domain";
import { useI18n } from "@/shared/i18n/LanguageProvider";

export function RewardPoolCard({ rewardPool }: { rewardPool: RewardPool }) {
  const { dictionary, t } = useI18n();

  return (
    <article className="h-full rounded-3xl border border-border bg-background p-6 shadow-sm flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-purple-500" />
            <p className="text-[12px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest">{t(dictionary.vault.sourceMix)}</p>
          </div>
          <h2 className="mt-2 text-xl font-black text-foreground tracking-tight">
            {t(rewardPool.title)}
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {rewardPool.period}
        </span>
      </div>
      
      <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-4 mb-6 border border-border/50">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
          {t(dictionary.vault.expectedPool)}
        </p>
        <p className="text-2xl font-black text-foreground tracking-tight">
          {rewardPool.monthlyAmountLabel}
        </p>
      </div>

      <div className="flex-1 space-y-4">
        {rewardPool.sourceMix.map((source) => (
          <div key={t(source.label)}>
            <div className="mb-1.5 flex items-center justify-between text-[13px]">
              <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${source.colorClass}`} />
                {t(source.label)}
              </span>
              <span className="font-bold text-foreground">
                {source.percent}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full ${source.colorClass}`}
                style={{ width: `${source.percent}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[11px] font-medium text-muted-foreground">{source.amountLabel}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
