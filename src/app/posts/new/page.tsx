"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, Suspense, useEffect, useMemo, useState } from "react";
import {
  RiArrowLeftLine,
  RiAttachment2,
  RiCloseLine,
  RiDraftLine,
  RiFilmLine,
  RiImage2Line,
  RiLinksLine,
  RiListCheck2,
  RiSearchLine,
  RiSendPlane2Line,
  RiVipDiamondLine,
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import { PremiumEditor } from "@/shared/components/editor/PremiumEditor";
import { isOfficialAccount } from "@/shared/lib/admin";
import type { Database, Json, SupportedLanguage } from "@/shared/types/database";

type AttentionRow = Database["public"]["Tables"]["attention_clusters"]["Row"];
type AttentionRuleRow = Database["public"]["Tables"]["attention_rules"]["Row"];
type AttentionOption = {
  id: string;
  title: string;
  slug: string | null;
  category: string | null;
  canonicalEventId: string | null;
};
type MediaItem = {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  previewUrl?: string;
};
type UploadedMediaItem = {
  name: string;
  type: string;
  size: number;
  bucket: "post-media";
  path: string;
  url: string;
};

const maxImageFiles = 4;
const maxVideoFiles = 1;
const maxImageTotalBytes = 50 * 1024 * 1024;
const maxVideoTotalBytes = 100 * 1024 * 1024;
const maxVideoDurationSec = 180; // 3 minutes

export default function NewPostPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <NewPostContent />
    </Suspense>
  );
}

