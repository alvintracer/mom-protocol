"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { use, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  RiArrowLeftLine,
  RiBarChartGroupedLine,
  RiHeart3Fill,
  RiHeart3Line,
  RiLinksLine,
  RiMessage2Line,
  RiRepeat2Line,
  RiSendPlane2Line,
  RiShareForwardLine,
} from "react-icons/ri";

import { PageSkeleton } from "@/shared/components/ui/LoadingStates";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import { useContentTranslations } from "@/shared/hooks/useContentTranslations";
import type { Database, SupportedLanguage } from "@/shared/types/database";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type CommentRow = Database["public"]["Tables"]["comments"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AttentionRow = Database["public"]["Tables"]["attention_clusters"]["Row"];

export default function PostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = use(params);
  const { dictionary, language, t } = useI18n();
  const [post, setPost] = useState<PostRow | null>(null);
  const [author, setAuthor] = useState<ProfileRow | null>(null);
  const [attention, setAttention] = useState<AttentionRow | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentAuthors, setCommentAuthors] = useState<Map<string, ProfileRow>>(
    new Map(),
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [reply, setReply] = useState("");
  const [quoteBody, setQuoteBody] = useState("");
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReposting, setIsReposting] = useState(false);

  const postIds = useMemo(() => (post ? [post.id] : []), [post]);
  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);
  const { getPostBody, getPostTitle, getCommentBody } = useContentTranslations(postIds, commentIds);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadPost() {
      const [{ data: userData }, { data: postData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("posts")
          .select("*")
          .eq("id", postId)
          .eq("is_deleted", false)
          .maybeSingle(),
      ]);

      if (!mounted) {
        return;
      }

      setUserId(userData.user?.id ?? null);

      if (!postData) {
        setStatus("missing");
        return;
      }

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
        supabase
          .from("comments")
          .select("*")
          .eq("post_id", postData.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: true })
          .limit(80),
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

      const commentUserIds = Array.from(
        new Set((commentRows ?? []).map((comment) => comment.user_id)),
      );
      const { data: commentProfiles } =
        commentUserIds.length > 0
          ? await supabase.from("profiles").select("*").in("id", commentUserIds)
          : { data: [] as ProfileRow[] };

      await supabase
        .from("posts")
        .update({ view_count: postData.view_count + 1 })
        .eq("id", postData.id);

      if (!mounted) {
        return;
      }

      setPost({ ...postData, view_count: postData.view_count + 1 });
      setAuthor(authorData ?? null);
      setAttention(attentionData ?? null);
      setHasLiked(Boolean(reactionData));
      setComments(commentRows ?? []);
      setCommentAuthors(
        new Map((commentProfiles ?? []).map((profile) => [profile.id, profile])),
      );
      setStatus("ready");
    }

    loadPost();

    return () => {
      mounted = false;
    };
  }, [postId]);

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!post || !userId || !reply.trim()) {
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("comments")
      .insert({
        post_id: post.id,
        user_id: userId,
        original_language: language as SupportedLanguage,
        original_body: reply.trim(),
        translation_status: "pending",
      })
      .select("*")
      .single();

    if (error || !data) {
      setIsSubmitting(false);
      return;
    }

    await Promise.all([
      supabase.rpc("enqueue_missing_translations_for_comment", {
        target_comment_id: data.id,
      }),
      supabase
        .from("posts")
        .update({ comment_count: post.comment_count + 1 })
        .eq("id", post.id),
    ]);

    setComments((current) => [...current, data]);
    setPost((current) =>
      current ? { ...current, comment_count: current.comment_count + 1 } : current,
    );
    setReply("");
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
      quote_body: quote?.trim() || null,
      quote_language: language as SupportedLanguage,
    });

    setIsReposting(false);

    if (error || !data) {
      return;
    }

    if (quote?.trim()) {
      await supabase.rpc("enqueue_missing_translations_for_post", {
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
            </div>

            {getPostTitle(post.id, post.original_title) ? (
              <h1 className="mt-4 text-2xl font-black leading-9 text-foreground">
                {getPostTitle(post.id, post.original_title)}
              </h1>
            ) : null}
            <p className="mt-4 whitespace-pre-wrap text-[19px] font-medium leading-8 text-foreground">
              {getPostBody(post.id, post.original_body)}
            </p>

            {Array.isArray(post.media_items) && post.media_items.length > 0 ? (
              <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-1">
                {post.media_items.map((item, index) => {
                  const media =
                    item && typeof item === "object" && !Array.isArray(item)
                      ? item
                      : {};
                  return (
                    <div
                      key={index}
                      className="min-w-[200px] snap-start overflow-hidden rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900/50"
                    >
                      {typeof media.url === "string" &&
                      typeof media.type === "string" &&
                      media.type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={media.url} alt="" className="h-36 w-full object-cover" />
                      ) : typeof media.url === "string" &&
                        typeof media.type === "string" &&
                        media.type.startsWith("audio/") ? (
                        <div className="p-3">
                          <audio controls src={media.url} className="w-full" />
                        </div>
                      ) : null}
                      <div className="p-3">
                        <p className="truncate text-sm font-black text-foreground">
                          {typeof media.name === "string" ? media.name : t(dictionary.common.attachment)}
                        </p>
                        <p className="mt-1 text-xs font-bold text-muted-foreground">
                          {typeof media.type === "string" && media.type.startsWith("audio/")
                            ? t(dictionary.postCreate.audio)
                            : t(dictionary.postCreate.media)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {post.link_url ? (
              <a
                href={post.link_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 block rounded-xl border border-border p-3 transition-colors hover:border-blue-500"
              >
                <div className="flex items-center gap-2 text-xs font-black text-blue-600">
                  <RiLinksLine className="size-4" />
                  {detectSourceName(post.link_url, t(dictionary.common.externalLink))}
                </div>
                <p className="mt-1 text-sm font-black text-foreground">
                  {post.link_title ?? post.link_url}
                </p>
                <p className="mt-1 truncate text-xs font-bold text-muted-foreground">
                  {post.link_url}
                </p>
              </a>
            ) : null}

            <p className="mt-5 text-sm font-semibold text-muted-foreground">
              {formatDateTime(post.created_at, language)}
            </p>

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
                onClick={() => setIsQuoteOpen((current) => !current)}
              />
              <ActionIcon
                icon={hasLiked ? <RiHeart3Fill className="size-[19px] text-red-500" /> : <RiHeart3Line className="size-[19px]" />}
                active={hasLiked}
                onClick={handleLike}
              />
              <ActionIcon icon={<RiShareForwardLine className="size-[19px]" />} />
            </div>
          </div>
        </div>
      </article>

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

      <section className="border-b border-border p-4 sm:p-6">
        {userId ? (
          <form onSubmit={handleReply} className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-black text-background">
              {t(dictionary.common.me).slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder={t(dictionary.postDetail.replyPlaceholder)}
                rows={3}
                className="min-h-20 w-full resize-none bg-transparent text-[17px] font-medium leading-7 text-foreground outline-none placeholder:text-muted-foreground"
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

      <section className="divide-y divide-border">
        {comments.length > 0 ? (
          comments.map((comment) => {
            const commentAuthor = commentAuthors.get(comment.user_id) ?? null;
            const commentAuthorLabel =
              commentAuthor?.display_name ??
              commentAuthor?.handle ??
              `u/${comment.user_id.slice(0, 8)}`;

            return (
              <article key={comment.id} className="p-4 sm:p-6">
                <div className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-black text-white">
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
                      <ActionIcon icon={<RiMessage2Line className="size-4" />} />
                      <ActionIcon icon={<RiHeart3Line className="size-4" />} />
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="p-6 text-sm font-semibold text-muted-foreground">
            {t(dictionary.postDetail.emptyReplies)}
          </p>
        )}
      </section>
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
