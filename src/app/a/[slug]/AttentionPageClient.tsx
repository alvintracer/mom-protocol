"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import {
  RiAddLine,
  RiExternalLinkLine,
  RiGlobalLine,
  RiShieldCheckLine,
  RiSendPlane2Line,
  RiUser3Line,
} from "react-icons/ri";

import { AioAssertionForm } from "@/shared/components/aio/AioAssertionForm";
import { AioRuleSummary, AioStatusPipeline } from "@/shared/components/aio/AioStatusPipeline";
import {
  AttentionDonateSection,
  AttentionDonorList,
  AttentionEnergyGauge,
  AttentionLeaderboard,
  usePageViewTracker,
} from "@/shared/components/attention/AttentionMonetization";
import { PageSkeleton } from "@/shared/components/ui/LoadingStates";
import { PredictionWidget } from "@/shared/components/prediction/PredictionWidget";
import { exploreAttentions as fallbackExploreAttentions } from "@/shared/data/explore";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { createClient } from "@/shared/lib/supabase/client";
import type { Database, SupportedLanguage } from "@/shared/types/database";

type AttentionCluster = Database["public"]["Tables"]["attention_clusters"]["Row"];
type AttentionSource = Database["public"]["Tables"]["attention_sources"]["Row"];
type AttentionRule = Database["public"]["Tables"]["attention_rules"]["Row"];
type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type AioAssertionRow = {
  id: string;
  status: string;
  claim_text: string;
  asserted_outcome: string;
  aggregate_verdict: string | null;
  aggregate_confidence: number | null;
  challenge_ends_at: string | null;
  finalized_outcome: string | null;
  created_at: string;
};

