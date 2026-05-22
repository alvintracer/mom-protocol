"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  RiArrowRightLine,
  RiArrowRightUpLine,
  RiBarChart2Line,
  RiCheckboxCircleFill,
  RiCheckboxBlankCircleLine,
  RiFireLine,
  RiFlashlightLine,
  RiGlobalLine,
  RiSearchLine,
  RiCloseLine,
  RiSortDesc,
  RiStackLine,
  RiTimeLine,
} from "react-icons/ri";

import {
  exploreAttentions as fallbackExploreAttentions,
  exploreTopics,
  type ExploreAttention,
} from "@/shared/data/explore";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { text, type LocalizedText } from "@/shared/i18n/config";
import { createClient } from "@/shared/lib/supabase/client";
import { useTranslate } from "@/shared/hooks/useTranslate";
import type { Database } from "@/shared/types/database";
import {
  AttentionGridSkeleton,
  LoadingBar,
} from "@/shared/components/ui/LoadingStates";

const categoryKeys = [
  "all",
  "economics",
  "politics",
  "crypto",
  "sports",
  "entertainment",
  "ai",
] as const;

type AttentionCluster = Database["public"]["Tables"]["attention_clusters"]["Row"];
type AttentionSource = Database["public"]["Tables"]["attention_sources"]["Row"];
type AttentionMembership =
  Database["public"]["Tables"]["attention_memberships"]["Row"];
type CategoryKey = (typeof categoryKeys)[number];

