"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  RiArrowLeftLine,
  RiFlashlightLine,
  RiHashtag,
  RiSearchLine,
  RiUser3Line,
  RiArticleLine,
  RiCloseLine,
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import type { Database } from "@/shared/types/database";

type AttentionCluster = Database["public"]["Tables"]["attention_clusters"]["Row"];
type TopicRow = Database["public"]["Tables"]["topics"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type PostRow = Database["public"]["Tables"]["posts"]["Row"];

type TabKey = "all" | "attentions" | "topics" | "users" | "posts";

const TABS: TabKey[] = ["all", "attentions", "topics", "users", "posts"];

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const initialTab = (searchParams.get("tab") as TabKey) || "all";

  const { dictionary, language, t } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Results
  const [attentions, setAttentions] = useState<AttentionCluster[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<(PostRow & { author?: Profile | null })[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setAttentions([]);
        setTopics([]);
        setUsers([]);
        setPosts([]);
        setHasSearched(false);
        return;
      }

      setIsLoading(true);
      setHasSearched(true);
      const supabase = createClient();
      const pattern = `%${q.trim()}%`;

      const [attRes, topicRes, userRes, postRes] = await Promise.all([
        supabase
          .from("attention_clusters")
          .select("*")
          .or(
            `title.ilike.${pattern},description.ilike.${pattern},slug.ilike.${pattern}`,
          )
          .order("attention_score", { ascending: false })
          .limit(20),
        supabase
          .from("topics")
          .select("*")
          .or(`canonical_label.ilike.${pattern},slug.ilike.${pattern}`)
          .order("canonical_label")
          .limit(20),
        supabase
          .from("profiles")
          .select("*")
          .or(`handle.ilike.${pattern},display_name.ilike.${pattern}`)
          .order("mom_energy", { ascending: false })
          .limit(20),
        supabase
          .from("posts")
          .select("*")
          .eq("visibility", "public")
          .eq("is_deleted", false)
          .or(
            `original_title.ilike.${pattern},original_body.ilike.${pattern}`,
          )
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      // Fetch post authors
      const postRows = postRes.data ?? [];
      const authorIds = [...new Set(postRows.map((p) => p.user_id))];
      let authorsMap = new Map<string, Profile>();
      if (authorIds.length > 0) {
        const { data: authorData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", authorIds);
        authorsMap = new Map(
          (authorData ?? []).map((a) => [a.id, a]),
        );
      }

      setAttentions(attRes.data ?? []);
      setTopics(topicRes.data ?? []);
      setUsers(userRes.data ?? []);
      setPosts(
        postRows.map((p) => ({
          ...p,
          author: authorsMap.get(p.user_id) ?? null,
        })),
      );
      setIsLoading(false);
    },
    [],
  );

  // Search on mount if there's a query param
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
    inputRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(value);
      // Update URL without navigation
      const url = value.trim()
        ? `/search?q=${encodeURIComponent(value.trim())}`
        : "/search";
      window.history.replaceState(null, "", url);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      performSearch(query);
      const url = query.trim()
        ? `/search?q=${encodeURIComponent(query.trim())}`
        : "/search";
      window.history.replaceState(null, "", url);
    }
  };

  const totalResults =
    attentions.length + topics.length + users.length + posts.length;

  const tabCounts: Record<TabKey, number> = {
    all: totalResults,
    attentions: attentions.length,
    topics: topics.length,
    users: users.length,
    posts: posts.length,
  };

  const tabIcons: Record<TabKey, React.ReactNode> = {
    all: null,
    attentions: <RiFlashlightLine className="size-3.5" />,
    topics: <RiHashtag className="size-3.5" />,
    users: <RiUser3Line className="size-3.5" />,
    posts: <RiArticleLine className="size-3.5" />,
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <RiArrowLeftLine className="size-5" />
          </button>

          <div className="relative flex-1">
            <RiSearchLine className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t(dictionary.search.placeholder)}
              className="h-10 w-full rounded-full border border-border bg-zinc-100 pl-10 pr-10 text-[14px] font-semibold text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-blue-500 focus:bg-background focus:ring-1 focus:ring-blue-500/30 dark:bg-zinc-900"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setHasSearched(false);
                  setAttentions([]);
                  setTopics([]);
                  setUsers([]);
                  setPosts([]);
                  window.history.replaceState(null, "", "/search");
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <RiCloseLine className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        {hasSearched && (
          <div className="flex overflow-x-auto px-4 no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative flex shrink-0 items-center gap-1.5 px-4 py-3 text-[13px] font-bold transition-colors ${
                  activeTab === tab
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground/80"
                }`}
              >
                {tabIcons[tab]}
                {t(
                  tab === "all"
                    ? dictionary.search.all
                    : tab === "attentions"
                      ? dictionary.search.attentions
                      : tab === "topics"
                        ? dictionary.search.topics
                        : tab === "users"
                          ? dictionary.search.users
                          : dictionary.search.posts,
                )}
                {tabCounts[tab] > 0 && (
                  <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">
                    {tabCounts[tab]}
                  </span>
                )}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full bg-blue-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Content */}
      <div className="mx-auto max-w-[740px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="size-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : hasSearched && totalResults === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <RiSearchLine className="size-12 text-muted-foreground/30" />
            <p className="mt-4 text-lg font-bold text-foreground">
              {t(dictionary.search.noResults)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(dictionary.search.noResultsDesc)}
            </p>
          </div>
        ) : hasSearched ? (
          <div className="divide-y divide-border">
            {/* Attentions */}
            {(activeTab === "all" || activeTab === "attentions") &&
              attentions.length > 0 && (
                <section className="py-3">
                  <SectionLabel
                    icon={<RiFlashlightLine className="size-4 text-blue-500" />}
                    label={t(dictionary.search.attentions)}
                    count={attentions.length}
                  />
                  {(activeTab === "all"
                    ? attentions.slice(0, 5)
                    : attentions
                  ).map((a) => (
                    <Link
                      key={a.id}
                      href={`/a/${a.slug || a.id}`}
                      className="block px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                    >
                      <p className="text-[14px] font-bold text-foreground line-clamp-1">
                        {a.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {a.attention_score.toLocaleString()} attention
                        </span>
                        <span>·</span>
                        <span>{a.post_count} posts</span>
                        {a.category && (
                          <>
                            <span>·</span>
                            <span>{a.category}</span>
                          </>
                        )}
                      </div>
                    </Link>
                  ))}
                  {activeTab === "all" && attentions.length > 5 && (
                    <button
                      onClick={() => setActiveTab("attentions")}
                      className="w-full px-4 py-2 text-center text-[13px] font-bold text-blue-600 hover:bg-zinc-50 dark:text-blue-400 dark:hover:bg-zinc-900/30"
                    >
                      {t(dictionary.sidebar.searchViewAll)} →
                    </button>
                  )}
                </section>
              )}

            {/* Topics */}
            {(activeTab === "all" || activeTab === "topics") &&
              topics.length > 0 && (
                <section className="py-3">
                  <SectionLabel
                    icon={<RiHashtag className="size-4 text-emerald-500" />}
                    label={t(dictionary.search.topics)}
                    count={topics.length}
                  />
                  {(activeTab === "all" ? topics.slice(0, 5) : topics).map(
                    (tp) => {
                      const labels = tp.labels as Record<string, string> | null;
                      const displayLabel =
                        labels?.[language] ?? tp.canonical_label;
                      return (
                        <Link
                          key={tp.id}
                          href={`/topic/${tp.slug}`}
                          className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                        >
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                            <RiHashtag className="size-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-bold text-foreground">
                              {displayLabel}
                            </p>
                            <p className="text-[12px] text-muted-foreground">
                              {tp.kind} · /{tp.slug}
                            </p>
                          </div>
                        </Link>
                      );
                    },
                  )}
                  {activeTab === "all" && topics.length > 5 && (
                    <button
                      onClick={() => setActiveTab("topics")}
                      className="w-full px-4 py-2 text-center text-[13px] font-bold text-blue-600 hover:bg-zinc-50 dark:text-blue-400 dark:hover:bg-zinc-900/30"
                    >
                      {t(dictionary.sidebar.searchViewAll)} →
                    </button>
                  )}
                </section>
              )}

            {/* Users */}
            {(activeTab === "all" || activeTab === "users") &&
              users.length > 0 && (
                <section className="py-3">
                  <SectionLabel
                    icon={<RiUser3Line className="size-4 text-violet-500" />}
                    label={t(dictionary.search.users)}
                    count={users.length}
                  />
                  {(activeTab === "all" ? users.slice(0, 5) : users).map(
                    (u) => (
                      <Link
                        key={u.id}
                        href={`/u/${u.handle ?? u.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 text-xs font-bold text-white dark:from-zinc-200 dark:to-white dark:text-zinc-950">
                          {(u.display_name ?? u.handle)
                            ?.trim()
                            .slice(0, 1)
                            .toUpperCase() || "m"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-bold text-foreground truncate">
                            {u.display_name || u.handle}
                          </p>
                          <p className="text-[12px] text-muted-foreground">
                            u/{u.handle ?? "anon"} ·{" "}
                            {Number(u.mom_energy).toLocaleString()} MOM
                          </p>
                        </div>
                      </Link>
                    ),
                  )}
                  {activeTab === "all" && users.length > 5 && (
                    <button
                      onClick={() => setActiveTab("users")}
                      className="w-full px-4 py-2 text-center text-[13px] font-bold text-blue-600 hover:bg-zinc-50 dark:text-blue-400 dark:hover:bg-zinc-900/30"
                    >
                      {t(dictionary.sidebar.searchViewAll)} →
                    </button>
                  )}
                </section>
              )}

            {/* Posts */}
            {(activeTab === "all" || activeTab === "posts") &&
              posts.length > 0 && (
                <section className="py-3">
                  <SectionLabel
                    icon={<RiArticleLine className="size-4 text-amber-500" />}
                    label={t(dictionary.search.posts)}
                    count={posts.length}
                  />
                  {(activeTab === "all" ? posts.slice(0, 5) : posts).map(
                    (p) => (
                      <Link
                        key={p.id}
                        href={`/posts/${p.id}`}
                        className="block px-4 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 text-[9px] font-bold text-white dark:from-zinc-200 dark:to-white dark:text-zinc-950">
                            {(p.author?.display_name ?? p.author?.handle)
                              ?.trim()
                              .slice(0, 1)
                              .toUpperCase() || "m"}
                          </div>
                          <span className="text-[12px] font-bold text-foreground">
                            {p.author?.display_name || p.author?.handle || "anon"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            u/{p.author?.handle ?? "anon"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            · {formatRelativeShort(p.created_at)}
                          </span>
                        </div>
                        {p.original_title && (
                          <p className="mt-1 text-[14px] font-bold text-foreground line-clamp-1">
                            {p.original_title}
                          </p>
                        )}
                        <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground line-clamp-2">
                          {p.content_format === "html"
                            ? (p.original_body ?? "")
                                .replace(/<[^>]+>/g, "")
                                .slice(0, 200)
                            : (p.original_body ?? "").slice(0, 200)}
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>♡ {p.like_count}</span>
                          <span>💬 {p.comment_count}</span>
                          <span>👁 {p.view_count}</span>
                          {p.is_premium && (
                            <span className="font-bold text-blue-600">Premium</span>
                          )}
                        </div>
                      </Link>
                    ),
                  )}
                  {activeTab === "all" && posts.length > 5 && (
                    <button
                      onClick={() => setActiveTab("posts")}
                      className="w-full px-4 py-2 text-center text-[13px] font-bold text-blue-600 hover:bg-zinc-50 dark:text-blue-400 dark:hover:bg-zinc-900/30"
                    >
                      {t(dictionary.sidebar.searchViewAll)} →
                    </button>
                  )}
                </section>
              )}
          </div>
        ) : (
          /* Empty state — no query yet */
          <div className="flex flex-col items-center justify-center py-20">
            <RiSearchLine className="size-16 text-muted-foreground/20" />
            <p className="mt-4 text-sm text-muted-foreground">
              {t(dictionary.search.placeholder)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function SectionLabel({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      {icon}
      <span className="text-[13px] font-black uppercase tracking-wider text-foreground">
        {label}
      </span>
      <span className="text-[11px] font-medium text-muted-foreground">
        ({count})
      </span>
    </div>
  );
}

function formatRelativeShort(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
