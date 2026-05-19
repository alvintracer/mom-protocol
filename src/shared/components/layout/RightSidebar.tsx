"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RiArrowRightUpLine,
  RiFireLine,
  RiGlobalLine,
  RiHashtag,
  RiMoreFill,
  RiSearchLine,
  RiUser3Line,
  RiUserFollowLine,
} from "react-icons/ri";

import { exploreAttentions, exploreTopics } from "@/shared/data/explore";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import { useTranslate } from "@/shared/hooks/useTranslate";
import { AdSlot } from "@/shared/components/ads/AdSlot";
import type { Database } from "@/shared/types/database";

type AttentionCluster = Database["public"]["Tables"]["attention_clusters"]["Row"];
type AttentionRule = Database["public"]["Tables"]["attention_rules"]["Row"];
type TopicRow = Database["public"]["Tables"]["topics"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/* ─── search result types ─── */
type SearchResult = {
  attentions: AttentionCluster[];
  topics: TopicRow[];
  users: Profile[];
};

/* ─── outcome option helpers ─── */
function normalizeOutcomes(raw: AttentionRule["supported_outcomes"]): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).slice(0, 3);
  if (typeof raw === "object" && raw !== null) {
    return Object.values(raw as Record<string, unknown>).map(String).slice(0, 3);
  }
  return [];
}

