import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/shared/lib/admin/session";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

async function gptJson(prompt: string): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.9,
    }),
  });
  const data = await res.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function requireAdmin() {
  const cookieStore = await cookies();
  return isValidAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

/* ── Korean-style nicknames ────────────────────────── */
const PREFIXES = [
  "빛나는", "용감한", "똑똑한", "웃기는", "신비한", "차분한", "엉뚱한", "따뜻한", "시원한", "날카로운",
  "조용한", "거침없는", "달콤한", "씩씩한", "수줍은", "자유로운", "느긋한", "활기찬", "든든한", "호기심많은",
];
const ANIMALS = [
  "판다", "고래", "여우", "독수리", "호랑이", "고양이", "부엉이", "돌고래", "사슴", "늑대",
  "펭귄", "코끼리", "수달", "토끼", "곰", "두루미", "너구리", "앵무새", "거북이", "다람쥐",
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomNum(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function generateHandle() {
  return `mom_${randomPick(ANIMALS).slice(0, 2)}${randomNum(1000, 9999)}`;
}
function generateDisplayName() {
  return `${randomPick(PREFIXES)} ${randomPick(ANIMALS)}`;
}

/**
 * POST /api/admin/community-seed
 *
 * Actions:
 * 1. action: "create_users"   — creates N AI profiles
 *    body: { action: "create_users", count: number }
 *
 * 2. action: "generate_posts" — GPT generates posts for a given attention
 *    body: { action: "generate_posts", attention_id: string, count: number }
 *
 * 3. action: "generate_comments" — GPT generates comments on existing posts
 *    body: { action: "generate_comments", attention_id: string, count: number }
 *
 * 4. action: "list_attentions" — returns attention clusters list
 *    body: { action: "list_attentions" }
 *
 * 5. action: "list_ai_users" — returns AI-generated profiles
 *    body: { action: "list_ai_users" }
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body as { action: string };

  switch (action) {
    case "create_users":
      return handleCreateUsers(body.count ?? 5);
    case "generate_posts":
      return handleGeneratePosts(body.attention_id, body.count ?? 3);
    case "generate_comments":
      return handleGenerateComments(body.attention_id, body.count ?? 5);
    case "list_attentions":
      return handleListAttentions();
    case "list_ai_users":
      return handleListAIUsers();
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

/* ── Create AI Users ─── */
async function handleCreateUsers(count: number) {
  const supabase = createServiceClient();
  const created: { id: string; handle: string; display_name: string }[] = [];

  for (let i = 0; i < Math.min(count, 50); i++) {
    const handle = generateHandle();
    const displayName = generateDisplayName();
    const emailId = `ai_${Date.now()}_${randomNum(1000, 9999)}`;
    const email = `${emailId}@ai.moment.local`;

    // 1. Create auth user (triggers profile creation via DB trigger)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: crypto.randomUUID(), // random password, these users don't login
      email_confirm: true,
      user_metadata: { name: displayName },
    });

    if (authError || !authData.user) {
      console.error("Failed to create AI auth user:", authError);
      continue;
    }

    const userId = authData.user.id;

    // 2. Update the auto-created profile with our custom handle, display name, energy
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        handle,
        display_name: displayName,
        mom_energy: randomNum(50, 500),
        preferred_language: "ko",
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to update AI profile:", updateError);
    }

    created.push({ id: userId, handle, display_name: displayName });
  }

  return NextResponse.json({ created, count: created.length });
}

/* ── List Attentions ─── */
async function handleListAttentions() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("attention_clusters")
    .select("id, title, category, post_count, created_at, status")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ attentions: data ?? [] });
}

/* ── List AI Users ─── */
async function handleListAIUsers() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, handle, display_name, mom_energy, created_at")
    .like("handle", "mom_%")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

