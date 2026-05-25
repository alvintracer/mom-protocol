"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import {
  RiChat1Line,
  RiEyeLine,
  RiFlashlightLine,
  RiHeart3Fill,
  RiHeart3Line,
  RiLinksLine,
  RiPushpinFill,
} from "react-icons/ri";

import type { Event, SocialPost } from "@/shared/types/domain";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

type BoardRowProps = {
  post: SocialPost;
  linkedEvent: Event | null;
  translatedTitle?: string | null;
  translatedBody?: string;
  currentUserId?: string | null;
  onRemoved?: () => void;
};

/**
 * BoardRow — Compact list-style row for board/community view.
 * Inspired by Korean community sites (DCInside, Dogdrip) with modern aesthetics.
 */
export function BoardRow({ post, linkedEvent, translatedTitle, translatedBody }: BoardRowProps) {
  const { t } = useI18n();
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [hasLiked, setHasLiked] = useState(false);

  const handleLike = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const supabase = createClient();
      const { data, error } = await supabase.rpc("toggle_post_like", {
        target_post_id: post.id,
      });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return;
      setHasLiked(data.liked === true);
      if (typeof data.like_count === "number") setLikeCount(data.like_count);
    },
    [post.id],
  );

  const displayTitle = translatedTitle ?? post.title ?? stripToLine(translatedBody ?? post.body);
  const hasMedia = post.mediaItems && post.mediaItems.length > 0;
  const thumbUrl = hasMedia ? post.mediaItems![0].previewUrl : null;
  const isVideo = hasMedia && post.mediaItems![0].type.startsWith("video/");

  return (
    <Link
      href={`/posts/${post.id}`}
      className={`group flex items-center gap-3 px-4 py-2.5 sm:px-5 sm:py-3 border-b border-border bg-background transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30 ${
        post.isPinned ? "border-l-2 border-l-amber-400" : ""
      }`}
    >
      {/* ── Thumbnail (left, only when media exists) ── */}
      {thumbUrl && (
        <div className="shrink-0 size-11 sm:size-12 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {isVideo ? (
            <video src={thumbUrl} className="size-full object-cover" muted preload="metadata" />
          ) : (
            <img src={thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
          )}
        </div>
      )}

      {/* ── Main content ── */}
      <div className="min-w-0 flex-1">
        {/* Row 1: attention slug + title + comment count */}
        <div className="flex items-center gap-1.5 min-w-0">
          {post.isPinned && (
            <RiPushpinFill className="size-3 shrink-0 text-amber-500" />
          )}

          {linkedEvent && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-black text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-500/20 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/a/${linkedEvent.slug || linkedEvent.id}`;
              }}
            >
              <RiLinksLine className="size-2.5" />
              a/{linkedEvent.slug || linkedEvent.id.slice(0, 6)}
            </span>
          )}

          {post.isPremium && (
            <span className="shrink-0 text-[10px]">💎</span>
          )}

          <h3 className="truncate text-[14px] sm:text-[15px] font-bold text-foreground leading-5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {displayTitle}
          </h3>

          {post.replyCount > 0 && (
            <span className="shrink-0 ml-0.5 text-[12px] font-black text-blue-500 tabular-nums">
              [{post.replyCount}]
            </span>
          )}
        </div>

        {/* Row 2: attention title + author + time */}
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] sm:text-[12px] text-muted-foreground min-w-0">
          {linkedEvent && (
            <>
              <span className="truncate max-w-[140px] sm:max-w-[200px] font-bold text-blue-600/70 dark:text-blue-400/70">
                {t(linkedEvent.title)}
              </span>
              <span>·</span>
            </>
          )}
          <span className="font-medium truncate max-w-[100px] sm:max-w-[120px]">
            {t(post.authorName)}
          </span>
          <span>·</span>
          <span className="shrink-0 tabular-nums">{t(post.createdAtLabel)}</span>

          {linkedEvent?.sponsor && (
            <>
              <span>·</span>
              <span className="shrink-0 text-[10px] font-bold text-indigo-500">
                {linkedEvent.sponsor.tagline || "Sponsored"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Right metrics ── */}
      <div className="hidden sm:flex items-center gap-3 shrink-0">
        {/* Energy score */}
        {linkedEvent && linkedEvent.attentionScore > 0 && (
          <MetricPill
            icon={<RiFlashlightLine className="size-3" />}
            value={formatCompact(linkedEvent.attentionScore)}
            colorClass="text-amber-600 dark:text-amber-400"
          />
        )}

        {/* Like */}
        <button
          onClick={handleLike}
          className="flex items-center gap-0.5 text-muted-foreground hover:text-rose-500 transition-colors"
        >
          {hasLiked ? (
            <RiHeart3Fill className="size-3.5 text-rose-500" />
          ) : (
            <RiHeart3Line className="size-3.5" />
          )}
          <span className={`text-[11px] font-bold tabular-nums ${hasLiked ? "text-rose-500" : ""}`}>
            {likeCount > 0 ? formatCompact(likeCount) : ""}
          </span>
        </button>

        {/* Views */}
        <MetricPill
          icon={<RiEyeLine className="size-3" />}
          value={formatCompact(post.viewCount)}
          colorClass="text-muted-foreground"
        />
      </div>

      {/* ── Mobile compact: comments + time ── */}
      <div className="flex sm:hidden flex-col items-end gap-0.5 shrink-0">
        {post.replyCount > 0 && (
          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
            <RiChat1Line className="size-3" />
            <span className="tabular-nums">{post.replyCount}</span>
          </span>
        )}
      </div>
    </Link>
  );
}

/* ── Helpers ── */

function MetricPill({
  icon,
  value,
  colorClass,
}: {
  icon: ReactNode;
  value: string;
  colorClass: string;
}) {
  return (
    <span className={`flex items-center gap-0.5 ${colorClass}`}>
      {icon}
      <span className="text-[11px] font-bold tabular-nums">{value}</span>
    </span>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function stripToLine(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
