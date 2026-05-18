"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiDownloadCloudLine,
  RiExternalLinkLine,
  RiFileList3Line,
  RiGitMergeLine,
  RiGlobalLine,
  RiLinkM,
  RiListCheck2,
  RiSearchLine,
} from "react-icons/ri";

import { useI18n } from "@/shared/i18n/LanguageProvider";
import { CaptchaGate } from "@/shared/components/captcha/CaptchaGate";
import { createClient } from "@/shared/lib/supabase/client";
import type { Database } from "@/shared/types/database";

const categories = [
  "economics",
  "politics",
  "crypto",
  "sports",
  "entertainment",
  "ai",
] as const;

type AttentionClusterRow = Database["public"]["Tables"]["attention_clusters"]["Row"];

type MergeCandidate = {
  id: string;
  title: string;
  score: number;
  sources: string[];
  sourceCount: number;
  postCount: number;
};

type HotPolymarketMarket = {
  id: string;
  question: string;
  slug: string | null;
  url: string | null;
  outcomes: string[];
  volume: number | null;
  endDate: string | null;
  platform?: "polymarket" | "manifold" | "kalshi";
};

export default function NewAttentionPage() {
  const { dictionary, t } = useI18n();
  const [mode, setMode] = useState<"create" | "import">("import");
  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("sports");
  const [sourceLinks, setSourceLinks] = useState("");
  const [deadline, setDeadline] = useState("");
  const [caseOptions, setCaseOptions] = useState("YES\nNO");
  const [hotMarkets, setHotMarkets] = useState<HotPolymarketMarket[]>([]);
  const [selectedHotMarket, setSelectedHotMarket] = useState<HotPolymarketMarket | null>(null);
  const [mergeCandidates, setMergeCandidates] = useState<MergeCandidate[]>([]);
  const [selectedMergeId, setSelectedMergeId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "login">("idle");
  const [createdAttentionHref, setCreatedAttentionHref] = useState<string | null>(null);
  const [linkedPolymarket, setLinkedPolymarket] = useState<HotPolymarketMarket | null>(null);

  /* ── Similar attention suggestion state ── */
  type SimilarAttention = {
    id: string;
    title: string;
    slug: string | null;
    category: string | null;
    score: number;
    sourceCount: number;
    postCount: number;
    matchSource: string;
  };
  const [similarAttentions, setSimilarAttentions] = useState<SimilarAttention[]>([]);
  const [isSearchingSimilar, setIsSearchingSimilar] = useState(false);
  const similarDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadClusters() {
      const { data } = await supabase
        .from("attention_clusters")
        .select("*")
        .in("status", ["active", "reviewing"])
        .order("updated_at", { ascending: false })
        .limit(8);

      if (!mounted) {
        return;
      }

      const candidates = (data ?? []).map(mapClusterToMergeCandidate);
      setMergeCandidates(candidates);
    }

    loadClusters();

    return () => {
      mounted = false;
    };
  }, []);

  /* ── Debounced similarity search when user types question ── */
  useEffect(() => {
    if (similarDebounceRef.current) {
      clearTimeout(similarDebounceRef.current);
    }

    const q = question.trim();
    if (q.length < 4) {
      similarDebounceRef.current = setTimeout(() => {
        setSimilarAttentions([]);
        setIsSearchingSimilar(false);
      }, 0);
      return;
    }

    similarDebounceRef.current = setTimeout(() => setIsSearchingSimilar(true), 0);

    similarDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/attentions/similar?q=${encodeURIComponent(q)}&category=${category}&limit=4`,
        );
        const data = (await res.json()) as { matches?: SimilarAttention[] };
        setSimilarAttentions(data.matches ?? []);
      } catch {
        setSimilarAttentions([]);
      }
      setIsSearchingSimilar(false);
    }, 600);

    return () => {
      if (similarDebounceRef.current) {
        clearTimeout(similarDebounceRef.current);
      }
    };
  }, [question, category]);;

  useEffect(() => {
    let mounted = true;

    async function loadHotMarkets() {
      try {
        const response = await fetch("/api/polymarket/hot");
        const data = (await response.json()) as { markets?: HotPolymarketMarket[] };
        if (mounted) {
          setHotMarkets(data.markets ?? []);
        }
      } catch {
        if (mounted) {
          setHotMarkets([]);
        }
      }
    }

    loadHotMarkets();

    return () => {
      mounted = false;
    };
  }, []);

  const links = useMemo(
    () =>
      sourceLinks
        .split("\n")
        .map((link) => link.trim())
        .filter(Boolean)
        .slice(0, 6),
    [sourceLinks],
  );

  const importedSources = links.map((link) =>
    selectedHotMarket?.url === link
      ? mapHotMarketToImportSource(selectedHotMarket)
      : parseImportSource(link),
  );
  const firstImportedSource = importedSources[0];
  const displayQuestion =
    question ||
    firstImportedSource?.title ||
    t(dictionary.attentionBuilder.questionPlaceholder);
  const sourceNames =
    importedSources.length > 0
      ? importedSources.map((source) => source.platform)
      : mode === "create"
        ? linkedPolymarket
          ? ["momment.", platformDisplayName(linkedPolymarket.platform)]
          : ["momment."]
        : [];
  const canSubmit = mode === "create" ? question.trim().length > 0 : links.length > 0;
  const supportedOutcomes = parseCaseOptions(caseOptions);

  const handleSubmit = async () => {
    if (!canSubmit || status === "saving") {
      return;
    }

    setStatus("saving");
    setCreatedAttentionHref(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      setStatus("login");
      return;
    }

    if (mode === "create") {
      const { data, error } = await supabase.rpc("create_native_attention", {
        title: displayQuestion,
        description: null,
        category,
        resolution_criteria: null,
        ends_at: deadline || null,
        original_language: "ko",
        merge_target_cluster_id: selectedMergeId,
        supported_outcomes: supportedOutcomes,
      });

      if (error || !data) {
        setStatus("error");
        return;
      }

      // If a Polymarket market is linked, import it as an external source
      if (linkedPolymarket) {
        const importSource = mapHotMarketToImportSource(linkedPolymarket);
        await supabase.rpc("import_attention_source", {
          source_url: importSource.url,
          source_platform: importSource.platform,
          title: importSource.title,
          description: importSource.description,
          category,
          rules_text: importSource.rulesText,
          oracle_type: importSource.oracleType,
          resolver_address: null,
          external_market_id: extractExternalMarketId(importSource.url),
          reference_signal: importSource.referenceSignalValue,
          reference_signal_label: importSource.referenceSignal,
          ends_at: importSource.endsAt,
          raw_metadata: {
            imported_from_ui: true,
            linked_during_create: true,
            rules_label: importSource.rulesLabel,
          },
          merge_target_cluster_id: data,
        });
      }

      setCreatedAttentionHref(await resolveAttentionHref(supabase, data));
      setStatus("saved");
      return;
    }

    const importResult = await importSources(
      supabase,
      importedSources,
      category,
      selectedMergeId,
    );

    if (!importResult.ok || !importResult.clusterId) {
      setStatus("error");
      return;
    }

    setCreatedAttentionHref(await resolveAttentionHref(supabase, importResult.clusterId));
    setStatus("saved");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/explore"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900/50"
          >
            <RiArrowLeftLine className="size-5" />
          </Link>
        </div>
      </header>

      <main className="grid gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4">
          <div className="grid grid-cols-2 rounded-full border border-border bg-zinc-50 p-1 dark:bg-zinc-900/50">
            <button
              type="button"
              onClick={() => {
                setMode("create");
                setStatus("idle");
              }}
              className={`h-10 rounded-full text-sm font-black transition-colors ${
                mode === "create"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(dictionary.attentionBuilder.internalMode)}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("import");
                setStatus("idle");
              }}
              className={`h-10 rounded-full text-sm font-black transition-colors ${
                mode === "import"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(dictionary.attentionBuilder.externalMode)}
            </button>
          </div>

          {mode === "create" ? (
            <>
              <Field label={t(dictionary.attentionBuilder.questionLabel)}>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={t(dictionary.attentionBuilder.questionPlaceholder)}
                  rows={3}
                  className="min-h-28 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-[17px] font-semibold leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500"
                />
              </Field>

              {/* ── Similar Attention Suggestions ── */}
              {(similarAttentions.length > 0 || isSearchingSimilar) && question.trim().length >= 4 ? (
                <div className="-mt-1 rounded-lg border border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/5 p-3">
                  <div className="flex items-center gap-2">
                    <RiGitMergeLine className="size-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-[13px] font-black text-amber-700 dark:text-amber-300">
                      {t(dictionary.attentionBuilder.similarFound)}
                    </p>
                    {isSearchingSimilar ? (
                      <div className="ml-auto size-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-amber-600/80 dark:text-amber-400/70">
                    {t(dictionary.attentionBuilder.similarDesc)}
                  </p>
                  {similarAttentions.length > 0 ? (
                    <div className="mt-2.5 space-y-1.5">
                      {similarAttentions.map((sa) => (
                        <div
                          key={sa.id}
                          className={`flex items-center gap-3 rounded-lg border p-2.5 transition-all cursor-pointer ${
                            selectedMergeId === sa.id
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-500/30"
                              : "border-border bg-background hover:border-amber-300 dark:hover:border-amber-500/30"
                          }`}
                          onClick={() => setSelectedMergeId(selectedMergeId === sa.id ? null : sa.id)}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-bold leading-5 text-foreground line-clamp-1">
                              {sa.title}
                            </p>
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-px font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                                {t(dictionary.attentionBuilder.matchScore)} {sa.score}%
                              </span>
                              <span>{sa.sourceCount} {t(dictionary.attentionBuilder.sources)}</span>
                              <span>· {sa.postCount} {t(dictionary.attentionBuilder.posts)}</span>
                              {sa.category ? (
                                <span className="rounded bg-zinc-100 px-1 py-px font-bold text-zinc-500 dark:bg-zinc-800">
                                  {sa.category}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {selectedMergeId === sa.id ? (
                            <div className="flex shrink-0 flex-col items-end gap-0.5">
                              <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-black text-white">
                                {t(dictionary.attentionBuilder.selectedMergeTarget)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSelectedMergeId(null); }}
                                className="text-[10px] font-bold text-muted-foreground underline"
                              >
                                {t(dictionary.attentionBuilder.cancelMerge)}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                            >
                              {t(dictionary.attentionBuilder.mergeInto)}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t(dictionary.attentionBuilder.categoryLabel)}>
                  <CategorySelect
                    category={category}
                    setCategory={setCategory}
                    dictionary={dictionary}
                    t={t}
                  />
                </Field>

                <Field label={t(dictionary.attentionBuilder.deadlineLabel)}>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                    className="h-12 w-full rounded-lg border border-border bg-background px-4 text-sm font-bold text-foreground outline-none focus:border-blue-500"
                  />
                </Field>
              </div>

              <Field label={t(dictionary.attentionBuilder.caseOptionsLabel)}>
                <textarea
                  value={caseOptions}
                  onChange={(event) => setCaseOptions(event.target.value)}
                  placeholder={t(dictionary.attentionBuilder.caseOptionsPlaceholder)}
                  rows={4}
                  className="min-h-28 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500"
                />
              </Field>

              <section className="rounded-lg border border-border bg-background p-4">
                <div className="flex items-center gap-2">
                  <RiListCheck2 className="size-5 text-blue-600" />
                  <h2 className="text-lg font-black text-foreground">
                    {t(dictionary.attentionBuilder.casePreviewTitle)}
                  </h2>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {supportedOutcomes.map((option) => (
                    <div
                      key={option}
                      className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-black text-foreground"
                    >
                      {option}
                    </div>
                  ))}
                </div>
              </section>

              <PolymarketSearchPanel
                onSelect={(market) => {
                  setLinkedPolymarket(market);
                  if (!question.trim()) {
                    setQuestion(market.question);
                  }
                  if (caseOptions === "YES\nNO" && market.outcomes.length > 0) {
                    setCaseOptions(market.outcomes.join("\n"));
                  }
                  if (!deadline && market.endDate) {
                    setDeadline(market.endDate.slice(0, 10));
                  }
                }}
                onRemove={() => setLinkedPolymarket(null)}
                linkedMarket={linkedPolymarket}
              />

            </>
          ) : (
            <>
              {hotMarkets.length > 0 ? (
                <section className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-foreground">
                        Polymarket 인기 마켓
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">
                        인기 마켓을 momment. 어텐션으로 빠르게 가져옵니다.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {hotMarkets.slice(0, 5).map((market) => (
                      <button
                        key={market.id}
                        type="button"
                        onClick={() => {
                          setSelectedHotMarket(market);
                          setQuestion(market.question);
                          setSourceLinks(market.url ?? "");
                          setCaseOptions(market.outcomes.join("\n"));
                          setDeadline(market.endDate ? market.endDate.slice(0, 10) : "");
                        }}
                        className="rounded-lg border border-border p-3 text-left transition-colors hover:border-blue-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                      >
                        <p className="line-clamp-2 text-sm font-black text-foreground">
                          {market.question}
                        </p>
                        <p className="mt-1 text-xs font-bold text-muted-foreground">
                          {market.outcomes.join(" · ")}
                          {market.volume ? ` · Vol ${Math.round(market.volume).toLocaleString()}` : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <Field label={t(dictionary.attentionBuilder.importLinksLabel)}>
                <textarea
                  value={sourceLinks}
                  onChange={(event) => {
                    setSourceLinks(event.target.value);
                    setStatus("idle");
                  }}
                  placeholder={t(dictionary.attentionBuilder.importLinksPlaceholder)}
                  rows={5}
                  className="min-h-36 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500"
                />
              </Field>

              {importedSources.length > 0 ? (
                <section className="space-y-3">
                  {importedSources.map((source) => (
                    <ImportSourceCard key={source.url} source={source} />
                  ))}
                </section>
              ) : null}

            </>
          )}

          <MergeAttentionPanel
            candidates={mergeCandidates}
            selectedMergeId={selectedMergeId}
            setSelectedMergeId={setSelectedMergeId}
          />

          <CaptchaGate action="attention_build">
            {({ captchaToken, isVerified, CaptchaWidget }) => (
              <>
                {CaptchaWidget}
                <button
                  type="button"
                  disabled={!canSubmit || status === "saving" || !isVerified}
                  onClick={handleSubmit}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {mode === "create" ? (
                    <RiAddLine className="size-5" />
                  ) : (
                    <RiDownloadCloudLine className="size-5" />
                  )}
                  {mode === "create"
                    ? t(dictionary.attentionBuilder.createDraft)
                    : t(dictionary.attentionBuilder.importDraft)}
                </button>
              </>
            )}
          </CaptchaGate>

          {status === "saved" ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold leading-6 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
              <p>
                {mode === "create"
                  ? t(dictionary.attentionBuilder.created)
                  : t(dictionary.attentionBuilder.imported)}
              </p>
              {createdAttentionHref ? (
                <Link
                  href={createdAttentionHref}
                  className="mt-2 inline-flex text-blue-700 underline underline-offset-4 dark:text-blue-200"
                >
                  {t(dictionary.attentionBuilder.openCreatedAttention)}
                </Link>
              ) : null}
            </div>
          ) : null}
          {status === "error" || status === "login" ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
              {status === "login"
                ? t(dictionary.attentionBuilder.loginRequired)
                : t(dictionary.attentionBuilder.saveFailed)}
            </p>
          ) : null}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
          <section className="rounded-lg border border-border bg-background p-4 shadow-sm">
            <p className="text-sm font-black text-blue-600">
              {mode === "create"
                ? t(dictionary.attentionBuilder.previewTitle)
                : t(dictionary.attentionBuilder.importPreviewTitle)}
            </p>
            <h2 className="mt-2 text-xl font-black leading-7 text-foreground">
              {displayQuestion}
            </h2>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              {categoryLabel(category, dictionary, t)}
            </p>

            <div className="mt-4 space-y-3">
              <PreviewRow
                icon={<RiFileList3Line className="size-5" />}
                label={t(dictionary.attentionBuilder.communityAnchor)}
                value="momment."
              />
              <PreviewRow
                icon={<RiGlobalLine className="size-5" />}
                label={t(dictionary.attentionBuilder.unifiedSources)}
                value={sourceNames.length > 0 ? sourceNames.join(" · ") : "Paste URL"}
              />
              {mode === "create" ? (
                <PreviewRow
                  icon={<RiListCheck2 className="size-5" />}
                  label={t(dictionary.attentionBuilder.casePreviewTitle)}
                  value={supportedOutcomes.join(" · ")}
                />
              ) : null}
              <PreviewRow
                icon={<RiCheckboxCircleLine className="size-5" />}
                label={
                  mode === "create"
                    ? t(dictionary.attentionBuilder.aioReady)
                    : t(dictionary.attentionBuilder.importedOracleReady)
                }
                value={
                  mode === "create"
                    ? t(dictionary.attentionBuilder.aioAfterDeadline)
                    : firstImportedSource?.oracleType ?? "External oracle"
                }
              />
            </div>

            {links.length > 0 ? (
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                {links.map((link) => (
                  <a
                    key={link}
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:text-blue-600 dark:bg-zinc-900/50"
                  >
                    <RiExternalLinkLine className="size-4 shrink-0" />
                    <span className="truncate">{detectSourceName(link)}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </section>

          <p className="rounded-lg border border-border bg-zinc-50 p-4 text-sm font-semibold leading-6 text-muted-foreground dark:bg-zinc-900/50">
            {t(dictionary.attentionBuilder.noTrading)}
          </p>
        </aside>
      </main>
    </div>
  );
}

function MergeAttentionPanel({
  candidates,
  selectedMergeId,
  setSelectedMergeId,
}: {
  candidates: MergeCandidate[];
  selectedMergeId: string | null;
  setSelectedMergeId: (id: string | null) => void;
}) {
  const { dictionary, t } = useI18n();

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <RiGitMergeLine className="size-5 text-blue-600" />
        <h2 className="text-lg font-black text-foreground">
          {t(dictionary.attentionBuilder.mergeCandidates)}
        </h2>
      </div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {t(dictionary.attentionBuilder.mergeCandidateDesc)}
      </p>

      <div className="mt-4 space-y-2">
        {candidates.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => setSelectedMergeId(candidate.id)}
            className={`w-full rounded-lg border p-3 text-left transition-colors ${
              selectedMergeId === candidate.id
                ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                : "border-border bg-background hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-foreground">
                  {candidate.title}
                </p>
                <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                  {candidate.sources.join(" · ")} · {candidate.postCount} posts
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-blue-600 px-2 py-1 text-[11px] font-black text-white">
                {candidate.score}%
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setSelectedMergeId(null)}
          className={`h-10 rounded-full border text-sm font-black transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900/50 ${
            selectedMergeId === null
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
              : "border-border text-foreground"
          }`}
        >
          {t(dictionary.attentionBuilder.createNewAttention)}
        </button>
        <button
          type="button"
          disabled={!selectedMergeId}
          className="h-10 rounded-full bg-foreground text-sm font-black text-background transition-colors hover:bg-blue-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t(dictionary.attentionBuilder.attachToExisting)}
        </button>
      </div>
    </section>
  );
}

