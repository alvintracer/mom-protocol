"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  RiArrowLeftLine,
  RiBarChartGroupedLine,
  RiFireLine,
  RiHashtag,
  RiPulseLine,
} from "react-icons/ri";

import { AttentionGridSkeleton, LoadingBar } from "@/shared/components/ui/LoadingStates";
import {
  exploreAttentions as fallbackExploreAttentions,
  exploreTopics,
  type ExploreAttention,
} from "@/shared/data/explore";
import { useI18n } from "@/shared/i18n/LanguageProvider";
import { text, type LocalizedText } from "@/shared/i18n/config";
import { createClient } from "@/shared/lib/supabase/client";
import type { Database } from "@/shared/types/database";

type AttentionCluster = Database["public"]["Tables"]["attention_clusters"]["Row"];
type TopicRow = Database["public"]["Tables"]["topics"]["Row"];
type TopicTrend = Database["public"]["Tables"]["topic_trend_snapshots"]["Row"];

type TopicView = {
  slug: string;
  label: string;
  description: string | null;
  energy: number;
  trend: string;
  attentionCount: number;
  postCount: number;
  commentCount: number;
};

export function TopicPageClient({ slug }: { slug: string }) {
  const { dictionary, language, t } = useI18n();
  const [topic, setTopic] = useState<TopicView | null>(null);
  const [attentions, setAttentions] = useState<ExploreAttention[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadTopic() {
      setStatus("loading");

      const { data: topicData } = await supabase
        .from("topics")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (!mounted) {
        return;
      }

      if (!topicData) {
        setStatus("missing");
        return;
      }

      const [{ data: contentTopicRows }, { data: trendRows }] = await Promise.all([
        supabase
          .from("content_topics")
          .select("*")
          .eq("topic_id", topicData.id)
          .eq("target_type", "attention"),
        supabase
          .from("topic_trend_snapshots")
          .select("*")
          .eq("topic_id", topicData.id)
          .order("window_end", { ascending: false })
          .limit(2),
      ]);

      const attentionIds = Array.from(
        new Set((contentTopicRows ?? []).map((row) => row.target_id)),
      );
      const { data: attentionRows } =
        attentionIds.length > 0
          ? await supabase.from("attention_clusters").select("*").in("id", attentionIds)
          : { data: [] as AttentionCluster[] };

      if (!mounted) {
        return;
      }

      const mappedAttentions = (attentionRows ?? []).map((cluster) =>
        mapClusterToAttention(
          cluster,
          dictionary.topic.fallbackSummary,
          dictionary.topic.live,
        ),
      );
      setTopic(buildTopicView(topicData, trendRows ?? [], mappedAttentions));
      setAttentions(mappedAttentions);
      setStatus("ready");
    }

    loadTopic();

    return () => {
      mounted = false;
    };
  }, [dictionary.topic.fallbackSummary, dictionary.topic.live, slug]);

  const sortedAttentions = useMemo(
    () => [...attentions].sort((a, b) => b.attentionScore - a.attentionScore),
    [attentions],
  );

  if (status === "missing") {
    notFound();
  }

  return (
    <div className="min-h-screen border-x border-border bg-background pb-20">
      {status === "loading" ? <LoadingBar /> : null}

      <header className="border-b border-border px-4 py-5 sm:px-6">
        <Link
          href="/explore"
          className="inline-flex size-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900/50"
        >
          <RiArrowLeftLine className="size-5" />
        </Link>

        <div className="mt-5 flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <RiHashtag className="size-8" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-blue-600">Topic</p>
            <h1 className="mt-1 truncate text-3xl font-black tracking-tight text-foreground">
              #{topic?.label ?? slug}
            </h1>
            {topic?.description ? (
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
                {topic.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <TopicMetric
            icon={<RiPulseLine />}
            label="Topic Energy"
            value={compact(topic?.energy ?? 0, language)}
          />
          <TopicMetric
            icon={<RiFireLine />}
            label={t(dictionary.topic.trend)}
            value={topic?.trend ?? "+0%"}
          />
          <TopicMetric
            icon={<RiBarChartGroupedLine />}
            label={t(dictionary.topic.attention)}
            value={(topic?.attentionCount ?? 0).toLocaleString(localeFromLanguage(language))}
          />
          <TopicMetric
            icon={<RiHashtag />}
            label={t(dictionary.topic.post)}
            value={(topic?.postCount ?? 0).toLocaleString(localeFromLanguage(language))}
          />
        </div>
      </header>

      <main className="space-y-4 px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-foreground">
              {t(dictionary.topic.relatedAttentions)}
            </h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {t(dictionary.topic.energyDescription)}
            </p>
          </div>
        </div>

        {status === "loading" ? (
          <AttentionGridSkeleton />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1450px]:grid-cols-4">
            {sortedAttentions.map((attention) => (
              <TopicAttentionCard key={attention.id} attention={attention} />
            ))}
          </div>
        )}

        {status === "ready" && sortedAttentions.length === 0 ? (
          <div className="rounded-2xl border border-border p-6 text-center">
            <p className="text-sm font-black text-foreground">
              {t(dictionary.topic.emptyTitle)}
            </p>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              {t(dictionary.topic.emptyDescription)}
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function TopicMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2 text-blue-600">
        <span className="text-lg">{icon}</span>
        <p className="text-xs font-black text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-lg font-black text-foreground">{value}</p>
    </div>
  );
}

function TopicAttentionCard({ attention }: { attention: ExploreAttention }) {
  const { dictionary, t } = useI18n();
  const slug = attention.slug || attention.id;

  return (
    <Link
      href={`/a/${slug}`}
      className="group flex min-h-44 flex-col rounded-2xl border border-border bg-background p-3.5 transition-all hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-sm dark:hover:bg-zinc-900/50"
    >
      <p className="truncate text-xs font-black text-blue-500">a/{slug}</p>
      <h3 className="mt-3 line-clamp-2 text-[15px] font-black leading-snug text-foreground">
        {t(attention.title)}
      </h3>
      {attention.outcomes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {attention.outcomes.slice(0, 4).map((o) => (
            <span key={o} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{o}</span>
          ))}
          {attention.outcomes.length > 4 && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500 dark:bg-zinc-800">+{attention.outcomes.length - 4}</span>
          )}
        </div>
      )}
      {attention.summary ? (
        <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-5 text-muted-foreground">
          {t(attention.summary)}
        </p>
      ) : null}
      <div className="mt-auto grid grid-cols-3 gap-1.5 pt-4 text-center">
        <SmallMetric label={t(dictionary.explore.energy)} value={attention.attentionScore} />
        <SmallMetric label={t(dictionary.explore.participants)} value={attention.participantCount} />
        <SmallMetric label={t(dictionary.explore.posts)} value={attention.postCount} />
      </div>
    </Link>
  );
}

function SmallMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-1.5 py-1.5">
      <p className="truncate text-[11px] font-bold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[13px] font-black text-foreground">{value}</p>
    </div>
  );
}

