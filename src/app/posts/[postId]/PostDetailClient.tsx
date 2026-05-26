"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  RiArrowLeftLine,
  RiBarChartGroupedLine,
  RiBookmarkFill,
  RiBookmarkLine,
  RiHashtag,
  RiHeart3Fill,
  RiHeart3Line,
  RiLinksLine,
  RiLock2Line,
  RiMessage2Line,
  RiRepeat2Line,
  RiSendPlane2Line,
  RiShareForwardLine,
  RiVipDiamondLine,
} from "react-icons/ri";

import { PageSkeleton } from "@/shared/components/ui/LoadingStates";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import { PostMediaGrid } from "@/shared/components/feed/PostMediaGrid";
import { PostOptionMenu } from "@/shared/components/feed/PostOptionMenu";
import { BookmarkButton } from "@/shared/components/feed/BookmarkButton";
import { AdSlot } from "@/shared/components/ads/AdSlot";
import { useContentTranslations } from "@/shared/hooks/useContentTranslations";
import type { Database, SupportedLanguage } from "@/shared/types/database";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type CommentRow = Database["public"]["Tables"]["comments"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AttentionRow = Database["public"]["Tables"]["attention_clusters"]["Row"];

export function PostDetailClient({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = use(params);
  const { dictionary, language, t } = useI18n();
  const router = useRouter();
  const [post, setPost] = useState<PostRow | null>(null);
  const [author, setAuthor] = useState<ProfileRow | null>(null);
  const [attention, setAttention] = useState<AttentionRow | null>(null);
  const [repostSource, setRepostSource] = useState<PostRow | null>(null);
  const [repostAuthor, setRepostAuthor] = useState<ProfileRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentAuthors, setCommentAuthors] = useState<Map<string, ProfileRow>>(
    new Map(),
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [reply, setReply] = useState("");
  const [replyToComment, setReplyToComment] = useState<{ id: string; authorName: string } | null>(null);
  const [quoteBody, setQuoteBody] = useState("");
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  // Premium state
  const [canViewFull, setCanViewFull] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [momRate, setMomRate] = useState<number>(0.001);
  const [postTopics, setPostTopics] = useState<{ label: string; source: string }[]>([]);
  const [similarPosts, setSimilarPosts] = useState<{ id: string; title: string | null; body: string | null; authorName: string; createdAt: string; attentionTitle: string | null; attentionSlug: string | null; selectedOutcome: string | null }[]>([]);

  const postIds = useMemo(() => (post ? [post.id] : []), [post]);
  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);
  const { getPostBody, getPostTitle, getCommentBody } = useContentTranslations(postIds, commentIds);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadPost() {
      const [{ data: userData }, secureResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc("get_post_detail_secure", { p_post_id: postId }),
      ]);

      if (!mounted) return;

      setUserId(userData.user?.id ?? null);

      const postJson = secureResult.data as Record<string, unknown> | null;
      if (!postJson || postJson.error) {
        setStatus("missing");
        return;
      }

      // Map RPC result back to PostRow shape
      const postData: PostRow = {
        id: postJson.id as string,
        user_id: postJson.user_id as string,
        event_id: (postJson.event_id as string) ?? null,
        attention_cluster_id: (postJson.attention_cluster_id as string) ?? null,
        parent_post_id: (postJson.parent_post_id as string) ?? null,
        repost_of_post_id: (postJson.repost_of_post_id as string) ?? null,
        post_kind: postJson.post_kind as PostRow["post_kind"],
        selected_outcome: (postJson.selected_outcome as string) ?? null,
        type: postJson.type as PostRow["type"],
        visibility: postJson.visibility as PostRow["visibility"],
        original_language: postJson.original_language as PostRow["original_language"],
        original_title: (postJson.original_title as string) ?? null,
        original_body: postJson.original_body as string,
        link_title: (postJson.link_title as string) ?? null,
        link_url: (postJson.link_url as string) ?? null,
        link_image_url: (postJson.link_image_url as string) ?? null,
        link_description: (postJson.link_description as string) ?? null,
        media_items: postJson.media_items as PostRow["media_items"],
        original_hash: (postJson.original_hash as string) ?? null,
        translation_status: postJson.translation_status as PostRow["translation_status"],
        like_count: postJson.like_count as number,
        comment_count: postJson.comment_count as number,
        share_count: postJson.share_count as number,
        view_count: postJson.view_count as number,
        is_deleted: postJson.is_deleted as boolean,
        is_premium: postJson.is_premium as boolean,
        premium_energy_cost: (postJson.premium_energy_cost as number) ?? null,
        premium_unlock_count: (postJson.premium_unlock_count as number) ?? 0,
        premium_total_earned: (postJson.premium_total_earned as number) ?? 0,
        content_format: (postJson.content_format as string) ?? "plain",
        is_pinned: (postJson.is_pinned as boolean) ?? false,
        created_at: postJson.created_at as string,
        updated_at: postJson.updated_at as string,
      };

      const canView = postJson.can_view_full as boolean;
      const unlocked = postJson.is_unlocked as boolean;

      setCanViewFull(canView);
      setIsUnlocked(unlocked);

      const [
        { data: authorData },
        { data: attentionData },
        { data: commentRows },
        { data: reactionData },
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", postData.user_id).maybeSingle(),
        postData.attention_cluster_id
          ? supabase
              .from("attention_clusters")
              .select("*")
              .eq("id", postData.attention_cluster_id)
              .maybeSingle()
          : Promise.resolve({ data: null as AttentionRow | null }),
        // Only load comments if user can view full content
        canView
          ? supabase
              .from("comments")
              .select("*")
              .eq("post_id", postData.id)
              .eq("is_deleted", false)
              .order("created_at", { ascending: true })
              .limit(80)
          : Promise.resolve({ data: [] as CommentRow[] }),
        userData.user
          ? supabase
              .from("post_reactions")
              .select("id")
              .eq("post_id", postData.id)
              .eq("user_id", userData.user.id)
              .eq("reaction_type", "like")
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      let sourceData: PostRow | null = null;
      let sourceAuthorData: ProfileRow | null = null;
      if (postData.repost_of_post_id) {
        const { data: sData } = await supabase
          .from("posts")
          .select("*")
          .eq("id", postData.repost_of_post_id)
          .maybeSingle();
        sourceData = sData;
        if (sData) {
          const { data: saData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", sData.user_id)
            .maybeSingle();
          sourceAuthorData = saData;
        }
      }

      const commentUserIds = Array.from(
        new Set((commentRows ?? []).map((comment) => comment.user_id)),
      );
      const { data: commentProfiles } =
        commentUserIds.length > 0
          ? await supabase.from("profiles").select("*").in("id", commentUserIds)
          : { data: [] as ProfileRow[] };

      // Fetch MOM rate for premium price display
      if (postData.is_premium) {
        try {
          const rateRes = await fetch("/api/rate");
          const rateJson = await rateRes.json();
          if (mounted && rateJson.rate) setMomRate(rateJson.rate);
        } catch { /* ignore */ }
      }

      if (!mounted) {
        return;
      }

      setPost(postData);
      setAuthor(authorData ?? null);
      setAttention(attentionData ?? null);
      setRepostSource(sourceData ?? null);
      setRepostAuthor(sourceAuthorData ?? null);
      setHasLiked(Boolean(reactionData));
      setComments(commentRows ?? []);
      setCommentAuthors(
        new Map((commentProfiles ?? []).map((profile) => [profile.id, profile])),
      );

      // Fetch topics
      const { data: topicLinks } = await supabase
        .from("content_topics")
        .select("source, topics!inner(canonical_label)")
        .eq("target_type", "post")
        .eq("target_id", postId);
      if (topicLinks) {
        setPostTopics(
          (topicLinks as unknown as { source: string; topics: { canonical_label: string } }[]).map((l) => ({
            label: l.topics.canonical_label,
            source: l.source,
          })),
        );
      }

      setStatus("ready");

      // Record view (RPC added in migration, type not yet generated)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).rpc("record_post_view", { target_post_id: postId });

      // Fetch similar posts based on shared topics
      if (topicLinks && (topicLinks as unknown[]).length > 0) {
        const topicIds = (topicLinks as unknown as { source: string; topics: { canonical_label: string } }[]).map(() => "");
        // Get topic_ids from content_topics
        const { data: myTopicIds } = await supabase
          .from("content_topics")
          .select("topic_id")
          .eq("target_type", "post")
          .eq("target_id", postId);
        const tIds = [...new Set((myTopicIds ?? []).map((t) => t.topic_id))];
        if (tIds.length > 0) {
          const { data: relatedLinks } = await supabase
            .from("content_topics")
            .select("target_id")
            .eq("target_type", "post")
            .in("topic_id", tIds)
            .neq("target_id", postId)
            .limit(20);
          const relatedPostIds = [...new Set((relatedLinks ?? []).map((l) => l.target_id))].slice(0, 5);
          if (relatedPostIds.length > 0) {
            const { data: relatedPosts } = await supabase
              .from("posts")
              .select("id, original_title, original_body, content_format, user_id, created_at, attention_cluster_id, selected_outcome")
              .in("id", relatedPostIds)
              .eq("is_deleted", false)
              .eq("visibility", "public");
            const rAuthorIds = [...new Set((relatedPosts ?? []).map((p) => p.user_id))];
            const rAttIds = [...new Set((relatedPosts ?? []).filter((p) => p.attention_cluster_id).map((p) => p.attention_cluster_id!))];
            const [{ data: rAuthors }, attResult] = await Promise.all([
              rAuthorIds.length > 0
                ? supabase.from("profiles").select("id, display_name, handle").in("id", rAuthorIds)
                : Promise.resolve({ data: [] as { id: string; display_name: string | null; handle: string | null }[] }),
              rAttIds.length > 0
                ? supabase.from("attention_clusters").select("id, title, slug").in("id", rAttIds)
                : Promise.resolve({ data: [] as { id: string; title: string; slug: string | null }[] }),
            ]);
            const rAuthMap = new Map((rAuthors ?? []).map((a) => [a.id, a.display_name || a.handle || "anon"]));
            const rAttMap = new Map((attResult.data ?? []).map((a) => [a.id, { title: a.title, slug: a.slug }]));
            if (mounted) {
              setSimilarPosts(
                (relatedPosts ?? []).map((p) => {
                  const att = p.attention_cluster_id ? rAttMap.get(p.attention_cluster_id) : null;
                  return {
                    id: p.id,
                    title: p.original_title,
                    body: p.content_format === "html"
                      ? (p.original_body ?? "").replace(/<[^>]+>/g, "").slice(0, 120)
                      : (p.original_body ?? "").slice(0, 120),
                    authorName: rAuthMap.get(p.user_id) ?? "anon",
                    createdAt: p.created_at,
                    attentionTitle: att?.title ?? null,
                    attentionSlug: att?.slug ?? null,
                    selectedOutcome: p.selected_outcome,
                  };
                }),
              );
            }
          }
        }
      }
    }

    loadPost();

    return () => {
      mounted = false;
    };
  }, [postId]);

  async function handleUnlock() {
    if (!post || !userId) return;
    setIsUnlocking(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("unlock_premium_post", {
      p_post_id: post.id,
    });
    setIsUnlocking(false);

    if (error) {
      const msg = error.message;
      if (msg.includes("insufficient_mom_energy")) {
        alert(t(dictionary.postDetail.premiumInsufficient));
      } else if (msg.includes("already_unlocked")) {
        // Already unlocked — just reload
      } else {
        alert(msg);
        return;
      }
    }

    // Reload the page to get full content
    window.location.reload();
  }

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!post || !userId || !reply.trim()) {
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const insertData: Record<string, unknown> = {
      post_id: post.id,
      user_id: userId,
      original_language: language as SupportedLanguage,
      original_body: reply.trim(),
      translation_status: "pending",
    };
    if (replyToComment) {
      insertData.parent_comment_id = replyToComment.id;
    }
    const { data, error } = await supabase
      .from("comments")
      .insert(insertData as any)
      .select("*")
      .single();

    if (error || !data) {
      setIsSubmitting(false);
      return;
    }

    await Promise.all([
      // Translation only — comment_count is updated by DB trigger
      (supabase as any).rpc("enqueue_missing_translations_for_comment", {
        target_comment_id: data.id,
      }),
    ]);

    // Add current user's profile to commentAuthors if missing
    if (!commentAuthors.has(userId)) {
      const { data: myProfile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (myProfile) {
        setCommentAuthors((prev) => new Map(prev).set(userId, myProfile));
      }
    }

    setComments((current) => [...current, data]);
    setPost((current) =>
      current ? { ...current, comment_count: current.comment_count + 1 } : current,
    );
    setReply("");
    setReplyToComment(null);
    setIsSubmitting(false);
  }

  async function handleLike() {
    if (!post || !userId) {
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.rpc("toggle_post_like", {
      target_post_id: post.id,
    });

    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    const liked = data.liked === true;
    const likeCount =
      typeof data.like_count === "number" ? data.like_count : post.like_count;

    setHasLiked(liked);
    setPost((current) =>
      current ? { ...current, like_count: likeCount } : current,
    );
  }

  async function handleRepost(quote?: string) {
    if (!post || !userId) {
      return;
    }

    setIsReposting(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("create_repost", {
      target_post_id: post.id,
      quote_body: quote?.trim() || undefined,
      quote_language: language as SupportedLanguage,
    });

    setIsReposting(false);

    if (error || !data) {
      return;
    }

    if (quote?.trim()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("enqueue_missing_translations_for_post", {
        target_post_id: data,
      });
    }

    setPost((current) =>
      current ? { ...current, share_count: current.share_count + 1 } : current,
    );
    setQuoteBody("");
    setIsQuoteOpen(false);
  }

  if (status === "missing") {
    notFound();
  }

  if (status === "loading" || !post) {
    return <PageSkeleton />;
  }

  const authorLabel =
    author?.display_name ?? author?.handle ?? `u/${post.user_id.slice(0, 8)}`;
  const authorHandle = author?.handle ?? post.user_id.slice(0, 8);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-black text-foreground"
        >
          <RiArrowLeftLine className="size-5" />
          {t(dictionary.postDetail.backLabel)}
        </Link>
      </header>

      {/* Attention Context Box */}
      {attention ? (
        <Link
          href={`/a/${attention.slug || attention.id}`}
          className="block border-b border-border px-4 py-3 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 sm:px-6"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-sm font-black text-blue-600">
              a/
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black tracking-wider text-blue-600 dark:text-blue-400">
                a/{attention.slug || attention.id.slice(0, 8)}
              </p>
              <p className="mt-0.5 truncate text-sm font-bold text-foreground">
                {attention.title}
              </p>
            </div>
            {post.selected_outcome ? (
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                post.selected_outcome.toLowerCase() === "yes" || post.selected_outcome.toLowerCase() === "above"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : post.selected_outcome.toLowerCase() === "no" || post.selected_outcome.toLowerCase() === "below"
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}>
                {post.selected_outcome.toUpperCase()}
              </span>
            ) : null}
          </div>
        </Link>
      ) : null}

      <article className="border-b border-border p-4 sm:p-6">
        <div className="flex gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-black text-background">
            {initial(authorLabel)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px]">
              <span className="font-bold text-foreground">{authorLabel}</span>
              <Link
                href={`/u/${authorHandle}`}
                className="text-muted-foreground hover:text-blue-500"
              >
                u/{authorHandle}
              </Link>
              <div className="ml-auto">
                <PostOptionMenu
                  postId={post.id}
                  authorId={post.user_id}
                  currentUserId={userId}
                  variant="full"
                  onDeleted={() => router.push("/")}
                />
              </div>
            </div>

            {getPostTitle(post.id, post.original_title) ? (
              <h1 className="mt-4 text-2xl font-black leading-9 text-foreground">
                {getPostTitle(post.id, post.original_title)}
              </h1>
            ) : null}

            {/* Premium badge in detail */}
            {post.is_premium && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-[12px] font-black text-blue-600 dark:text-blue-400">
                <RiVipDiamondLine className="size-3.5" />
                {t(dictionary.postDetail.premiumBadge)}
                {canViewFull && <span className="text-emerald-600 dark:text-emerald-400">· {t(dictionary.postDetail.premiumUnlocked)} ✅</span>}
              </div>
            )}

            {/* Body + fade overlay for premium */}
            <div className="relative">
              {post.content_format === "html" ? (
                <div
                  className={`premium-prose mt-4 text-[17px] leading-8 text-foreground ${
                    !canViewFull && post.is_premium ? "select-none premium-fade" : ""
                  }`}
                  dangerouslySetInnerHTML={{ __html: getPostBody(post.id, post.original_body) }}
                />
              ) : (
                <p className={`mt-4 whitespace-pre-wrap text-[19px] font-medium leading-8 text-foreground ${
                  !canViewFull && post.is_premium ? "select-none premium-fade" : ""
                }`}>
                  {getPostBody(post.id, post.original_body)}
                </p>
              )}
            </div>

            {/* Unlock CTA — Medium-style, clean and separated */}
            {!canViewFull && post.is_premium && (
              <div className="mt-8 flex flex-col items-center text-center">
                <div className="mx-auto w-16 border-t border-border" />
                <p className="mt-8 text-xl font-black leading-snug text-foreground sm:text-2xl">
                  {post.premium_energy_cost?.toLocaleString()} {t(dictionary.postDetail.premiumMomToUnlock)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(dictionary.postDetail.premiumApproxUsd)} ${((post.premium_energy_cost ?? 0) * momRate).toFixed(2)} USD
                </p>
                {userId ? (
                  <button
                    onClick={handleUnlock}
                    disabled={isUnlocking}
                    className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-blue-600 px-8 text-sm font-black text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md disabled:opacity-50"
                  >
                    {isUnlocking ? (
                      <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <RiVipDiamondLine className="size-5" />
                    )}
                    {t(dictionary.postDetail.premiumUnlockButton)}
                  </button>
                ) : (
                  <Link
                    href={`/auth/login?next=/posts/${post.id}`}
                    className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-blue-600 px-8 text-sm font-black text-white shadow-sm"
                  >
                    {t(dictionary.postDetail.premiumLoginToUnlock)}
                  </Link>
                )}
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {t(dictionary.postDetail.premiumPermanent)}
                </p>
              </div>
            )}

            {canViewFull && Array.isArray(post.media_items) && post.media_items.length > 0 ? (
              <PostMediaGrid
                items={(post.media_items as Array<Record<string, unknown>>)
                  .filter((m) => typeof m?.url === "string" && typeof m?.type === "string")
                  .map((m) => ({ url: m.url as string, type: m.type as string, name: (m.name as string) || undefined }))}
                variant="detail"
              />
            ) : null}

            {post.link_url ? (
              <a
                href={post.link_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block rounded-xl border border-border p-3 transition-colors hover:border-blue-500"
              >
                {post.link_image_url && (
                  <img
                    src={post.link_image_url}
                    alt=""
                    className="mb-3 w-full max-h-64 object-cover rounded-lg"
                  />
                )}
                <div className="flex items-center gap-2 text-xs font-black text-blue-600">
                  <RiLinksLine className="size-4" />
                  {detectSourceName(post.link_url, t(dictionary.common.externalLink))}
                </div>
                <p className="mt-1 text-sm font-black text-foreground">
                  {post.link_title ?? post.link_url}
                </p>
                <p className="mt-1 line-clamp-2 text-xs font-bold text-muted-foreground">
                  {post.link_description ?? post.link_url}
                </p>
              </a>
            ) : null}

            {repostSource ? (
              <div
                className="mt-4 cursor-pointer rounded-2xl border border-border bg-background p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                onClick={() => router.push(`/posts/${repostSource.id}`)}
              >
                <div className="flex items-center gap-1.5 text-[13px]">
                  <span className="font-bold text-foreground">
                    {repostAuthor?.display_name ?? repostAuthor?.handle ?? `u/${repostSource.user_id.slice(0, 8)}`}
                  </span>
                  <span className="text-muted-foreground">
                    @{repostAuthor?.handle ?? repostSource.user_id.slice(0, 8)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[15px] font-medium leading-7 text-foreground">
                  {repostSource.original_body || "Repost"}
                </p>
                {Array.isArray(repostSource.media_items) && repostSource.media_items.length > 0 ? (
                  <div className="mt-3 overflow-hidden rounded-xl border border-border bg-black/5 aspect-video w-full">
                    {(repostSource.media_items[0] as any)?.type?.startsWith("video/") ? (
                      <video
                        src={(repostSource.media_items[0] as any)?.url}
                        className="h-full w-full object-contain bg-black"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={(repostSource.media_items[0] as any)?.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            <p className="mt-5 text-sm font-semibold text-muted-foreground">
              {formatDateTime(post.created_at, language)}
            </p>

            {postTopics.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {postTopics.map((topic) => (
                  <Link
                    key={topic.label}
                    href={`/topic/${encodeURIComponent(topic.label.toLowerCase().replace(/\s+/g, "-"))}`}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold transition-colors ${
                      topic.source === "user"
                        ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300"
                        : "bg-zinc-100 text-muted-foreground hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <RiHashtag className="size-3" />
                    {topic.label}
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-4 gap-2 border-y border-border py-3 text-center">
              <Metric icon={<RiMessage2Line />} value={post.comment_count} label={t(dictionary.postDetail.replies)} />
              <Metric icon={<RiRepeat2Line />} value={post.share_count} label={t(dictionary.postDetail.reposts)} />
              <Metric icon={hasLiked ? <RiHeart3Fill /> : <RiHeart3Line />} value={post.like_count} label={t(dictionary.postDetail.likes)} active={hasLiked} />
              <Metric icon={<RiBarChartGroupedLine />} value={post.view_count} label={t(dictionary.postDetail.views)} />
            </div>

            <div className="mt-3 flex max-w-md items-center justify-between text-muted-foreground">
              <ActionIcon icon={<RiMessage2Line className="size-[19px]" />} />
              <ActionIcon
                icon={<RiRepeat2Line className="size-[19px]" />}
                onClick={() => router.push(`/posts/new?quote=${post.id}`)}
              />
              <ActionIcon
                icon={hasLiked ? <RiHeart3Fill className="size-[19px] text-red-500" /> : <RiHeart3Line className="size-[19px]" />}
                active={hasLiked}
                onClick={handleLike}
              />
              <BookmarkButton targetType="post" targetId={post.id} variant="icon" />
              <ActionIcon icon={<RiShareForwardLine className="size-[19px]" />} />
            </div>
          </div>
        </div>
      </article>

      {/* Ad slot — post detail bottom */}
      <AdSlot position="post_detail_bottom" size="native" />

      {isQuoteOpen ? (
        <section className="border-b border-border p-4 sm:p-6">
          {userId ? (
            <div className="rounded-2xl border border-border p-4">
              <textarea
                value={quoteBody}
                onChange={(event) => setQuoteBody(event.target.value)}
                placeholder={t(dictionary.postDetail.quotePlaceholder)}
                rows={3}
                className="min-h-20 w-full resize-none bg-transparent text-[16px] font-medium leading-7 text-foreground outline-none placeholder:text-muted-foreground"
              />
              <div className="mt-3 rounded-xl border border-border p-3">
                <p className="text-xs font-black text-muted-foreground">
                  {authorLabel} · u/{authorHandle}
                </p>
                <p className="mt-2 line-clamp-3 text-sm font-medium leading-6 text-foreground">
                  {post.original_body}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={isReposting}
                  onClick={() => handleRepost()}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-black text-foreground transition-colors hover:border-blue-500 hover:text-blue-600 disabled:opacity-50"
                >
                  <RiRepeat2Line className="size-4" />
                  {t(dictionary.postDetail.repost)}
                </button>
                <button
                  type="button"
                  disabled={!quoteBody.trim() || isReposting}
                  onClick={() => handleRepost(quoteBody)}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {t(dictionary.postDetail.quote)}
                </button>
              </div>
            </div>
          ) : (
            <Link
              href={`/auth/login?next=/posts/${post.id}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-black text-white"
            >
              {t(dictionary.postDetail.loginToRepost)}
            </Link>
          )}
        </section>
      ) : null}

      {/* Comments section — locked for premium posts that haven't been unlocked */}
      {post.is_premium && !canViewFull ? (
        <section className="border-b border-border p-4 sm:p-6">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <RiLock2Line className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-bold text-muted-foreground">
              {t(dictionary.postDetail.premiumCommentsLocked)}
            </p>
          </div>
        </section>
      ) : (
        <section className="border-b border-border p-4 sm:p-6">
          {userId ? (
            <form onSubmit={handleReply} className="flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-black text-background">
                {t(dictionary.common.me).slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                {/* Reply-to indicator */}
                {replyToComment && (
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold text-blue-500">
                    <span>↩ {replyToComment.authorName}에게 {t(dictionary.postDetail.subReply)}</span>
                    <button onClick={() => setReplyToComment(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                )}
                <textarea
                  id="comment-textarea"
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (reply.trim() && !isSubmitting) {
                        const form = (e.target as HTMLElement).closest("form");
                        form?.requestSubmit();
                      }
                    }
                  }}
                  placeholder={replyToComment ? t(dictionary.postDetail.subReplyPlaceholder) : t(dictionary.postDetail.replyPlaceholder)}
                  rows={2}
                  className="min-h-14 w-full resize-none bg-transparent text-[17px] font-medium leading-7 text-foreground outline-none placeholder:text-muted-foreground"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={!reply.trim() || isSubmitting}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RiSendPlane2Line className="size-4" />
                    {t(dictionary.postDetail.reply)}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <Link
              href={`/auth/login?next=/posts/${post.id}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-blue-600 px-5 text-sm font-black text-white"
            >
              {t(dictionary.postDetail.loginToReply)}
            </Link>
          )}
        </section>
      )}

      <section className="divide-y divide-border">
        {comments.length > 0 ? (
          (() => {
            // Separate top-level comments and sub-replies
            const topLevel = comments.filter((c) => !(c as any).parent_comment_id);
            const subReplies = comments.filter((c) => (c as any).parent_comment_id);
            const repliesByParent = new Map<string, CommentRow[]>();
            for (const sr of subReplies) {
              const pid = (sr as any).parent_comment_id as string;
              if (!repliesByParent.has(pid)) repliesByParent.set(pid, []);
              repliesByParent.get(pid)!.push(sr);
            }

            return topLevel.map((comment) => {
              const commentAuthor = commentAuthors.get(comment.user_id) ?? null;
              const commentAuthorLabel =
                commentAuthor?.display_name ??
                commentAuthor?.handle ??
                `u/${comment.user_id.slice(0, 8)}`;
              const childReplies = repliesByParent.get(comment.id) ?? [];

              return (
                <article key={comment.id} className="p-4 sm:p-6">
                  {/* Top-level comment */}
                  <div className="flex gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-black text-white dark:bg-zinc-200 dark:text-zinc-900">
                      {initial(commentAuthorLabel)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 text-sm">
                        <span className="font-bold text-foreground">
                          {commentAuthorLabel}
                        </span>
                        <span className="text-muted-foreground">
                          · {formatDate(comment.created_at, language)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6 text-foreground">
                        {getCommentBody(comment.id, comment.original_body)}
                      </p>
                      <div className="mt-2 flex items-center gap-5 text-muted-foreground">
                        <button
                          onClick={() => {
                            setReplyToComment({ id: comment.id, authorName: commentAuthorLabel });
                            setReply("");
                            // Focus the textarea
                            setTimeout(() => {
                              const ta = document.querySelector<HTMLTextAreaElement>("#comment-textarea");
                              ta?.focus();
                            }, 100);
                          }}
                          className="flex items-center gap-1 text-xs font-bold hover:text-blue-500 transition-colors"
                        >
                          <RiMessage2Line className="size-4" />
                          {t(dictionary.postDetail.subReply)}
                          {childReplies.length > 0 && <span className="text-blue-500">{childReplies.length}</span>}
                        </button>
                        <ActionIcon icon={<RiHeart3Line className="size-4" />} />
                      </div>
                    </div>
                  </div>

                  {/* Sub-replies (대댓글) */}
                  {childReplies.length > 0 && (
                    <div className="mt-3 ml-12 space-y-3 border-l-2 border-border pl-4">
                      {childReplies.map((sr) => {
                        const srAuthor = commentAuthors.get(sr.user_id) ?? null;
                        const srLabel = srAuthor?.display_name ?? srAuthor?.handle ?? `u/${sr.user_id.slice(0, 8)}`;
                        return (
                          <div key={sr.id} className="flex gap-2">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-black text-white dark:bg-zinc-300 dark:text-zinc-900">
                              {initial(srLabel)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-1.5 text-[13px]">
                                <span className="font-bold text-foreground">{srLabel}</span>
                                <span className="text-muted-foreground">· {formatDate(sr.created_at, language)}</span>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-[14px] leading-5 text-foreground">
                                {getCommentBody(sr.id, sr.original_body)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              );
            });
          })()
        ) : (
          <p className="p-6 text-sm font-semibold text-muted-foreground">
            {t(dictionary.postDetail.emptyReplies)}
          </p>
        )}
      </section>

      {/* ─── Similar Posts ─── */}
      {similarPosts.length > 0 && (
        <section className="border-t border-border">
          <div className="px-4 py-3 sm:px-6">
            <p className="text-[14px] font-black text-foreground">
              {t(dictionary.postDetail.similarPosts)}
            </p>
          </div>
          <div className="divide-y divide-border">
            {similarPosts.map((sp) => (
              <Link
                key={sp.id}
                href={`/posts/${sp.id}`}
                className="block px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30 sm:px-6"
              >
                {sp.attentionTitle && (
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/a/${sp.attentionSlug || sp.id}`); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); router.push(`/a/${sp.attentionSlug || sp.id}`); } }}
                    className="mb-1.5 flex cursor-pointer items-center gap-1.5 text-[11px] font-black text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    <span className="shrink-0 rounded bg-blue-500/10 px-1.5 py-0.5">a/</span>
                    <span className="truncate">{sp.attentionTitle}</span>
                    {sp.selectedOutcome && (
                      <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                        sp.selectedOutcome.toLowerCase() === "yes" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : sp.selectedOutcome.toLowerCase() === "no" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}>
                        {sp.selectedOutcome}
                      </span>
                    )}
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 text-[9px] font-bold text-white dark:from-zinc-200 dark:to-white dark:text-zinc-950">
                    {sp.authorName.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-[12px] font-bold text-foreground">{sp.authorName}</span>
                  <span className="text-[11px] text-muted-foreground">· {formatRelativeTime(sp.createdAt)}</span>
                </div>
                {sp.title && (
                  <p className="mt-1 text-[14px] font-bold text-foreground line-clamp-1">{sp.title}</p>
                )}
                <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground line-clamp-2">
                  {sp.body}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({
  icon,
  value,
  label,
  active = false,
}: {
  icon: React.ReactElement;
  value: number;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className={`flex items-center justify-center gap-1 ${active ? "text-red-500" : "text-foreground"}`}>
        <span className={active ? "text-red-500" : "text-blue-500"}>{icon}</span>
        <span className="text-sm font-black">{value.toLocaleString()}</span>
      </div>
      <p className="mt-1 truncate text-[11px] font-bold text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function ActionIcon({
  icon,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full p-2 transition-colors hover:bg-blue-500/10 hover:text-blue-500 ${
        active ? "text-red-500" : ""
      }`}
    >
      {icon}
    </button>
  );
}

function initial(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "m";
}

function formatDateTime(value: string, language: SupportedLanguage) {
  return new Intl.DateTimeFormat(localeFromLanguage(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value: string, language: SupportedLanguage) {
  return new Intl.DateTimeFormat(localeFromLanguage(language), {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function localeFromLanguage(language: SupportedLanguage) {
  if (language === "en") return "en-US";
  if (language === "es") return "es-ES";
  return "ko-KR";
}

function detectSourceName(url: string, fallbackLabel: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("polymarket")) return "Polymarket market";
    if (host.includes("kalshi")) return "Kalshi market";
    return host;
  } catch {
    return fallbackLabel;
  }
}

function formatRelativeTime(dateStr: string) {
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
  return `${Math.floor(days / 30)}mo`;
}
