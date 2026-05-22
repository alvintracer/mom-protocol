"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RiInformationLine, RiPulseLine, RiTrophyLine, RiMedalFill, RiUserFollowLine } from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import { RateHistoryChart } from "@/shared/components/cards/RateHistoryChart";

type PlatformVaultOverview = {
  vault_usd: number;
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

export default function RewardsPage() {
  const { dictionary, t } = useI18n();
  const m = dictionary.vault;

  const [overview, setOverview] = useState<PlatformVaultOverview | null>(null);
  const [history, setHistory] = useState<RateHistory[]>([]);
  const [rankings, setRankings] = useState<ContributorRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadData() {
      const [overviewRes, historyRes, rankingsRes] = await Promise.all([
        supabase.from("platform_vault_overview").select("vault_usd, total_mom_supply, current_rate").maybeSingle(),
        (supabase as any).from("platform_rate_history").select("*").order("snapshot_date", { ascending: true }),
        (supabase as any).from("platform_contributor_rankings").select("*").order("rank", { ascending: true }).limit(100),
      ]);

      if (!mounted) return;

      const ov = overviewRes.data as PlatformVaultOverview | null;
      setOverview(ov);
      setRankings(rankingsRes.data as ContributorRanking[] | null ?? []);

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
            label={t(dictionary.topBar.vault ?? { ko: "볼트", en: "Vault", es: "Bóveda" })} 
            value={overview ? `$${formatNumber(overview.vault_usd)}` : "—"} 
            highlight 
          />
          <VaultStat 
            label={t(dictionary.topBar.totalSupply ?? { ko: "유통 에너지", en: "Total Supply", es: "Suministro Total" })} 
            value={overview ? `${formatNumber(overview.total_mom_supply)} MOM` : "—"} 
          />
          <VaultStat 
            label={t(dictionary.topBar.rate ?? { ko: "환율", en: "Rate", es: "Tasa" })} 
            value={overview ? `$${overview.current_rate.toFixed(4)}` : "—"} 
          />
        </div>

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
