import type { MetadataRoute } from "next";

import { createSeoSupabaseClient, publicUrl } from "@/shared/lib/seo";

const LOCALES = ["ko", "en", "es"] as const;

/** Build a sitemap entry with hreflang alternates for all locales */
function localizedEntry(
  path: string,
  lastModified: Date,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  priority: number,
): MetadataRoute.Sitemap[number] {
  const alternates: Record<string, string> = {};
  for (const locale of LOCALES) {
    alternates[locale] = publicUrl(`/${locale}${path}`);
  }

  return {
    url: publicUrl(`/ko${path}`), // default = Korean
    lastModified,
    changeFrequency,
    priority,
    alternates: {
      languages: {
        ...alternates,
        "x-default": publicUrl(`/ko${path}`),
      },
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    localizedEntry("", now, "hourly", 1),
    localizedEntry("/explore", now, "hourly", 0.9),
    localizedEntry("/rewards", now, "daily", 0.6),
    localizedEntry("/oracle", now, "hourly", 0.7),
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

  const attentionRoutes: MetadataRoute.Sitemap = (attentions ?? []).map((attention) =>
    localizedEntry(
      `/a/${encodeURIComponent(attention.slug || attention.id)}`,
      new Date(attention.updated_at),
      "hourly",
      Math.min(0.95, 0.55 + Math.max(0, Number(attention.attention_score)) / 1000),
    ),
  );

  const topicRoutes: MetadataRoute.Sitemap = (topics ?? []).map((topic) =>
    localizedEntry(
      `/topic/${encodeURIComponent(topic.slug)}`,
      new Date(topic.updated_at),
      "hourly",
      0.75,
    ),
  );

  const postRoutes: MetadataRoute.Sitemap = (posts ?? []).map((post) =>
    localizedEntry(
      `/posts/${post.id}`,
      new Date(post.updated_at),
      "daily",
      0.6,
    ),
  );

  return [...staticRoutes, ...attentionRoutes, ...topicRoutes, ...postRoutes];
}
