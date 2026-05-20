"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import {
  RiBarChartGroupedLine,
  RiHashtag,
  RiHeart3Fill,
  RiHeart3Line,
  RiLinksLine,
  RiMessage2Line,
  RiRepeat2Line,
  RiShareForwardLine,
} from "react-icons/ri";

import type { Event, SocialPost } from "@/shared/types/domain";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import { PostMediaGrid } from "./PostMediaGrid";

type SocialPostCardProps = {
  post: SocialPost;
  linkedEvent: Event | null;
  /** Translated body text (overrides post.body if provided) */
  translatedBody?: string;
  /** Translated title text (overrides post.title if provided) */
  translatedTitle?: string | null;
};

export function SocialPostCard({ post, linkedEvent, translatedBody, translatedTitle }: SocialPostCardProps) {
  const { dictionary, t } = useI18n();
  const router = useRouter();
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [hasLiked, setHasLiked] = useState(false);
  const [repostCount, setRepostCount] = useState(post.repostCount);

  const handleLike = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const supabase = createClient();
      const { data, error } = await supabase.rpc("toggle_post_like", {
        target_post_id: post.id,
      });

      if (error || !data || typeof data !== "object" || Array.isArray(data)) {
        return;
      }

      setHasLiked(data.liked === true);
      if (typeof data.like_count === "number") {
        setLikeCount(data.like_count);
      }
    },
    [post.id],
  );

  const handleRepost = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase.rpc("create_repost", {
        target_post_id: post.id,
        quote_body: null,
        quote_language: "ko",
      });

      if (!error) {
        setRepostCount((c) => c + 1);
      }
    },
    [post.id],
  );

  return (
    <article className="border-b border-border bg-background transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30">
      <Link href={`/posts/${post.id}`} className="block px-4 py-3.5 sm:px-5">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-zinc-950 dark:from-zinc-100 dark:to-white text-sm font-bold text-white dark:text-zinc-950 ring-2 ring-background">
            {post.avatarInitials}
          </div>
          <div className="min-w-0 flex-1">
            {post.postKind === "repost" ? (
              <p className="mb-1 text-xs font-black text-muted-foreground">
                {t(post.authorName)} reposted
              </p>
            ) : null}
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[15px]">
              <span className="font-bold text-foreground">{t(post.authorName)}</span>
              <span className="text-[13px] text-muted-foreground">@{post.authorHandle}</span>
              <span className="text-[13px] text-muted-foreground">·</span>
              <span className="text-[13px] text-muted-foreground">{t(post.createdAtLabel)}</span>
            </div>

            {(translatedTitle ?? post.title) ? (
              <h2 className="mt-2 text-[17px] font-black leading-6 text-foreground">
                {translatedTitle ?? post.title}
              </h2>
            ) : null}
            {post.selectedOutcome ? (
              <span className={`mt-1.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-black ${
                post.selectedOutcome.toLowerCase() === "yes" || post.selectedOutcome.toLowerCase() === "above"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : post.selectedOutcome.toLowerCase() === "no" || post.selectedOutcome.toLowerCase() === "below"
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}>
                {post.selectedOutcome.toUpperCase()}
              </span>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-[15px] leading-6 text-foreground">
              {translatedBody ?? post.body}
            </p>

            {post.mediaItems && post.mediaItems.length > 0 ? (
              <PostMediaGrid
                items={post.mediaItems
                  .filter((i) => i.previewUrl)
                  .map((i) => ({ url: i.previewUrl!, type: i.type, name: i.name }))}
                variant="feed"
              />
            ) : null}

            {post.repostOf ? (
              <div className="mt-3 rounded-xl border border-border p-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px]">
                  <span className="font-black text-foreground">
                    {t(post.repostOf.authorName)}
                  </span>
                  <span className="text-muted-foreground">
                    u/{post.repostOf.authorHandle}
                  </span>
                </div>
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm font-medium leading-6 text-foreground">
                  {post.repostOf.body || "Repost"}
                </p>
              </div>
            ) : null}

            {linkedEvent ? (
              <div className="mt-3 rounded-xl border border-border bg-zinc-50/50 dark:bg-zinc-900/30 p-3.5 transition-colors hover:border-blue-300 dark:hover:border-blue-500/40">
                <p className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  {t(dictionary.home.linkedAttention)}
                </p>
                <p className="mt-1.5 text-sm font-black leading-5 text-foreground">
                  {t(linkedEvent.title)}
                </p>
                <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                  {t(linkedEvent.summary)}
                </p>
              </div>
            ) : null}

            {post.externalPreview ? (
              <div className="mt-3 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-[12px] font-bold text-blue-600">
                  <RiLinksLine className="size-4" />
                  {post.externalPreview.sourceName}
                </div>
                <p className="mt-1 text-sm font-black text-foreground">
                  {t(post.externalPreview.title)}
                </p>
                <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                  {t(post.externalPreview.description)}
                </p>
              </div>
            ) : null}

            {post.userTags.length > 0 || post.autoTags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {post.userTags.map((tag) => (
                  <TagPill key={`user-${tag}`} label={tag} />
                ))}
                {post.autoTags.map((tag) => (
                  <TagPill key={`auto-${tag}`} label={tag} muted />
                ))}
              </div>
            ) : null}

            <div className="mt-3 flex max-w-md items-center justify-between border-t border-transparent pt-2 text-muted-foreground">
              <ActionIcon
                icon={<RiMessage2Line className="size-[17px]" />}
                count={post.replyCount}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  router.push(`/posts/${post.id}`);
                }}
              />
              <ActionIcon
                icon={<RiRepeat2Line className="size-[17px]" />}
                count={repostCount}
                onClick={handleRepost}
                hoverColor="green"
              />
              <ActionIcon
                icon={
                  hasLiked ? (
                    <RiHeart3Fill className="size-[17px] text-red-500" />
                  ) : (
                    <RiHeart3Line className="size-[17px]" />
                  )
                }
                count={likeCount}
                onClick={handleLike}
                hoverColor="red"
                active={hasLiked}
              />
              <ActionIcon icon={<RiBarChartGroupedLine className="size-[17px]" />} count={post.viewCount} />
              <ActionIcon
                icon={<RiShareForwardLine className="size-[17px]" />}
                onClick={async (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const url = `${window.location.origin}/posts/${post.id}`;
                  if (navigator.share) {
                    try { await navigator.share({ url }); } catch { /* cancelled */ }
                  } else {
                    await navigator.clipboard.writeText(url);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}

function TagPill({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${
        muted
          ? "bg-zinc-100 text-muted-foreground dark:bg-zinc-900"
          : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
      }`}
    >
      <RiHashtag className="size-3.5" />
      {label}
    </span>
  );
}

function ActionIcon({
  icon,
  count,
  onClick,
  hoverColor = "blue",
  active = false,
}: {
  icon: ReactNode;
  count?: number;
  onClick?: (event: React.MouseEvent) => void;
  hoverColor?: "blue" | "red" | "green";
  active?: boolean;
}) {
  const colorMap = {
    blue: "group-hover:bg-blue-500/10 group-hover:text-blue-500",
    red: "group-hover:bg-red-500/10 group-hover:text-red-500",
    green: "group-hover:bg-green-500/10 group-hover:text-green-500",
  };
  const countColorMap = {
    blue: "group-hover:text-blue-500",
    red: "group-hover:text-red-500",
    green: "group-hover:text-green-500",
  };

  return (
    <button
      className="group flex items-center gap-1.5"
      onClick={onClick ?? ((event) => event.preventDefault())}
    >
      <span className={`rounded-full p-1.5 transition-colors ${colorMap[hoverColor]}`}>
        {icon}
      </span>
      {typeof count === "number" ? (
        <span className={`text-[12px] font-medium tabular-nums transition-colors ${active ? (hoverColor === "red" ? "text-red-500" : "text-green-500") : ""} ${countColorMap[hoverColor]}`}>
          {count.toLocaleString()}
        </span>
      ) : null}
    </button>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
