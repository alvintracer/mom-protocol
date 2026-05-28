"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { SocialPostCard } from "@/shared/components/feed/SocialPostCard";
import { BoardRow } from "@/shared/components/feed/BoardRow";
import { BoardSortBar, type BoardSortKey } from "@/shared/components/feed/BoardSortBar";
import { text, type LanguageCode } from "@/shared/i18n/config";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import { FeedSkeleton, LoadingBar } from "@/shared/components/ui/LoadingStates";
import { AdSlot } from "@/shared/components/ads/AdSlot";
import type { Database } from "@/shared/types/database";
import type { Event, SocialPost } from "@/shared/types/domain";
import { useContentTranslations } from "@/shared/hooks/useContentTranslations";
import { RiHashtag, RiLayoutGridLine, RiListUnordered } from "react-icons/ri";

type AuthUser = {
  id: string;
  email?: string;
  name: string;
};

type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AttentionRow = Database["public"]["Tables"]["attention_clusters"]["Row"];

export default function Home() {
  return (
    <Suspense
      fallback={
        <div>
          <LoadingBar />
          <FeedSkeleton />
        </div>
      }
    >
      <HomeFeed />
    </Suspense>
  );
}

type ViewMode = "feed" | "board";
const VIEW_MODE_KEY = "momment.viewMode";

