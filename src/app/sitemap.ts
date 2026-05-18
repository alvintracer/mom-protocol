import type { MetadataRoute } from "next";

import { createSeoSupabaseClient, publicUrl } from "@/shared/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: publicUrl("/"),
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: publicUrl("/explore"),
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: publicUrl("/rewards"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: publicUrl("/oracle"),
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.7,
    },
  ];

  const supabase = createSeoSupabaseClient();

  if (!supabase) {
    return staticRoutes;
  }

  const [{ data: attentions }, { data: topics }, { data: posts }] = await Promise.all([
    supabase
      .from("attention_clusters")
      .select("id, slug, updated_at, attention_score")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase
      .from("topics")
      .select("slug, updated_at")
      .order("updated_at", { ascending: false })
      .limit(500),
    supabase
      .from("posts")
      .select("id, updated_at")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  const attentionRoutes: MetadataRoute.Sitemap = (attentions ?? []).map((attention) => ({
    url: publicUrl(`/a/${encodeURIComponent(attention.slug || attention.id)}`),
    lastModified: new Date(attention.updated_at),
    changeFrequency: "hourly",
    priority: Math.min(0.95, 0.55 + Math.max(0, Number(attention.attention_score)) / 1000),
  }));

  const topicRoutes: MetadataRoute.Sitemap = (topics ?? []).map((topic) => ({
    url: publicUrl(`/topic/${encodeURIComponent(topic.slug)}`),
    lastModified: new Date(topic.updated_at),
    changeFrequency: "hourly",
    priority: 0.75,
  }));

  // Individual post pages — high value for long-tail SEO
  const postRoutes: MetadataRoute.Sitemap = (posts ?? []).map((post) => ({
    url: publicUrl(`/posts/${post.id}`),
    lastModified: new Date(post.updated_at),
    changeFrequency: "daily",
    priority: 0.6,
  }));

  return [...staticRoutes, ...attentionRoutes, ...topicRoutes, ...postRoutes];
}