export default function ExplorePage() {
  const { dictionary, t } = useI18n();
  const router = useRouter();
  const [attentions, setAttentions] = useState<ExploreAttention[]>(
    fallbackExploreAttentions,
  );
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  type ExternalMarket = {
    id: string;
    question: string;
    slug: string | null;
    url: string | null;
    outcomes: string[];
    volume: number | null;
    endDate: string | null;
    platform?: "polymarket" | "manifold" | "kalshi";
    subMarketCount?: number;
    image?: string | null;
  };
  const [externalMarkets, setExternalMarkets] = useState<ExternalMarket[]>([]);
  const [marketSort, setMarketSort] = useState<"volume" | "newest" | "ending_soon">("volume");
  const [platformFilters, setPlatformFilters] = useState({
    polymarket: true,
    manifold: true,
    kalshi: true,
  });
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [marketSearchQuery, setMarketSearchQuery] = useState("");
  const [isMarketSearchMode, setIsMarketSearchMode] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadExploreData() {
      setIsLoading(true);

      const { data: clusterRows, error: clusterError } = await supabase
        .from("attention_clusters")
        .select("*")
        .eq("status", "active")
        .order("attention_score", { ascending: false })
        .limit(48);

      if (!mounted) {
        return;
      }

      if (clusterError || !clusterRows || clusterRows.length === 0) {
        setAttentions(fallbackExploreAttentions);
        setIsLoading(false);
        return;
      }

      const clusterIds = clusterRows.map((cluster) => cluster.id);
      const [{ data: sourceRows }, { data: membershipRows }, { data: sponsorRows }] = await Promise.all([
        supabase
          .from("attention_sources")
          .select("*")
          .in("cluster_id", clusterIds),
        supabase
          .from("attention_memberships")
          .select("*")
          .in("attention_cluster_id", clusterIds),
        supabase
          .from("attention_sponsorships")
          .select("cluster_id, sponsor_name, sponsor_logo_url, sponsor_tagline, sponsor_url, sponsor_color")
          .in("cluster_id", clusterIds)
          .eq("status", "active"),
      ]);

      const sponsorMap = new Map<string, { name: string; logoUrl?: string | null; tagline?: string | null; url: string; color?: string | null }>();
      if (sponsorRows) {
        for (const s of sponsorRows) {
          sponsorMap.set(s.cluster_id, {
            name: s.sponsor_name,
            logoUrl: s.sponsor_logo_url,
            tagline: s.sponsor_tagline,
            url: s.sponsor_url,
            color: s.sponsor_color,
          });
        }
      }

      if (!mounted) {
        return;
      }

      setAttentions(
        clusterRows.map((cluster) =>
          mapClusterToExploreAttention(
            cluster,
            (sourceRows ?? []).filter((source) => source.cluster_id === cluster.id),
            (membershipRows ?? []).filter(
              (membership) => membership.attention_cluster_id === cluster.id,
            ),
            dictionary.explore.mappedAttentionSummary,
            dictionary.explore.live,
            dictionary.explore.awaitingResolution,
            dictionary.explore.daysLeft,
            sponsorMap.get(cluster.id) ?? null,
          ),
        ),
      );
      setIsLoading(false);
    }

    loadExploreData();

    return () => {
      mounted = false;
    };
  }, [
    dictionary.explore.awaitingResolution,
    dictionary.explore.daysLeft,
    dictionary.explore.live,
    dictionary.explore.mappedAttentionSummary,
  ]);

  /* ── Load external prediction market data ── */
  const loadExternalMarkets = useCallback(async () => {
    setIsLoadingMarkets(true);
    try {
      const enabledSources = Object.entries(platformFilters)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(",");
      const response = await fetch(
        `/api/markets/trending?limit=5&sort=${marketSort}&sources=${enabledSources}`,
      );
      const data = (await response.json()) as { markets?: ExternalMarket[] };
      setExternalMarkets(data.markets ?? []);
    } catch {
      setExternalMarkets([]);
    }
    setIsLoadingMarkets(false);
  }, [marketSort, platformFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadExternalMarkets();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadExternalMarkets]);

  const togglePlatform = useCallback((platform: "polymarket" | "manifold" | "kalshi") => {
    setPlatformFilters((prev) => {
      const next = { ...prev, [platform]: !prev[platform] };
      // Ensure at least one is active
      if (!next.polymarket && !next.manifold && !next.kalshi) return prev;
      return next;
    });
  }, []);

  /* ── Market keyword search ── */
  const searchMarkets = useCallback(async () => {
    const q = marketSearchQuery.trim();
    if (q.length < 2) return;
    setIsLoadingMarkets(true);
    setIsMarketSearchMode(true);
    try {
      const enabledSources = Object.entries(platformFilters)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(",");
      const response = await fetch(
        `/api/polymarket/search?q=${encodeURIComponent(q)}&source=${enabledSources}`,
      );
      const data = (await response.json()) as { markets?: ExternalMarket[] };
      setExternalMarkets(data.markets ?? []);
    } catch {
      setExternalMarkets([]);
    }
    setIsLoadingMarkets(false);
  }, [marketSearchQuery, platformFilters]);

  const clearMarketSearch = useCallback(() => {
    setMarketSearchQuery("");
    setIsMarketSearchMode(false);
    loadExternalMarkets();
  }, [loadExternalMarkets]);

  const filteredAttentions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return attentions.filter((attention) => {
      const matchesCategory =
        selectedCategory === "all" || attention.category === selectedCategory;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          attention.title.ko,
          attention.title.en,
          attention.title.es,
          attention.summary.ko,
          attention.sources.join(" "),
          attention.topics.join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [attentions, searchTerm, selectedCategory]);

  const breaking = filteredAttentions
    .filter((attention) => attention.urgency === "breaking")
    .slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      {isLoading ? <LoadingBar /> : null}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1" />
          <Link
            href="/attentions/new"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-blue-600 px-4 text-sm font-bold text-white transition-colors hover:bg-blue-700"
          >
            <span className="hidden sm:inline">{t(dictionary.explore.createAttention)}</span>
            <RiArrowRightLine className="size-4" />
          </Link>
        </div>

        <div className="relative mt-4">
          <RiSearchLine className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchTerm.trim()) {
                router.push(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
              }
            }}
            placeholder={t(dictionary.explore.searchPlaceholder)}
            className="h-12 w-full rounded-full border border-border bg-muted/60 pl-12 pr-4 text-[15px] text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-blue-500 focus:bg-background focus:ring-2 focus:ring-blue-500/10"
          />
        </div>
      </header>

      <main className="space-y-7 px-4 py-5 sm:px-6">
        <section className="space-y-3">
          <SectionHeader
            icon={<RiFlashlightLine className="size-5" />}
            title={t(dictionary.explore.breaking)}
            description={t(dictionary.explore.breakingDesc)}
          />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[1750px]:grid-cols-5">
            {breaking.map((attention) => (
              <ExploreAttentionCard key={attention.id} attention={attention} featured />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader
            icon={<RiFireLine className="size-5" />}
            title={t(dictionary.explore.popularTopics)}
            description={t(dictionary.explore.topicSource)}
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {exploreTopics.map((topic) => (
              <Link
                key={topic.slug}
                href={`/topic/${topic.slug}`}
                className="min-w-fit rounded-full border border-border bg-background px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900/50"
              >
                #{topic.label}
                <span className="ml-2 text-xs text-blue-500">{topic.trend}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Global Prediction Markets ── */}
        <section className="space-y-3">
          <SectionHeader
            icon={<RiGlobalLine className="size-5" />}
            title={t(dictionary.externalMarkets.sectionTitle)}
            description={t(dictionary.externalMarkets.sectionDesc)}
          />

          {/* Sort + Platform filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sort pills */}
            {(["volume", "newest", "ending_soon"] as const).map((mode) => {
              const icons = { volume: RiBarChart2Line, newest: RiSortDesc, ending_soon: RiTimeLine };
              const Icon = icons[mode];
              const labels = {
                volume: dictionary.externalMarkets.sortVolume,
                newest: dictionary.externalMarkets.sortNewest,
                ending_soon: dictionary.externalMarkets.sortEndingSoon,
              };
              return (
                <button
                  key={mode}
                  onClick={() => setMarketSort(mode)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                    marketSort === mode
                      ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                      : "border-border bg-background text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900/50"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {t(labels[mode])}
                </button>
              );
            })}

            <span className="mx-1 h-5 w-px bg-border" />

            {/* Platform toggles */}
            {(["polymarket", "manifold", "kalshi"] as const).map((platform) => {
              const active = platformFilters[platform];
              const CheckIcon = active ? RiCheckboxCircleFill : RiCheckboxBlankCircleLine;
              return (
                <button
                  key={platform}
                  onClick={() => togglePlatform(platform)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${
                    active
                      ? `border-transparent ${platformToggleActiveStyle(platform)}`
                      : "border-border bg-background text-muted-foreground/60 line-through"
                  }`}
                >
                  <CheckIcon className="size-3.5" />
                  {platformLabel(platform)}
                </button>
              );
            })}
          </div>

          {/* Market keyword search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={marketSearchQuery}
                onChange={(e) => setMarketSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") searchMarkets(); }}
                placeholder={t(dictionary.externalMarkets.searchPlaceholder)}
                className="h-9 w-full rounded-xl border border-border bg-muted/60 pl-9 pr-3 text-[13px] text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-blue-500 focus:bg-background focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
            <button
              onClick={searchMarkets}
              disabled={marketSearchQuery.trim().length < 2}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-[12px] font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RiSearchLine className="size-3.5" />
              {t(dictionary.externalMarkets.searchBtn)}
            </button>
            {isMarketSearchMode ? (
              <button
                onClick={clearMarketSearch}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-border bg-background px-3 text-[12px] font-bold text-muted-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <RiCloseLine className="size-4" />
                {t(dictionary.externalMarkets.clearSearch)}
              </button>
            ) : null}
          </div>

          {/* Search mode indicator */}
          {isMarketSearchMode ? (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-500/5 px-3 py-1.5">
              <RiSearchLine className="size-3.5 text-blue-500" />
              <p className="text-[12px] font-bold text-blue-600 dark:text-blue-400">
                &ldquo;{marketSearchQuery}&rdquo; {t(dictionary.externalMarkets.searchResultLabel)} ({externalMarkets.length})
              </p>
            </div>
          ) : null}

          {isLoadingMarkets ? (
            <div className="flex items-center justify-center py-8">
              <div className="size-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : externalMarkets.length > 0 ? (
            <TranslatedMarketGrid markets={externalMarkets} />
          ) : (
            <div className="rounded-2xl border border-border bg-background p-6 text-center">
              <p className="text-sm font-bold text-muted-foreground">
                {t(dictionary.explore.emptyTitle)}
              </p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeader
            icon={<RiStackLine className="size-5" />}
            title={t(dictionary.explore.categories)}
            description={t(dictionary.explore.unifiedSources)}
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categoryKeys.map((key) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`min-w-fit rounded-full border px-4 py-2 text-sm font-bold transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900/50 ${
                  selectedCategory === key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-foreground"
                }`}
              >
                {categoryLabel(key, dictionary, t)}
              </button>
            ))}
          </div>
          {isLoading ? (
            <AttentionGridSkeleton />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[1750px]:grid-cols-5">
              {filteredAttentions.map((attention) => (
                <ExploreAttentionCard key={attention.id} attention={attention} />
              ))}
            </div>
          )}
          {!isLoading && filteredAttentions.length === 0 ? (
            <div className="rounded-2xl border border-border bg-background p-6 text-center">
              <p className="text-sm font-black text-foreground">
                {t(dictionary.explore.emptyTitle)}
              </p>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                {t(dictionary.explore.emptyDescription)}
              </p>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function ExploreAttentionCard({
  attention,
  featured = false,
}: {
  attention: ExploreAttention;
  featured?: boolean;
}) {
  const { dictionary, language, t } = useI18n();
  const slug = attention.slug || attention.id;

  return (
    <Link
      href={`/a/${slug}`}
      className={[
        "group flex flex-col rounded-2xl border border-border bg-background p-3.5 transition-all hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-sm dark:hover:bg-zinc-900/50",
        featured ? "min-h-48 md:min-h-56" : "min-h-[140px] max-h-[calc(100vw*9/16)]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-blue-500">a/{slug}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-black text-blue-500">
              {categoryLabel(attention.category, dictionary, t)}
            </span>
            {attention.urgency === "breaking" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-black text-red-500">
                <RiFireLine className="size-3.5" />
                {t(dictionary.explore.breaking)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex-1">
        <h2 className="line-clamp-2 text-[15px] font-black leading-snug text-foreground">
          {t(attention.title)}
        </h2>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
          {t(attention.summary)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        <Metric label={t(dictionary.explore.energy)} value={attention.attentionScore} />
        <Metric
          label={t(dictionary.explore.participants)}
          value={compact(attention.participantCount, language)}
        />
        <Metric label={t(dictionary.explore.posts)} value={attention.postCount} />
      </div>

      {attention.sponsor && (
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <span className="text-[10px] font-bold text-muted-foreground">
            {attention.sponsor.tagline || "Sponsored by"}
          </span>
          {attention.sponsor.logoUrl ? (
            <img
              src={attention.sponsor.logoUrl}
              alt={attention.sponsor.name}
              className="size-4 rounded-sm object-contain"
            />
          ) : null}
          <span className="text-[10px] font-black text-foreground">
            {attention.sponsor.name}
          </span>
        </div>
      )}
    </Link>
  );
}

type ExternalMarketCardData = {
  id: string;
  question: string;
  slug: string | null;
  url: string | null;
  outcomes: string[];
  volume: number | null;
  endDate: string | null;
  platform?: "polymarket" | "manifold" | "kalshi";
  subMarketCount?: number;
  image?: string | null;
};

/** Wrapper that batch-translates all market questions + outcomes */
function TranslatedMarketGrid({ markets }: { markets: ExternalMarketCardData[] }) {
  // Collect all translatable strings: questions + outcome labels
  const allTexts = useMemo(() => {
    const set = new Set<string>();
    for (const m of markets) {
      set.add(m.question);
      for (const o of m.outcomes) {
        if (!["YES", "NO", "Yes", "No", "Up", "Down"].includes(o)) {
          set.add(o);
        }
      }
    }
    return [...set];
  }, [markets]);

  const { tx } = useTranslate(allTexts);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 min-[1750px]:grid-cols-5">
      {markets.map((market) => (
        <ExternalMarketCard key={`${market.platform}-${market.id}`} market={market} tx={tx} />
      ))}
    </div>
  );
}

function ExternalMarketCard({ market, tx }: { market: ExternalMarketCardData; tx: (s: string) => string }) {
  const { dictionary, language, t } = useI18n();
  const platformName = platformLabel(market.platform);
  const encodedMarket = encodeURIComponent(JSON.stringify({
    id: market.id,
    question: market.question,
    slug: market.slug,
    url: market.url,
    outcomes: market.outcomes,
    volume: market.volume,
    endDate: market.endDate,
    platform: market.platform,
  }));

  return (
    <Link
      href={`/market/${market.platform ?? "polymarket"}/${market.slug ?? market.id}?data=${encodedMarket}`}
      className="group flex min-h-48 flex-col rounded-2xl border border-border bg-background p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-sm hover:border-blue-500/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${platformBadgeStyle(market.platform)}`}>
              {platformName}
            </span>
            {(market.subMarketCount ?? 0) > 1 ? (
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-bold text-zinc-500 dark:bg-zinc-800">
                {market.subMarketCount} markets
              </span>
            ) : null}
            <span className="text-[10px] font-bold text-muted-foreground">
              {t(dictionary.externalMarkets.externalMarketLabel)}
            </span>
          </div>
        </div>
        <RiArrowRightUpLine className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="mt-2.5 flex-1">
        <h2 className="line-clamp-2 text-[15px] font-black leading-snug text-foreground">
          {tx(market.question)}
        </h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {market.outcomes.slice(0, 4).map((outcome, idx) => (
            <span
              key={`${outcome}-${idx}`}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {tx(outcome)}
            </span>
          ))}
          {market.outcomes.length > 4 ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800">
              +{market.outcomes.length - 4}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        <Metric
          label={t(dictionary.externalMarkets.volume)}
          value={market.volume ? compact(market.volume, language) : "—"}
        />
        <Metric
          label={t(dictionary.externalMarkets.outcomes)}
          value={market.outcomes.length}
        />
        <Metric
          label={t(dictionary.externalMarkets.endsAt)}
          value={market.endDate ? market.endDate.slice(0, 10) : "—"}
        />
      </div>
    </Link>
  );
}

function platformLabel(platform?: string) {
  switch (platform) {
    case "manifold": return "Manifold";
    case "kalshi": return "Kalshi";
    default: return "Polymarket";
  }
}

function platformBadgeStyle(platform?: string) {
  switch (platform) {
    case "manifold":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
    case "kalshi":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
    default:
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400";
  }
}

function platformToggleActiveStyle(platform: string) {
  switch (platform) {
    case "manifold":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "kalshi":
      return "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400";
    default:
      return "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400";
  }
}
function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-foreground">
          <span className="text-blue-500">{icon}</span>
          <h2 className="text-xl font-black tracking-tight">{title}</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-1.5 py-1.5">
      <p className="truncate text-[11px] font-bold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[13px] font-black text-foreground">{value}</p>
    </div>
  );
}

function compact(value: number, language: string) {
  return new Intl.NumberFormat(localeFromLanguage(language), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function mapClusterToExploreAttention(
  cluster: AttentionCluster,
  sources: AttentionSource[],
  memberships: AttentionMembership[],
  fallbackSummary: LocalizedText,
  liveLabel: LocalizedText,
  awaitingResolutionLabel: LocalizedText,
  daysLeftLabel: LocalizedText,
  sponsor?: ExploreAttention["sponsor"],
): ExploreAttention {
  const sourceNames = Array.from(
    new Set(sources.map((source) => source.source_platform).filter(Boolean)),
  );
  const sourceSignals = sources
    .map((source) => source.reference_signal)
    .filter((value): value is number => typeof value === "number");
  const referenceSignal =
    sourceSignals.length > 0
      ? Math.round(
          sourceSignals.reduce((total, value) => total + value, 0) /
            sourceSignals.length,
        )
      : Math.min(99, Math.max(1, Math.round(Number(cluster.attention_score))));
  const closestEndAt = sources
    .map((source) => source.ends_at)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  return {
    id: cluster.id,
    slug: cluster.slug || cluster.id,
    title: localize(cluster.title),
    summary: cluster.description ? localize(cluster.description) : fallbackSummary,
    category: normalizeCategory(cluster.category),
    urgency: resolveUrgency(Number(cluster.attention_score), cluster.post_count),
    referenceSignal,
    attentionScore: Math.round(Number(cluster.attention_score)),
    participantCount: memberships.length,
    postCount: cluster.post_count,
    sourceCount: cluster.source_count || sources.length,
    sources: sourceNames.length > 0 ? sourceNames : ["momment."],
    topics: deriveTopics(cluster, sources),
    endsInLabel: closestEndAt
      ? formatEndsIn(closestEndAt, liveLabel, awaitingResolutionLabel, daysLeftLabel)
      : liveLabel,
    ruleStatus: sources.some((source) => Boolean(source.rules_text)) ? "ready" : "draft",
    sponsor: sponsor ?? null,
  };
}

function localize(value: string): LocalizedText {
  return text(value, value, value);
}

function normalizeCategory(category: string | null): ExploreAttention["category"] {
  if (
    category === "economics" ||
    category === "politics" ||
    category === "crypto" ||
    category === "sports" ||
    category === "entertainment" ||
    category === "ai"
  ) {
    return category;
  }

  return "economics";
}

function resolveUrgency(score: number, postCount: number): ExploreAttention["urgency"] {
  if (score >= 80 || postCount >= 100) {
    return "breaking";
  }

  if (score >= 45 || postCount >= 20) {
    return "hot";
  }

  return "steady";
}

function deriveTopics(cluster: AttentionCluster, sources: AttentionSource[]) {
  const words = `${cluster.title} ${cluster.description ?? ""} ${sources
    .map((source) => source.title)
    .join(" ")}`
    .split(/[\s,/·]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}-]/gu, ""))
    .filter((word) => word.length >= 2)
    .slice(0, 4);

  return Array.from(new Set(words));
}

function formatEndsIn(
  value: string,
  liveLabel: LocalizedText,
  awaitingResolutionLabel: LocalizedText,
  daysLeftLabel: LocalizedText,
): LocalizedText {
  const target = new Date(value).getTime();
  const days = Math.ceil((target - Date.now()) / 86_400_000);

  if (Number.isNaN(days)) {
    return liveLabel;
  }

  if (days <= 0) {
    return awaitingResolutionLabel;
  }

  return text(`${days}${daysLeftLabel.ko}`, `${days}${daysLeftLabel.en}`, `${days}${daysLeftLabel.es}`);
}

function localeFromLanguage(language: string) {
  if (language === "en") return "en-US";
  if (language === "es") return "es-ES";
  return "ko-KR";
}

function categoryLabel(
  key: CategoryKey | ExploreAttention["category"],
  dictionary: ReturnType<typeof useI18n>["dictionary"],
  t: ReturnType<typeof useI18n>["t"],
) {
  const labels = {
    all: dictionary.explore.all,
    economics: dictionary.explore.economics,
    politics: dictionary.explore.politics,
    crypto: dictionary.explore.crypto,
    sports: dictionary.explore.sports,
    entertainment: dictionary.explore.entertainment,
    ai: dictionary.explore.ai,
  };

  return t(labels[key]);
}
