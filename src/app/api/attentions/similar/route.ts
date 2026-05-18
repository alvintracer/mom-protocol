/**
 * Find similar existing attentions based on text similarity.
 * Uses PostgreSQL pg_trgm trigram similarity on both cluster titles and aliases.
 *
 * GET /api/attentions/similar?q=Bitcoin+price+prediction&category=crypto&limit=5
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category") || null;
  const limit = Math.min(Number(searchParams.get("limit")) || 5, 10);

  if (!q || q.length < 2) {
    return Response.json({ matches: [] });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ matches: [], error: "config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase.rpc("find_similar_attentions", {
      query_text: q,
      query_category: category,
      max_results: limit,
      min_score: 0.12,
    });

    if (error) {
      console.error("Similarity search error:", error);
      return await fallbackSearch(supabase, q, category, limit);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matches = (data ?? []).map((row: any) => ({
      id: row.cluster_id,
      title: row.title,
      slug: row.slug,
      category: row.category,
      score: Math.round(Number(row.similarity_score) * 100),
      sourceCount: row.source_count,
      postCount: row.post_count,
      attentionScore: row.attention_score,
      matchSource: row.match_source,
    }));

    return Response.json({ matches, method: "trigram" });
  } catch (err) {
    console.error("Similarity search unexpected error:", err);
    return await fallbackSearch(supabase, q, category, limit);
  }
}

/** Fallback ILIKE search when pg_trgm is not available */
async function fallbackSearch(
  supabase: SupabaseClient,
  q: string,
  category: string | null,
  limit: number,
) {
  const pattern = `%${q}%`;

  let query = supabase
    .from("attention_clusters")
    .select("id, title, slug, category, source_count, post_count, attention_score")
    .in("status", ["active", "reviewing"])
    .or(`title.ilike.${pattern},description.ilike.${pattern}`)
    .order("attention_score", { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq("category", category);
  }

  const { data } = await query;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches = (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    score: 50,
    sourceCount: row.source_count,
    postCount: row.post_count,
    attentionScore: row.attention_score,
    matchSource: "ilike",
  }));

  return Response.json({ matches, method: "ilike_fallback" });
}
