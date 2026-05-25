"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiArrowRightUpLine,
  RiBarChart2Line,
  RiCalendarLine,
  RiExternalLinkLine,
  RiGlobalLine,
  RiListCheck2,
  RiTimeLine,
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";

type MarketData = {
  id: string;
  question: string;
  slug: string | null;
  url: string | null;
  outcomes: string[];
  volume: number | null;
  endDate: string | null;
  platform?: "polymarket" | "manifold" | "kalshi";
};

function MarketDetailContent() {
  const { dictionary, language, t } = useI18n();
  const searchParams = useSearchParams();

  const market = useMemo<MarketData | null>(() => {
    const raw = searchParams.get("data");
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw)) as MarketData;
    } catch {
      return null;
    }
  }, [searchParams]);
  const [now] = useState(() => Date.now());

  if (!market) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Market data not found.</p>
      </div>
    );
  }

  const platformName = platformDisplayName(market.platform);
  const platformColor = platformAccentClass(market.platform);
  const externalUrl = market.url;
  const createUrl = `/attentions/new?prefill=${encodeURIComponent(JSON.stringify({
    question: market.question,
    outcomes: market.outcomes,
    endDate: market.endDate,
    sourceUrl: market.url,
    platform: market.platform,
  }))}`;

  const daysLeft = market.endDate
    ? Math.ceil((new Date(market.endDate).getTime() - now) / 86_400_000)
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900/50"
          >
            <RiArrowLeftLine className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${platformColor}`}>
                {platformName}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                {t(dictionary.externalMarkets.externalMarketLabel)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="grid gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left: Main content */}
        <div className="space-y-5">
          {/* Question card */}
          <section className="rounded-2xl border border-border bg-background p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <RiGlobalLine className={`size-5 ${platformTextColor(market.platform)}`} />
              <span className="text-xs font-bold text-muted-foreground">
                {t(dictionary.externalMarkets.poweredBy)} {platformName}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t(dictionary.externalMarkets.liveData)}
              </span>
            </div>

            <h1 className="mt-4 text-xl font-black leading-7 text-foreground sm:text-2xl sm:leading-8">
              {market.question}
            </h1>

            {/* Outcome cards */}
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {market.outcomes.map((outcome, i) => (
                <div
                  key={outcome}
                  className={`rounded-xl border p-3.5 transition-colors ${
                    i === 0
                      ? "border-blue-200 bg-blue-50/50 dark:border-blue-500/20 dark:bg-blue-500/5"
                      : "border-border bg-zinc-50/50 dark:bg-zinc-900/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-foreground">{outcome}</span>
                    <RiListCheck2 className="size-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>

            {/* Stats row */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              <StatCard
                icon={<RiBarChart2Line className="size-4" />}
                label={t(dictionary.externalMarkets.volume)}
                value={market.volume ? formatVolume(market.volume, language) : "—"}
              />
              <StatCard
                icon={<RiCalendarLine className="size-4" />}
                label={t(dictionary.externalMarkets.endsAt)}
                value={market.endDate ? market.endDate.slice(0, 10) : "—"}
              />
              <StatCard
                icon={<RiTimeLine className="size-4" />}
                label="D-Day"
                value={daysLeft !== null ? (daysLeft > 0 ? `D-${daysLeft}` : "Ended") : "—"}
              />
            </div>
          </section>

          {/* CTA: Create attention */}
          <section className="rounded-2xl border border-dashed border-blue-300 bg-blue-50/30 p-5 dark:border-blue-500/30 dark:bg-blue-500/5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20">
                <RiAddLine className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-foreground">
                  {t(dictionary.externalMarkets.notYetOnMomment)}
                </p>
                <p className="mt-1 text-[13px] font-medium text-muted-foreground">
                  {t(dictionary.externalMarkets.beFirstToCreate)}
                </p>
                <Link
                  href={createUrl}
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-blue-600 px-4 text-[13px] font-bold text-white transition-colors hover:bg-blue-700"
                >
                  <RiAddLine className="size-4" />
                  {t(dictionary.externalMarkets.createAttentionFromMarket)}
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* Right: Sidebar info */}
        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          {/* External link card */}
          {externalUrl ? (
            <section className="rounded-2xl border border-border bg-background p-5">
              <h3 className="text-sm font-black text-foreground">
                {platformName}
              </h3>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {t(dictionary.externalMarkets.participateExternal)}
              </p>
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                className={`mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full text-sm font-bold text-white transition-colors ${platformButtonClass(market.platform)}`}
              >
                <RiExternalLinkLine className="size-4" />
                {platformName}
                <RiArrowRightUpLine className="size-3.5" />
              </a>
              <a
                href={externalUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground hover:text-blue-500"
              >
                <RiExternalLinkLine className="size-3 shrink-0" />
                <span className="truncate">{externalUrl}</span>
              </a>
            </section>
          ) : null}

          {/* Market metadata */}
          <section className="rounded-2xl border border-border bg-background p-5">
            <h3 className="text-sm font-black text-foreground">
              {t(dictionary.externalMarkets.outcomes)}
            </h3>
            <div className="mt-3 space-y-2">
              {market.outcomes.map((outcome) => (
                <div
                  key={outcome}
                  className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50"
                >
                  <span className="size-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-bold text-foreground">{outcome}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Disclaimer */}
          <p className="rounded-lg border border-border bg-zinc-50 p-4 text-[12px] font-medium leading-5 text-muted-foreground dark:bg-zinc-900/50">
            momment. is not a trading venue. This page displays reference data from {platformName}.
            To participate in trading, visit the original market.
          </p>
        </aside>
      </main>
    </div>
  );
}

export default function MarketDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="size-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <MarketDetailContent />
    </Suspense>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-zinc-50/50 p-3 dark:bg-zinc-900/30">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-bold">{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-black text-foreground">{value}</p>
    </div>
  );
}

function formatVolume(volume: number, language: string) {
  const locale = language === "en" ? "en-US" : language === "es" ? "es-ES" : "ko-KR";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(volume);
}

function platformDisplayName(platform?: string) {
  switch (platform) {
    case "manifold": return "Manifold";
    case "kalshi": return "Kalshi";
    default: return "Polymarket";
  }
}

function platformAccentClass(platform?: string) {
  switch (platform) {
    case "manifold":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
    case "kalshi":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
    default:
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400";
  }
}

function platformTextColor(platform?: string) {
  switch (platform) {
    case "manifold": return "text-emerald-500";
    case "kalshi": return "text-amber-500";
    default: return "text-indigo-500";
  }
}

function platformButtonClass(platform?: string) {
  switch (platform) {
    case "manifold":
      return "bg-emerald-600 hover:bg-emerald-700";
    case "kalshi":
      return "bg-amber-600 hover:bg-amber-700";
    default:
      return "bg-indigo-600 hover:bg-indigo-700";
  }
}