function NewPostContent() {
  const router = useRouter();
  const { dictionary, language, t } = useI18n();
  const initialDraft = readPostDraft();
  const [attentionOptions, setAttentionOptions] = useState<AttentionOption[]>([]);
  const [attentionQuery, setAttentionQuery] = useState("");
  const [selectedAttention, setSelectedAttention] = useState<AttentionOption | null>(
    initialDraft.selectedAttention,
  );
  const [caseOptions, setCaseOptions] = useState<string[]>([]);
  const [selectedOutcome, setSelectedOutcome] = useState(initialDraft.selectedOutcome);
  const [isLoadingCases, setIsLoadingCases] = useState(false);
  const [isAttentionOpen, setIsAttentionOpen] = useState(false);
  const [title, setTitle] = useState(initialDraft.title);
  const [body, setBody] = useState(initialDraft.body);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaMode, setMediaMode] = useState<"none" | "image" | "video">("none");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [linkTitle, setLinkTitle] = useState(initialDraft.linkTitle);
  const [linkUrl, setLinkUrl] = useState(initialDraft.linkUrl);
  const [linkPreview, setLinkPreview] = useState<{ image: string; title: string; description: string } | null>(null);
  const [isFetchingLink, setIsFetchingLink] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "posting" | "error" | "login">("idle");
  // Premium post
  const [isPremium, setIsPremium] = useState(false);
  const [premiumCost, setPremiumCost] = useState<string>("");
  const [momRate, setMomRate] = useState<number>(0.001);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userHandle, setUserHandle] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  // Topic picker
  const [selectedTopics, setSelectedTopics] = useState<{ slug: string; label: string }[]>([]);
  const [topicQuery, setTopicQuery] = useState("");
  const [topicResults, setTopicResults] = useState<{ slug: string; canonical_label: string; labels: Record<string, string>; kind: string }[]>([]);

  const searchParams = useSearchParams();
  const attentionParam = searchParams.get("attention");
  const outcomeParam = searchParams.get("outcome");
  const quoteParam = searchParams.get("quote");
  const [quotePost, setQuotePost] = useState<{
    id: string;
    authorName: string;
    authorHandle: string;
    body: string;
    title: string | null;
    attentionId: string | null;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchOg = async () => {
      const url = linkUrl.trim();
      if (!isValidUrl(url)) {
        if (mounted) { setLinkPreview(null); setIsFetchingLink(false); }
        return;
      }
      setIsFetchingLink(true);
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (mounted && data && !data.error) {
          setLinkPreview({ image: data.image || "", title: data.title || "", description: data.description || "" });
          if (!linkTitle && data.title) {
            setLinkTitle(data.title);
          }
        } else if (mounted) {
          setLinkPreview(null);
        }
      } catch {
        if (mounted) setLinkPreview(null);
      } finally {
        if (mounted) setIsFetchingLink(false);
      }
    };
    const timer = setTimeout(fetchOg, 500);
    return () => { mounted = false; clearTimeout(timer); };
  }, [linkUrl]);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadRecentAttentions() {
      const { data } = await supabase
        .from("attention_clusters")
        .select("*")
        .in("status", ["active", "reviewing"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (mounted) {
        setAttentionOptions((data ?? []).map(mapAttention));
      }

      if (!attentionParam || !mounted) {
        return;
      }

      const { data: attentionData } = isUuid(attentionParam)
        ? await supabase
            .from("attention_clusters")
            .select("*")
            .eq("id", attentionParam)
            .maybeSingle()
        : await supabase
            .from("attention_clusters")
            .select("*")
            .eq("slug", attentionParam)
            .maybeSingle();

      if (mounted && attentionData) {
        const mappedAttention = mapAttention(attentionData);
        setSelectedAttention(mappedAttention);
        setAttentionOptions((current) =>
          current.some((attention) => attention.id === mappedAttention.id)
            ? current
            : [mappedAttention, ...current],
        );

        // Auto-select outcome from URL (e.g. from PredictionWidget)
        if (outcomeParam) {
          setSelectedOutcome(outcomeParam);
        }
      }
    }

    loadRecentAttentions();

    return () => {
      mounted = false;
      mediaItems.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attentionParam, outcomeParam]);

  // Load quoted post
  useEffect(() => {
    if (!quoteParam) return;
    let mounted = true;
    const supabase = createClient();

    async function loadQuotePost() {
      const { data: postData } = await supabase
        .from("posts")
        .select("*")
        .eq("id", quoteParam!)
        .eq("is_deleted", false)
        .maybeSingle();
      if (!mounted || !postData) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", postData.user_id)
        .maybeSingle();

      if (!mounted) return;

      setQuotePost({
        id: postData.id,
        authorName: profile?.display_name ?? profile?.handle ?? `u/${postData.user_id.slice(0, 8)}`,
        authorHandle: profile?.handle ?? postData.user_id.slice(0, 8),
        body: postData.original_body,
        title: postData.original_title,
        attentionId: postData.attention_cluster_id,
      });

      // Auto-select the quoted post's attention if any
      if (postData.attention_cluster_id && !selectedAttention) {
        const { data: attn } = await supabase
          .from("attention_clusters")
          .select("*")
          .eq("id", postData.attention_cluster_id)
          .maybeSingle();
        if (mounted && attn) {
          const mapped = mapAttention(attn);
          setSelectedAttention(mapped);
          setAttentionOptions((prev) =>
            prev.some((a) => a.id === mapped.id) ? prev : [mapped, ...prev],
          );
        }
      }
    }

    loadQuotePost();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteParam]);

  // Fetch MOM rate for premium price display + current user ID
  useEffect(() => {
    fetch("/api/rate")
      .then((r) => r.json())
      .then((d) => { if (d.rate) setMomRate(d.rate); })
      .catch(() => {});
    createClient().auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id);
        const { data: profile } = await createClient()
          .from("profiles")
          .select("handle")
          .eq("id", data.user.id)
          .maybeSingle();
        if (profile?.handle) setUserHandle(profile.handle);
      }
    });
  }, []);

  // Topic search
  useEffect(() => {
    if (topicQuery.trim().length < 1) {
      setTopicResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const q = topicQuery.trim().toLowerCase();
      const { data } = await supabase
        .from("topics")
        .select("slug, canonical_label, labels, kind")
        .or(`slug.ilike.%${q}%,canonical_label.ilike.%${q}%`)
        .order("canonical_label")
        .limit(10);
      if (!cancelled && data) {
        setTopicResults(
          (data as { slug: string; canonical_label: string; labels: Record<string, string>; kind: string }[])
            .filter((t) => !selectedTopics.some((s) => s.slug === t.slug)),
        );
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [topicQuery, selectedTopics]);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    const query = attentionQuery.trim();

    async function searchAttentions() {
      const request = query
        ? supabase
            .from("attention_clusters")
            .select("*")
            .in("status", ["active", "reviewing"])
            .ilike("title", `%${query}%`)
            .order("updated_at", { ascending: false })
            .limit(8)
        : supabase
            .from("attention_clusters")
            .select("*")
            .in("status", ["active", "reviewing"])
            .order("created_at", { ascending: false })
            .limit(5);

      const { data } = await request;
      if (mounted) {
        setAttentionOptions((data ?? []).map(mapAttention));
      }
    }

    const timer = window.setTimeout(searchAttentions, query ? 180 : 0);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [attentionQuery]);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadCaseOptions() {
      setSelectedOutcome("");
      setCaseOptions([]);
      setIsLoadingCases(false);

      if (!selectedAttention) {
        return;
      }

      setIsLoadingCases(true);

      let data = null;

      // Try by canonical event ID first
      if (selectedAttention.canonicalEventId) {
        const result = await supabase
          .from("attention_rules")
          .select("*")
          .eq("event_id", selectedAttention.canonicalEventId)
          .maybeSingle();
        data = result.data;
      }

      // Fallback: look up the cluster's canonical_event_id, then query rules
      if (!data && selectedAttention.id) {
        const { data: clusterData } = await supabase
          .from("attention_clusters")
          .select("canonical_event_id")
          .eq("id", selectedAttention.id)
          .maybeSingle();

        if (clusterData?.canonical_event_id) {
          const result = await supabase
            .from("attention_rules")
            .select("*")
            .eq("event_id", clusterData.canonical_event_id)
            .maybeSingle();
          data = result.data;
        }
      }

      if (!mounted) {
        return;
      }

      setCaseOptions(normalizeCaseOptions(data));
      setIsLoadingCases(false);
    }

    loadCaseOptions();

    return () => {
      mounted = false;
    };
  }, [selectedAttention]);

  const totalMediaBytes = useMemo(
    () => mediaItems.reduce((sum, item) => sum + item.size, 0),
    [mediaItems],
  );
  const maxFiles = mediaMode === "video" ? maxVideoFiles : maxImageFiles;
  const maxTotalBytes = mediaMode === "video" ? maxVideoTotalBytes : maxImageTotalBytes;
  const normalizedLinkUrl = linkUrl.trim();
  const canPost =
    title.trim().length > 0 &&
    (!normalizedLinkUrl || isValidUrl(normalizedLinkUrl)) &&
    mediaItems.length <= maxFiles &&
    totalMediaBytes <= maxTotalBytes;

  async function handleMediaChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setMediaError(null);

    const firstFileType = files[0].type;
    const incomingMode = firstFileType.startsWith("video/") ? "video" : "image";

    // Enforce single media type
    if (mediaMode !== "none" && mediaMode !== incomingMode) {
      setMediaError(
        incomingMode === "video"
          ? t(dictionary.postCreate.mediaTypeConflictVideo)
          : t(dictionary.postCreate.mediaTypeConflictImage),
      );
      event.target.value = "";
      return;
    }

    const effectiveMaxFiles = incomingMode === "video" ? maxVideoFiles : maxImageFiles;
    const nextFiles = files.slice(0, Math.max(0, effectiveMaxFiles - mediaItems.length));
    const nextItems: MediaItem[] = [];

    for (const file of nextFiles) {
      // Video: only 1 allowed, check duration
      if (file.type.startsWith("video/")) {
        if (mediaItems.some((m) => m.type.startsWith("video/"))) {
          setMediaError(t(dictionary.postCreate.videoSingleOnly));
          continue;
        }
        // Check duration
        const duration = await getVideoDuration(file);
        if (duration > maxVideoDurationSec) {
          setMediaError(t(dictionary.postCreate.videoTooLong));
          continue;
        }
      }

      nextItems.push({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        name: file.name,
        type: file.type,
        size: file.size,
        previewUrl: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : file.type.startsWith("video/")
            ? URL.createObjectURL(file)
            : undefined,
      });
    }

    if (nextItems.length > 0) {
      const newMode = nextItems[0].type.startsWith("video/") ? "video" : "image";
      setMediaMode((prev) => (prev === "none" ? newMode : prev));
      setMediaItems((current) => [...current, ...nextItems].slice(0, effectiveMaxFiles));
    }
    event.target.value = "";
  }

  function handleRemoveMedia(itemId: string) {
    setMediaItems((current) => {
      const item = current.find((i) => i.id === itemId);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      const next = current.filter((i) => i.id !== itemId);
      if (next.length === 0) setMediaMode("none");
      return next;
    });
    setMediaError(null);
  }

  function saveDraft() {
    window.localStorage.setItem(
      "momment.postDraft",
      JSON.stringify({
        title,
        body,
        linkTitle,
        linkUrl,
        selectedAttention,
        selectedOutcome,
      }),
    );
    setStatus("saving");
    window.setTimeout(() => setStatus("idle"), 1200);
  }

  async function publishPost() {
    if (!canPost || status === "posting") {
      return;
    }

    setStatus("posting");
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setStatus("login");
      router.push("/auth/login?next=/posts/new");
      return;
    }

    try {
      const uploadedMediaItems = await uploadMediaItems(
        supabase,
        userData.user.id,
        mediaItems,
      );
      const { data, error } = await supabase
        .from("posts")
        .insert({
          user_id: userData.user.id,
          attention_cluster_id: selectedAttention?.id ?? null,
          selected_outcome: selectedOutcome || null,
          post_kind: quotePost ? "quote" : "post",
          type: "analysis",
          visibility: "public",
          original_language: language as SupportedLanguage,
          original_title: title.trim(),
          original_body: body.trim() || title.trim(),
          link_title: linkTitle.trim() || linkPreview?.title || null,
          link_url: normalizedLinkUrl || null,
          link_image_url: linkPreview?.image || null,
          link_description: linkPreview?.description || null,
          media_items: uploadedMediaItems as Json,
          translation_status: "pending",
          repost_of_post_id: quotePost?.id ?? null,
          is_premium: isPremium,
          premium_energy_cost: isPremium && premiumCost ? Number(premiumCost) : null,
          content_format: isPremium ? "html" : "plain",
          is_pinned: isOfficialAccount(userHandle) && isPinned,
        })
        .select("id")
        .single();

      if (error || !data) {
        setStatus("error");
        return;
      }

      await supabase.rpc("enqueue_missing_translations_for_post", {
        target_post_id: data.id,
      });

      // Insert user-selected topics
      if (selectedTopics.length > 0) {
        const { data: topicRows } = await supabase
          .from("topics")
          .select("id, slug")
          .in("slug", selectedTopics.map((t) => t.slug));

        if (topicRows && topicRows.length > 0) {
          await supabase.from("content_topics").insert(
            topicRows.map((t: { id: string }) => ({
              topic_id: t.id,
              target_type: "post" as const,
              target_id: data.id,
              source: "user" as const,
              confidence: 1.0,
            })),
          );
        }
      }

      // Fire-and-forget: LLM auto-tagging
      fetch("/api/posts/auto-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: data.id }),
      }).catch(() => {});

      window.localStorage.removeItem("momment.postDraft");
      router.push(`/posts/${data.id}`);
    } catch {
      setStatus("error");
      return;
    }
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-foreground">
          <RiArrowLeftLine className="size-5" />
          {t(dictionary.postCreate.backLabel)}
        </Link>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5 sm:px-6">
          {/* Premium post toggle — top of form */}
          <section className="rounded-2xl border border-border bg-background shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setIsPremium(!isPremium)}
              className={`flex h-14 w-full items-center gap-3 px-4 text-left transition-colors ${
                isPremium
                  ? "bg-blue-500/5 border-b border-blue-500/20"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
              }`}
            >
              <div className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                isPremium ? "bg-blue-500/15 text-blue-600" : "bg-zinc-100 text-muted-foreground dark:bg-zinc-800"
              }`}>
                <RiVipDiamondLine className="size-4" />
              </div>
              <span className={`text-sm font-black ${isPremium ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`}>
                {t(dictionary.postCreate.premiumLabel)}
              </span>
              <div className={`ml-auto flex size-5 items-center justify-center rounded-full border-2 transition-all ${
                isPremium
                  ? "border-blue-500 bg-blue-500"
                  : "border-border"
              }`}>
                {isPremium && (
                  <svg viewBox="0 0 12 12" className="size-3 text-white">
                    <path d="M3.5 6.5L5 8l3.5-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </button>

            {isPremium && (
              <div className="space-y-3 p-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">
                    {t(dictionary.postCreate.premiumUnlockPrice)}
                  </label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={premiumCost}
                      onChange={(e) => setPremiumCost(e.target.value)}
                      placeholder={t(dictionary.postCreate.premiumPlaceholder)}
                      className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none focus:border-blue-500 [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    {premiumCost && Number(premiumCost) > 0 && (
                      <span className="shrink-0 text-sm font-bold text-muted-foreground">
                        ≈ ${(Number(premiumCost) * momRate).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] font-medium leading-4 text-muted-foreground">
                  {t(dictionary.postCreate.premiumFeeNotice)}
                </p>
              </div>
            )}
          </section>

          {/* Admin: Pin to top — only for official account */}
          {isOfficialAccount(userHandle) && (
            <section className="rounded-2xl border border-amber-300/50 bg-amber-50/30 shadow-sm overflow-hidden dark:border-amber-500/20 dark:bg-amber-900/10">
              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                className="flex h-14 w-full items-center gap-3 px-4 text-left"
              >
                <div className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                  isPinned ? "bg-amber-500/15 text-amber-600" : "bg-zinc-100 text-muted-foreground dark:bg-zinc-800"
                }`}>
                  📌
                </div>
                <div className="flex-1">
                  <span className={`text-sm font-black ${isPinned ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                    홈 피드 상단 고정
                  </span>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    momment. 공식 계정 전용
                  </p>
                </div>
                <div className={`flex size-5 items-center justify-center rounded-full border-2 transition-all ${
                  isPinned ? "border-amber-500 bg-amber-500" : "border-border"
                }`}>
                  {isPinned && (
                    <svg viewBox="0 0 12 12" className="size-3 text-white">
                      <path d="M3.5 6.5L5 8l3.5-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
            <button
              type="button"
              onClick={() => setIsAttentionOpen((current) => !current)}
              className="flex h-12 w-full items-center justify-between rounded-xl border border-border px-4 text-left text-sm font-black text-foreground transition-colors hover:border-blue-500"
            >
              <span className="truncate">
                {selectedAttention
                  ? formatAttentionLabel(selectedAttention)
                  : t(dictionary.postCreate.selectAttention)}
              </span>
              <RiSearchLine className="size-5 text-blue-600" />
            </button>

            {isAttentionOpen ? (
              <div className="mt-3 rounded-xl border border-border bg-zinc-50 p-3 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
                  <RiSearchLine className="size-4 text-blue-600" />
                  <input
                    value={attentionQuery}
                    onChange={(event) => setAttentionQuery(event.target.value)}
                    autoFocus
                    placeholder={t(dictionary.postCreate.searchAttention)}
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAttention(null);
                      setIsAttentionOpen(false);
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-muted-foreground hover:bg-background"
                  >
                    {t(dictionary.postCreate.noAttention)}
                  </button>
                  {attentionOptions.map((attention) => (
                    <button
                      key={attention.id}
                      type="button"
                      onClick={() => {
                        setSelectedAttention(attention);
                        setIsAttentionOpen(false);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left hover:bg-background"
                    >
                      <p className="truncate text-sm font-black text-foreground">
                        {attention.title}
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-muted-foreground">
                        a/{attention.slug ?? attention.id.slice(0, 8)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {selectedAttention ? (
            <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <RiListCheck2 className="size-5 text-blue-600" />
                <h2 className="text-sm font-black text-foreground">
                  {t(dictionary.postCreate.caseOptionLabel)}
                </h2>
              </div>
              {isLoadingCases ? (
                <p className="mt-3 text-sm font-bold text-muted-foreground">
                  {t(dictionary.postCreate.loadingCases)}
                </p>
              ) : caseOptions.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {caseOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setSelectedOutcome((current) =>
                          current === option ? "" : option,
                        )
                      }
                      className={`min-h-11 rounded-xl border px-4 py-2 text-left text-sm font-black transition-colors ${
                        selectedOutcome === option
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-border bg-background text-foreground hover:border-blue-500 hover:text-blue-600"
                      }`}
                    >
                      {formatOutcomeLabel(option)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm font-bold text-muted-foreground">
                  {t(dictionary.postCreate.noCaseOption)}
                </p>
              )}
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
            <label className="block text-sm font-black text-foreground">
              {t(dictionary.postCreate.titleLabel)}
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t(dictionary.postCreate.titlePlaceholder)}
              className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-[17px] font-black text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500"
            />

            {!isPremium && (
              <>
                <label className="mt-4 block text-sm font-black text-foreground">
                  {t(dictionary.postCreate.bodyLabel)}
                </label>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={t(dictionary.postCreate.bodyPlaceholder)}
                  rows={5}
                  maxLength={500}
                  className="mt-2 min-h-32 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-[16px] font-medium leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500"
                />
                <p className={`mt-1 text-right text-[11px] font-bold ${body.length > 450 ? "text-red-500" : "text-muted-foreground/50"}`}>
                  {body.length} / 500
                </p>
              </>
            )}
          </section>

          {isPremium && (
            <>
              <PremiumEditor
                value={body}
                onChange={setBody}
                placeholder={t(dictionary.postCreate.bodyPlaceholder)}
                userId={currentUserId}
              />
              <p className={`-mt-2 text-right text-[11px] font-bold ${stripHtmlLen(body) > 28000 ? "text-red-500" : "text-muted-foreground/50"}`}>
                {stripHtmlLen(body).toLocaleString()} / 30,000
              </p>
            </>
          )}

          {/* Topic picker */}
          <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
            <h2 className="text-sm font-black text-foreground">
              {t({ ko: "토픽", en: "Topics", es: "Temas" })}
              <span className="ml-1.5 text-xs font-bold text-muted-foreground">
                {t({ ko: "선택사항 · 최대 5개", en: "Optional · Max 5", es: "Opcional · Máx 5" })}
              </span>
            </h2>

            {selectedTopics.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {selectedTopics.map((topic) => (
                  <span
                    key={topic.slug}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                  >
                    #{topic.label}
                    <button
                      type="button"
                      onClick={() => setSelectedTopics((prev) => prev.filter((t) => t.slug !== topic.slug))}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200/50 dark:hover:bg-blue-500/20"
                    >
                      <RiCloseLine className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {selectedTopics.length < 5 && (
              <div className="relative mt-2">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
                  <RiSearchLine className="size-4 text-muted-foreground" />
                  <input
                    value={topicQuery}
                    onChange={(e) => setTopicQuery(e.target.value)}
                    placeholder={t({ ko: "토픽 검색...", en: "Search topics...", es: "Buscar temas..." })}
                    className="h-9 min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>

                {topicResults.length > 0 && (
                  <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-border bg-background shadow-lg">
                    {topicResults.map((topic) => (
                      <button
                        key={topic.slug}
                        type="button"
                        onClick={() => {
                          setSelectedTopics((prev) => [
                            ...prev,
                            { slug: topic.slug, label: topic.labels[language] || topic.canonical_label },
                          ]);
                          setTopicQuery("");
                          setTopicResults([]);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-foreground hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                      >
                        <span className="text-blue-600">#</span>
                        <span>{topic.labels[language] || topic.canonical_label}</span>
                        <span className="ml-auto text-[10px] font-medium text-muted-foreground">{topic.kind}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-foreground">
                  {t(dictionary.postCreate.mediaLabel)}
                </h2>
                <p className="mt-1 text-xs font-bold text-muted-foreground">
                  {t(dictionary.postCreate.mediaHelp)}
                </p>
              </div>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-black text-foreground transition-colors hover:border-blue-500 hover:text-blue-600">
                <RiAttachment2 className="size-4" />
                {t(dictionary.postCreate.addMedia)}
                <input
                  type="file"
                  multiple={mediaMode !== "video"}
                  accept={mediaMode === "video" ? "video/*" : mediaMode === "image" ? "image/*" : "image/*,video/*"}
                  onChange={handleMediaChange}
                  className="sr-only"
                />
              </label>
            </div>

            {mediaError ? (
              <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-[12px] font-bold text-rose-600">{mediaError}</p>
            ) : null}

            {mediaItems.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {mediaItems.map((item) => (
                  <div
                    key={item.id}
                    className="relative overflow-hidden rounded-xl border border-border bg-zinc-50 dark:bg-zinc-900/50"
                  >
                    {item.type.startsWith("image/") && item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.previewUrl} alt="" className="aspect-square w-full object-cover" />
                    ) : item.type.startsWith("video/") && item.previewUrl ? (
                      <div className="relative aspect-video w-full bg-black">
                        <video src={item.previewUrl} className="h-full w-full object-contain" preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <RiFilmLine className="size-8 text-white/70" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex aspect-square items-center justify-center text-blue-600">
                        <RiImage2Line className="size-8" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(item.id)}
                      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background"
                    >
                      <RiCloseLine className="size-4" />
                    </button>
                    <div className="p-2">
                      <p className="truncate text-xs font-black text-foreground">{item.name}</p>
                      <p className="mt-0.5 text-[11px] font-bold text-muted-foreground">
                        {formatBytes(item.size)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <RiLinksLine className="size-5 text-blue-600" />
              <h2 className="text-sm font-black text-foreground">
                {t(dictionary.postCreate.linkLabel)}
              </h2>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://"
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none focus:border-blue-500"
              />
              <input
                value={linkTitle}
                onChange={(event) => setLinkTitle(event.target.value)}
                placeholder={t(dictionary.postCreate.linkTitlePlaceholder) + " (Optional)"}
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none focus:border-blue-500"
              />
            </div>
            {normalizedLinkUrl ? (
              <div className="mt-3 rounded-xl border border-border p-3">
                {linkPreview?.image && (
                  <img src={linkPreview.image} alt="" className="mb-3 w-full max-h-48 object-cover rounded-lg" />
                )}
                {isFetchingLink && <p className="mb-2 text-xs text-muted-foreground animate-pulse">Fetching preview...</p>}
                <p className="text-xs font-black text-blue-600">
                  {detectSourceName(
                    normalizedLinkUrl,
                    t(dictionary.postCreate.externalLink),
                  )}
                </p>
                <p className="mt-1 truncate text-sm font-black text-foreground">
                  {linkTitle || linkPreview?.title || t(dictionary.postCreate.linkTitleRequired)}
                </p>
                <p className="mt-1 line-clamp-2 text-xs font-bold text-muted-foreground">
                  {linkPreview?.description || normalizedLinkUrl}
                </p>
              </div>
            ) : null}
          </section>

          {quotePost ? (
            <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm dark:border-blue-500/20 dark:bg-blue-500/5">
              <p className="text-[11px] font-black uppercase tracking-wider text-blue-600">
                {t(dictionary.postCreate.quotingLabel)}
              </p>
              <div className="mt-2 rounded-xl border border-border bg-background p-3">
                <div className="flex items-center gap-1.5 text-[13px]">
                  <span className="font-bold text-foreground">{quotePost.authorName}</span>
                  <span className="text-muted-foreground">@{quotePost.authorHandle}</span>
                </div>
                {quotePost.title ? (
                  <p className="mt-1.5 text-sm font-black text-foreground">{quotePost.title}</p>
                ) : null}
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm font-medium leading-6 text-foreground">
                  {quotePost.body}
                </p>
              </div>
            </section>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={saveDraft}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-black text-foreground transition-colors hover:border-blue-500 hover:text-blue-600"
            >
              <RiDraftLine className="size-4" />
              {status === "saving"
                ? t(dictionary.postCreate.draftSaved)
                : t(dictionary.postCreate.saveDraft)}
            </button>
            <button
              type="button"
              onClick={publishPost}
              disabled={!canPost || status === "posting"}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "posting" ? (
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <RiSendPlane2Line className="size-4" />
              )}
              {status === "posting"
                ? t(dictionary.postCreate.posting)
                : quotePost
                  ? t(dictionary.postCreate.publishQuote)
                  : t(dictionary.postCreate.publish)}
            </button>
          </div>
          {status === "error" ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {t(dictionary.postCreate.saveFailed)}
            </p>
          ) : null}
      </main>
    </div>
  );
}

async function uploadMediaItems(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  items: MediaItem[],
): Promise<UploadedMediaItem[]> {
  const uploadedItems: UploadedMediaItem[] = [];

  for (const item of items) {
    const extension = extensionFromName(item.name);
    const path = `${userId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;
    const { error } = await supabase.storage
      .from("post-media")
      .upload(path, item.file, {
        cacheControl: "31536000",
        contentType: item.type,
        upsert: false,
      });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from("post-media").getPublicUrl(path);
    uploadedItems.push({
      name: item.name,
      type: item.type,
      size: item.size,
      bucket: "post-media",
      path,
      url: data.publicUrl,
    });
  }

  return uploadedItems;
}

