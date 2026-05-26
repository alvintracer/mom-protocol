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
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
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
    case "reset_ai_energy": {
      const supabase = createServiceClient();
      // Count first, then update
      const { count: affected } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .like("handle", "mom_%")
        .gt("mom_energy", 0);
      await supabase
        .from("profiles")
        .update({ mom_energy: 0 })
        .like("handle", "mom_%");
      return NextResponse.json({ reset: true, affected: affected ?? 0 });
    }
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

    // 2. Update the auto-created profile with our custom handle, display name
    // AI users get 0 energy to avoid inflating circulating supply
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        handle,
        display_name: displayName,
        mom_energy: 0,
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
  const prompt = `너는 한국 커뮤니티 유저 ${safeCount}명이야. 각각 다른 사람이고, 아래 주제에 대해 글을 써.

주제: "${attention.title}"
카테고리: ${attention.category || "일반"}
맥락: ${attention.description || "없음"}

중요 규칙:
- 진짜 사람이 쓴것처럼 써. AI가 쓴 느낌 절대 나면 안됨
- "~하는 건 어떨까요" "~가 제 motto예요" 이런 식의 AI체 절대 금지
- 디시, 레딧, 에펨코리아에서 볼법한 실제 유저 말투
- 반말/존댓말 섞어서. 사람마다 다르게
- 문장 1~3개로 짧게. 긴 글 쓰지마
- 이모지는 1~2개만, 안 써도 됨
- 제목은 대부분 null로. 가끔 한줄짜리 제목
- 스타일 예시: 팩트 전달, 한줄 의견, 까는 글, 응원, 밈, 질문, 뉴스 요약 등
- "ㅋㅋ" "ㄹㅇ" "ㅇㅇ" "ㄴㄴ" 같은 축약어도 가끔 사용
- 절대 모든 글이 비슷한 톤이면 안됨

나쁜 예 (AI체, 이렇게 쓰지마):
- "여러분도 기대하고 있죠? 😂🍗"
- "축제처럼 즐길 수 있겠죠!"
- "기대감은 넘치네요~"

좋은 예 (진짜 커뮤니티 글):
- "손흥민 컨디션 보면 조별리그는 넘는다 봄"
- "이번엔 진짜 기대해도 되는거냐 ㅋㅋ"
- "16강 가면 치킨 쏜다"

JSON으로만 반환. 다른 텍스트 쓰지마:
{"posts": [{"title": null, "body": "본문"}, ...]}`;

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

  const prompt = `너는 한국 커뮤니티 유저야. 아래 포스트들에 댓글을 달아.

주제: "${attention.title}"

포스트 목록:
${postSummaries}

중요 규칙:
- 진짜 사람 댓글처럼. AI체 절대 금지
- 1문장이 대부분. 길어도 2문장
- 반말 위주. "ㅋㅋ" "ㄹㅇ" "ㅇㅈ" 같은 축약어 자연스럽게
- 동의, 태클, 드립, 추가정보, 짧은 리액션 등 다양하게
- 이모지 0~1개
- 나쁜 예: "정말 좋은 분석이네요! 저도 동의합니다 😊"
- 좋은 예: "ㅇㅈ 이건 맞는듯", "아 진짜? 소스 있음?", "ㅋㅋㅋㅋ", "와 미쳤다"

JSON으로만 반환:
{"comments": [{"post_id": "...", "body": "댓글"}, ...]}`;

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

/* ── Reset AI user energy to 0 ─── */
async function resetAiUserEnergy(supabase: ReturnType<typeof createServiceClient>) {
  await supabase
    .from("profiles")
    .update({ mom_energy: 0 })
    .like("handle", "mom_%");
}
