"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  const activeFeed = searchParams.get("feed") === "following" ? "following" : "for-you";
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [eventsMap, setEventsMap] = useState<Map<string, Event>>(new Map());
  const [userTopics, setUserTopics] = useState<{ slug: string; label: string; score: number }[]>([]);
  const [activeTopicFilter, setActiveTopicFilter] = useState<string | null>(null);

  // View mode: default based on language
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(VIEW_MODE_KEY);
      if (saved === "feed" || saved === "board") return saved;
    }
    return language === "ko" ? "board" : "feed";
  });
  const setViewMode = useCallback((m: ViewMode) => {
    setViewModeState(m);
    window.localStorage.setItem(VIEW_MODE_KEY, m);
  }, []);

  // Board sort
  const [boardSort, setBoardSort] = useState<BoardSortKey>("latest");

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
  }, [activeFeed, dictionary.home.linkedAttentionFallbackDesc]);

  // Filter posts by active topic
  const displayPosts = useMemo(() => {
    if (!activeTopicFilter) return posts;
    return posts.filter((p) => {
      const tags = [...(p.userTags ?? []), ...(p.autoTags ?? [])];
      return tags.some((t) => t.toLowerCase() === activeTopicFilter.toLowerCase());
    });
  }, [posts, activeTopicFilter]);

  // Board-mode sorting (client-side re-order of displayPosts)
  const sortedPosts = useMemo(() => {
    if (viewMode !== "board" || boardSort === "latest") return displayPosts;
    const sorted = [...displayPosts];
    switch (boardSort) {
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
  }, [displayPosts, viewMode, boardSort, eventsMap]);

  return (
    <div className="pb-20">
      {isLoadingPosts ? <LoadingBar /> : null}

      {/* ─── View Toggle + Topic Chips ─── */}
      <div className="border-b border-border px-4 py-2 sm:px-5 flex items-center gap-2">
        {/* Topic chips (scrollable, takes remaining space) */}
        {userTopics.length > 0 && activeFeed === "for-you" ? (
          <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
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
        ) : (
          <div className="flex-1" />
        )}

        {/* View toggle */}
        <div className="flex items-center shrink-0 rounded-lg border border-border p-0.5">
          <button
            onClick={() => setViewMode("feed")}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-all ${
              viewMode === "feed"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={t(dictionary.home.viewFeed)}
          >
            <RiLayoutGridLine className="size-3.5" />
            <span className="hidden sm:inline">{t(dictionary.home.viewFeed)}</span>
          </button>
          <button
            onClick={() => setViewMode("board")}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold transition-all ${
              viewMode === "board"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={t(dictionary.home.viewBoard)}
          >
            <RiListUnordered className="size-3.5" />
            <span className="hidden sm:inline">{t(dictionary.home.viewBoard)}</span>
          </button>
        </div>
      </div>

      {/* ─── Board Sort Bar (board mode only) ─── */}
      {viewMode === "board" && !isLoadingPosts && sortedPosts.length > 0 && (
        <BoardSortBar value={boardSort} onChange={setBoardSort} />
      )}

      <div className={viewMode === "feed" ? "divide-y divide-border" : ""}>
        {isLoadingPosts ? (
          <FeedSkeleton />
        ) : null}
        {!isLoadingPosts && activeFeed === "following" && !authUser ? (
          <EmptyFeed
            title={t(dictionary.home.followingSignInTitle)}
            description={t(dictionary.home.followingEmptyDesc)}
            actionHref="/auth/login?next=/?feed=following"
            actionLabel={t(dictionary.actions.signIn)}
          />
        ) : null}
        {!isLoadingPosts &&
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
    createdAtLabel: text(
      formatRelative(row.created_at, "ko-KR"),
      formatRelative(row.created_at, "en-US"),
      formatRelative(row.created_at, "es-ES"),
    ),
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
