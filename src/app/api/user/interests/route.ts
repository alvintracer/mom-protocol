import { NextResponse } from "next/server";

import { createClient } from "@/shared/lib/supabase/server";

/**
 * GET /api/user/interests
 *
 * Returns the current user's top interest topics with scores.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: interests } = await supabase
    .from("user_interests")
    .select("score, interaction_count, last_interaction_at, topics!inner(slug, canonical_label, labels, kind)")
    .eq("user_id", user.id)
    .gt("score", 0.1)
    .order("score", { ascending: false })
    .limit(30);

  return NextResponse.json({
    interests: (interests ?? []).map((i: Record<string, unknown>) => ({
      score: i.score,
      interactionCount: i.interaction_count,
      lastInteraction: i.last_interaction_at,
      topic: i.topics as { slug: string; canonical_label: string; labels: Record<string, string>; kind: string },
    })),
  });
}
