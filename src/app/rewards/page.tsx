"use client";

import { useEffect, useMemo, useState } from "react";

import { RewardPoolCard } from "@/shared/components/cards/RewardPoolCard";
import { VaultGaugeCard } from "@/shared/components/cards/VaultGaugeCard";
import { rewardPool } from "@/shared/data/mock";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import type { LocalizedText } from "@/shared/i18n/config";
import type { RewardPool } from "@/shared/types/domain";

type VaultOverview = {
  cumulative_energy: number;
  monthly_energy: number;
  distributed_energy: number;
  next_distribution_date: string;
  posted_entry_count: number;
};

type VaultSourceMix = {
  source_type: string;
  energy_amount: number;
  percent: number;
};

export default function RewardsPage() {
  const { dictionary, t } = useI18n();
  const [overview, setOverview] = useState<VaultOverview | null>(null);
  const [sourceMix, setSourceMix] = useState<VaultSourceMix[]>([]);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadVault() {
      const [overviewResult, mixResult] = await Promise.all([
        supabase
          .from("platform_vault_overview")
          .select("cumulative_energy, monthly_energy, distributed_energy, next_distribution_date, posted_entry_count")
          .maybeSingle(),
        supabase
          .from("platform_vault_source_mix_current")
          .select("source_type, energy_amount, percent"),
      ]);

      if (!mounted) {
        return;
      }

      setOverview((overviewResult.data as VaultOverview | null) ?? null);
      setSourceMix((mixResult.data as VaultSourceMix[]) ?? []);
    }

    loadVault();

    return () => {
      mounted = false;
    };
  }, []);

  const liveRewardPool = useMemo(
    () => buildRewardPool(rewardPool, overview, sourceMix, dictionary.vault.title, dictionary.vault.sources),
    [dictionary.vault.sources, dictionary.vault.title, overview, sourceMix],
  );

  return (
    <div className="flex-1 min-w-0 bg-zinc-50/30 dark:bg-zinc-950/20">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 pb-20">
        
        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <VaultStat label={t(dictionary.vault.cumulative)} value={liveRewardPool.cumulativeAmountLabel} />
          <VaultStat label={t(dictionary.vault.monthly)} value={liveRewardPool.monthlyAmountLabel} highlight />
          <VaultStat label={t(dictionary.vault.distributed)} value={liveRewardPool.distributedAmountLabel} />
        </div>

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <VaultGaugeCard rewardPool={liveRewardPool} />
          </div>
          <div className="xl:col-span-1">
            <RewardPoolCard rewardPool={liveRewardPool} />
          </div>
        </div>

        <div className="rounded-xl border border-blue-200/40 bg-blue-50/30 px-4 py-2.5 text-[12px] font-medium leading-relaxed text-blue-800 dark:border-blue-500/15 dark:bg-blue-500/5 dark:text-blue-300 flex items-center gap-2.5">
          <span className="text-blue-500 dark:text-blue-400 text-sm">ℹ</span>
          <p>{t(dictionary.vault.noBetting)}</p>
        </div>

        {/* Contribution Board */}
        <div className="pt-4">
          <div className="mb-4">
            <h2 className="text-lg font-black text-foreground tracking-tight">
              {t(dictionary.vault.contributionBoard)}
            </h2>
            <p className="text-[12px] text-muted-foreground font-medium mt-0.5">
              {t(dictionary.vault.subtitle)}
            </p>
          </div>
          
          <div className="rounded-2xl border border-dashed border-border bg-background p-6 text-sm font-semibold text-muted-foreground">
            {t(dictionary.vault.noContributorData)}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildRewardPool(
  fallback: RewardPool,
  overview: VaultOverview | null,
  sourceRows: VaultSourceMix[],
  title: LocalizedText,
  labels: Record<string, LocalizedText>,
): RewardPool {
  const monthlyEnergy = Number(overview?.monthly_energy ?? 0);
  const sourceMix =
    sourceRows.length > 0
      ? sourceRows.map((row) => ({
          label: sourceLabel(row.source_type, labels),
          percent: Number(row.percent ?? 0),
          amountLabel: formatEnergy(Number(row.energy_amount ?? 0)),
          colorClass: sourceColor(row.source_type),
        }))
      : [];

  return {
    ...fallback,
    title,
    totalAmountLabel: formatEnergy(Number(overview?.cumulative_energy ?? 0)),
    cumulativeAmountLabel: formatEnergy(Number(overview?.cumulative_energy ?? 0)),
    monthlyAmountLabel: formatEnergy(monthlyEnergy),
    distributedAmountLabel: formatEnergy(Number(overview?.distributed_energy ?? 0)),
    period: currentMonthPeriod(),
    fillPercent: Math.min(100, Math.max(0, Math.round((monthlyEnergy / 1_000_000) * 100))),
    activeContributors: overview?.posted_entry_count ?? 0,
    nextDistributionDate: formatDate(overview?.next_distribution_date ?? nextMonthDate()),
    sourceMix,
  };
}

function sourceLabel(sourceType: string, labels: Record<string, LocalizedText>) {
  const key = sourceType.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
  return labels[key] ?? labels.other;
}

function sourceColor(sourceType: string) {
  const colors: Record<string, string> = {
    nowpayments_energy_purchase: "bg-blue-600",
    adsense: "bg-emerald-500",
    advertiser_direct: "bg-indigo-500",
    creator_subscription: "bg-sky-500",
    attention_boost: "bg-cyan-500",
    super_comment: "bg-violet-500",
    sponsor_campaign: "bg-fuchsia-500",
    data_api: "bg-slate-500",
    manual_adjustment: "bg-amber-500",
    other: "bg-zinc-500",
  };

  return colors[sourceType] ?? colors.other;
}

function formatEnergy(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M MOM`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}k MOM`;
  }

  return `${Math.round(value).toLocaleString()} MOM`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function currentMonthPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${formatDate(start.toISOString())} - ${formatDate(end.toISOString())}`;
}

function nextMonthDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

function VaultStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <article className={`rounded-2xl border p-5 transition-all ${
      highlight 
        ? "border-blue-500/25 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/15 dark:to-zinc-950 shadow-[0_0_20px_rgba(59,130,246,0.06)]" 
        : "border-border/80 bg-background shadow-sm"
    }`}>
      <p className={`text-[11px] font-bold uppercase tracking-wider ${highlight ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className={`mt-2 text-2xl font-black tracking-tight tabular-nums ${highlight ? "text-blue-700 dark:text-blue-300" : "text-foreground"}`}>
        {value}
      </p>
    </article>
  );
}