function HomeFeed() {
  const { dictionary, t, language } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeFeed = searchParams.get("feed") === "following" ? "following" : "for-you";
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [eventsMap, setEventsMap] = useState<Map<string, Event>>(new Map());
  const [userTopics, setUserTopics] = useState<{ slug: string; label: string; score: number }[]>([]);
  const [activeTopicFilter, setActiveTopicFilter] = useState<string | null>(null);

  // Track whether user had a saved preference (for onboarding banner)
  const [showOnboarding, setShowOnboarding] = useState(false);

  // View mode: default based on language
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(VIEW_MODE_KEY);
      if (saved === "feed" || saved === "board") return saved;
    }
    return language === "ko" ? "board" : "feed";
  });

  // Check for first visit (no saved preference)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(VIEW_MODE_KEY);
      if (!saved) {
        setShowOnboarding(true);
      }
    }
  }, []);

  const setViewMode = useCallback((m: ViewMode) => {
    setViewModeState(m);
    window.localStorage.setItem(VIEW_MODE_KEY, m);
    setShowOnboarding(false);
    // Reset sort default per view mode
    setBoardSort(m === "board" ? "latest" : "recommended");
  }, []);

  // Board sort — default depends on view mode
  const [boardSort, setBoardSort] = useState<BoardSortKey>(() =>
    (typeof window !== "undefined" && window.localStorage.getItem(VIEW_MODE_KEY) === "feed")
      ? "recommended" : "latest"
  );

  // In feed view, boardSort should always be "recommended"
  useEffect(() => {
    if (viewMode === "feed" && boardSort !== "recommended") {
      setBoardSort("recommended");
    }
  }, [viewMode, boardSort]);

  // Ad interval from site_config
  const [adInterval, setAdInterval] = useState({ feed: 5, board: 10 });
  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("site_config")
      .select("value")
      .eq("key", "feed_ad_interval")
      .maybeSingle()
      .then(({ data }: { data: { value: { feed?: number; board?: number } } | null }) => {
        if (data?.value) {
          setAdInterval({
            feed: data.value.feed ?? 5,
            board: data.value.board ?? 10,
          });
        }
      });
  }, []);

  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const { getPostBody, getPostTitle } = useContentTranslations(postIds);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadInitialData() {
      setIsLoadingPosts(true);
      const { data: userData } = await supabase.auth.getUser();

      if (!mounted) {
        return;
      }

      const user = userData.user;
      const joinedAttentionIds =
        user && activeFeed === "following"
          ? (
              (
                await supabase
                  .from("attention_memberships")
                  .select("attention_cluster_id")
                  .eq("user_id", user.id)
              ).data ?? []
            ).map((membership) => membership.attention_cluster_id)
          : [];
      const followedUserIds =
        user && activeFeed === "following"
          ? (
              (
                await supabase
                  .from("user_follows")
                  .select("following_id")
                  .eq("follower_id", user.id)
              ).data ?? []
            ).map((follow) => follow.following_id)
          : [];
      const postQuery = supabase
        .from("posts")
        .select("*")
        .eq("visibility", "public")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(20);
      let feedData: PostRow[];
      if (activeFeed === "following" && user) {
        // Combine posts from followed users + joined attentions
        const hasFollowedUsers = followedUserIds.length > 0;
        const hasJoinedAttentions = joinedAttentionIds.length > 0;
        if (hasFollowedUsers || hasJoinedAttentions) {
          const promises: Array<PromiseLike<{ data: PostRow[] | null }>> = [];
          if (hasFollowedUsers) {
            promises.push(
              supabase.from("posts").select("*")
                .eq("visibility", "public").eq("is_deleted", false)
                .in("user_id", followedUserIds)
                .order("created_at", { ascending: false }).limit(20)
            );
          }
          if (hasJoinedAttentions) {
            promises.push(
              supabase.from("posts").select("*")
                .eq("visibility", "public").eq("is_deleted", false)
                .in("attention_cluster_id", joinedAttentionIds)
                .order("created_at", { ascending: false }).limit(20)
            );
          }
          const results = await Promise.all(promises);
          const allPosts = results.flatMap((r) => r.data ?? []);
          // Deduplicate and sort
          const seenIds = new Set<string>();
          feedData = allPosts
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .filter((p) => { if (seenIds.has(p.id)) return false; seenIds.add(p.id); return true; })
            .slice(0, 20);
        } else {
          feedData = [];
        }
      } else if (user) {
        // Board view always fetches chronologically; Feed view uses recommendations
        if (viewMode === "board") {
          const { data: allPosts } = await postQuery;
          feedData = allPosts ?? [];
        } else {
          // "For You" — try personalized recommendations
          const { data: recommended } = await supabase.rpc(
            "get_recommended_post_ids",
            { p_user_id: user.id, p_limit: 20 },
          );
          const recIds = (recommended ?? []).map(
            (r: { post_id: string }) => r.post_id,
          );

          if (recIds.length >= 5) {
            // Fetch posts in recommended order
            const { data: recPosts } = await supabase
              .from("posts")
              .select("*")
              .in("id", recIds);
            const recMap = new Map((recPosts ?? []).map((p) => [p.id, p]));
            feedData = recIds
              .map((id: string) => recMap.get(id))
              .filter((p): p is PostRow => p != null);

            // Backfill with latest posts if recommendations are < 20
            if (feedData.length < 20) {
              const existingIds = new Set(feedData.map((p) => p.id));
              const { data: backfillPosts } = await supabase
                .from("posts")
                .select("*")
                .eq("visibility", "public")
                .eq("is_deleted", false)
                .order("created_at", { ascending: false })
                .limit(20);
              for (const p of backfillPosts ?? []) {
                if (!existingIds.has(p.id) && feedData.length < 20) {
                  feedData.push(p);
                  existingIds.add(p.id);
                }
              }
            }
          } else {
            // Not enough recommendations → chronological fallback
            const { data: allPosts } = await postQuery;
            feedData = allPosts ?? [];
          }
        }
      } else {
        const { data: allPosts } = await postQuery;
        feedData = allPosts ?? [];
      }

      // Fetch pinned posts and prepend to feed
      const { data: pinnedPosts } = await supabase
        .from("posts")
        .select("*")
        .eq("is_pinned", true)
        .eq("is_deleted", false)
        .eq("visibility", "public")
        .order("created_at", { ascending: false });

      if (pinnedPosts && pinnedPosts.length > 0) {
        const pinnedIds = new Set(pinnedPosts.map((p) => p.id));
        const nonPinned = feedData.filter((p) => !pinnedIds.has(p.id));
        feedData = [...pinnedPosts, ...nonPinned];
      }

      const rows = feedData;
      const repostSourceIds = Array.from(
        new Set(rows.map((post) => post.repost_of_post_id).filter(Boolean)),
      ) as string[];
      const { data: repostSourceRows } =
        repostSourceIds.length > 0
          ? await supabase.from("posts").select("*").in("id", repostSourceIds)
          : { data: [] as PostRow[] };
      const sourceRows = repostSourceRows ?? [];
      const authorIds = Array.from(
        new Set([
          ...rows.map((post) => post.user_id),
          ...sourceRows.map((post) => post.user_id),
        ]),
      );
      const attentionIds = Array.from(
        new Set(rows.map((post) => post.attention_cluster_id).filter(Boolean)),
      ) as string[];
      const allPostIds = rows.map((p) => p.id);
      const [{ data: profileRows }, { data: postAttentionRows }, { data: topicLinks }] =
        await Promise.all([
          authorIds.length > 0
            ? supabase.from("profiles").select("*").in("id", authorIds)
            : Promise.resolve({ data: [] as ProfileRow[] }),
          attentionIds.length > 0
            ? supabase
                .from("attention_clusters")
                .select("*")
                .in("id", attentionIds)
            : Promise.resolve({ data: [] as AttentionRow[] }),
          allPostIds.length > 0
            ? supabase
                .from("content_topics")
                .select("target_id, source, topics!inner(slug, canonical_label, labels, kind)")
                .eq("target_type", "post")
                .in("target_id", allPostIds)
            : Promise.resolve({ data: [] as { target_id: string; source: string; topics: { slug: string; canonical_label: string; labels: Record<string, string>; kind: string } }[] }),
        ]);

      // Fetch active sponsorships for these attention clusters
      let sponsorsByClusterId = new Map<string, { name: string; logoUrl?: string | null; tagline?: string | null; url: string; color?: string | null }>();
      if (attentionIds.length > 0) {
        const { data: sponsorRows } = await supabase
          .from("attention_sponsorships")
          .select("cluster_id, sponsor_name, sponsor_logo_url, sponsor_tagline, sponsor_url, sponsor_color")
          .in("cluster_id", attentionIds)
          .eq("status", "active");
        if (sponsorRows) {
          for (const s of sponsorRows) {
            sponsorsByClusterId.set(s.cluster_id, {
              name: s.sponsor_name,
              logoUrl: s.sponsor_logo_url,
              tagline: s.sponsor_tagline,
              url: s.sponsor_url,
              color: s.sponsor_color,
            });
          }
        }
      }

      if (!mounted) {
        return;
      }

      // Build postId → { userTags, autoTags }
      const topicsByPostId = new Map<string, { userTags: string[]; autoTags: string[] }>();
      for (const link of (topicLinks ?? []) as { target_id: string; source: string; topics: { slug: string; canonical_label: string; labels: Record<string, string>; kind: string } }[]) {
        if (!topicsByPostId.has(link.target_id)) {
          topicsByPostId.set(link.target_id, { userTags: [], autoTags: [] });
        }
        const entry = topicsByPostId.get(link.target_id)!;
        const label = link.topics.canonical_label;
        if (link.source === "user") {
          if (!entry.userTags.includes(label)) entry.userTags.push(label);
        } else {
          if (!entry.autoTags.includes(label)) entry.autoTags.push(label);
        }
      }

      const profilesById = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));
      const repostSourcesById = new Map(sourceRows.map((row) => [row.id, row]));
      const attentionsById = new Map(
        (postAttentionRows ?? []).map((attention) => [attention.id, attention]),
      );

      // Build Event map for linkedEvent prop
      const eventsById = new Map<string, Event>();
      for (const [id, a] of attentionsById) {
        const sponsor = sponsorsByClusterId.get(id) ?? null;
        eventsById.set(id, {
          id: a.id,
          slug: a.slug,
          title: text(a.title, a.title, a.title),
          summary: text(a.description ?? "", a.description ?? "", a.description ?? ""),
          category: (a.category as Event["category"]) ?? "기타",
          status: "open",
          attentionScore: a.attention_score ?? 0,
          participantCount: 0,
          evidenceCount: 0,
          predictionCount: 0,
          endsAt: "",
          sourceName: text("", "", ""),
          sourceUrl: "",
          oracleState: "대기",
          tags: [],
          sponsor,
        });
      }

      setEventsMap(eventsById);

      setAuthUser(
        user
          ? {
              id: user.id,
              email: user.email,
              name:
                user.user_metadata?.name ??
                user.email?.split("@")[0] ??
                "moment user",
            }
          : null,
      );
      setPosts(
        rows.map((row) => {
          const tags = topicsByPostId.get(row.id);
          return mapPostRowToSocialPost(
            row,
            profilesById.get(row.user_id) ?? null,
            row.repost_of_post_id
              ? repostSourcesById.get(row.repost_of_post_id) ?? null
              : null,
            row.repost_of_post_id
              ? profilesById.get(
                  repostSourcesById.get(row.repost_of_post_id)?.user_id ?? "",
                ) ?? null
              : null,
            row.attention_cluster_id
              ? attentionsById.get(row.attention_cluster_id) ?? null
              : null,
            dictionary.home.linkedAttentionFallbackDesc,
            tags ?? null,
          );
        }),
      );
      setIsLoadingPosts(false);

      // Fetch user interest topics for chip bar
      if (user) {
        const { data: interests } = await supabase
          .from("user_interests")
          .select("score, topics!inner(slug, canonical_label)")
          .eq("user_id", user.id)
          .gt("score", 0.5)
          .order("score", { ascending: false })
          .limit(10);
        if (mounted && interests) {
          setUserTopics(
            (interests as unknown as { score: number; topics: { slug: string; canonical_label: string } }[]).map((i) => ({
              slug: i.topics.slug,
              label: i.topics.canonical_label,
              score: Number(i.score),
            })),
          );
        }
      }
    }

    loadInitialData();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user;
        setAuthUser(
          user
            ? {
                id: user.id,
                email: user.email,
                name:
                  user.user_metadata?.name ??
                  user.email?.split("@")[0] ??
                  "moment user",
              }
            : null,
        );
      },
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [activeFeed, viewMode, dictionary.home.linkedAttentionFallbackDesc]);

  // Filter posts by active topic
  const displayPosts = useMemo(() => {
    if (!activeTopicFilter) return posts;
    return posts.filter((p) => {
      const tags = [...(p.userTags ?? []), ...(p.autoTags ?? [])];
      return tags.some((t) => t.toLowerCase() === activeTopicFilter.toLowerCase());
    });
  }, [posts, activeTopicFilter]);

  // Sorting (client-side re-order of displayPosts)
  const sortedPosts = useMemo(() => {
    if (boardSort === "recommended") return displayPosts;
    const sorted = [...displayPosts];
    switch (boardSort) {
      case "latest":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "popular":
        sorted.sort((a, b) => (b.likeCount + b.viewCount * 0.1) - (a.likeCount + a.viewCount * 0.1));
        break;
      case "comments":
        sorted.sort((a, b) => b.replyCount - a.replyCount);
        break;
      case "energy":
        sorted.sort((a, b) => {
          const aScore = a.linkedEventId ? (eventsMap.get(a.linkedEventId)?.attentionScore ?? 0) : 0;
          const bScore = b.linkedEventId ? (eventsMap.get(b.linkedEventId)?.attentionScore ?? 0) : 0;
          return bScore - aScore;
        });
        break;
    }
    // Keep pinned at top regardless of sort
    const pinned = sorted.filter((p) => p.isPinned);
    const rest = sorted.filter((p) => !p.isPinned);
    return [...pinned, ...rest];
  }, [displayPosts, boardSort, eventsMap]);

  return (
    <div className="pb-20">
      {isLoadingPosts ? <LoadingBar /> : null}

      {/* ─── 1. Primary View Toggle (Feed / Board) ─── */}
      <div className="border-b border-border">
        <div className="grid grid-cols-2">
          <button
            onClick={() => setViewMode("feed")}
            className={`relative flex items-center justify-center gap-1.5 py-3.5 text-sm font-bold transition-colors ${
              viewMode === "feed"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            }`}
          >
            <RiLayoutGridLine className="size-4" />
            {t(dictionary.home.viewFeed)}
            {viewMode === "feed" && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-14 rounded-full bg-blue-500" />
            )}
          </button>
          <button
            onClick={() => setViewMode("board")}
            className={`relative flex items-center justify-center gap-1.5 py-3.5 text-sm font-bold transition-colors ${
              viewMode === "board"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            }`}
          >
            <RiListUnordered className="size-4" />
            {t(dictionary.home.viewBoard)}
            {viewMode === "board" && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-14 rounded-full bg-blue-500" />
            )}
          </button>
        </div>
      </div>

      {/* ─── Onboarding Banner (first visit, no saved preference) ─── */}
      {showOnboarding && (
        <div className="mx-4 mt-3 mb-1 sm:mx-5">
          <div className="rounded-2xl border border-border bg-background p-4 sm:p-5">
            <p className="text-sm font-black text-foreground mb-3">
              {t(dictionary.home.viewModePrompt)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setViewMode("feed")}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900 p-4 transition-all hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                <RiLayoutGridLine className="size-7 text-blue-500" />
                <span className="text-xs font-bold text-foreground">
                  {t(dictionary.home.viewFeed)}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground text-center">
                  {t(dictionary.home.viewModeFeedDesc)}
                </span>
              </button>
              <button
                onClick={() => setViewMode("board")}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900 p-4 transition-all hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                <RiListUnordered className="size-7 text-blue-500" />
                <span className="text-xs font-bold text-foreground">
                  {t(dictionary.home.viewBoard)}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground text-center">
                  {t(dictionary.home.viewModeBoardDesc)}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. Feed View: Sub-tabs (추천 / 팔로잉) ─── */}
      {viewMode === "feed" && (
        <div className="border-b border-border">
          <div className="grid grid-cols-2">
            <button
              onClick={() => router.push("/?feed=for-you")}
              className={`relative py-2.5 text-[13px] font-bold transition-colors ${
                activeFeed === "for-you"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              }`}
            >
              {t(dictionary.home.forYou)}
              {activeFeed === "for-you" && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-10 rounded-full bg-blue-500" />
              )}
            </button>
            <button
              onClick={() => router.push("/?feed=following")}
              className={`relative py-2.5 text-[13px] font-bold transition-colors ${
                activeFeed === "following"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
              }`}
            >
              {t(dictionary.home.following)}
              {activeFeed === "following" && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-10 rounded-full bg-blue-500" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── 3. Board View: Sort pills (최신순 | 추천순 | 인기순 | 댓글순 | 에너지순) ─── */}
      {viewMode === "board" && !isLoadingPosts && sortedPosts.length > 0 && (
        <BoardSortBar value={boardSort} onChange={setBoardSort} excludeRecommended />
      )}

      {/* ─── Topic Chips ─── */}
      {userTopics.length > 0 && (viewMode === "board" || activeFeed === "for-you") && (
        <div className="border-b border-border px-4 py-2 sm:px-5">
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTopicFilter(null)}
                className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
                  !activeTopicFilter
                    ? "bg-foreground text-background"
                    : "bg-zinc-100 text-muted-foreground hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                }`}
              >
                {t(dictionary.search.all)}
              </button>
              {userTopics.map((topic) => (
                <button
                  key={topic.slug}
                  onClick={() =>
                    setActiveTopicFilter(
                      activeTopicFilter === topic.label ? null : topic.label,
                    )
                  }
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
                    activeTopicFilter === topic.label
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-100 text-foreground hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                  }`}
                >
                  <RiHashtag className="size-3" />
                  {topic.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={viewMode === "feed" ? "divide-y divide-border" : ""}>
        {isLoadingPosts ? (
          <FeedSkeleton />
        ) : null}
        {!isLoadingPosts && viewMode === "feed" && activeFeed === "following" && !authUser ? (
          <EmptyFeed
            title={t(dictionary.home.followingSignInTitle)}
            description={t(dictionary.home.followingEmptyDesc)}
            actionHref="/auth/login?next=/?feed=following"
            actionLabel={t(dictionary.actions.signIn)}
          />
        ) : null}
        {!isLoadingPosts &&
        viewMode === "feed" &&
        activeFeed === "following" &&
        authUser &&
        posts.length === 0 ? (
          <EmptyFeed
            title={t(dictionary.home.followingEmptyTitle)}
            description={t(dictionary.home.followingEmptyDesc)}
            actionHref="/explore"
            actionLabel={t(dictionary.nav.explore)}
          />
        ) : null}

        {/* ─── Feed View ─── */}
        {viewMode === "feed" &&
          sortedPosts.map((post, idx) => (
            <div key={post.id}>
              <SocialPostCard
                post={post}
                linkedEvent={post.linkedEventId ? eventsMap.get(post.linkedEventId) ?? null : null}
                translatedBody={getPostBody(post.id, post.body)}
                translatedTitle={getPostTitle(post.id, post.title)}
                currentUserId={authUser?.id ?? null}
                onRemoved={() => setPosts((prev) => prev.filter((p) => p.id !== post.id))}
              />
              {/* Insert ad after every Nth post */}
              {(idx + 1) % adInterval.feed === 0 && idx > 0 && (
                <AdSlot position="feed_mid" size="native" adsenseSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED} />
              )}
            </div>
          ))}

        {/* ─── Board View ─── */}
        {viewMode === "board" &&
          sortedPosts.map((post, idx) => (
            <div key={post.id}>
              <BoardRow
                post={post}
                linkedEvent={post.linkedEventId ? eventsMap.get(post.linkedEventId) ?? null : null}
                translatedTitle={getPostTitle(post.id, post.title)}
                translatedBody={getPostBody(post.id, post.body)}
                currentUserId={authUser?.id ?? null}
                onRemoved={() => setPosts((prev) => prev.filter((p) => p.id !== post.id))}
              />
              {(idx + 1) % adInterval.board === 0 && idx > 0 && (
                <AdSlot position="feed_mid" size="native" adsenseSlot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED} />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

function EmptyFeed({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="p-6">
      <div className="rounded-2xl border border-border bg-background p-5">
        <h2 className="text-lg font-black text-foreground">{title}</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
          {description}
        </p>
        <Link
          href={actionHref}
          className="mt-4 inline-flex h-10 items-center rounded-full bg-blue-600 px-5 text-sm font-black text-white transition-colors hover:bg-blue-700"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

function mapPostRowToSocialPost(
  row: PostRow,
  profile: ProfileRow | null,
  repostSource: PostRow | null,
  repostAuthor: ProfileRow | null,
  attention: AttentionRow | null,
  linkedAttentionFallbackDesc: ReturnType<typeof text>,
  topicTags: { userTags: string[]; autoTags: string[] } | null,
): SocialPost {
  const body = row.original_body;
  const language = row.original_language as LanguageCode;
  const authorLabel =
    profile?.display_name ?? profile?.handle ?? `u/${row.user_id.slice(0, 8)}`;
  const handle = profile?.handle ?? row.user_id.slice(0, 8);

  return {
    id: row.id,
    authorId: row.user_id,
    title: row.original_title,
    body,
    originalLanguage: language,
    authorName: text(authorLabel, authorLabel, authorLabel),
    authorHandle: handle,
    avatarInitials: initial(authorLabel),
    avatarUrl: profile?.avatar_url ?? null,
    createdAtLabel: text(
      formatRelative(row.created_at, "ko-KR"),
      formatRelative(row.created_at, "en-US"),
      formatRelative(row.created_at, "es-ES"),
    ),
    createdAt: row.created_at,
    linkedEventId: row.attention_cluster_id,
    selectedOutcome: row.selected_outcome,
    postKind: row.post_kind as "post" | "reply" | "repost" | "quote",
    repostOf: repostSource
      ? {
          id: repostSource.id,
          authorName: text(
            repostAuthor?.display_name ??
              repostAuthor?.handle ??
              `u/${repostSource.user_id.slice(0, 8)}`,
            repostAuthor?.display_name ??
              repostAuthor?.handle ??
              `u/${repostSource.user_id.slice(0, 8)}`,
            repostAuthor?.display_name ??
              repostAuthor?.handle ??
              `u/${repostSource.user_id.slice(0, 8)}`,
          ),
          authorHandle: repostAuthor?.handle ?? repostSource.user_id.slice(0, 8),
          body: repostSource.original_body,
          mediaItems: normalizeMediaItems(repostSource.media_items),
        }
      : null,
    replyCount: row.comment_count,
    repostCount: row.share_count,
    likeCount: row.like_count,
    viewCount: row.view_count,
    userTags: topicTags?.userTags ?? [],
    autoTags: topicTags?.autoTags ?? (attention ? [attention.slug ?? attention.category ?? "attention"] : []),
    externalUrl: row.link_url,
    mediaItems: normalizeMediaItems(row.media_items),
    externalPreview: row.link_url
      ? {
          sourceName: detectSourceName(row.link_url),
          title: text(row.link_title ?? row.link_url, row.link_title ?? row.link_url, row.link_title ?? row.link_url),
          description: text(row.link_description ?? row.link_url, row.link_description ?? row.link_url, row.link_description ?? row.link_url),
          imageUrl: row.link_image_url,
        }
      : null,
    translationStatus: row.translation_status === "translated" ? "ready" : "queued",
    autoTagStatus: "queued",
    isPremium: row.is_premium,
    premiumEnergyCost: row.premium_energy_cost,
    contentFormat: row.content_format,
    isPinned: row.is_pinned,
  };
}

function normalizeMediaItems(value: Database["public"]["Tables"]["posts"]["Row"]["media_items"]) {
  return Array.isArray(value)
    ? value
        .map((item) => (item && typeof item === "object" && !Array.isArray(item) ? item : null))
        .filter(Boolean)
        .map((item) => ({
          name: typeof item?.name === "string" ? item.name : "attachment",
          type: typeof item?.type === "string" ? item.type : "application/octet-stream",
          size: typeof item?.size === "number" ? item.size : 0,
          previewUrl: typeof item?.url === "string" ? item.url : undefined,
        }))
    : [];
}

function detectSourceName(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("polymarket")) return "Polymarket market";
    if (host.includes("kalshi")) return "Kalshi market";
    return host;
  } catch {
    return "External link";
  }
}

function initial(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "m";
}

function formatRelative(value: string, locale: string) {
  const createdAt = new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.floor((Date.now() - createdAt) / 60000));

  if (diffMinutes < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" }).format(
      -diffMinutes,
      "minute",
    );
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" }).format(
      -diffHours,
      "hour",
    );
  }

  return new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" }).format(
    -Math.floor(diffHours / 24),
    "day",
  );
}
