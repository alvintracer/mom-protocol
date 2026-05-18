"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { RewardPool } from "@/shared/types/domain";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import {
  RiArrowRightLine,
  RiCalendarEventLine,
  RiGroupLine,
  RiShieldCheckLine,
} from "react-icons/ri";

type VaultGaugeCardProps = {
  rewardPool: RewardPool;
  compact?: boolean;
};

const pieBackground =
  "conic-gradient(#2563eb 0deg 137deg, #0ea5e9 137deg 234deg, #06b6d4 234deg 299deg, #6366f1 299deg 360deg)";

export function VaultGaugeCard({ rewardPool, compact = false }: VaultGaugeCardProps) {
  const { dictionary, t } = useI18n();

  if (compact) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-blue-50 to-purple-50 p-5 dark:from-blue-900/10 dark:to-purple-900/10 transition-colors">
        <div className="absolute -right-4 -top-4 size-24 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-2xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                {t(dictionary.vault.shortTitle)}
              </p>
              <p className="mt-1 text-2xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-purple-400">
                {rewardPool.monthlyAmountLabel}
              </p>
            </div>
            <span className="rounded-full border border-blue-200 bg-white/60 px-2.5 py-1 text-[11px] font-bold text-blue-700 backdrop-blur-md dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300">
              {t(rewardPool.status)}
            </span>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-[12px] font-bold">
              <span className="text-muted-foreground">{t(dictionary.vault.fill)}</span>
              <span className="text-foreground">{rewardPool.fillPercent}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                style={{ width: `${rewardPool.fillPercent}%` }}
              />
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 text-[13px]">
            <div className="min-w-0">
              <p className="text-muted-foreground">{t(dictionary.vault.nextDistribution)}</p>
              <p className="font-bold text-foreground">{rewardPool.nextDistributionDate}</p>
            </div>
            <Link
              href="/rewards"
              className="group inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-zinc-800 shadow-sm border border-border transition-all hover:border-blue-500 hover:shadow-md hover:scale-105"
              aria-label={t(dictionary.nav.rewards)}
            >
              <RiArrowRightLine className="size-5 text-foreground group-hover:text-blue-500 transition-colors" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <article className="relative overflow-hidden rounded-3xl border border-border bg-zinc-950 p-6 sm:p-8 shadow-2xl">
      <div className="absolute -left-20 -top-20 size-64 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 size-64 rounded-full bg-purple-600/20 blur-3xl" />
      
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-blue-400 uppercase tracking-widest">{t(dictionary.vault.title)}</p>
          <h2 className="mt-2 text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {rewardPool.monthlyAmountLabel}
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-400 font-medium">
            {t(dictionary.vault.subtitle)}
          </p>
        </div>
        <div className="flex items-center gap-6 lg:gap-10">
          <div
            className="relative size-36 shrink-0 rounded-full shadow-inner sm:size-44"
            style={{ background: pieBackground }}
            aria-hidden="true"
          >
            <div className="absolute inset-4 sm:inset-5 flex flex-col items-center justify-center rounded-full bg-zinc-950 text-center shadow-2xl">
              <span className="text-[11px] sm:text-xs font-bold text-zinc-500 uppercase tracking-wider">
                {t(dictionary.vault.fill)}
              </span>
              <span className="text-2xl sm:text-3xl font-black text-white mt-1">
                {rewardPool.fillPercent}%
              </span>
            </div>
          </div>
          <div className="hidden min-w-40 space-y-3 sm:block">
            {rewardPool.sourceMix.map((source) => (
              <div key={t(source.label)} className="flex items-center gap-3 text-[13px]">
                <span className={`size-3 rounded-full shadow-sm ${source.colorClass}`} />
                <span className="min-w-0 flex-1 truncate font-semibold text-zinc-400">
                  {t(source.label)}
                </span>
                <span className="font-black text-white">{source.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-8 grid border-t border-white/10 pt-6 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
        <VaultMetric
          icon={<RiCalendarEventLine className="size-5" />}
          label={t(dictionary.vault.nextDistribution)}
          value={rewardPool.nextDistributionDate}
        />
        <VaultMetric
          icon={<RiGroupLine className="size-5" />}
          label={t(dictionary.vault.activeContributors)}
          value={rewardPool.activeContributors.toLocaleString("ko-KR")}
        />
        <VaultMetric
          icon={<RiShieldCheckLine className="size-5" />}
          label={t(dictionary.common.status)}
          value={t(rewardPool.status)}
        />
      </div>
    </article>
  );
}

function VaultMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="py-3 sm:px-6 sm:py-2 first:sm:pl-0 last:sm:pr-0">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur">
        {icon}
      </div>
      <p className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider">{label}</p>
      <p className="mt-1.5 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
