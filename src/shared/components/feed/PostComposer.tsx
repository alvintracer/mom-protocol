"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiHashtag,
  RiLinksLine,
  RiListCheck2,
} from "react-icons/ri";

import { text } from "@/shared/i18n/config";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import type { SocialPost } from "@/shared/types/domain";

export type AttentionOption = {
  id: string;
  title: string;
  slug: string | null;
  category: string | null;
};

type PostComposerProps = {
  attentions: AttentionOption[];
  isAuthenticated: boolean;
  onCreatePost: (post: SocialPost) => Promise<boolean>;
  lockedAttentionId?: string | null;
  caseOptions?: string[];
  compactContext?: boolean;
};

export function PostComposer({
  attentions,
  isAuthenticated,
  onCreatePost,
  lockedAttentionId = null,
  caseOptions = [],
  compactContext = false,
}: PostComposerProps) {
  const { dictionary, language, t } = useI18n();
  const [body, setBody] = useState("");
  const [attentionId, setAttentionId] = useState(lockedAttentionId ?? "");
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [tags, setTags] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const postCounterRef = useRef(0);

  const detectedUrl = useMemo(() => {
    const fromBody = body.match(/https?:\/\/\S+/i)?.[0] ?? "";
    return externalUrl.trim() || fromBody;
  }, [body, externalUrl]);

  const linkedAttention =
    attentions.find((attention) => attention.id === (lockedAttentionId ?? attentionId)) ??
    null;
  const canPost = body.trim().length > 0 || detectedUrl.length > 0;

  const handleSubmit = async () => {
    if (!canPost) {
      return;
    }

    if (!isAuthenticated) {
      setNotice(t(dictionary.home.signedOutPostHint));
      window.setTimeout(() => setNotice(""), 2600);
      return;
    }

    const userTags = tags
      .split(/[,\s]+/)
      .map((tag) => tag.replace(/^#/, "").trim())
      .filter(Boolean)
      .slice(0, 6);

    postCounterRef.current += 1;

    const post: SocialPost = {
      id: `mock-post-${postCounterRef.current}`,
      title: null,
      body: body.trim() || t(dictionary.home.mockLinkSource),
      originalLanguage: language,
      authorName: dictionary.common.me,
      authorHandle: "me",
      avatarInitials: t(dictionary.common.me).slice(0, 1),
      createdAtLabel: dictionary.common.now,
      linkedEventId: linkedAttention?.id ?? null,
      selectedOutcome: selectedOutcome || null,
      postKind: "post",
      repostOf: null,
      replyCount: 0,
      repostCount: 0,
      likeCount: 0,
      viewCount: 0,
      userTags,
      autoTags: linkedAttention
        ? [linkedAttention.category ?? linkedAttention.slug ?? "attention"]
        : ["general"],
      externalUrl: detectedUrl || null,
      mediaItems: [],
      externalPreview: detectedUrl
        ? {
            sourceName: detectSourceName(detectedUrl),
            title: linkedAttention
              ? text(linkedAttention.title, linkedAttention.title, linkedAttention.title)
              : dictionary.home.mockLinkSource,
            description: dictionary.home.mockLinkSourceDesc,
          }
        : null,
      translationStatus: "queued",
      autoTagStatus: "queued",
    };

    setIsSubmitting(true);
    const ok = await onCreatePost(post);
    setIsSubmitting(false);

    if (!ok) {
      setNotice(t(dictionary.home.postFailed));
      window.setTimeout(() => setNotice(""), 2600);
      return;
    }

    setBody("");
    setExternalUrl("");
    setTags("");
    setSelectedOutcome("");
    setNotice(t(dictionary.home.postCreated));
    window.setTimeout(() => setNotice(""), 2200);
  };

  return (
    <section className="border-b border-border bg-background p-4">
      <div className="flex gap-3 sm:gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
          {t(dictionary.common.me).slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">
            {t(dictionary.home.postComposerTitle)}
          </p>

          <label className="sr-only" htmlFor="post-body">
            {t(dictionary.home.postBodyLabel)}
          </label>
          <textarea
            id="post-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t(dictionary.home.composerPlaceholder)}
            rows={3}
            className="mt-3 min-h-24 w-full resize-none bg-transparent text-[18px] font-medium leading-7 text-foreground outline-none placeholder:text-muted-foreground"
          />

          <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {!compactContext ? (
              <FieldShell icon={<RiArrowDownSLine className="size-4" />}>
                <label className="sr-only" htmlFor="linked-attention">
                  {t(dictionary.home.attachAttention)}
                </label>
                <select
                  id="linked-attention"
                  value={attentionId}
                  onChange={(event) => setAttentionId(event.target.value)}
                  className="h-10 w-full bg-transparent text-sm font-bold text-foreground outline-none"
                >
                  <option value="">{t(dictionary.home.noAttention)}</option>
                  {attentions.map((attention) => (
                    <option key={attention.id} value={attention.id}>
                      a/{attention.slug ?? attention.title}
                    </option>
                  ))}
                </select>
              </FieldShell>
            ) : (
              <FieldShell icon={<RiArrowDownSLine className="size-4" />}>
                <p className="h-10 min-w-0 truncate py-2.5 text-sm font-black text-foreground">
                  a/{linkedAttention?.slug ?? linkedAttention?.title ?? "attention"}
                </p>
              </FieldShell>
            )}

            <FieldShell icon={<RiHashtag className="size-4" />}>
              <label className="sr-only" htmlFor="hashtags">
                {t(dictionary.home.hashtagLabel)}
              </label>
              <input
                id="hashtags"
                type="text"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder={t(dictionary.home.hashtagPlaceholder)}
                className="h-10 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
              />
            </FieldShell>
          </div>

          {compactContext && caseOptions.length > 0 ? (
            <FieldShell className="mt-2" icon={<RiListCheck2 className="size-4" />}>
              <label className="sr-only" htmlFor="attention-outcome">
                {t(dictionary.home.caseOptionLabel)}
              </label>
              <select
                id="attention-outcome"
                value={selectedOutcome}
                onChange={(event) => setSelectedOutcome(event.target.value)}
                className="h-10 w-full bg-transparent text-sm font-bold text-foreground outline-none"
              >
                <option value="">{t(dictionary.home.noCaseOption)}</option>
                {caseOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatOutcomeLabel(option)}
                  </option>
                ))}
              </select>
            </FieldShell>
          ) : null}

          {!compactContext ? (
            <FieldShell className="mt-2" icon={<RiLinksLine className="size-4" />}>
              <label className="sr-only" htmlFor="external-link">
                {t(dictionary.home.externalLink)}
              </label>
              <input
                id="external-link"
                type="url"
                value={externalUrl}
                onChange={(event) => setExternalUrl(event.target.value)}
                placeholder={t(dictionary.home.externalLinkPlaceholder)}
                className="h-10 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
              />
            </FieldShell>
          ) : null}

          {!compactContext && detectedUrl ? (
            <div className="mt-3 rounded-lg border border-border p-3">
              <p className="text-[12px] font-bold text-blue-600">
                {t(dictionary.home.linkPreview)} · {detectSourceName(detectedUrl)}
              </p>
              <p className="mt-1 truncate text-sm font-black text-foreground">
                {linkedAttention ? linkedAttention.title : t(dictionary.home.mockLinkSource)}
              </p>
              <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
                {t(dictionary.home.mockLinkSourceDesc)}
              </p>
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0 text-[12px] font-bold text-muted-foreground">
              {notice ? <span className="text-blue-600">{notice}</span> : null}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canPost || isSubmitting}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RiAddLine className="size-5" />
              {t(dictionary.home.postButton)}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FieldShell({
  children,
  className = "",
  icon,
}: {
  children: ReactNode;
  className?: string;
  icon: ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 rounded-lg border border-border bg-zinc-50 px-3 dark:bg-zinc-900/50 ${className}`}
    >
      <span className="shrink-0 text-blue-600">{icon}</span>
      {children}
    </div>
  );
}

function detectSourceName(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");

    if (host.includes("polymarket")) return "Polymarket";
    if (host.includes("kalshi")) return "Kalshi";
    if (host.includes("predictit")) return "PredictIt";
    if (host.includes("manifold")) return "Manifold";

    return host;
  } catch {
    return "External source";
  }
}

function formatOutcomeLabel(value: string) {
  const normalized = value.trim();

  if (normalized.toLowerCase() === "yes") return "YES";
  if (normalized.toLowerCase() === "no") return "NO";
  if (normalized.toLowerCase() === "ambiguous") return "Ambiguous";

  return normalized;
}