function mapClusterToMergeCandidate(cluster: AttentionClusterRow): MergeCandidate {
  return {
    id: cluster.id,
    title: cluster.title,
    score: Math.min(96, Math.max(61, Math.round(Number(cluster.attention_score) || 82))),
    sources:
      cluster.source_count > 1
        ? ["momment.", `${cluster.source_count} sources`]
        : ["momment."],
    sourceCount: cluster.source_count,
    postCount: cluster.post_count,
  };
}

function CategorySelect({
  category,
  setCategory,
  dictionary,
  t,
}: {
  category: (typeof categories)[number];
  setCategory: (category: (typeof categories)[number]) => void;
  dictionary: ReturnType<typeof useI18n>["dictionary"];
  t: ReturnType<typeof useI18n>["t"];
}) {
  return (
    <select
      value={category}
      onChange={(event) =>
        setCategory(event.target.value as (typeof categories)[number])
      }
      className="h-12 w-full rounded-lg border border-border bg-background px-4 text-sm font-bold text-foreground outline-none focus:border-blue-500"
    >
      {categories.map((item) => (
        <option key={item} value={item}>
          {categoryLabel(item, dictionary, t)}
        </option>
      ))}
    </select>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-foreground">{label}</span>
      {children}
    </label>
  );
}

function ImportSourceCard({ source }: { source: ImportSource }) {
  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-600">{source.platform}</p>
          <h2 className="mt-1 line-clamp-2 text-base font-black text-foreground">
            {source.title}
          </h2>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-black text-muted-foreground">
          {source.referenceSignal}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniMetric label="Oracle" value={source.oracleType} />
        <MiniMetric label="Rules" value={source.rulesLabel} />
        <MiniMetric label="Ends" value={source.endsLabel} />
      </div>
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex min-w-0 items-center gap-2 text-xs font-bold text-muted-foreground hover:text-blue-600"
      >
        <RiLinkM className="size-4 shrink-0" />
        <span className="truncate">{source.url}</span>
      </a>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/50">
      <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-foreground">{value}</p>
    </div>
  );
}

function PreviewRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
      <span className="text-blue-600">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-sm font-black text-foreground">{value}</p>
      </div>
    </div>
  );
}

type ImportSource = {
  url: string;
  platform: string;
  title: string;
  description: string;
  oracleType: string;
  rulesLabel: string;
  rulesText: string;
  endsLabel: string;
  endsAt: string | null;
  referenceSignal: string;
  referenceSignalValue: number | null;
};

async function importSources(
  supabase: ReturnType<typeof createClient>,
  sources: ImportSource[],
  category: string,
  mergeTargetClusterId: string | null,
) {
  let lastClusterId: string | null = null;

  for (const source of sources) {
    const { data, error } = await supabase.rpc("import_attention_source", {
      source_url: source.url,
      source_platform: source.platform,
      title: source.title,
      description: source.description,
      category,
      rules_text: source.rulesText,
      oracle_type: source.oracleType,
      resolver_address: null,
      external_market_id: extractExternalMarketId(source.url),
      reference_signal: source.referenceSignalValue,
      reference_signal_label: source.referenceSignal,
      ends_at: source.endsAt,
      raw_metadata: {
        imported_from_ui: true,
        rules_label: source.rulesLabel,
        ends_label: source.endsLabel,
      },
      merge_target_cluster_id: mergeTargetClusterId,
    });

    if (error || !data) {
      return { ok: false as const, clusterId: null };
    }

    lastClusterId = data;
  }

  return { ok: true as const, clusterId: lastClusterId };
}

