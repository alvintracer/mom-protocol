"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SocialPostCard } from "@/shared/components/feed/SocialPostCard";
import { text, type LanguageCode } from "@/shared/i18n/config";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import { FeedSkeleton, LoadingBar } from "@/shared/components/ui/LoadingStates";
import { AdSlot } from "@/shared/components/ads/AdSlot";
import type { Database } from "@/shared/types/database";
import type { SocialPost } from "@/shared/types/domain";
import { useContentTranslations } from "@/shared/hooks/useContentTranslations";

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

function HomeFeed() {
  const { dictionary, t } = useI18n();
  const searchParams = useSearchParams();
  const activeFeed = searchParams.get("feed") === "following" ? "following" : "for-you";
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

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
      } else {
        const { data: allPosts } = await postQuery;
        feedData = allPosts ?? [];
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
      const [{ data: profileRows }, { data: postAttentionRows }] =
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
        ]);

      if (!mounted) {
        return;
      }

      const profilesById = new Map((profileRows ?? []).map((profile) => [profile.id, profile]));
      const repostSourcesById = new Map(sourceRows.map((row) => [row.id, row]));
      const attentionsById = new Map(
        (postAttentionRows ?? []).map((attention) => [attention.id, attention]),
      );

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
        rows.map((row) =>
          mapPostRowToSocialPost(
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
          ),
        ),
      );
      setIsLoadingPosts(false);
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

  return (
    <div className="pb-20">
      {isLoadingPosts ? <LoadingBar /> : null}

      <div className="divide-y divide-border">
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
        {posts.map((post, idx) => (
          <div key={post.id}>
            <SocialPostCard
              post={post}
              linkedEvent={null}
              translatedBody={getPostBody(post.id, post.body)}
              translatedTitle={getPostTitle(post.id, post.title)}
            />
            {/* Insert ad after every 5th post */}
            {idx === 4 && (
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
): SocialPost {
  const body = row.original_body;
  const language = row.original_language as LanguageCode;
  const authorLabel =
    profile?.display_name ?? profile?.handle ?? `u/${row.user_id.slice(0, 8)}`;
  const handle = profile?.handle ?? row.user_id.slice(0, 8);

  return {
    id: row.id,
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
    postKind: row.post_kind,
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
        }
      : null,
    replyCount: row.comment_count,
    repostCount: row.share_count,
    likeCount: row.like_count,
    viewCount: row.view_count,
    userTags: [],
    autoTags: attention ? [attention.slug ?? attention.category ?? "attention"] : ["global"],
    externalUrl: row.link_url,
    mediaItems: normalizeMediaItems(row.media_items),
    externalPreview: row.link_url
      ? {
          sourceName: detectSourceName(row.link_url),
          title: text(row.link_title ?? row.link_url, row.link_title ?? row.link_url, row.link_title ?? row.link_url),
          description: text(row.link_url, row.link_url, row.link_url),
        }
      : attention
      ? {
         sourceName: `a/${attention.slug ?? attention.id.slice(0, 8)}`,
          title: text(attention.title, attention.title, attention.title),
          description: text(
            attention.description ?? linkedAttentionFallbackDesc.ko,
            attention.description ?? linkedAttentionFallbackDesc.en,
            attention.description ?? linkedAttentionFallbackDesc.es,
          ),
        }
      : null,
    translationStatus: row.translation_status === "translated" ? "ready" : "queued",
    autoTagStatus: "queued",
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
