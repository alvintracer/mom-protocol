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
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
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
  const [status, setStatus] = useState<"idle" | "saving" | "posting" | "error" | "login">("idle");

  const searchParams = useSearchParams();
  const attentionParam = searchParams.get("attention");
  const outcomeParam = searchParams.get("outcome");

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
    (!normalizedLinkUrl || (linkTitle.trim().length > 0 && isValidUrl(normalizedLinkUrl))) &&
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
          post_kind: "post",
          type: "analysis",
          visibility: "public",
          original_language: language as SupportedLanguage,
          original_title: title.trim(),
          original_body: body.trim() || title.trim(),
          link_title: linkTitle.trim() || null,
          link_url: normalizedLinkUrl || null,
          media_items: uploadedMediaItems as Json,
          translation_status: "pending",
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

      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-4">
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

            <label className="mt-4 block text-sm font-black text-foreground">
              {t(dictionary.postCreate.bodyLabel)}
            </label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t(dictionary.postCreate.bodyPlaceholder)}
              rows={7}
              className="mt-2 min-h-44 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-[16px] font-medium leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500"
            />
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
                value={linkTitle}
                onChange={(event) => setLinkTitle(event.target.value)}
                placeholder={t(dictionary.postCreate.linkTitlePlaceholder)}
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none focus:border-blue-500"
              />
              <input
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://"
                className="h-11 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none focus:border-blue-500"
              />
            </div>
            {normalizedLinkUrl ? (
              <div className="mt-3 rounded-xl border border-border p-3">
                <p className="text-xs font-black text-blue-600">
                  {detectSourceName(
                    normalizedLinkUrl,
                    t(dictionary.postCreate.externalLink),
                  )}
                </p>
                <p className="mt-1 truncate text-sm font-black text-foreground">
                  {linkTitle || t(dictionary.postCreate.linkTitleRequired)}
                </p>
                <p className="mt-1 truncate text-xs font-bold text-muted-foreground">
                  {normalizedLinkUrl}
                </p>
              </div>
            ) : null}
          </section>

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
              <RiSendPlane2Line className="size-4" />
              {status === "posting"
                ? t(dictionary.postCreate.posting)
                : t(dictionary.postCreate.publish)}
            </button>
          </div>
          {status === "error" ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              {t(dictionary.postCreate.saveFailed)}
            </p>
          ) : null}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-2xl border border-border bg-background p-4 shadow-sm">
            {selectedAttention ? (
              <p className="text-xs font-black text-blue-600">
                {formatAttentionLabel(selectedAttention)}
              </p>
            ) : null}
            {selectedOutcome ? (
              <p className="mt-2 inline-flex rounded-full bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-600">
                {formatOutcomeLabel(selectedOutcome)}
              </p>
            ) : null}
            <h2 className="mt-2 text-lg font-black leading-7 text-foreground">
              {title || t(dictionary.postCreate.previewTitle)}
            </h2>
            {body ? (
              <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm font-medium leading-6 text-muted-foreground">
                {body}
              </p>
            ) : null}
            <div className="mt-4 text-xs font-bold text-muted-foreground">
              {t(dictionary.postCreate.mediaCount)} {mediaItems.length}/{maxFiles} · {formatBytes(totalMediaBytes)} / {mediaMode === "video" ? "100MB" : "50MB"}
            </div>
          </section>
        </aside>
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
