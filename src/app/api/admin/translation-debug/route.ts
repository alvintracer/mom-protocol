import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/shared/lib/admin/session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  const cookieStore = await cookies();
  if (!isValidAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Count translations
  const [postTrans, commentTrans, pendingPosts, pendingComments, totalPosts] = await Promise.all([
    supabase.from("post_translations").select("id", { count: "exact", head: true }),
    supabase.from("comment_translations").select("id", { count: "exact", head: true }),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("translation_status", "pending").eq("is_deleted", false),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("translation_status", "pending").eq("is_deleted", false),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("is_deleted", false),
  ]);

  // Sample: grab a few post translations to see actual data
  const { data: sampleTranslations } = await supabase
    .from("post_translations")
    .select("post_id, language, title, body, status, provider, model")
    .limit(10);

  // Count by language
  const enCount = await supabase.from("post_translations").select("id", { count: "exact", head: true }).eq("language", "en");
  const esCount = await supabase.from("post_translations").select("id", { count: "exact", head: true }).eq("language", "es");
  const koCount = await supabase.from("post_translations").select("id", { count: "exact", head: true }).eq("language", "ko");

  // Sample: check post visibility values
  const { data: samplePosts } = await supabase
    .from("posts")
    .select("id, visibility, translation_status, original_language")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(10);

  // Try the same query the hook uses (anon-style) for a sample post
  const firstPostId = samplePosts?.[0]?.id;
  const { data: hookStyleQuery, error: hookError } = firstPostId
    ? await supabase
        .from("post_translations")
        .select("post_id, language, title, body")
        .eq("post_id", firstPostId)
        .eq("language", "en")
        .eq("status", "translated")
    : { data: null, error: null };

  return NextResponse.json({
    counts: {
      totalPosts: totalPosts.count,
      pendingPosts: pendingPosts.count,
      pendingComments: pendingComments.count,
      postTranslations: postTrans.count,
      commentTranslations: commentTrans.count,
      byLanguage: {
        en: enCount.count,
        es: esCount.count,
        ko: koCount.count,
      },
    },
    sampleTranslations,
    samplePosts,
    hookStyleQuery: { data: hookStyleQuery, error: hookError?.message, postId: firstPostId },
  });
}
