"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  RiBookmarkFill,
  RiBookmarkLine,
  RiChat1Line,
  RiEyeLine,
  RiFlashlightLine,
} from "react-icons/ri";

import { AuthGuard } from "@/shared/components/auth/AuthGuard";
import { LoadingBar } from "@/shared/components/ui/LoadingStates";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";

type BookmarkItem = {
  id: string;
  target_type: string;
  target_id: string;
  created_at: string;
  // Enriched fields
  title?: string;
  body?: string;
  authorName?: string;
  slug?: string;
  category?: string;
  energyScore?: number;
};

type Tab = "all" | "posts" | "attentions";

export default function BookmarksPage() {
  return (
    <AuthGuard>
      {(_userId) => <BookmarksContent />}
    </AuthGuard>
  );
}

function BookmarksContent() {
  const { dictionary, t } = useI18n();
  const d = dictionary.bookmarksPage;
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user || !mounted) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!data || !mounted) {
        setLoading(false);
        return;
      }

      // Enrich bookmarks with post/attention data
      const postIds = data.filter((b) => b.target_type === "post").map((b) => b.target_id);
      const attentionIds = data.filter((b) => b.target_type === "attention").map((b) => b.target_id);

      const [postResult, attentionResult] = await Promise.all([
        postIds.length > 0
          ? supabase.from("posts").select("id, original_title, original_body, user_id").in("id", postIds)
          : Promise.resolve({ data: [] as Array<{ id: string; original_title: string | null; original_body: string; user_id: string }> }),
        attentionIds.length > 0
          ? supabase.from("attention_clusters").select("id, title, slug, category, attention_score").in("id", attentionIds)
          : Promise.resolve({ data: [] as Array<{ id: string; title: string; slug: string | null; category: string | null; attention_score: number }> }),
      ]);

      const postMap = new Map((postResult.data ?? []).map((p) => [p.id, p]));
      const attentionMap = new Map((attentionResult.data ?? []).map((a) => [a.id, a]));

      const enriched: BookmarkItem[] = data.map((b) => {
        if (b.target_type === "post") {
          const post = postMap.get(b.target_id);
          return {
            ...b,
            title: post?.original_title ?? undefined,
            body: post?.original_body ?? undefined,
          };
        }
        if (b.target_type === "attention") {
          const attention = attentionMap.get(b.target_id);
          return {
            ...b,
            title: attention?.title ?? undefined,
            slug: attention?.slug ?? undefined,
            category: attention?.category ?? undefined,
            energyScore: attention?.attention_score ?? undefined,
          };
        }
        return b;
      });

      if (mounted) {
        setBookmarks(enriched);
        setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, []);

  const removeBookmark = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from("bookmarks").delete().eq("id", id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const filtered = bookmarks.filter((b) => {
    if (tab === "posts") return b.target_type === "post";
    if (tab === "attentions") return b.target_type === "attention";
    return true;
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t(d.tabs.all) },
    { key: "posts", label: t(d.tabs.posts) },
    { key: "attentions", label: t(d.tabs.attentions) },
  ];

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <h1 className="text-lg font-black text-foreground tracking-tight">
            {t(d.title)}
          </h1>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-muted-foreground dark:bg-zinc-800">
            {bookmarks.length}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`flex-1 py-2.5 text-[13px] font-bold transition-colors relative ${
                tab === item.key
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
              }`}
            >
              {item.label}
              {tab === item.key && (
                <span className="absolute bottom-0 left-1/2 h-[3px] w-10 -translate-x-1/2 rounded-full bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <>
          <LoadingBar />
          <div className="space-y-0">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 border-b border-border px-4 py-3.5">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/60" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/40" />
                </div>
                <div className="mt-1 h-5 w-5 shrink-0 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800/50">
            <RiBookmarkLine className="size-8 text-zinc-400" />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-bold text-foreground">{t(d.empty)}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{t(d.emptyDesc)}</p>
          </div>
        </div>
      ) : (
        <div>
          {filtered.map((b) => (
            <div
              key={b.id}
              className="flex items-start gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                b.target_type === "attention"
                  ? "bg-indigo-500/10 text-indigo-500"
                  : "bg-blue-500/10 text-blue-500"
              }`}>
                {b.target_type === "attention" ? (
                  <RiFlashlightLine className="size-4" />
                ) : (
                  <RiChat1Line className="size-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={
                    b.target_type === "attention"
                      ? `/a/${b.slug || b.target_id}`
                      : `/posts/${b.target_id}`
                  }
                  className="group"
                >
                  {b.target_type === "attention" ? (
                    <>
                      <p className="text-[11px] font-black tracking-wider text-indigo-600 dark:text-indigo-400">
                        a/{b.slug || b.target_id.slice(0, 8)}
                        {b.category ? (
                          <span className="ml-2 text-muted-foreground font-bold">· {b.category}</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[14px] font-bold text-foreground leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {b.title || `Attention · ${b.target_id.slice(0, 8)}`}
                      </p>
                      {b.energyScore !== undefined ? (
                        <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                          ⚡ {b.energyScore.toLocaleString()} Energy
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {b.title ? (
                        <p className="text-[14px] font-bold text-foreground leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {b.title}
                        </p>
                      ) : null}
                      <p className={`${b.title ? "mt-1 " : ""}line-clamp-2 text-[13px] font-medium leading-5 ${b.title ? "text-muted-foreground" : "text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400"} transition-colors`}>
                        {b.body || `Post · ${b.target_id.slice(0, 8)}`}
                      </p>
                    </>
                  )}
                </Link>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <RiEyeLine className="size-3" />
                    {b.target_type === "attention" ? t(d.tabs.attentions) : t(d.tabs.posts)}
                  </span>
                  <span>{formatDate(b.created_at)}</span>
                </div>
              </div>
              <button
                onClick={() => removeBookmark(b.id)}
                className="mt-1 shrink-0 rounded-full p-1.5 text-amber-500 transition-colors hover:bg-amber-50 dark:hover:bg-amber-500/10"
                title={t(d.remove)}
              >
                <RiBookmarkFill className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("default", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateStr));
}