async function resolveAttentionHref(
  supabase: ReturnType<typeof createClient>,
  clusterId: string,
) {
  const { data } = await supabase
    .from("attention_clusters")
    .select("slug")
    .eq("id", clusterId)
    .maybeSingle();

  return `/a/${data?.slug || clusterId}`;
}

function parseImportSource(url: string): ImportSource {
  const platform = detectSourceName(url);

  if (platform === "Polymarket") {
    return {
      url,
      platform,
      title: "Korean baseball championship winner",
      description: "Polymarket reference source imported into momment.",
      oracleType: "UMA reference",
      rulesLabel: "Source rules",
      rulesText: "Resolve according to the external source rules and referenced oracle metadata.",
      endsLabel: "2026.11",
      endsAt: "2026-11-30T00:00:00+09:00",
      referenceSignal: "YES 64%",
      referenceSignalValue: 64,
    };
  }

  if (platform === "Kalshi") {
    return {
      url,
      platform,
      title: "Korean baseball championship winner",
      description: "Kalshi reference source imported into momment.",
      oracleType: "Kalshi settlement",
      rulesLabel: "Contract rules",
      rulesText: "Resolve according to the external contract rules and settlement source.",
      endsLabel: "2026.11",
      endsAt: "2026-11-30T00:00:00+09:00",
      referenceSignal: "62%",
      referenceSignalValue: 62,
    };
  }

  if (platform === "Manifold") {
    return {
      url,
      platform,
      title: "KBO season champion",
      description: "Manifold reference source imported into momment.",
      oracleType: "Community resolution",
      rulesLabel: "Resolution criteria",
      rulesText: "Resolve according to the imported resolution criteria.",
      endsLabel: "2026.11",
      endsAt: "2026-11-30T00:00:00+09:00",
      referenceSignal: "61%",
      referenceSignalValue: 61,
    };
  }

  return {
    url,
    platform,
    title: "External event source",
    description: "External source imported into momment.",
    oracleType: "Source reference",
    rulesLabel: "Imported metadata",
    rulesText: "Imported external metadata will be reviewed before final resolution.",
    endsLabel: "TBD",
    endsAt: null,
    referenceSignal: "Reference",
    referenceSignalValue: null,
  };
}