function extensionFromName(name: string) {
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  return extension.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12);
}

function readPostDraft() {
  const fallback = {
    title: "",
    body: "",
    linkTitle: "",
    linkUrl: "",
    selectedAttention: null as AttentionOption | null,
    selectedOutcome: "",
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  const draft = window.localStorage.getItem("momment.postDraft");
  if (!draft) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(draft) as Partial<typeof fallback>;
    return {
      title: parsed.title ?? "",
      body: parsed.body ?? "",
      linkTitle: parsed.linkTitle ?? "",
      linkUrl: parsed.linkUrl ?? "",
      selectedAttention: parsed.selectedAttention ?? null,
      selectedOutcome: parsed.selectedOutcome ?? "",
    };
  } catch {
    window.localStorage.removeItem("momment.postDraft");
    return fallback;
  }
}

function mapAttention(row: AttentionRow): AttentionOption {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    canonicalEventId: row.canonical_event_id,
  };
}

function normalizeCaseOptions(rule: AttentionRuleRow | null) {
  const values = rule?.supported_outcomes ?? [];
  return values
    .map((value) => value.trim())
    .filter((value) => value && value.toLowerCase() !== "ambiguous");
}

function formatAttentionLabel(attention: AttentionOption) {
  return `${attention.title} (a/${attention.slug ?? attention.id.slice(0, 8)})`;
}

function formatOutcomeLabel(value: string) {
  const normalized = value.trim();

  if (normalized.toLowerCase() === "yes") return "YES";
  if (normalized.toLowerCase() === "no") return "NO";
  if (normalized.toLowerCase() === "above") return "Above";
  if (normalized.toLowerCase() === "below") return "Below";
  if (normalized.toLowerCase() === "in_range") return "In range";

  return normalized;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function detectSourceName(url: string, fallbackLabel: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("polymarket")) return "Polymarket";
    if (host.includes("kalshi")) return "Kalshi";
    if (host.includes("reddit")) return "Reddit";
    return host;
  } catch {
    return fallbackLabel;
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      resolve(video.duration);
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => {
      resolve(0);
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
  });
}

function stripHtmlLen(html: string): number {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").length;
}
