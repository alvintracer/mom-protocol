import type { Metadata } from "next";

import { AttentionPageClient } from "./AttentionPageClient";
import {
  compactSeoDescription,
  createSeoSupabaseClient,
  publicUrl,
  safeDecodePathSegment,
  siteName,
} from "@/shared/lib/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type AttentionSeoRow = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  category: string | null;
  attention_score: number;
  post_count: number;
  comment_count: number;
  source_count: number;
  updated_at: string;
  created_at: string;
};

const SEO_FIELDS =
  "id, slug, title, description, category, attention_score, post_count, comment_count, source_count, updated_at, created_at";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const lookupSlug = safeDecodePathSegment(slug);
  const attention = await fetchAttentionSeo(lookupSlug);
  const canonicalSlug = attention?.slug || slug;
  const title = attention
    ? `${attention.title} — 예측·분석·토론 | ${siteName}`
    : siteName;
  const description = attention
    ? compactSeoDescription(
        `${attention.title}에 대한 실시간 예측과 분석. ${attention.post_count}개 포스트, ${attention.comment_count}개 댓글, ${attention.source_count}개 출처. ${attention.description ?? ""}`,
      )
    : compactSeoDescription(null);
  const url = publicUrl(`/a/${encodeURIComponent(canonicalSlug)}`);

  const ogImageParams = new URLSearchParams({
    title: attention?.title || "moment.",
    type: "attention",
    category: attention?.category || "",
    energy: String(attention?.attention_score ?? 0),
    posts: String(attention?.post_count ?? 0),
  });
  const ogImage = publicUrl(`/api/og?${ogImageParams.toString()}`);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName,
      type: "article",
      modifiedTime: attention?.updated_at,
      publishedTime: attention?.created_at,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: attention?.title || "moment.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: Boolean(attention),
      follow: true,
    },
  };
}

export default async function AttentionPage({ params }: PageProps) {
  const { slug } = await params;
  const lookupSlug = safeDecodePathSegment(slug);
  const attention = await fetchAttentionSeo(lookupSlug);
  const canonicalSlug = attention?.slug || slug;

  // JSON-LD structured data for search engines
  const jsonLd = attention
    ? {
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        headline: attention.title,
        description: attention.description ?? undefined,
        url: publicUrl(`/a/${encodeURIComponent(canonicalSlug)}`),
        datePublished: attention.created_at,
        dateModified: attention.updated_at,
        author: {
          "@type": "Organization",
          name: siteName,
          url: publicUrl("/"),
        },
        publisher: {
          "@type": "Organization",
          name: siteName,
          url: publicUrl("/"),
          logo: {
            "@type": "ImageObject",
            url: publicUrl("/favicon.ico"),
          },
        },
        interactionStatistic: [
          {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/CommentAction",
            userInteractionCount: attention.comment_count,
          },
          {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/WriteAction",
            userInteractionCount: attention.post_count,
          },
        ],
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": publicUrl(`/a/${encodeURIComponent(canonicalSlug)}`),
        },
      }
    : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <AttentionPageClient slug={slug} />
    </>
  );
}

async function fetchAttentionSeo(slug: string): Promise<AttentionSeoRow | null> {
  const supabase = createSeoSupabaseClient();

  if (!supabase) {
    return null;
  }

  if (isUuid(slug)) {
    const { data } = await supabase
      .from("attention_clusters")
      .select(SEO_FIELDS)
      .eq("id", slug)
      .maybeSingle();

    return data;
  }

  const directMatch = await supabase
    .from("attention_clusters")
    .select(SEO_FIELDS)
    .eq("slug", slug)
    .maybeSingle();

  if (directMatch.data || directMatch.error) {
    return directMatch.data;
  }

  const eventMatch = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();

  if (!eventMatch.data?.id) {
    return null;
  }

  const sourceMatch = await supabase
    .from("attention_sources")
    .select("cluster_id")
    .eq("event_id", eventMatch.data.id)
    .limit(1)
    .maybeSingle();

  if (!sourceMatch.data?.cluster_id) {
    return null;
  }

  const { data } = await supabase
    .from("attention_clusters")
    .select(SEO_FIELDS)
    .eq("id", sourceMatch.data.cluster_id)
    .maybeSingle();

  return data;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(
    value,
  );
}