function mapHotMarketToImportSource(market: HotPolymarketMarket): ImportSource {
  const pName = platformDisplayName(market.platform);
  const oracleTypes: Record<string, string> = {
    polymarket: "UMA reference",
    manifold: "Community resolution",
    kalshi: "Kalshi settlement",
  };

  const fallbackUrls: Record<string, string> = {
    polymarket: `https://polymarket.com/event/${market.slug ?? market.id}`,
    manifold: `https://manifold.markets/${market.slug ?? market.id}`,
    kalshi: `https://kalshi.com/markets/${(market.slug ?? market.id).toLowerCase()}`,
  };

  return {
    url: market.url ?? fallbackUrls[market.platform ?? "polymarket"],
    platform: pName,
    title: market.question,
    description: `${pName} market imported into momment.`,
    oracleType: oracleTypes[market.platform ?? "polymarket"],
    rulesLabel: "Source rules",
    rulesText: `Imported outcomes: ${market.outcomes.join(", ")}`,
    endsLabel: market.endDate ? market.endDate.slice(0, 10) : "TBD",
    endsAt: market.endDate,
    referenceSignal: market.volume ? `Vol ${Math.round(market.volume).toLocaleString()}` : "Hot",
    referenceSignalValue: null,
  };
}

function parseCaseOptions(value: string) {
  const options = value
    .split(/\r?\n|,/)
    .map((option) => option.trim())
    .filter(Boolean);
  const uniqueOptions = Array.from(new Set(options)).slice(0, 12);

  return uniqueOptions.length > 0 ? uniqueOptions : ["YES", "NO"];
}