export function AttentionPageClient({ slug }: { slug: string }) {
  const { dictionary, language, t } = useI18n();
  const lookupSlug = safeDecodeSlug(slug);
  const [cluster, setCluster] = useState<AttentionCluster | null>(null);
  const [sources, setSources] = useState<AttentionSource[]>([]);
  const [rule, setRule] = useState<AttentionRule | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [isTogglingJoin, setIsTogglingJoin] = useState(false);
  const [builder, setBuilder] = useState<ProfileRow | null>(null);
  const [latestAssertion, setLatestAssertion] = useState<AioAssertionRow | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">(
    "loading",
  );

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadAttention() {
      const clusterQuery = resolveClusterBySlug(supabase, lookupSlug);

      const [{ data: userData }, { data: clusterData, error: clusterError }] =
        await Promise.all([supabase.auth.getUser(), clusterQuery]);

      if (!mounted) {
        return;
      }

      setUserId(userData.user?.id ?? null);

      if (clusterError || !clusterData) {
        const fallbackAttention = fallbackExploreAttentions.find(
          (attention) =>
            attention.id === lookupSlug || attention.slug === lookupSlug,
        );

        if (!fallbackAttention) {
          setStatus("missing");
          return;
        }

        const fallbackTitle = fallbackAttention.title[language] ?? fallbackAttention.title.ko;
        const fallbackSummary = fallbackAttention.summary[language] ?? fallbackAttention.summary.ko;
        setCluster({
          id: fallbackAttention.id,
          canonical_event_id: null,
          slug: fallbackAttention.slug || fallbackAttention.id,
          title: fallbackTitle,
          description: fallbackSummary,
          category: fallbackAttention.category,
          original_language: "ko",
          status: "active",
          source_count: fallbackAttention.sourceCount,
          post_count: fallbackAttention.postCount,
          comment_count: 0,
          attention_score: fallbackAttention.attentionScore,
          created_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        setSources([]);
        setRule(createFallbackRule(fallbackAttention.id, fallbackTitle, fallbackSummary));
        setLatestAssertion(null);
        setPosts([]);
        setMemberCount(fallbackAttention.participantCount);
        setHasJoined(false);
        setStatus("ready");
        return;
      }

      const postQuery = supabase
        .from("posts")
        .select("*")
        .eq("attention_cluster_id", clusterData.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(20);

      const [
        { data: sourceRows },
        { data: postRows },
        { data: ruleData },
        { count: membershipCount },
        { data: membershipData },
      ] = await Promise.all([
        supabase
          .from("attention_sources")
          .select("*")
          .eq("cluster_id", clusterData.id)
              .order("created_at", { ascending: false })
              .limit(8),
        postQuery,
        clusterData.canonical_event_id
          ? supabase
              .from("attention_rules")
              .select("*")
              .eq("event_id", clusterData.canonical_event_id)
              .maybeSingle()
          : Promise.resolve({ data: null as AttentionRule | null }),
        supabase
          .from("attention_memberships")
          .select("id", { count: "exact", head: true })
          .eq("attention_cluster_id", clusterData.id),
        userData.user
          ? supabase
              .from("attention_memberships")
              .select("id")
              .eq("attention_cluster_id", clusterData.id)
              .eq("user_id", userData.user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (!mounted) {
        return;
      }

      setCluster(clusterData);
      setSources(sourceRows ?? []);
      setRule(ruleData ?? null);
      setPosts(postRows ?? []);
      setMemberCount(membershipCount ?? 0);
      setHasJoined(Boolean(membershipData));

      if (ruleData?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: assertionData } = await (supabase as any)
          .from("aio_assertions")
          .select("*")
          .eq("rule_id", ruleData.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (mounted) {
          setLatestAssertion((assertionData as AioAssertionRow | null) ?? null);
        }
      } else {
        setLatestAssertion(null);
      }

      // Fetch builder profile
      if (clusterData.created_by) {
        const { data: builderData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", clusterData.created_by)
          .maybeSingle();
        if (mounted) setBuilder(builderData ?? null);
      }

      setStatus("ready");
    }

    loadAttention();

    return () => {
      mounted = false;
    };
  }, [language, lookupSlug]);

  async function handleToggleJoin() {
    if (!cluster || !userId) {
      window.location.href = `/auth/login?next=/a/${displaySlug}`;
      return;
    }

    setIsTogglingJoin(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("toggle_attention_membership", {
      target_attention_cluster_id: cluster.id,
    });
    setIsTogglingJoin(false);

    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      return;
    }

    setHasJoined(data.joined === true);
    setMemberCount(
      typeof data.member_count === "number" ? data.member_count : memberCount,
    );
  }

  // Track page views & dwell time (must be called before early returns to maintain hook order)
  usePageViewTracker(cluster?.id ?? null);

  if (status === "missing") {
    notFound();
  }

  if (status === "loading" || !cluster) {
    return <PageSkeleton />;
  }

  const displaySlug = cluster.slug || cluster.id.slice(0, 8);
  const outcomeOptions = normalizeOutcomeOptions(rule?.supported_outcomes, cluster.title);
  const createPostHref = `/posts/new?attention=${encodeURIComponent(cluster.id)}`;
  const aioDisplayStatus = getAioDisplayStatus(latestAssertion, rule);
  const canSubmitAssertion =
    !latestAssertion ||
    latestAssertion.status === "rejected" ||
    latestAssertion.status === "cancelled";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="h-28 bg-[linear-gradient(135deg,#2563eb_0%,#0f172a_55%,#334155_100%)] sm:h-40" />

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="flex size-20 items-center justify-center rounded-2xl border border-border/80 bg-background text-3xl font-black text-blue-600 shadow-md sm:size-24">
              a/
            </div>
            <div className="pb-1">
              <p className="text-[12px] font-black tracking-wider text-blue-500">a/{displaySlug}</p>
              <h1 className="mt-1 max-w-3xl text-2xl font-black leading-tight text-foreground sm:text-3xl">
                {cluster.title}
              </h1>
            </div>
          </div>

          <button
            onClick={handleToggleJoin}
            disabled={isTogglingJoin}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-black transition-colors disabled:opacity-50 ${
              hasJoined
                ? "border border-border bg-background text-foreground hover:border-blue-500 hover:text-blue-600"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            <RiAddLine className="size-4" />
            {hasJoined ? t(dictionary.attentionDetail.joined) : t(dictionary.attentionDetail.join)}
          </button>
        </div>

        {cluster.description ? (
          <p className="mt-4 max-w-3xl text-[15px] font-medium leading-6 text-muted-foreground">
            {cluster.description}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <AttentionStat label={t(dictionary.attentionDetail.attention)} value={cluster.attention_score.toLocaleString()} accent />
          <AttentionStat label={t(dictionary.attentionDetail.members)} value={memberCount.toLocaleString()} />
          <AttentionStat label={t(dictionary.attentionDetail.posts)} value={cluster.post_count.toLocaleString()} />
          <AttentionStat label={t(dictionary.attentionDetail.comments)} value={cluster.comment_count.toLocaleString()} />
          <AttentionStat label={t(dictionary.attentionDetail.sources)} value={cluster.source_count.toLocaleString()} />
        </div>

        {/* Builder Info */}
        {builder ? (
          <Link
            href={`/u/${builder.handle ?? builder.id.slice(0, 10)}`}
            className="mt-4 inline-flex items-center gap-2.5 rounded-full border border-border bg-background px-4 py-2 transition-colors hover:border-blue-500"
          >
            <div className="flex size-7 items-center justify-center rounded-full bg-foreground text-xs font-black text-background">
              {(builder.display_name || builder.handle || "m").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-black text-foreground">
                {builder.display_name || builder.handle}
              </p>
              <p className="text-[10px] font-bold text-muted-foreground">
                Builder · u/{builder.handle ?? builder.id.slice(0, 10)}
              </p>
            </div>
            <RiUser3Line className="size-3.5 text-muted-foreground" />
          </Link>
        ) : null}

        {/* AIO Finalized Result */}
        {latestAssertion?.finalized_outcome && rule ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2">
              <RiGlobalLine className="size-5 text-emerald-600" />
              <h3 className="text-[14px] font-black text-emerald-700 dark:text-emerald-400">
                {t(dictionary.aio.challenge.finalizedOutcome)}
              </h3>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(rule.supported_outcomes as string[])
                .filter((o) => o.toLowerCase() !== "ambiguous")
                .map((outcome) => {
                  const isWinner = outcome.toLowerCase() === latestAssertion.finalized_outcome?.toLowerCase();
                  return (
                    <span
                      key={outcome}
                      className={`rounded-full px-3 py-1 text-sm font-black ${
                        isWinner
                          ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/50"
                          : "bg-zinc-100 text-muted-foreground dark:bg-zinc-800"
                      }`}
                    >
                      {outcome.toUpperCase()}
                      {isWinner ? " ✓" : ""}
                    </span>
                  );
                })}
            </div>
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              {t(dictionary.aio.challenge.assertionsClosed)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mx-auto mt-6 grid max-w-5xl gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-border/80 bg-background shadow-sm overflow-hidden">
            <Link
              href={createPostHref}
              className="flex min-h-16 items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-foreground">
                  {t(dictionary.attentionDetail.createPost)}
                </p>
                <p className="mt-1 truncate text-[12px] font-bold text-blue-600 dark:text-blue-400">
                  {cluster.title} (a/{displaySlug})
                </p>
              </div>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
                <RiSendPlane2Line className="size-4" />
              </span>
            </Link>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm">
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-[15px] font-black text-foreground">
                {t(dictionary.attentionDetail.posts)}
              </h2>
            </div>
            <div className="divide-y divide-border">
              {posts.length > 0 ? (
                posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="block px-5 py-3.5 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-900/30"
                  >
                    <p className="text-[11px] font-black tracking-wider text-blue-600 dark:text-blue-400">a/{displaySlug}</p>
                    <p className="mt-1.5 text-sm font-medium leading-6 text-foreground">
                      {post.original_body}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] font-medium text-muted-foreground">
                      {post.selected_outcome ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${
                          post.selected_outcome.toLowerCase() === "yes" || post.selected_outcome.toLowerCase() === "above"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : post.selected_outcome.toLowerCase() === "no" || post.selected_outcome.toLowerCase() === "below"
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        }`}>{formatOutcomeLabel(post.selected_outcome)}</span>
                      ) : null}
                      <span>{formatDate(post.created_at, language)}</span>
                      <span className="size-0.5 rounded-full bg-muted-foreground" />
                      <span>{post.like_count.toLocaleString()} {t(dictionary.attentionDetail.likes)}</span>
                      <span className="size-0.5 rounded-full bg-muted-foreground" />
                      <span>{post.comment_count.toLocaleString()} {t(dictionary.attentionDetail.comments)}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="px-5 py-6 text-sm font-medium text-muted-foreground">
                  {t(dictionary.attentionDetail.emptyPosts)}
                </p>
              )}
            </div>
          </section>

          {/* AIO Rule Summary + Assertion Form */}
          {rule && (
            <>
              <AioRuleSummary rule={rule} />
              <section className="space-y-3 rounded-2xl border border-border/80 bg-background p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <RiShieldCheckLine className="size-4 shrink-0 text-blue-500" />
                    <h3 className="truncate text-[14px] font-black text-foreground">
                      {t(dictionary.aio.assertion.currentTitle)}
                    </h3>
                  </div>
                  <Link
                    href="/oracle"
                    className="shrink-0 rounded-full border border-border px-3 py-1 text-[11px] font-black text-muted-foreground transition-colors hover:border-blue-500 hover:text-blue-600"
                  >
                    {t(dictionary.aio.assertion.viewOracle)}
                  </Link>
                </div>
                <div className="overflow-x-auto pb-1">
                  <AioStatusPipeline
                    status={aioDisplayStatus as Parameters<typeof AioStatusPipeline>[0]["status"]}
                  />
                </div>
                {latestAssertion ? (
                  <div className="rounded-xl border border-border/70 bg-zinc-50/60 p-3 dark:bg-zinc-900/30">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-black text-muted-foreground">
                      <span>{formatOutcomeLabel(latestAssertion.asserted_outcome)}</span>
                      <span className="size-1 rounded-full bg-muted-foreground" />
                      <span>{formatDate(latestAssertion.created_at, language)}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] font-semibold leading-5 text-foreground">
                      {latestAssertion.claim_text}
                    </p>
                  </div>
                ) : null}
              </section>
              {canSubmitAssertion ? (
                <AioAssertionForm
                  eventId={cluster.canonical_event_id || rule.event_id || cluster.id}
                  ruleId={rule.id}
                  outcomeOptions={(rule.supported_outcomes ?? []).filter(
                    (o: string) => o.toLowerCase() !== "ambiguous",
                  )}
                  bondAmount={rule.bond_amount}
                  isLoggedIn={Boolean(userId)}
                />
              ) : (
                <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <h3 className="text-[14px] font-black text-foreground">
                    {t(dictionary.aio.assertion.closedTitle)}
                  </h3>
                  <p className="mt-1 text-[13px] font-semibold leading-5 text-muted-foreground">
                    {t(dictionary.aio.assertion.closedDesc)}
                  </p>
                </section>
              )}
            </>
          )}
        </main>

        <aside className="space-y-4">
          <AttentionEnergyGauge
            attentionScore={cluster.attention_score}
            viewCount={(cluster as Record<string, unknown>).total_view_count as number ?? 0}
            visitorCount={(cluster as Record<string, unknown>).unique_visitor_count as number ?? 0}
            donationTotal={(cluster as Record<string, unknown>).total_donation_krw as number ?? 0}
          />

          <AttentionDonateSection
            clusterId={cluster.id}
            attentionScore={cluster.attention_score}
          />

          <PredictionWidget
            attentionId={cluster.id}
            attentionSlug={displaySlug}
            outcomeOptions={outcomeOptions}
            outcomeCounts={computeOutcomeCounts(posts, outcomeOptions)}
            isLoggedIn={Boolean(userId)}
          />

          <AttentionLeaderboard clusterId={cluster.id} />

          <AttentionDonorList clusterId={cluster.id} />

          <section className="overflow-hidden rounded-2xl border border-border/80 bg-background shadow-sm">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <RiGlobalLine className="size-4 text-blue-500" />
              <h2 className="text-[15px] font-black text-foreground">
                {t(dictionary.attentionDetail.sources)}
              </h2>
            </div>
            <div className="p-3 space-y-2">
              {sources.length > 0 ? (
                sources.map((source) => (
                  <Link
                    key={source.id}
                    href={source.source_url || "#"}
                    target={source.source_url ? "_blank" : undefined}
                    className="block rounded-xl border border-border/60 bg-zinc-50/50 dark:bg-zinc-900/20 p-3 transition-all hover:border-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black text-foreground">
                          {source.title}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                          {source.source_platform}
                        </p>
                      </div>
                      <RiExternalLinkLine className="size-3.5 shrink-0 text-muted-foreground" />
                    </div>
                  </Link>
                ))
              ) : (
                <p className="px-1 py-3 text-sm font-medium text-muted-foreground">
                  {t(dictionary.attentionDetail.emptySources)}
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AttentionStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`tabular-nums font-bold ${accent ? "text-blue-600 dark:text-blue-400" : "text-foreground"}`}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function getAioDisplayStatus(
  assertion: AioAssertionRow | null,
  rule: AttentionRule | null,
) {
  if (assertion?.status) {
    return assertion.status;
  }

  const config = (rule?.oracle_config ?? {}) as Record<string, unknown>;
  const openWindowSeconds = Number(config.open_verification_window_seconds ?? 0);

  return openWindowSeconds > 0 ? "builder_verification_window" : "open_verification_window";
}

async function resolveClusterBySlug(
  supabase: ReturnType<typeof createClient>,
  slug: string,
) {
  if (isUuid(slug)) {
    return supabase.from("attention_clusters").select("*").eq("id", slug).maybeSingle();
  }

  const directMatch = await supabase
    .from("attention_clusters")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (directMatch.data || directMatch.error) {
    return directMatch;
  }

  const eventMatch = await supabase
    .from("events")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!eventMatch.data?.id) {
    return directMatch;
  }

  const sourceMatch = await supabase
    .from("attention_sources")
    .select("cluster_id")
    .eq("event_id", eventMatch.data.id)
    .limit(1)
    .maybeSingle();

  if (!sourceMatch.data?.cluster_id) {
    return directMatch;
  }

  return supabase
    .from("attention_clusters")
    .select("*")
    .eq("id", sourceMatch.data.cluster_id)
    .maybeSingle();
}

function formatDate(value: string, language: SupportedLanguage) {
  return new Intl.DateTimeFormat(localeFromLanguage(language), {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function createFallbackRule(id: string, title: string, summary: string): AttentionRule {
  const now = new Date().toISOString();

  return {
    id: `fallback-rule-${id}`,
    event_id: id,
    template_id: null,
    title,
    question: title,
    resolution_criteria: summary,
    supported_outcomes: inferOutcomeOptions(title),
    evidence_requirements: {},
    source_requirements: {},
    challenge_period_seconds: 259200,
    min_evidence_count: 1,
    min_publisher_trust: 0.1,
    bond_amount: 0,
    bond_currency: "MOM_POINT",
    oracle_config: {},
    prompt_version: null,
    prompt_hash: null,
    status: "draft",
    locked_at: null,
    created_by: null,
    created_at: now,
    updated_at: now,
  };
}

function normalizeOutcomeOptions(values: string[] | undefined, title: string) {
  const cleaned = (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value && value.toLowerCase() !== "ambiguous");

  return cleaned.length > 0 ? cleaned : inferOutcomeOptions(title);
}

function inferOutcomeOptions(title: string) {
  if (title.toLowerCase().includes("btc")) {
    return ["above", "below", "in_range"];
  }

  return ["yes", "no"];
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

function localeFromLanguage(language: SupportedLanguage) {
  if (language === "en") return "en-US";
  if (language === "es") return "es-ES";
  return "ko-KR";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function safeDecodeSlug(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function computeOutcomeCounts(posts: PostRow[], outcomeOptions: string[]) {
  const counts = new Map<string, number>();
  for (const option of outcomeOptions) {
    counts.set(option.toLowerCase(), 0);
  }
  for (const post of posts) {
    if (post.selected_outcome) {
      const key = post.selected_outcome.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return outcomeOptions.map((option) => ({
    outcome: option,
    count: counts.get(option.toLowerCase()) ?? 0,
  }));
}
