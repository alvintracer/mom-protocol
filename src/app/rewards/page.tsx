"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  RiInformationLine, RiPulseLine, RiTrophyLine, RiMedalFill,
  RiUserFollowLine, RiShieldCheckLine, RiExternalLinkLine,
  RiPieChartLine, RiFlagLine, RiLockLine, RiLockUnlockLine,
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import { RateHistoryChart } from "@/shared/components/cards/RateHistoryChart";

type PlatformVaultOverview = {
  vault_usd: number;
  distributable_usd: number;
  operations_usd: number;
  distribution_pct: number;
  operations_pct: number;
  total_mom_supply: number;
  current_rate: number;
};

type RateHistory = {
  snapshot_date: string;
  vault_usd: number;
  total_mom_supply: number;
  mom_rate: number;
};

type ContributorRanking = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  total_energy: number;
  percent_rank: number;
  rank: number;
};

type MilestoneTier = {
  tier_name: string;
  tier_emoji: string;
  vault_threshold_usd: number;
  max_withdrawal_pct: number;
  max_monthly_usd: number;
  min_withdrawal_usd: number;
  is_fully_open: boolean;
  sort_order: number;
};

export default function RewardsPage() {
  const { dictionary, t } = useI18n();
  const m = dictionary.vault;

  const [overview, setOverview] = useState<PlatformVaultOverview | null>(null);
  const [history, setHistory] = useState<RateHistory[]>([]);
  const [rankings, setRankings] = useState<ContributorRanking[]>([]);
  const [milestones, setMilestones] = useState<MilestoneTier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadData() {
      const [overviewRes, historyRes, rankingsRes, milestonesRes] = await Promise.all([
        supabase.from("platform_vault_overview").select("vault_usd, distributable_usd, operations_usd, distribution_pct, operations_pct, total_mom_supply, current_rate").maybeSingle(),
        (supabase as any).from("platform_rate_history").select("*").order("snapshot_date", { ascending: true }),
        (supabase as any).from("platform_contributor_rankings").select("*").order("rank", { ascending: true }).limit(100),
        (supabase as any).from("vault_milestones").select("*").order("sort_order", { ascending: true }),
      ]);

      if (!mounted) return;

      const ov = overviewRes.data as PlatformVaultOverview | null;
      setOverview(ov);
      setRankings(rankingsRes.data as ContributorRanking[] | null ?? []);
      setMilestones(milestonesRes.data as MilestoneTier[] | null ?? []);

      const historicalData = (historyRes.data as RateHistory[] | null) ?? [];

      // Append today's live rate first
      const today = new Date().toISOString().slice(0, 10);
      const hasTodaySnapshot = historicalData.some((d) => d.snapshot_date === today);

      if (!hasTodaySnapshot && ov) {
        historicalData.push({
          snapshot_date: today,
          vault_usd: ov.vault_usd,
          total_mom_supply: ov.total_mom_supply,
          mom_rate: ov.current_rate,
        });
      }

      // Then fill missing dates between data points (carry forward)
      setHistory(fillDateGaps(historicalData));
      setLoading(false);
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  // Max energy for bar chart scaling
  const maxEnergy = rankings.length > 0 ? rankings[0].total_energy : 1;

  return (
    <div className="flex-1 min-w-0 bg-zinc-50/30 dark:bg-zinc-950/20">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 pb-20">

        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <VaultStat 
            label={t(m.totalVault)} 
            value={overview ? `$${formatNumber(overview.vault_usd)}` : "—"} 
            highlight 
          />
          <VaultStat 
            label={t(m.distributableUsd)} 
            value={overview ? `$${formatNumber(overview.distributable_usd)}` : "—"} 
          />
          <VaultStat 
            label={t(dictionary.topBar.rate ?? { ko: "환율", en: "Rate", es: "Tasa" })} 
            value={overview ? `$${overview.current_rate.toFixed(4)}` : "—"} 
          />
        </div>

        {/* Vault Allocation Pie Chart + On-chain Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pie Chart */}
          <div className="rounded-3xl border border-border bg-background p-5 sm:p-7 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <RiPieChartLine className="size-5 text-emerald-500" />
              <h2 className="text-lg font-black text-foreground">
                {t(m.vaultAllocation)}
              </h2>
            </div>
            {loading ? (
              <div className="h-48 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
            ) : (
              <VaultPieChart
                distributionPct={overview?.distribution_pct ?? 90}
                operationsPct={overview?.operations_pct ?? 10}
                distributableUsd={overview?.distributable_usd ?? 0}
                operationsUsd={overview?.operations_usd ?? 0}
                totalUsd={overview?.vault_usd ?? 0}
                distributionLabel={t(m.distributionLabel)}
                operationsLabel={t(m.operationsLabel)}
              />
            )}
          </div>

          {/* On-chain Info */}
          <div className="rounded-3xl border border-border bg-background p-5 sm:p-7 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <RiShieldCheckLine className="size-5 text-indigo-500" />
              <h2 className="text-lg font-black text-foreground">
                {t(m.onchainVault)}
              </h2>
            </div>
            <div className="space-y-4">
              <OnChainRow
                label="Network"
                value="Giwa Sepolia (Testnet)"
              />
              <OnChainRow
                label={t(m.contractAddress)}
                value={process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "Deploying..."}
                isMono
                href={process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS ? `https://sepolia-explorer.giwa.io/address/${process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS}` : undefined}
              />
              <OnChainRow
                label="Token"
                value="mUSDC (momment. Mock USDC)"
              />
              <OnChainRow
                label={t(m.masterWallet)}
                value="0xFe86...0387"
                isMono
                href="https://sepolia-explorer.giwa.io/address/0xFe86A4f256eB3b2C303Fc2e8C9bC81f025B80387"
              />
              <OnChainRow
                label={t(m.totalVault)}
                value={overview ? `$${formatNumber(overview.vault_usd)} mUSDC` : "—"}
              />
            </div>
            <p className="mt-5 text-[11px] text-muted-foreground/70 leading-relaxed">
              {t(m.testnetNotice)}
            </p>
          </div>
        </div>

        {/* Milestone Progress */}
        {milestones.length > 0 && (
          <MilestoneProgress
            milestones={milestones}
            vaultUsd={overview?.vault_usd ?? 0}
          />
        )}

        {/* Rate History Chart */}
        <div className="rounded-3xl border border-border bg-background p-5 sm:p-7 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <RiPulseLine className="size-5 text-emerald-500" />
            <h2 className="text-lg font-black text-foreground">
              {t({ ko: "환율 히스토리", en: "Rate History", es: "Historial de tasas" })}
            </h2>
          </div>
          {loading ? (
            <div className="h-64 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
          ) : (
            <RateHistoryChart data={history} />
          )}
        </div>

        {/* Info Box */}
        <div className="rounded-2xl border border-blue-200/50 bg-blue-50/50 p-5 dark:border-blue-500/20 dark:bg-blue-500/5">
          <div className="flex gap-3">
            <RiInformationLine className="size-5 shrink-0 text-blue-500 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-[13px] font-bold text-blue-800 dark:text-blue-300">
                {t({
                  ko: "MOM 에너지는 momment.의 활성화에 대한 유저를 위한 리워드입니다.",
                  en: "MOM Energy is a reward for users who contribute to momment. activity.",
                  es: "MOM Energy es una recompensa para usuarios que contribuyen a la actividad de momment.",
                })}
              </p>
              <p className="text-[13px] font-medium leading-relaxed text-blue-700/80 dark:text-blue-300/80">
                {t({
                  ko: "MOM 에너지는 실제 스테이블코인으로 출금 가능하며, 출금 시 소각됩니다. momment. 볼트는 플랫폼이 벌어들인, 투명하게 공개되는 모든 수입이며 에너지의 환율은 (전체 momment. 볼트 잔고 / 전체 MOM 유통 에너지)로 실시간 유동적으로 변동됩니다.",
                  en: "MOM Energy can be withdrawn as real stablecoins and is burned upon withdrawal. The momment. Vault represents all transparently disclosed platform revenue, and the exchange rate dynamically fluctuates in real-time based on (Total momment. Vault Balance / Total MOM Supply).",
                  es: "MOM Energy se puede retirar como stablecoins reales y se quema al retirarlo. El Vault de momment. representa todos los ingresos transparentes de la plataforma, y el tipo de cambio fluctúa dinámicamente en tiempo real según (Saldo Total del Vault / Suministro Total de MOM).",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Global Contributor Rankings */}
        <div className="pt-4">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RiTrophyLine className="size-5 text-amber-500" />
              <h2 className="text-lg font-black text-foreground tracking-tight">
                {t(m.contributionBoard)}
              </h2>
            </div>
            {rankings.length > 0 && (
              <span className="text-[12px] font-bold text-muted-foreground">
                Top {rankings.length}
              </span>
            )}
          </div>
          
          <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
            {loading ? (
              <div className="space-y-4 p-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
                ))}
              </div>
            ) : rankings.length > 0 ? (
              <div>
                {rankings.map((user) => (
                  <ContributorRow
                    key={user.user_id}
                    user={user}
                    maxEnergy={maxEnergy}
                  />
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-sm font-medium text-muted-foreground">
                {t(m.noContributorData)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ContributorRow({ user, maxEnergy }: { user: ContributorRanking; maxEnergy: number }) {
  // Bar width: percentage of max energy (min 2% so it's visible)
  const barPercent = Math.max(2, (user.total_energy / maxEnergy) * 100);

  // Determine Tier
  let tierLabel = "Member";
  let tierColor = "text-zinc-600 bg-zinc-500/10 border-zinc-200 dark:border-zinc-800";
  let barColor = "bg-zinc-300 dark:bg-zinc-700";

  if (user.percent_rank <= 0.05) {
    tierLabel = "Gold";
    tierColor = "text-amber-600 bg-amber-500/10 border-amber-200 dark:border-amber-900/50";
    barColor = "bg-gradient-to-r from-amber-400 to-amber-500 dark:from-amber-500 dark:to-amber-600";
  } else if (user.percent_rank <= 0.20) {
    tierLabel = "Silver";
    tierColor = "text-slate-500 bg-slate-500/10 border-slate-200 dark:text-slate-300 dark:bg-slate-400/20 dark:border-slate-700";
    barColor = "bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-500 dark:to-slate-600";
  }

  return (
    <Link
      href={`/u/${user.handle || user.user_id}`}
      className="group relative block overflow-hidden border-b border-border/40 last:border-b-0 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20"
    >
      {/* Background bar — left-aligned, full row height, semi-transparent */}
      <div
        className={`absolute inset-y-0 left-0 ${barColor} opacity-[0.18] group-hover:opacity-[0.28] transition-opacity`}
        style={{ width: `${barPercent}%` }}
      />

      <div className="relative flex items-center gap-3 px-4 sm:px-5 py-3.5">
        {/* Rank */}
        <span className="w-7 text-center text-[13px] font-black tabular-nums text-muted-foreground shrink-0">
          {user.rank <= 3 ? ["🥇", "🥈", "🥉"][user.rank - 1] : `#${user.rank}`}
        </span>

        {/* Avatar */}
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-[12px] font-black text-foreground overflow-hidden">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt="" className="size-full object-cover" />
          ) : (
            (user.display_name?.[0] || user.handle?.[0] || "?").toUpperCase()
          )}
        </div>

        {/* Name + Tier */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {user.display_name || user.handle || "—"}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[9px] font-black uppercase tracking-wider ${tierColor}`}>
              <RiMedalFill className="size-2.5" />
              {tierLabel}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
              <RiUserFollowLine className="size-3" />
              {(user.follower_count ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Energy */}
        <div className="text-right shrink-0">
          <p className="text-[13px] font-black tabular-nums text-foreground">
            {formatCompact(user.total_energy)}
          </p>
          <p className="text-[10px] font-medium text-muted-foreground">
            MOM
          </p>
        </div>
      </div>
    </Link>
  );
}

function VaultStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <article className={`rounded-2xl border p-5 transition-all ${
      highlight 
        ? "border-blue-500/25 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/15 dark:to-zinc-950 shadow-[0_0_20px_rgba(59,130,246,0.06)]" 
        : "border-border/80 bg-background shadow-sm"
    }`}>
      <p className={`text-[12px] font-bold tracking-wider ${highlight ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className={`mt-2 text-3xl font-black tracking-tight tabular-nums ${highlight ? "text-blue-700 dark:text-blue-300" : "text-foreground"}`}>
        {value}
      </p>
    </article>
  );
}

// Utils
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Fill missing dates in rate history by carrying forward the last known value */
function fillDateGaps(data: RateHistory[]): RateHistory[] {
  if (data.length < 2) return [...data];

  const result: RateHistory[] = [];
  const sorted = [...data].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  for (let i = 0; i < sorted.length; i++) {
    result.push(sorted[i]);

    if (i < sorted.length - 1) {
      const current = new Date(sorted[i].snapshot_date);
      const next = new Date(sorted[i + 1].snapshot_date);
      const gap = Math.round((next.getTime() - current.getTime()) / 86400000);

      // Fill each missing day with the current day's values
      for (let d = 1; d < gap; d++) {
        const fill = new Date(current);
        fill.setDate(fill.getDate() + d);
        result.push({
          snapshot_date: fill.toISOString().slice(0, 10),
          vault_usd: sorted[i].vault_usd,
          total_mom_supply: sorted[i].total_mom_supply,
          mom_rate: sorted[i].mom_rate,
        });
      }
    }
  }

  return result;
}

/**
 * CSS-only donut pie chart showing 90/10 vault allocation.
 */
function VaultPieChart({
  distributionPct,
  operationsPct,
  distributableUsd,
  operationsUsd,
  totalUsd,
  distributionLabel,
  operationsLabel,
}: {
  distributionPct: number;
  operationsPct: number;
  distributableUsd: number;
  operationsUsd: number;
  totalUsd: number;
  distributionLabel: string;
  operationsLabel: string;
}) {
  // conic-gradient for the donut
  const gradient = `conic-gradient(
    #3b82f6 0deg ${distributionPct * 3.6}deg,
    #71717a ${distributionPct * 3.6}deg 360deg
  )`;

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Donut */}
      <div className="relative size-44 sm:size-48">
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: gradient }}
        />
        {/* Inner cutout */}
        <div className="absolute inset-5 rounded-full bg-background flex flex-col items-center justify-center">
          <span className="text-[11px] font-bold text-muted-foreground">Total</span>
          <span className="text-xl sm:text-2xl font-black tabular-nums text-foreground">
            ${formatNumber(totalUsd)}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-[13px]">
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-sm bg-blue-500" />
          <div>
            <p className="font-bold text-foreground">{distributionLabel}</p>
            <p className="text-muted-foreground tabular-nums">${formatNumber(distributableUsd)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="size-3 rounded-sm bg-zinc-500" />
          <div>
            <p className="font-bold text-foreground">{operationsLabel}</p>
            <p className="text-muted-foreground tabular-nums">${formatNumber(operationsUsd)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnChainRow({
  label,
  value,
  isMono,
  href,
}: {
  label: string;
  value: string;
  isMono?: boolean;
  href?: string;
}) {
  const content = (
    <span
      className={`text-[13px] font-bold truncate text-right ${
        isMono ? "font-mono text-[12px]" : ""
      } ${
        href ? "text-blue-600 dark:text-blue-400" : "text-foreground"
      }`}
    >
      {value}
      {href && <RiExternalLinkLine className="inline ml-1 size-3 opacity-60" />}
    </span>
  );

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] font-bold text-muted-foreground shrink-0">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="truncate hover:opacity-80 transition-opacity">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

/**
 * Milestone progress section: progress bar + tier cards (i18n, no emoji)
 */
function MilestoneProgress({
  milestones,
  vaultUsd,
}: {
  milestones: MilestoneTier[];
  vaultUsd: number;
}) {
  const { dictionary, t } = useI18n();
  const m = dictionary.vault;

  // Tier name lookup from i18n
  const tierLabel = (name: string) => {
    const key = name as keyof typeof m.tierNames;
    return m.tierNames[key] ? t(m.tierNames[key]) : name;
  };

  // Find current tier
  const currentTier = milestones
    .filter((ms) => ms.vault_threshold_usd <= vaultUsd)
    .sort((a, b) => b.vault_threshold_usd - a.vault_threshold_usd)[0];

  const nextTier = milestones.find(
    (ms) => ms.vault_threshold_usd > vaultUsd,
  );

  // Progress towards next tier
  const progressPct = nextTier
    ? Math.min(
        ((vaultUsd - (currentTier?.vault_threshold_usd ?? 0)) /
          (nextTier.vault_threshold_usd - (currentTier?.vault_threshold_usd ?? 0))) *
          100,
        100,
      )
    : 100;

  // Skip "locked" tier row
  const visibleTiers = milestones.filter((ms) => ms.sort_order > 0);

  return (
    <div className="rounded-3xl border border-border bg-background p-5 sm:p-7 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <RiFlagLine className="size-5 text-amber-500" />
        <h2 className="text-lg font-black text-foreground">
          {t(m.milestones)}
        </h2>
      </div>
      <p className="mb-5 text-[12px] font-medium text-muted-foreground">
        {t(m.milestonesDesc)}
      </p>

      {/* Current status */}
      <div className="mb-6 rounded-2xl border border-border bg-zinc-50/50 dark:bg-zinc-900/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground">
              {t(m.currentTier)}
            </p>
            <p className="text-[15px] font-black text-foreground">
              {tierLabel(currentTier?.tier_name ?? "locked")}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground">
              {currentTier && currentTier.max_withdrawal_pct > 0
                ? `${currentTier.max_withdrawal_pct}% ${t(m.withdrawable)}`
                : t(m.withdrawalsLocked)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[18px] font-black tabular-nums text-foreground">
              ${formatCompactUsd(vaultUsd)}
            </p>
            {nextTier && (
              <p className="text-[11px] font-medium text-muted-foreground">
                → ${formatCompactUsd(nextTier.vault_threshold_usd)}
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {nextTier && (
          <div className="relative h-2.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
              style={{ width: `${Math.max(progressPct, 2)}%` }}
            />
          </div>
        )}
      </div>

      {/* Tier timeline */}
      <div className="space-y-2">
        {visibleTiers.map((tier) => {
          const isActive = currentTier?.tier_name === tier.tier_name;
          const isReached = tier.vault_threshold_usd <= vaultUsd;

          return (
            <div
              key={tier.tier_name}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                isActive
                  ? "border-blue-500/30 bg-blue-500/5"
                  : isReached
                    ? "border-emerald-400/20 bg-emerald-500/5"
                    : "border-border bg-background opacity-50"
              }`}
            >
              {/* Lock icon */}
              <div className="shrink-0">
                {isReached ? (
                  <RiLockUnlockLine className="size-4 text-emerald-500" />
                ) : (
                  <RiLockLine className="size-4 text-muted-foreground" />
                )}
              </div>

              {/* Tier name (localized, no emoji) */}
              <div className="min-w-0 flex-1">
                <p className={`text-[12px] font-black ${
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                }`}>
                  {tierLabel(tier.tier_name)}
                </p>
              </div>

              {/* Threshold */}
              <span className="text-[11px] font-bold tabular-nums text-muted-foreground shrink-0">
                ${formatCompactUsd(tier.vault_threshold_usd)}
              </span>

              {/* Withdrawal info */}
              <div className="text-right shrink-0 w-16">
                <p className="text-[11px] font-black tabular-nums text-foreground">
                  {tier.is_fully_open ? "100%" : `${tier.max_withdrawal_pct}%`}
                </p>
                <p className="text-[9px] font-medium text-muted-foreground">
                  {tier.is_fully_open
                    ? t(m.noCap)
                    : tier.max_monthly_usd > 0
                      ? `≤$${formatCompactUsd(tier.max_monthly_usd)}${t(m.perMonth)}`
                      : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom notice */}
      <p className="mt-4 text-[11px] text-muted-foreground/70 leading-relaxed">
        {t(m.milestoneNotice)}
      </p>
    </div>
  );
}

function formatCompactUsd(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
