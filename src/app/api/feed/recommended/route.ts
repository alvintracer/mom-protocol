import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/feed/recommended?limit=20
 *
 * Returns personalized post recommendations based on user_interests.
 * Falls back to trending posts if user has no interest profile.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

  // Get user from auth header
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Verify user
  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 1. Check if user has interests
    const { count: interestCount } = await supabase
      .from("user_interests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gt("score", 0.1);

    let postIds: string[] = [];

    if ((interestCount ?? 0) > 0) {
      // 2a. Use personalized recommendations
      const { data: recommended } = await supabase.rpc(
        "get_recommended_post_ids",
        { p_user_id: user.id, p_limit: limit },
      );

      postIds = (recommended ?? []).map(
        (r: { post_id: string }) => r.post_id,
      );
    }

    if (postIds.length < 5) {
      // 2b. Cold start fallback: trending posts from last 7 days
      const { data: trending } = await supabase
        .from("posts")
        .select("id")
        .eq("visibility", "public")
        .eq("is_deleted", false)
        .neq("user_id", user.id)
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 86400_000).toISOString(),
        )
        .order("like_count", { ascending: false })
        .limit(limit);

      const trendingIds = (trending ?? []).map(
        (p: { id: string }) => p.id,
      );
      // Merge, dedup, keep recommended order first
      const seen = new Set(postIds);
      for (const id of trendingIds) {
        if (!seen.has(id)) {
          postIds.push(id);
          seen.add(id);
        }
        if (postIds.length >= limit) break;
      }
    }

    // 3. Fetch full post data in order
    if (postIds.length === 0) {
      return NextResponse.json({ posts: [], source: "empty" });
    }

    const { data: posts } = await supabase
      .from("posts")
      .select("*")
      .in("id", postIds);

    // Preserve recommended order
    const postMap = new Map((posts ?? []).map((p) => [p.id, p]));
    const ordered = postIds
      .map((id) => postMap.get(id))
      .filter(Boolean);

    return NextResponse.json({
      posts: ordered,
      source: (interestCount ?? 0) > 0 ? "personalized" : "trending",
      interestCount: interestCount ?? 0,
    });
  } catch (err) {
    console.error("[recommended]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
