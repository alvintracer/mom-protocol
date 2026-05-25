import type { Metadata } from "next";

import { TopicPageClient } from "./TopicPageClient";
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

type TopicSeoRow = {
  slug: string;
  canonical_label: string;
  description: string | null;
  updated_at: string;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const lookupSlug = safeDecodePathSegment(slug);
  const topic = await fetchTopicSeo(lookupSlug);
  const canonicalSlug = topic?.slug || slug;
  const label = topic?.canonical_label || lookupSlug;
  const title = `#${label} | ${siteName}`;
  const description = compactSeoDescription(topic?.description);
  const url = publicUrl(`/topic/${encodeURIComponent(canonicalSlug)}`);

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
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: Boolean(topic),
      follow: true,
    },
  };
}

export default async function TopicPage({ params }: PageProps) {
  const { slug } = await params;

  return <TopicPageClient slug={slug} />;
}

async function fetchTopicSeo(slug: string): Promise<TopicSeoRow | null> {
  const supabase = createSeoSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("topics")
    .select("slug, canonical_label, description, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  return data;
}
