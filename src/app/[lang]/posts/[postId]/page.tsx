import type { Metadata } from "next";

import { PostDetailClient } from "./PostDetailClient";
import {
  compactSeoDescription,
  createSeoSupabaseClient,
  publicUrl,
  siteName,
} from "@/shared/lib/seo";

type PageProps = {
  params: Promise<{ postId: string }>;
};

type PostSeoRow = {
  id: string;
  original_title: string | null;
  original_body: string;
  content_format: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  attention_cluster_id: string | null;
};

const SEO_FIELDS =
  "id, original_title, original_body, content_format, like_count, comment_count, view_count, created_at, updated_at, user_id, attention_cluster_id";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { postId } = await params;
  const post = await fetchPostSeo(postId);

  if (!post) {
    return { title: `Post | ${siteName}`, robots: { index: false } };
  }

  const bodyText =
    post.content_format === "html"
      ? post.original_body.replace(/<[^>]+>/g, "").trim()
      : post.original_body.trim();

  const title = post.original_title
    ? `${post.original_title} | ${siteName}`
    : `${bodyText.slice(0, 70)}${bodyText.length > 70 ? "…" : ""} | ${siteName}`;

  const description = compactSeoDescription(
    post.original_title
      ? `${post.original_title} — ${bodyText}`
      : bodyText,
  );

  const url = publicUrl(`/posts/${post.id}`);

  // Fetch author info for structured data
  const authorName = await fetchAuthorName(post.user_id);
  const attentionTitle = post.attention_cluster_id
    ? await fetchAttentionTitle(post.attention_cluster_id)
    : null;

  const fullDescription = attentionTitle
    ? compactSeoDescription(`[${attentionTitle}] ${description}`)
    : description;

  const ogImageParams = new URLSearchParams({
    title: post.original_title || bodyText.slice(0, 80),
    type: "post",
    author: authorName || "",
    category: attentionTitle || "",
  });
  const ogImage = publicUrl(`/api/og?${ogImageParams.toString()}`);

  return {
    title,
    description: fullDescription,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description: fullDescription,
      url,
      siteName,
      type: "article",
      modifiedTime: post.updated_at,
      publishedTime: post.created_at,
      authors: authorName ? [authorName] : undefined,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: post.original_title || bodyText.slice(0, 70),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: fullDescription,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function PostDetailPage({ params }: PageProps) {
  const { postId } = await params;
  const post = await fetchPostSeo(postId);

  // JSON-LD structured data
  const authorName = post ? await fetchAuthorName(post.user_id) : null;

  const bodyText = post
    ? post.content_format === "html"
      ? post.original_body.replace(/<[^>]+>/g, "").trim()
      : post.original_body.trim()
    : "";

  const jsonLd = post
    ? {
        "@context": "https://schema.org",
        "@type": "SocialMediaPosting",
        headline: post.original_title || bodyText.slice(0, 110),
        articleBody: bodyText.slice(0, 500),
        url: publicUrl(`/posts/${post.id}`),
        datePublished: post.created_at,
        dateModified: post.updated_at,
        author: {
          "@type": "Person",
          name: authorName || "momment. user",
        },
        publisher: {
          "@type": "Organization",
          name: siteName,
          url: publicUrl("/"),
        },
        interactionStatistic: [
          {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/LikeAction",
            userInteractionCount: post.like_count,
          },
          {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/CommentAction",
            userInteractionCount: post.comment_count,
          },
        ],
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": publicUrl(`/posts/${post.id}`),
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
      <PostDetailClient params={params} />
    </>
  );
}

/* ─── Server-side data fetchers ─── */

async function fetchPostSeo(postId: string): Promise<PostSeoRow | null> {
  const supabase = createSeoSupabaseClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("posts")
    .select(SEO_FIELDS)
    .eq("id", postId)
    .eq("is_deleted", false)
    .eq("visibility", "public")
    .maybeSingle();

  return data;
}

async function fetchAuthorName(userId: string): Promise<string | null> {
  const supabase = createSeoSupabaseClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("profiles")
    .select("display_name, handle")
    .eq("id", userId)
    .maybeSingle();

  return data?.display_name || data?.handle || null;
}

async function fetchAttentionTitle(attentionId: string): Promise<string | null> {
  const supabase = createSeoSupabaseClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("attention_clusters")
    .select("title")
    .eq("id", attentionId)
    .maybeSingle();

  return data?.title || null;
}
