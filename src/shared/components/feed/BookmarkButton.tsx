"use client";

import { useCallback, useEffect, useState } from "react";
import { RiBookmarkFill, RiBookmarkLine } from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

type BookmarkButtonProps = {
  targetType: "post" | "attention";
  targetId: string;
  /** "icon" = small icon-only (for feed action bars), "button" = larger with label */
  variant?: "icon" | "button";
  className?: string;
};

export function BookmarkButton({
  targetType,
  targetId,
  variant = "icon",
  className = "",
}: BookmarkButtonProps) {
  const { dictionary, t } = useI18n();
  const d = dictionary.bookmarksPage;
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Check current bookmark status on mount
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function checkBookmark() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user || !mounted) {
        setIsLoading(false);
        return;
      }

      setUserId(userData.user.id);

      const { data } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("target_type", targetType)
        .eq("target_id", targetId)
        .maybeSingle();

      if (mounted) {
        setIsBookmarked(Boolean(data));
        setBookmarkId(data?.id ?? null);
        setIsLoading(false);
      }
    }

    checkBookmark();
    return () => { mounted = false; };
  }, [targetType, targetId]);

  const handleToggle = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (!userId) {
        // Redirect to login
        window.location.href = `/auth/login?next=${window.location.pathname}`;
        return;
      }

      const supabase = createClient();

      if (isBookmarked && bookmarkId) {
        // Remove bookmark
        await supabase.from("bookmarks").delete().eq("id", bookmarkId);
        setIsBookmarked(false);
        setBookmarkId(null);
      } else {
        // Add bookmark
        const { data } = await supabase
          .from("bookmarks")
          .insert({
            user_id: userId,
            target_type: targetType,
            target_id: targetId,
          })
          .select("id")
          .single();

        if (data) {
          setIsBookmarked(true);
          setBookmarkId(data.id);
        }
      }
    },
    [userId, isBookmarked, bookmarkId, targetType, targetId],
  );

  if (isLoading) {
    if (variant === "button") {
      return (
        <button
          disabled
          className={`inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-bold text-muted-foreground opacity-50 ${className}`}
        >
          <RiBookmarkLine className="size-4" />
          <span>{t(d.addBookmark)}</span>
        </button>
      );
    }

    return (
      <button
        disabled
        className={`group flex items-center gap-1.5 ${className}`}
      >
        <span className="rounded-full p-1.5 text-muted-foreground opacity-40">
          <RiBookmarkLine className="size-[17px]" />
        </span>
      </button>
    );
  }

  if (variant === "button") {
    return (
      <button
        onClick={handleToggle}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition-all ${
          isBookmarked
            ? "border-amber-400/50 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
            : "border-border bg-background text-foreground hover:border-blue-500 hover:text-blue-600"
        } ${className}`}
        title={t(isBookmarked ? d.removeBookmark : d.addBookmark)}
      >
        {isBookmarked ? (
          <RiBookmarkFill className="size-4" />
        ) : (
          <RiBookmarkLine className="size-4" />
        )}
        <span>{t(isBookmarked ? d.saved : d.addBookmark)}</span>
      </button>
    );
  }

  // icon variant — matches ActionIcon style from SocialPostCard
  return (
    <button
      className={`group flex items-center gap-1.5 ${className}`}
      onClick={handleToggle}
      title={t(isBookmarked ? d.removeBookmark : d.addBookmark)}
    >
      <span
        className={`rounded-full p-1.5 transition-colors ${
          isBookmarked
            ? "text-amber-500"
            : "text-muted-foreground group-hover:bg-amber-500/10 group-hover:text-amber-500"
        }`}
      >
        {isBookmarked ? (
          <RiBookmarkFill className="size-[17px]" />
        ) : (
          <RiBookmarkLine className="size-[17px]" />
        )}
      </span>
    </button>
  );
}