function buildTopicView(
  topic: TopicRow,
  trends: TopicTrend[],
  attentions: ExploreAttention[],
): TopicView {
  const latest = trends[0];
  const previous = trends[1];
  const latestScore = Number(latest?.score ?? 0);
  const previousScore = Number(previous?.score ?? 0);
  const trend =
    previousScore > 0
      ? `${latestScore >= previousScore ? "+" : ""}${Math.round(
          ((latestScore - previousScore) / previousScore) * 100,
        )}%`
      : latestScore > 0
        ? "+100%"
        : "+0%";

  return {
    slug: topic.slug,
    label: topic.canonical_label,
    description: topic.description,
    energy: attentions.reduce((total, attention) => total + attention.attentionScore, 0),
    trend,
    attentionCount: attentions.length || latest?.attention_count || 0,
    postCount:
      attentions.reduce((total, attention) => total + attention.postCount, 0) ||
      latest?.post_count ||
      0,
    commentCount: latest?.comment_count || 0,
  };
}

function buildFallbackTopicView(
  slug: string,
  label: string,
  attentions: ExploreAttention[],
): TopicView {
  return {
    slug,
    label,
    description: null,
    energy: attentions.reduce((total, attention) => total + attention.attentionScore, 0),
    trend: exploreTopics.find((topic) => topic.slug === slug)?.trend ?? "+0%",
    attentionCount: attentions.length,
    postCount: attentions.reduce((total, attention) => total + attention.postCount, 0),
    commentCount: 0,
  };
}

function mapClusterToAttention(
  cluster: AttentionCluster,
  _fallbackSummary: LocalizedText,
  liveLabel: LocalizedText,
): ExploreAttention {
  return {
    id: cluster.id,
    slug: cluster.slug || cluster.id,
    title: localize(cluster.title),
    summary: cluster.description ? localize(cluster.description) : null,
    category: normalizeCategory(cluster.category),
    urgency: Number(cluster.attention_score) >= 80 ? "breaking" : "hot",
    referenceSignal: Math.min(99, Math.max(1, Math.round(Number(cluster.attention_score)))),
    attentionScore: Math.round(Number(cluster.attention_score)),
    participantCount: 0,
    postCount: cluster.post_count,
    sourceCount: cluster.source_count,
    sources: ["momment."],
    topics: [cluster.category ?? "attention"],
    outcomes: [],
    endsInLabel: liveLabel,
    ruleStatus: "draft",
  };
}

function localize(value: string): LocalizedText {
  return text(value, value, value);
}

function normalizeCategory(category: string | null): ExploreAttention["category"] {
  if (
    category === "economics" ||
    category === "politics" ||
    category === "crypto" ||
    category === "sports" ||
    category === "entertainment" ||
    category === "ai"
  ) {
    return category;
  }

  return "entertainment";
}

function normalizeTopic(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");
}

function compact(value: number, language: string) {
  return new Intl.NumberFormat(localeFromLanguage(language), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function localeFromLanguage(language: string) {
  if (language === "en") return "en-US";
  if (language === "es") return "es-ES";
  return "ko-KR";
}
