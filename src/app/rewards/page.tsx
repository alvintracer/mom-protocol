"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RiArrowRightLine, RiInformationLine, RiPulseLine, RiTrophyLine, RiMedalFill } from "react-icons/ri";

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
        supabase.from("platform_rate_history").select("*").order("snapshot_date", { ascending: true }),
        supabase.from("platform_contributor_rankings").select("*").order("rank", { ascending: true }).limit(50),
      ]);

      if (!mounted) return;

      setOverview(overviewRes.data as PlatformVaultOverview | null);
      setHistory(historyRes.data as RateHistory[] | null ?? []);
      setRankings(rankingsRes.data as ContributorRanking[] | null ?? []);
      setLoading(false);
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

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
                {t(m.noBetting)}
              </p>
              <p className="text-[13px] font-medium leading-relaxed text-blue-700/80 dark:text-blue-300/80">
                {t({
                  ko: "MOM 에너지는 월말 정산 없이 원하실 때 언제든 출금할 수 있습니다. 환율은 (전체 볼트 잔고 / 전체 MOM 유통 에너지)로 매일 유동적으로 변동됩니다.",
                  en: "MOM Energy can be withdrawn at any time without waiting for month-end settlement. The rate dynamically changes based on (Total Vault USD / Total MOM Supply).",
                  es: "MOM Energy se puede retirar en cualquier momento sin esperar al cierre de mes. La tasa cambia dinámicamente según (Total Vault USD / Total MOM Supply)."
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
          </div>
          
          <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
            {loading ? (
              <div className="space-y-4 p-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/50" />
                ))}
              </div>
            ) : rankings.length > 0 ? (
              <div className="divide-y divide-border/50">
                {rankings.map((user) => (
                  <ContributorRow key={user.user_id} user={user} />
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

function ContributorRow({ user }: { user: ContributorRanking }) {
  const { t } = useI18n();
  
  // Determine Tier
  let tierLabel = "Member";
  let tierColor = "text-zinc-600 bg-zinc-500/10 border-zinc-200 dark:border-zinc-800";
  let spread = "5%";

  if (user.percent_rank <= 0.05) {
    tierLabel = "Gold";
    tierColor = "text-amber-600 bg-amber-500/10 border-amber-200 dark:border-amber-900/50";
    spread = "3%";
  } else if (user.percent_rank <= 0.20) {
    tierLabel = "Silver";
    tierColor = "text-slate-600 bg-slate-500/10 border-slate-200 dark:text-slate-300 dark:bg-slate-400/20 dark:border-slate-700";
    spread = "4%";
  }

  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30">
      <span className="w-6 text-center text-[13px] font-black tabular-nums text-muted-foreground">
        {user.rank <= 3 ? ["🥇", "🥈", "🥉"][user.rank - 1] : `#${user.rank}`}
      </span>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-[12px] font-black text-foreground overflow-hidden">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" className="size-full object-cover" />
        ) : (
          (user.display_name?.[0] || user.handle?.[0] || "?").toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-foreground">
          {user.display_name || user.handle || "—"}
        </p>
        <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${tierColor}`}>
          <RiMedalFill className="size-3" />
          {tierLabel}
        </span>
      </div>
      <div className="text-right">
        <p className="text-[13px] font-black tabular-nums text-foreground">
          {formatCompact(user.total_energy)} MOM
        </p>
        <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
          {t({ ko: "출금 수수료", en: "Spread", es: "Spread" })}: {spread}
        </p>
      </div>
    </div>
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
