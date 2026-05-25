"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiCloseLine,
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
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><div className="size-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" /></div>}>
      <NewAttentionContent />
    </Suspense>
  );
}

function NewAttentionContent() {
  const { dictionary, t, language } = useI18n();
  const [mode, setMode] = useState<"create" | "import">("import");
  const [question, setQuestion] = useState("");
  const [attentionDescription, setAttentionDescription] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("sports");
  const [sourceLinks, setSourceLinks] = useState("");
  const [deadline, setDeadline] = useState("");
  const [caseOptions, setCaseOptions] = useState("YES\nNO");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [topicSuggestions, setTopicSuggestions] = useState<{slug: string; label: string}[]>([]);
  const [hotMarkets, setHotMarkets] = useState<HotPolymarketMarket[]>([]);
  const [selectedHotMarket, setSelectedHotMarket] = useState<HotPolymarketMarket | null>(null);
  const [mergeCandidates, setMergeCandidates] = useState<MergeCandidate[]>([]);
  const [selectedMergeId, setSelectedMergeId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error" | "login">("idle");
  const [createdAttentionHref, setCreatedAttentionHref] = useState<string | null>(null);
  const [linkedPolymarket, setLinkedPolymarket] = useState<HotPolymarketMarket | null>(null);

  /* ── Import mode search ── */
  const [importSearchQuery, setImportSearchQuery] = useState("");
  const [importSearchResults, setImportSearchResults] = useState<HotPolymarketMarket[]>([]);
  const [isImportSearching, setIsImportSearching] = useState(false);
  const importSearchRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleImportSearchChange = useCallback((value: string) => {
    setImportSearchQuery(value);
    if (importSearchRef.current) clearTimeout(importSearchRef.current);
    if (!value.trim() || value.trim().length < 2) {
      setImportSearchResults([]);
      setIsImportSearching(false);
      return;
    }
    importSearchRef.current = setTimeout(async () => {
      setIsImportSearching(true);
      try {
        const res = await fetch(`/api/polymarket/search?q=${encodeURIComponent(value.trim())}`);
        const data = (await res.json()) as { markets?: HotPolymarketMarket[] };
        let markets = data.markets ?? [];
        if (language !== "en" && markets.length > 0) {
          markets = await translateMarketQuestions(markets, language);
        }
        setImportSearchResults(markets);
      } catch {
        setImportSearchResults([]);
      } finally {
        setIsImportSearching(false);
      }
    }, 400);
  }, [language]);

  /* ── Prefill from market detail page query param ── */
  const searchParams = useSearchParams();
  const [prefillApplied, setPrefillApplied] = useState(false);
  useEffect(() => {
    if (prefillApplied) return;
    const raw = searchParams.get("prefill");
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as {
        question?: string;
        outcomes?: string[];
        endDate?: string;
        sourceUrl?: string;
        platform?: string;
      };
      if (data.question) setQuestion(data.question);
      if (data.outcomes && data.outcomes.length > 0) setCaseOptions(data.outcomes.join("\n"));
      if (data.endDate) setDeadline(data.endDate.slice(0, 10));
      if (data.sourceUrl) setSourceLinks(data.sourceUrl);
      setMode("create");
      setPrefillApplied(true);
      // Auto-link as polymarket source
      if (data.sourceUrl && data.platform) {
        setLinkedPolymarket({
          id: data.sourceUrl,
          question: data.question || "",
          slug: null,
          url: data.sourceUrl,
          outcomes: data.outcomes || ["YES", "NO"],
          volume: null,
          endDate: data.endDate || null,
          platform: (data.platform as HotPolymarketMarket["platform"]) || "polymarket",
        });
      }
    } catch { /* ignore bad prefill */ }
  }, [searchParams, prefillApplied]);

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
        const response = await fetch("/api/polymarket/hot?sort=popular");
        const data = (await response.json()) as { markets?: HotPolymarketMarket[] };
        if (!mounted) return;
        let markets = data.markets ?? [];
        // Translate market questions if user language is not English
        if (language !== "en" && markets.length > 0) {
          markets = await translateMarketQuestions(markets, language);
        }
        setHotMarkets(markets);
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

  const [importedSources, setImportedSources] = useState<ImportSource[]>([]);

  // Resolve import links asynchronously via API
  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (links.length === 0) {
        setImportedSources([]);
        return;
      }

      const resolved = await Promise.all(
        links.map(async (link) => {
          if (selectedHotMarket?.url === link) {
            return mapHotMarketToImportSource(selectedHotMarket);
          }
          return fetchImportSource(link);
        }),
      );

      if (cancelled) return;

      // Translate titles if language is not English
      let translated = resolved;
      if (language !== "en" && resolved.length > 0) {
        try {
          const separator = " ||| ";
          const combined = resolved.map((s) => s.title).join(separator);
          const res = await fetch(
            `/api/translate?to=${encodeURIComponent(language)}&text=${encodeURIComponent(combined)}`,
          );
          const data = (await res.json()) as { translated?: string };
          if (data.translated && !cancelled) {
            const parts = data.translated.split(separator).map((s) => s.trim());
            translated = resolved.map((s, i) => ({
              ...s,
              title: parts[i] || s.title,
            }));
          }
        } catch {
          // fallback: use untranslated
        }
      }

      if (!cancelled) {
        setImportedSources(translated);
        // Always auto-populate case options from resolved outcomes
        const firstOutcomes = translated[0]?.outcomes;
        if (firstOutcomes && firstOutcomes.length > 0) {
          setCaseOptions(firstOutcomes.join("\n"));
        }
        // Auto-populate question from first resolved source title
        if (translated[0]?.title) {
          setQuestion(translated[0].title);
        }
      }
    }

    resolve();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, selectedHotMarket, language]);
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
        description: attentionDescription.trim() || undefined,
        category,
        resolution_criteria: undefined,
        ends_at: deadline || undefined,
        original_language: "ko",
        merge_target_cluster_id: selectedMergeId ?? undefined,
        supported_outcomes: supportedOutcomes,
        topic_slugs: selectedTopics,
      });

      if (error || !data) {
        setStatus("error");
        return;
      }

      // If a Polymarket market is linked, import it as an external source
      if (linkedPolymarket) {
        const importSource = mapHotMarketToImportSource(linkedPolymarket);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).rpc("import_attention_source", {
          source_url: importSource.url,
          source_platform: importSource.platform,
          title: importSource.title,
          description: importSource.description,
          category,
          rules_text: importSource.rulesText,
          oracle_type: importSource.oracleType,
          resolver_address: undefined,
          external_market_id: extractExternalMarketId(importSource.url) ?? undefined,
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

      // Auto-join the attention as creator
      await supabase.rpc("toggle_attention_membership", {
        target_attention_cluster_id: data,
      });

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

    // Auto-join the attention as creator
    await supabase.rpc("toggle_attention_membership", {
      target_attention_cluster_id: importResult.clusterId,
    });

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

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5 sm:px-6">
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

              <Field label={t(dictionary.attentionBuilder.descriptionLabel)}>
                <textarea
                  value={attentionDescription}
                  onChange={(event) => setAttentionDescription(event.target.value)}
                  placeholder={t(dictionary.attentionBuilder.descriptionPlaceholder)}
                  rows={2}
                  className="min-h-[52px] w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500"
                />
              </Field>

              {/* ── Topic tags ── */}
              <Field label={t(dictionary.attentionBuilder.topicLabel)}>
                <div className="space-y-2">
                  {selectedTopics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTopics.map((slug) => (
                        <span
                          key={slug}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                        >
                          #{slug}
                          <button
                            type="button"
                            onClick={() => setSelectedTopics((prev) => prev.filter((s) => s !== slug))}
                            className="ml-0.5 text-blue-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type="text"
                      value={topicInput}
                      onChange={async (event) => {
                        const val = event.target.value;
                        setTopicInput(val);
                        if (val.trim().length >= 1) {
                          const supabase = createClient();
                          const q = val.trim();
                          // Two parallel queries: canonical/slug match + Korean label match
                          const [r1, r2] = await Promise.all([
                            supabase
                              .from("topics")
                              .select("slug, canonical_label, labels")
                              .or(`canonical_label.ilike.%${q}%,slug.ilike.%${q}%`)
                              .limit(6),
                            supabase
                              .from("topics")
                              .select("slug, canonical_label, labels")
                              .filter("labels->>ko", "ilike", `%${q}%`)
                              .limit(6),
                          ]);
                          // Merge & dedupe
                          const seen = new Set<string>();
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          const merged: {slug: string; label: string}[] = [];
                          for (const d of [...(r1.data ?? []), ...(r2.data ?? [])]) {
                            if (seen.has(d.slug)) continue;
                            seen.add(d.slug);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const labels = d.labels as any;
                            merged.push({ slug: d.slug, label: labels?.ko || labels?.en || d.canonical_label });
                          }
                          setTopicSuggestions(merged.slice(0, 6));
                        } else {
                          setTopicSuggestions([]);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const slug = topicInput.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");
                          if (slug && !selectedTopics.includes(slug)) {
                            setSelectedTopics((prev) => [...prev, slug]);
                          }
                          setTopicInput("");
                          setTopicSuggestions([]);
                        }
                      }}
                      placeholder={t(dictionary.attentionBuilder.topicPlaceholder)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-blue-500"
                    />
                    {topicSuggestions.length > 0 && topicInput.trim() && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-border bg-background shadow-lg">
                        {topicSuggestions
                          .filter((s) => !selectedTopics.includes(s.slug))
                          .map((s) => (
                            <button
                              key={s.slug}
                              type="button"
                              onClick={() => {
                                setSelectedTopics((prev) => [...prev, s.slug]);
                                setTopicInput("");
                                setTopicSuggestions([]);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-foreground transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                            >
                              <span className="text-blue-500">#</span>{s.label}
                            </button>
                          ))}
                        {topicInput.trim() && !topicSuggestions.some((s) => s.slug === topicInput.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-")) && (
                          <button
                            type="button"
                            onClick={() => {
                              const slug = topicInput.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");
                              if (slug && !selectedTopics.includes(slug)) {
                                setSelectedTopics((prev) => [...prev, slug]);
                              }
                              setTopicInput("");
                              setTopicSuggestions([]);
                            }}
                            className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm font-bold text-blue-600 transition-colors hover:bg-blue-50 dark:hover:bg-blue-500/10"
                          >
                            + &quot;{topicInput.trim()}&quot; {t(dictionary.attentionBuilder.topicAdd)}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
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

            </>
          ) : (
            <>
              {hotMarkets.length > 0 || true ? (
                <section className="rounded-lg border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-foreground">
                        글로벌 예측시장
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">
                        예측시장 마켓을 검색하거나 인기 마켓을 어텐션으로 가져옵니다.
                      </p>
                    </div>
                  </div>

                  {/* Search input */}
                  <div className="group relative mt-3">
                    <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground transition-colors group-focus-within:text-blue-500" />
                    <input
                      type="text"
                      value={importSearchQuery}
                      onChange={(e) => handleImportSearchChange(e.target.value)}
                      placeholder="키워드로 마켓 검색 (예: bitcoin, AI, election...)"
                      className="h-10 w-full rounded-lg border border-border bg-zinc-50 pl-10 pr-4 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground focus:border-blue-500 focus:bg-background dark:bg-zinc-900/50"
                    />
                  </div>

                  {/* Search results */}
                  {isImportSearching ? (
                    <div className="mt-3 flex items-center justify-center py-4">
                      <div className="size-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                      <span className="ml-2 text-xs font-medium text-muted-foreground">검색 중...</span>
                    </div>
                  ) : importSearchResults.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {importSearchResults.map((market) => (
                        <button
                          key={market.id}
                          type="button"
                          onClick={() => {
                            setSelectedHotMarket(market);
                            setQuestion(market.question);
                            setSourceLinks(market.url ?? "");
                            setCaseOptions(market.outcomes.join("\n"));
                            setDeadline(market.endDate ? market.endDate.slice(0, 10) : "");
                            setImportSearchQuery("");
                            setImportSearchResults([]);
                          }}
                          className="rounded-lg border border-border p-3 text-left transition-colors hover:border-blue-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                        >
                          <p className="line-clamp-2 text-sm font-black text-foreground">
                            {market.question}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {market.outcomes.slice(0, 6).map((o) => (
                              <span key={o} className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-black bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                {o}
                              </span>
                            ))}
                            {market.volume ? (
                              <span className="text-[10px] font-medium text-muted-foreground">
                                Vol {Math.round(market.volume).toLocaleString()}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : importSearchQuery.trim().length >= 2 ? (
                    <p className="mt-3 py-3 text-center text-sm font-medium text-muted-foreground">
                      검색 결과가 없습니다.
                    </p>
                  ) : hotMarkets.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {hotMarkets.slice(0, 3).map((market) => (
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
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {market.outcomes.slice(0, 6).map((o) => (
                              <span key={o} className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-black bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                {o}
                              </span>
                            ))}
                            {market.volume ? (
                              <span className="text-[10px] font-medium text-muted-foreground">
                                Vol {Math.round(market.volume).toLocaleString()}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
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
                  rows={2}
                  className="min-h-[52px] w-full resize-none rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500"
                />
              </Field>

              {importedSources.length > 0 ? (
                <section className="space-y-3">
                  {importedSources.map((source) => (
                    <ImportSourceCard key={source.url} source={source} />
                  ))}
                </section>
              ) : null}

              {/* Editable fields after import */}
              {(question || importedSources.length > 0) ? (
                <>
                  <Field label={t(dictionary.attentionBuilder.questionLabel)}>
                    <textarea
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      placeholder={t(dictionary.attentionBuilder.questionPlaceholder)}
                      rows={2}
                      className="min-h-16 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-[17px] font-semibold leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500"
                    />
                  </Field>

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
                      rows={3}
                      className="min-h-20 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-blue-500"
                    />
                  </Field>
                </>
              ) : null}

            </>
          )}

          <MergeAttentionPanel
            candidates={mergeCandidates}
            selectedMergeId={selectedMergeId}
            setSelectedMergeId={setSelectedMergeId}
          />

        </section>

        {/* ── Preview (compact) ── */}
        <section className="rounded-lg border border-border bg-background p-3 shadow-sm">
          <p className="text-xs font-black text-blue-600">
            {mode === "create"
              ? t(dictionary.attentionBuilder.previewTitle)
              : t(dictionary.attentionBuilder.importPreviewTitle)}
          </p>
          <h2 className="mt-1 text-base font-black leading-6 text-foreground">
            {displayQuestion}
          </h2>

          {/* Outcomes preview */}
          {(mode === "create" ? supportedOutcomes : firstImportedSource?.outcomes ?? supportedOutcomes).length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {(mode === "create" ? supportedOutcomes : firstImportedSource?.outcomes ?? supportedOutcomes).map((o) => (
                <span
                  key={o}
                  className="inline-flex rounded border border-border px-2 py-0.5 text-[11px] font-bold text-foreground bg-zinc-50 dark:bg-zinc-900/50"
                >
                  {o}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold text-muted-foreground">
            <span>{categoryLabel(category, dictionary, t)}</span>
            <span>·</span>
            <span>{sourceNames.length > 0 ? sourceNames.join(" · ") : "Paste URL"}</span>
            {deadline ? <><span>·</span><span>~ {deadline}</span></> : null}
          </div>
        </section>

        <p className="rounded-lg border border-border bg-zinc-50 px-3 py-2.5 text-[12px] font-semibold leading-5 text-muted-foreground dark:bg-zinc-900/50">
          {t(dictionary.attentionBuilder.noTrading)}
        </p>

        {/* Submit button at the very bottom */}
        <CaptchaGate action="attention_build">
          {({ captchaToken, isVerified, CaptchaWidget }) => (
            <>
              {CaptchaWidget}
              <button
                type="button"
                disabled={!canSubmit || status === "saving" || !isVerified}
                onClick={handleSubmit}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RiAddLine className="size-5" />
                {t(dictionary.attentionBuilder.createDraft)}
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
  const [showAll, setShowAll] = useState(false);
  const MAX_VISIBLE = 3;
  const visibleCandidates = showAll ? candidates : candidates.slice(0, MAX_VISIBLE);
  const hasMore = candidates.length > MAX_VISIBLE;

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <RiGitMergeLine className="size-5 text-blue-600" />
        <h2 className="text-lg font-black text-foreground">
          {t(dictionary.attentionBuilder.mergeCandidates)}
        </h2>
        <span className="ml-auto text-xs font-bold text-muted-foreground">{candidates.length}</span>
      </div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {t(dictionary.attentionBuilder.mergeCandidateDesc)}
      </p>

      <div className="mt-4 space-y-2">
        {visibleCandidates.map((candidate) => (
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
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="w-full rounded-lg border border-dashed border-border py-2 text-[12px] font-bold text-muted-foreground transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
          >
            {showAll ? `▲ ${MAX_VISIBLE}개만 보기` : `▼ ${candidates.length - MAX_VISIBLE}개 더 보기`}
          </button>
        )}
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
      {source.outcomes && source.outcomes.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {source.outcomes.map((o) => (
            <span
              key={o}
              className="inline-flex rounded-md border border-border px-2 py-0.5 text-[11px] font-black text-foreground bg-zinc-50 dark:bg-zinc-900/50"
            >
              {o}
            </span>
          ))}
        </div>
      ) : null}
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
  outcomes?: string[];
};

async function importSources(
  supabase: ReturnType<typeof createClient>,
  sources: ImportSource[],
  category: string,
  mergeTargetClusterId: string | null,
) {
  let lastClusterId: string | null = null;

  for (const source of sources) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("import_attention_source", {
      source_url: source.url,
      source_platform: source.platform,
      title: source.title,
      description: source.description,
      category,
      rules_text: source.rulesText,
      oracle_type: source.oracleType,
      resolver_address: undefined,
      external_market_id: extractExternalMarketId(source.url) ?? undefined,
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

async function fetchImportSource(url: string): Promise<ImportSource> {
  const platform = detectSourceName(url);

  try {
    const res = await fetch(`/api/markets/resolve?url=${encodeURIComponent(url)}`);
    if (!res.ok) throw new Error("fetch failed");

    const data = (await res.json()) as {
      platform?: string;
      title?: string | null;
      description?: string | null;
      outcomes?: string[];
      volume?: number | null;
      endDate?: string | null;
      oracleType?: string;
    };

    const title = data.title || extractSlugFromUrl(url);
    const outcomes = data.outcomes && data.outcomes.length > 0 ? data.outcomes : ["YES", "NO"];
    const volumeLabel = data.volume ? `Vol ${Math.round(data.volume).toLocaleString()}` : "Reference";
    const endsLabel = data.endDate ? data.endDate.slice(0, 10) : "TBD";

    return {
      url,
      platform: data.platform || platform,
      title,
      description: data.description || `${data.platform || platform} reference source imported into momment.`,
      oracleType: data.oracleType || "Source reference",
      rulesLabel: "Source rules",
      rulesText: `Imported outcomes: ${outcomes.join(", ")}`,
      endsLabel,
      endsAt: data.endDate || null,
      referenceSignal: volumeLabel,
      referenceSignalValue: data.volume || null,
      outcomes,
    };
  } catch {
    return {
      url,
      platform,
      title: extractSlugFromUrl(url),
      description: `${platform} reference source imported into momment.`,
      oracleType: "Source reference",
      rulesLabel: "Source rules",
      rulesText: "Imported external metadata will be reviewed before final resolution.",
      endsLabel: "TBD",
      endsAt: null,
      referenceSignal: "Reference",
      referenceSignalValue: null,
      outcomes: ["YES", "NO"],
    };
  }
}

function extractSlugFromUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    // Remove language prefix if present
    const eventIdx = segments.indexOf("event");
    const slug = eventIdx >= 0 ? segments[eventIdx + 1] : segments.at(-1);
    return (slug || "External source").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "External source";
  }
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
    outcomes: market.outcomes,
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

/**
 * Batch-translate market question texts via /api/translate.
 * Combines all questions into a single request using a separator.
 */
async function translateMarketQuestions(
  markets: HotPolymarketMarket[],
  targetLang: string,
): Promise<HotPolymarketMarket[]> {
  if (markets.length === 0) return markets;

  try {
    // Batch: join all questions with a separator unlikely to appear in text
    const separator = " ||| ";
    const combined = markets.map((m) => m.question).join(separator);
    const res = await fetch(
      `/api/translate?to=${encodeURIComponent(targetLang)}&text=${encodeURIComponent(combined)}`,
    );
    const data = (await res.json()) as { translated?: string };
    if (!data.translated) return markets;

    const translated = data.translated.split(separator).map((s) => s.trim());
    return markets.map((m, i) => ({
      ...m,
      question: translated[i] || m.question,
    }));
  } catch {
    return markets;
  }
}