function extractExternalMarketId(url: string) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.at(-1) ?? null;
  } catch {
    return null;
  }
}

function detectSourceName(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");

    if (host.includes("polymarket")) return "Polymarket";
    if (host.includes("kalshi")) return "Kalshi";
    if (host.includes("manifold")) return "Manifold";
    if (host.includes("predictit")) return "PredictIt";

    return host;
  } catch {
    return url;
  }
}

function categoryLabel(
  key: (typeof categories)[number],
  dictionary: ReturnType<typeof useI18n>["dictionary"],
  t: ReturnType<typeof useI18n>["t"],
) {
  const labels = {
    economics: dictionary.explore.economics,
    politics: dictionary.explore.politics,
    crypto: dictionary.explore.crypto,
    sports: dictionary.explore.sports,
    entertainment: dictionary.explore.entertainment,
    ai: dictionary.explore.ai,
  };

  return t(labels[key]);
}

function PolymarketSearchPanel({
  onSelect,
  onRemove,
  linkedMarket,
}: {
  onSelect: (market: HotPolymarketMarket) => void;
  onRemove: () => void;
  linkedMarket: HotPolymarketMarket | null;
}) {
  const { dictionary, t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<HotPolymarketMarket[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await fetch(`/api/polymarket/search?q=${encodeURIComponent(q.trim())}`);
      const data = (await response.json()) as { markets?: HotPolymarketMarket[] };
      setResults(data.markets ?? []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        performSearch(value);
      }, 400);
    },
    [performSearch],
  );

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <RiGlobalLine className="size-5 text-indigo-500" />
        <div>
          <h2 className="text-lg font-black text-foreground">
            {t(dictionary.polymarketSearch.title)}
          </h2>
          <p className="text-[12px] font-medium text-muted-foreground">
            {t(dictionary.polymarketSearch.subtitle)}
          </p>
        </div>
      </div>

      {/* Linked market badge */}
      {linkedMarket ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-blue-500/30 bg-blue-50 p-3 dark:bg-blue-500/10">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-blue-600 dark:text-blue-400">
              {platformDisplayName(linkedMarket.platform)} · {t(dictionary.polymarketSearch.linked)}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-foreground">
              {linkedMarket.question}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {linkedMarket.outcomes.join(" · ")}
              {linkedMarket.volume
                ? ` · ${t(dictionary.polymarketSearch.volume)} ${Math.round(linkedMarket.volume).toLocaleString()}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
            title={t(dictionary.polymarketSearch.removeSource)}
          >
            <RiCloseLine className="size-5" />
          </button>
        </div>
      ) : (
        <>
          {/* Search input */}
          <div className="group relative mt-3">
            <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-colors group-focus-within:text-blue-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={t(dictionary.polymarketSearch.searchPlaceholder)}
              className="h-10 w-full rounded-lg border border-border bg-zinc-50 pl-10 pr-4 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground focus:border-blue-500 focus:bg-background dark:bg-zinc-900/50"
            />
          </div>

          {/* Search results */}
          {isSearching ? (
            <div className="mt-3 flex items-center justify-center py-4">
              <div className="size-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              <span className="ml-2 text-xs font-medium text-muted-foreground">
                {t(dictionary.polymarketSearch.searching)}
              </span>
            </div>
          ) : results.length > 0 ? (
            <div className="mt-3 space-y-2">
              {results.map((market) => (
                <button
                  key={market.id}
                  type="button"
                  onClick={() => {
                    onSelect(market);
                    setSearchQuery("");
                    setResults([]);
                    setHasSearched(false);
                  }}
                  className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-500/5"
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${platformBadgeClass(market.platform)}`}>
                      {platformShortName(market.platform)}
                    </span>
                    <p className="line-clamp-2 text-[13px] font-bold text-foreground">
                      {market.question}
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {market.outcomes.slice(0, 4).map((outcome) => (
                      <span
                        key={outcome}
                        className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-black bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {outcome}
                      </span>
                    ))}
                    {market.volume ? (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        Vol {Math.round(market.volume).toLocaleString()}
                      </span>
                    ) : null}
                    {market.endDate ? (
                      <span className="text-[10px] font-medium text-muted-foreground">
                        ~ {market.endDate.slice(0, 10)}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : hasSearched && searchQuery.trim().length >= 2 ? (
            <p className="mt-3 py-4 text-center text-sm font-medium text-muted-foreground">
              {t(dictionary.polymarketSearch.noResults)}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function platformDisplayName(platform?: string) {
  switch (platform) {
    case "manifold": return "Manifold";
    case "kalshi": return "Kalshi";
    default: return "Polymarket";
  }
}

function platformShortName(platform?: string) {
  switch (platform) {
    case "manifold": return "MAN";
    case "kalshi": return "KAL";
    default: return "POLY";
  }
}

function platformBadgeClass(platform?: string) {
  switch (platform) {
    case "manifold":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
    case "kalshi":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
    default:
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400";
  }
}