export function RightSidebar() {
  const { dictionary, language, t } = useI18n();

  /* ─── Live data state ─── */
  const [attentions, setAttentions] = useState<AttentionCluster[]>([]);
  const [attentionRules, setAttentionRules] = useState<Record<string, string[]>>({});
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [leaders, setLeaders] = useState<Profile[]>([]);

  type SidebarMarket = {
    id: string;
    question: string;
    slug: string | null;
    url: string | null;
    outcomes: string[];
    volume: number | null;
    endDate: string | null;
    platform: "polymarket" | "manifold" | "kalshi";
    subMarketCount?: number;
  };
  const [globalMarkets, setGlobalMarkets] = useState<SidebarMarket[]>([]);

  /* ─── Search state ─── */
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  /* ─── Load sidebar data from Supabase (with fallbacks) ─── */
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadData() {
      /* ── Attentions (top 5 by attention_score) ── */
      const { data: clusterData } = await supabase
        .from("attention_clusters")
        .select("*")
        .in("status", ["active", "reviewing"])
        .order("attention_score", { ascending: false })
        .limit(5);

      if (mounted && clusterData && clusterData.length > 0) {
        setAttentions(clusterData);

        // fetch rules for these attentions via canonical_event_id -> event_id
        const eventIds = clusterData
          .map((c) => c.canonical_event_id)
          .filter((id): id is string => id !== null);

        if (eventIds.length > 0) {
          const { data: rulesData } = await supabase
            .from("attention_rules")
            .select("event_id, supported_outcomes")
            .in("event_id", eventIds);

          if (mounted && rulesData) {
            // Map event_id -> cluster_id for reverse lookup
            const eventToCluster: Record<string, string> = {};
            for (const c of clusterData) {
              if (c.canonical_event_id) {
                eventToCluster[c.canonical_event_id] = c.id;
              }
            }
            const rulesMap: Record<string, string[]> = {};
            for (const rule of rulesData) {
              const clusterId = eventToCluster[rule.event_id];
              if (clusterId) {
                rulesMap[clusterId] = normalizeOutcomes(rule.supported_outcomes);
              }
            }
            setAttentionRules(rulesMap);
          }
        }
      } else if (mounted) {
        // Fallback to explore mock attentions
        const fallback: AttentionCluster[] = exploreAttentions.slice(0, 5).map((ea) => ({
          id: ea.id,
          canonical_event_id: null,
          slug: ea.slug || ea.id,
          title: ea.title[language] ?? ea.title.ko,
          description: ea.summary[language] ?? ea.summary.ko,
          category: ea.category,
          original_language: "ko" as const,
          status: "active" as const,
          source_count: ea.sourceCount,
          post_count: ea.postCount,
          comment_count: 0,
          attention_score: ea.attentionScore,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));
        setAttentions(fallback);
        // Mock rules from explore topics
        const mockRulesMap: Record<string, string[]> = {};
        for (const ea of exploreAttentions.slice(0, 5)) {
          mockRulesMap[ea.id] = ["YES", "NO"];
        }
        setAttentionRules(mockRulesMap);
      }

      /* ── Topics ── */
      const { data: topicData } = await supabase
        .from("topics")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(8);

      if (mounted && topicData && topicData.length > 0) {
        setTopics(topicData);
      }
      // fallback topics stay empty; we show exploreTopics as fallback in render

      /* ── Opinion Leaders (top 4 by mom_energy) ── */
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .order("mom_energy", { ascending: false })
        .limit(4);

      if (mounted && profileData && profileData.length > 0) {
        setLeaders(profileData);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, [language]);

  /* ── Load global markets for sidebar ── */
  useEffect(() => {
    let mounted = true;
    async function loadMarkets() {
      try {
        const res = await fetch("/api/markets/trending?limit=2&sort=volume");
        const data = (await res.json()) as { markets?: SidebarMarket[] };
        if (mounted) setGlobalMarkets((data.markets ?? []).slice(0, 4));
      } catch { /* ignore */ }
    }
    loadMarkets();
    return () => { mounted = false; };
  }, []);

  /* ─── Real search ─── */
  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const supabase = createClient();
    const searchPattern = `%${q.trim()}%`;

    const [attentionRes, topicRes, userRes] = await Promise.all([
      supabase
        .from("attention_clusters")
        .select("*")
        .or(`title.ilike.${searchPattern},description.ilike.${searchPattern},slug.ilike.${searchPattern}`)
        .order("attention_score", { ascending: false })
        .limit(5),
      supabase
        .from("topics")
        .select("*")
        .or(`canonical_label.ilike.${searchPattern},slug.ilike.${searchPattern}`)
        .limit(5),
      supabase
        .from("profiles")
        .select("*")
        .or(`handle.ilike.${searchPattern},display_name.ilike.${searchPattern}`)
        .order("mom_energy", { ascending: false })
        .limit(5),
    ]);

    setSearchResults({
      attentions: attentionRes.data ?? [],
      topics: topicRes.data ?? [],
      users: userRes.data ?? [],
    });
    setIsSearching(false);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  }, [performSearch]);

  /* ─── Display data ─── */
  const displayTopics = topics.length > 0
    ? topics.map((t) => ({ slug: t.slug, label: t.canonical_label, kind: t.kind }))
    : exploreTopics.slice(0, 8).map((t) => ({ slug: t.slug, label: t.label, kind: "user_hashtag" as const }));

  const showSearch = query.length > 0;

  return (
    <aside className="hidden h-screen shrink-0 space-y-4 overflow-y-auto border-l border-border bg-background px-4 py-5 xl:sticky xl:top-0 xl:block 2xl:px-6">
      {/* ─── Search Bar ─── */}
      <div className="group relative">
        <RiSearchLine className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-colors group-focus-within:text-blue-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t(dictionary.topBar.search)}
          className="h-10 w-full rounded-full border border-transparent bg-zinc-100 dark:bg-zinc-900 pl-10 pr-4 text-[14px] outline-none transition-all placeholder:text-muted-foreground focus:border-blue-500 focus:bg-background focus:ring-1 focus:ring-blue-500/30"
        />
      </div>

      {/* ─── Search Results Overlay ─── */}
      {showSearch ? (
        <div className="rounded-2xl border border-border/80 bg-background shadow-lg overflow-hidden">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <div className="size-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : searchResults ? (
            <div className="divide-y divide-border">
              {/* Attentions */}
              {searchResults.attentions.length > 0 ? (
                <div>
                  <p className="px-4 pt-3 pb-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    {t(dictionary.sidebar.searchAttentions)}
                  </p>
                  {searchResults.attentions.map((a) => (
                    <Link
                      key={a.id}
                      href={`/a/${a.slug || a.id}`}
                      className="block px-4 py-2 transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/40"
                      onClick={() => { setQuery(""); setSearchResults(null); }}
                    >
                      <p className="text-[13px] font-bold text-foreground line-clamp-1">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {a.attention_score.toLocaleString()} attention · {a.post_count} {t(dictionary.sidebar.postsCount)}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : null}
              {/* Topics */}
              {searchResults.topics.length > 0 ? (
                <div>
                  <p className="px-4 pt-3 pb-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    {t(dictionary.sidebar.searchTopics)}
                  </p>
                  {searchResults.topics.map((tp) => (
                    <Link
                      key={tp.id}
                      href={`/topic/${tp.slug}`}
                      className="flex items-center gap-2 px-4 py-2 transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/40"
                      onClick={() => { setQuery(""); setSearchResults(null); }}
                    >
                      <RiHashtag className="size-3.5 text-blue-500 shrink-0" />
                      <span className="text-[13px] font-bold text-foreground">{tp.canonical_label}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
              {/* Users */}
              {searchResults.users.length > 0 ? (
                <div>
                  <p className="px-4 pt-3 pb-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    {t(dictionary.sidebar.searchUsers)}
                  </p>
                  {searchResults.users.map((u) => (
                    <Link
                      key={u.id}
                      href={`/u/${u.handle ?? u.id}`}
                      className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/40"
                      onClick={() => { setQuery(""); setSearchResults(null); }}
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 dark:from-zinc-200 dark:to-white text-[10px] font-bold text-white dark:text-zinc-950">
                        {initial(u.display_name ?? u.handle)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-foreground truncate">{u.display_name || u.handle}</p>
                        <p className="text-[11px] text-muted-foreground">u/{u.handle} · {Number(u.mom_energy).toLocaleString()} MOM</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}
              {/* No results */}
              {searchResults.attentions.length === 0 &&
               searchResults.topics.length === 0 &&
               searchResults.users.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm font-medium text-muted-foreground">
                  {t(dictionary.sidebar.noResults)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {/* ─── Today's Attention ─── */}
          <section className="rounded-2xl border border-border/80 bg-zinc-50/80 dark:bg-zinc-900/40 overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-lg font-black text-foreground">
                {t(dictionary.sidebar.todayAttention)}
              </p>
            </div>
            <div>
              {attentions.map((attention, i) => {
                const outcomes = attentionRules[attention.id] ?? [];
                return (
                  <Link
                    key={attention.id}
                    href={`/a/${attention.slug || attention.id}`}
                    className="group block cursor-pointer px-4 py-2.5 transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        #{i + 1} · {attention.category || "general"}
                      </p>
                      <RiMoreFill className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="mt-0.5 text-[13px] font-bold leading-5 text-foreground line-clamp-2">
                      {attention.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      <span className="tabular-nums font-medium text-blue-600 dark:text-blue-400">
                        {attention.attention_score.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground">
                        · {attention.post_count} {t(dictionary.sidebar.postsCount)}
                      </span>
                      {outcomes.length > 0 ? (
                        <span className="ml-auto flex gap-1">
                          {outcomes.map((o) => (
                            <span
                              key={o}
                              className={`inline-flex rounded px-1.5 py-px text-[10px] font-black ${
                                o.toLowerCase() === "yes" || o.toLowerCase() === "above"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                  : o.toLowerCase() === "no" || o.toLowerCase() === "below"
                                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                                    : "bg-zinc-200/70 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                              }`}
                            >
                              {o}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ─── Trending Topics ─── */}
          <section className="rounded-2xl border border-border/80 bg-zinc-50/80 dark:bg-zinc-900/40 overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <RiFireLine className="size-4 text-orange-500" />
              <p className="text-lg font-black text-foreground">
                {t(dictionary.sidebar.trendingTopics)}
              </p>
            </div>
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {displayTopics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/topic/${topic.slug}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1 text-[12px] font-bold text-foreground transition-all hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <RiHashtag className="size-3 text-muted-foreground" />
                  {topic.label}
                </Link>
              ))}
            </div>
          </section>

          {/* ─── Opinion Leaders ─── */}
          {leaders.length > 0 ? (
            <section className="rounded-2xl border border-border/80 bg-zinc-50/80 dark:bg-zinc-900/40 overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                <RiUserFollowLine className="size-4 text-blue-500" />
                <p className="text-lg font-black text-foreground">
                  {t(dictionary.sidebar.opinionLeaders)}
                </p>
              </div>
              <div className="pb-2">
                {leaders.map((leader) => (
                  <LeaderRow key={leader.id} profile={leader} />
                ))}
              </div>
            </section>
          ) : null}

          {/* ── Global Markets ── */}
          {globalMarkets.length > 0 ? (
            <SidebarGlobalMarkets markets={globalMarkets} />
          ) : null}

          {/* ── Sidebar Ad Slot ── */}
          <AdSlot
            position="sidebar"
            size="native"
            adsenseSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR}
          />

          {/* ─── Footer ─── */}
          <div className="px-4 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground/70">
            <a href="#" className="hover:underline">{t(dictionary.footer.terms)}</a>
            <a href="#" className="hover:underline">{t(dictionary.footer.privacy)}</a>
            <a href="#" className="hover:underline">{t(dictionary.footer.cookies)}</a>
            <span>© 2026 TRAVERSE</span>
          </div>
        </>
      )}
    </aside>
  );
}

function LeaderRow({ profile }: { profile: Profile }) {
  const { dictionary, t } = useI18n();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleFollow = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/auth/login?next=/";
      return;
    }

    const { data, error } = await supabase.rpc("toggle_user_follow", {
      target_user_id: profile.id,
    });

    setIsLoading(false);

    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      setIsFollowing((prev) => !prev);
      return;
    }

    setIsFollowing(data.followed === true);
  }, [profile.id]);

  return (
    <div className="flex items-center justify-between cursor-pointer hover:bg-zinc-100/80 dark:hover:bg-zinc-800/40 px-4 py-2.5 transition-colors">
      <Link
        href={`/u/${profile.handle ?? profile.id}`}
        className="flex items-center gap-3 min-w-0"
      >
        <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 dark:from-zinc-200 dark:to-white text-xs font-bold text-white dark:text-zinc-950 shrink-0">
          {initial(profile.display_name ?? profile.handle)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-foreground">
            {profile.display_name || profile.handle}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            u/{profile.handle ?? "anon"} · {Number(profile.mom_energy).toLocaleString()} MOM
          </p>
        </div>
      </Link>
      <button
        onClick={handleFollow}
        disabled={isLoading}
        className={`rounded-full px-3.5 py-1 text-[12px] font-bold transition-all disabled:opacity-50 shrink-0 ${
          isFollowing
            ? "border border-border bg-background text-foreground hover:border-red-300 hover:text-red-500"
            : "bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200"
        }`}
      >
        {isFollowing
          ? t(dictionary.actions.following)
          : t(dictionary.actions.follow)}
      </button>
    </div>
  );
}

function initial(value?: string | null) {
  return value?.trim().slice(0, 1).toUpperCase() || "m";
}

function sidebarPlatformBadge(platform: string) {
  switch (platform) {
    case "manifold":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
    case "kalshi":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
    default:
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400";
  }
}

type SidebarMarketItem = {
  id: string;
  question: string;
  slug: string | null;
  url: string | null;
  outcomes: string[];
  volume: number | null;
  endDate: string | null;
  platform: "polymarket" | "manifold" | "kalshi";
  subMarketCount?: number;
};

function SidebarGlobalMarkets({ markets }: { markets: SidebarMarketItem[] }) {
  const { dictionary, language, t } = useI18n();

  const questions = useMemo(() => markets.map((m) => m.question), [markets]);
  const { tx } = useTranslate(questions);

  return (
    <section className="rounded-2xl border border-border/80 bg-zinc-50/80 dark:bg-zinc-900/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <RiGlobalLine className="size-4 text-indigo-500" />
        <p className="text-lg font-black text-foreground">
          {t(dictionary.externalMarkets.sidebarTitle)}
        </p>
      </div>
      <div>
        {markets.map((market, i) => (
          <Link
            key={`${market.platform}-${market.id}`}
            href={`/market/${market.platform}/${market.slug ?? market.id}?data=${encodeURIComponent(JSON.stringify(market))}`}
            className="group block px-4 py-2.5 transition-colors hover:bg-zinc-100/80 dark:hover:bg-zinc-800/40"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-medium text-muted-foreground">
                  #{i + 1}
                </p>
                <span className={`inline-flex rounded px-1 py-px text-[8px] font-black uppercase tracking-wider ${sidebarPlatformBadge(market.platform)}`}>
                  {market.platform === "manifold" ? "MAN" : market.platform === "kalshi" ? "KAL" : "POLY"}
                </span>
              </div>
              <RiArrowRightUpLine className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-0.5 text-[13px] font-bold leading-5 text-foreground line-clamp-2">
              {tx(market.question)}
            </p>
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              {market.volume ? (
                <span className="tabular-nums font-medium text-blue-600 dark:text-blue-400">
                  {new Intl.NumberFormat(language === "en" ? "en-US" : "ko-KR", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(market.volume)}
                </span>
              ) : null}
              <span className="text-muted-foreground">
                · {market.outcomes.length} {t(dictionary.externalMarkets.outcomes)}
              </span>
              {(market.subMarketCount ?? 0) > 1 ? (
                <span className="ml-auto text-muted-foreground">
                  {market.subMarketCount} {t(dictionary.externalMarkets.markets)}
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