/* ── Generate Posts ─── */
async function handleGeneratePosts(attentionId: string, count: number) {
  if (!attentionId) {
    return NextResponse.json({ error: "attention_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get attention info
  const { data: attention } = await supabase
    .from("attention_clusters")
    .select("id, title, category, description")
    .eq("id", attentionId)
    .single();

  if (!attention) {
    return NextResponse.json({ error: "Attention not found" }, { status: 404 });
  }

  // Get AI users
  const { data: aiUsers } = await supabase
    .from("profiles")
    .select("id, handle, display_name")
    .like("handle", "mom_%")
    .limit(50);

  if (!aiUsers || aiUsers.length === 0) {
    return NextResponse.json({ error: "No AI users found. Create users first." }, { status: 400 });
  }

  const safeCount = Math.min(count, 10);

  // Generate post content with GPT
  const prompt = `당신은 "moment."라는 예측 어텐션 커뮤니티의 다양한 유저입니다.
아래 어텐션 주제에 대해 ${safeCount}개의 서로 다른 포스트를 작성하세요.

어텐션 제목: "${attention.title}"
카테고리: ${attention.category || "일반"}
설명: ${attention.description || "없음"}

규칙:
- 각 포스트는 서로 다른 관점/스타일이어야 합니다 (분석, 의견, 유머, 정보공유, 질문 등)
- 커뮤니티 느낌으로 자연스럽게 (오글거리지 않게, 실제 유저가 쓸법하게)
- 길이는 2~5문장 정도
- 이모지 적절히 사용
- 한국어로 작성
- 포스트마다 선택적으로 짧은 제목을 넣을 수 있음 (없어도 됨)

JSON 배열로 반환:
[{"title": "제목 또는 null", "body": "본문 내용"}, ...]`;

  let posts: { title: string | null; body: string }[] = [];
  try {
    const parsed = await gptJson(prompt);
    posts = (parsed.posts || parsed.data || (Array.isArray(parsed) ? parsed : [])) as typeof posts;
  } catch {
    return NextResponse.json({ error: "GPT parsing failed" }, { status: 500 });
  }

  const created: string[] = [];

  for (const post of posts.slice(0, safeCount)) {
    const user = randomPick(aiUsers);

    const { data: inserted, error } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        attention_cluster_id: attentionId,
        type: "analysis",
        visibility: "public",
        original_language: "ko",
        original_title: post.title || null,
        original_body: post.body,
        content_format: "text",
      })
      .select("id")
      .single();

    if (!error && inserted) {
      created.push(inserted.id);

      // Update post_count on attention cluster
      const { count: newCount } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("attention_cluster_id", attentionId)
        .eq("is_deleted", false);
      await supabase
        .from("attention_clusters")
        .update({ post_count: newCount ?? 0 })
        .eq("id", attentionId);
    }
  }

  return NextResponse.json({
    created: created.length,
    post_ids: created,
    attention: attention.title,
  });
}

/* ── Generate Comments ─── */
async function handleGenerateComments(attentionId: string, count: number) {
  if (!attentionId) {
    return NextResponse.json({ error: "attention_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get attention + its posts
  const { data: attention } = await supabase
    .from("attention_clusters")
    .select("id, title")
    .eq("id", attentionId)
    .single();

  if (!attention) {
    return NextResponse.json({ error: "Attention not found" }, { status: 404 });
  }

  const { data: posts } = await supabase
    .from("posts")
    .select("id, original_title, original_body")
    .eq("attention_cluster_id", attentionId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!posts || posts.length === 0) {
    return NextResponse.json({ error: "No posts in this attention" }, { status: 400 });
  }

  // Get AI users
  const { data: aiUsers } = await supabase
    .from("profiles")
    .select("id")
    .like("handle", "mom_%")
    .limit(50);

  if (!aiUsers || aiUsers.length === 0) {
    return NextResponse.json({ error: "No AI users found" }, { status: 400 });
  }

  const safeCount = Math.min(count, 20);

  // Pick random posts to comment on
  const targetPosts = Array.from({ length: safeCount }, () => randomPick(posts));

  const postSummaries = targetPosts.map(
    (p, i) => `${i + 1}. [Post ID: ${p.id}] "${p.original_title || p.original_body.slice(0, 60)}"`
  ).join("\n");

  const prompt = `당신은 "moment." 커뮤니티의 다양한 유저입니다.
아래 포스트들에 각각 1개씩 댓글을 달아주세요.

어텐션: "${attention.title}"

포스트 목록:
${postSummaries}

규칙:
- 각 댓글은 해당 포스트 내용에 맞는 반응이어야 합니다
- 동의, 반박, 질문, 추가정보, 유머 등 다양한 스타일로
- 1~3문장, 자연스러운 커뮤니티 댓글처럼
- 한국어, 이모지 적절히

JSON 배열로 반환:
[{"post_id": "...", "body": "댓글 내용"}, ...]`;

  let comments: { post_id: string; body: string }[] = [];
  try {
    const parsed = await gptJson(prompt);
    comments = (parsed.comments || parsed.data || (Array.isArray(parsed) ? parsed : [])) as typeof comments;
  } catch {
    return NextResponse.json({ error: "GPT parsing failed" }, { status: 500 });
  }

  let createdCount = 0;

  for (const comment of comments) {
    const user = randomPick(aiUsers);

    const { error } = await supabase
      .from("comments")
      .insert({
        post_id: comment.post_id,
        user_id: user.id,
        original_language: "ko",
        original_body: comment.body,
      });

    if (!error) {
      createdCount++;
      // Increment comment count
      const { count: cCount } = await supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", comment.post_id)
        .eq("is_deleted", false);
      await supabase
        .from("posts")
        .update({ comment_count: cCount ?? 0 })
        .eq("id", comment.post_id);
    }
  }

  return NextResponse.json({
    created: createdCount,
    attention: attention.title,
  });
}
