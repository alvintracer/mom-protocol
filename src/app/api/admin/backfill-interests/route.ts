import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/admin/backfill-interests
 *
 * One-time backfill of user_interests from existing activity.
 * Processes: likes, bookmarks, comments, unlocks, content_topics.
 * 
 * Protected by admin secret.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const adminSecret = body.secret;

  if (adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const stats = { likes: 0, bookmarks: 0, comments: 0, unlocks: 0, topics: 0 };

  try {
    // 1. Likes → weight 2.0
    const { data: reactions } = await supabase
      .from("post_reactions")
      .select("user_id, post_id")
      .limit(5000);

    for (const r of reactions ?? []) {
      await supabase.rpc("update_user_interest" as never, {
        p_user_id: r.user_id,
        p_post_id: r.post_id,
        p_signal_weight: 2.0,
      } as never);
      stats.likes++;
    }

    // 2. Bookmarks → weight 3.0
    const { data: bookmarks } = await supabase
      .from("bookmarks")
      .select("user_id, target_type, target_id")
      .eq("target_type", "post")
      .limit(5000);

    for (const b of bookmarks ?? []) {
      await supabase.rpc("update_user_interest" as never, {
        p_user_id: b.user_id,
        p_post_id: b.target_id,
        p_signal_weight: 3.0,
      } as never);
      stats.bookmarks++;
    }

    // 3. Comments → weight 2.5
    const { data: comments } = await supabase
      .from("comments")
      .select("user_id, post_id")
      .limit(5000);

    for (const c of comments ?? []) {
      await supabase.rpc("update_user_interest" as never, {
        p_user_id: c.user_id,
        p_post_id: c.post_id,
        p_signal_weight: 2.5,
      } as never);
      stats.comments++;
    }

    // 4. Post unlocks → weight 4.0
    const { data: unlocks } = await supabase
      .from("post_unlocks")
      .select("user_id, post_id")
      .limit(5000);

    for (const u of unlocks ?? []) {
      await supabase.rpc("update_user_interest" as never, {
        p_user_id: u.user_id,
        p_post_id: u.post_id,
        p_signal_weight: 4.0,
      } as never);
      stats.unlocks++;
    }

    // 5. Content topics (author interests) — already handled by trigger on existing data
    // Just count for reporting
    const { count } = await supabase
      .from("content_topics")
      .select("id", { count: "exact", head: true })
      .eq("target_type", "post");
    stats.topics = count ?? 0;

    return NextResponse.json({
      success: true,
      stats,
      message: "Backfill complete",
    });
  } catch (err) {
    console.error("[backfill-interests]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
