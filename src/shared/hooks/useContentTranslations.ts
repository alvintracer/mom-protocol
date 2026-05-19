"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

/* ── Types ──────────────────────────────────────────────────── */

type PostTranslation = {
  post_id: string;
  language: string;
  title: string | null;
  body: string;
};

type CommentTranslation = {
  comment_id: string;
  language: string;
  body: string;
};

type TranslationCache = {
  posts: Map<string, PostTranslation>;
  comments: Map<string, CommentTranslation>;
};

/* ── Hook: useContentTranslations ──────────────────────────── */

/**
 * Batch-fetches translations for given post/comment IDs
 * in the user's current language. Returns helpers to resolve
 * the display text for any content item.
 */
export function useContentTranslations(
  postIds: string[],
  commentIds: string[] = [],
) {
  const { language } = useI18n();
  const [cache, setCache] = useState<TranslationCache>({
    posts: new Map(),
    comments: new Map(),
  });
  const lastKey = useRef("");

  const fetchTranslations = useCallback(async () => {
    if (postIds.length === 0 && commentIds.length === 0) return;

    const key = `${language}:${postIds.join(",")}:${commentIds.join(",")}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    const supabase = createClient();
    const newPosts = new Map<string, PostTranslation>();
    const newComments = new Map<string, CommentTranslation>();

    // Fetch post translations
    if (postIds.length > 0) {
      const { data } = await supabase
        .from("post_translations")
        .select("post_id, language, title, body")
        .in("post_id", postIds)
        .eq("language", language)
        .eq("status", "translated");

      if (data) {
        for (const row of data) {
          newPosts.set(row.post_id, row as PostTranslation);
        }
      }
    }

    // Fetch comment translations
    if (commentIds.length > 0) {
      const { data } = await supabase
        .from("comment_translations")
        .select("comment_id, language, body")
        .in("comment_id", commentIds)
        .eq("language", language)
        .eq("status", "translated");

      if (data) {
        for (const row of data) {
          newComments.set(row.comment_id, row as CommentTranslation);
        }
      }
    }

    setCache({ posts: newPosts, comments: newComments });
  }, [postIds, commentIds, language]);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  /** Get translated post body, fallback to original */
  const getPostBody = useCallback(
    (postId: string, originalBody: string): string => {
      const t = cache.posts.get(postId);
      return t?.body ?? originalBody;
    },
    [cache.posts],
  );

  /** Get translated post title, fallback to original */
  const getPostTitle = useCallback(
    (postId: string, originalTitle: string | null | undefined): string | null | undefined => {
      const t = cache.posts.get(postId);
      return t?.title ?? originalTitle;
    },
    [cache.posts],
  );

  /** Get translated comment body, fallback to original */
  const getCommentBody = useCallback(
    (commentId: string, originalBody: string): string => {
      const t = cache.comments.get(commentId);
      return t?.body ?? originalBody;
    },
    [cache.comments],
  );

  return { getPostBody, getPostTitle, getCommentBody, language };
}
