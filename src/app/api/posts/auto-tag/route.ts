import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

/* ─── env ─── */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/* ─── types ─── */
type TopicSuggestion = {
  slug: string;
  kind: "ai_keyword" | "entity" | "category";
  canonical_label: string;
  labels: { ko: string; en: string; es: string };
  confidence: number;
};

type LLMResponse = {
  topics: TopicSuggestion[];
};

/* ─── main ─── */
export async function POST(request: Request) {
  try {
    const { postId } = (await request.json()) as { postId: string };

    if (!postId) {
      return NextResponse.json({ error: "postId required" }, { status: 400 });
    }
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Fetch post
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, original_title, original_body, content_format")
      .eq("id", postId)
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "post_not_found" }, { status: 404 });
    }

    // Strip HTML for analysis if html format
    const plainBody =
      post.content_format === "html"
        ? (post.original_body as string)
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .trim()
        : (post.original_body as string);

    // 2. Fetch existing top topics for LLM context
    const { data: existingTopics } = await supabase
      .from("topics")
      .select("slug, kind, canonical_label")
      .order("created_at", { ascending: true })
      .limit(300);

    const topicSlugs = (existingTopics ?? []).map(
      (t: { slug: string; kind: string; canonical_label: string }) =>
        `${t.slug} (${t.kind}: ${t.canonical_label})`
    );

    // 3. Call LLM
    const prompt = buildPrompt(
      post.original_title as string,
      plainBody.slice(0, 2000),
      topicSlugs,
    );

    const llmResult = await callOpenAI(prompt);
    if (!llmResult || !llmResult.topics || llmResult.topics.length === 0) {
      // Mark as done even if no topics extracted
      await supabase.from("posts").update({ auto_tag_status: "done" }).eq("id", postId);
      return NextResponse.json({ tagged: 0 });
    }

    // 4. Upsert topics + link to post
    let taggedCount = 0;

    for (const topic of llmResult.topics.slice(0, 5)) {
      // Normalize slug
      const slug = topic.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      if (!slug) continue;

      // Upsert topic
      const { data: upserted } = await supabase
        .from("topics")
        .upsert(
          {
            slug,
            kind: topic.kind,
            canonical_label: topic.canonical_label,
            labels: topic.labels,
          },
          { onConflict: "slug" },
        )
        .select("id")
        .single();

      if (!upserted) continue;

      // Insert content_topics (ignore conflict)
      await supabase.from("content_topics").upsert(
        {
          topic_id: upserted.id,
          target_type: "post" as const,
          target_id: postId,
          source: "llm" as const,
          confidence: topic.confidence ?? 0.8,
          model: "gpt-4o-mini",
        },
        { onConflict: "topic_id,target_type,target_id,source" },
      );

      taggedCount++;
    }

    // 5. Update post status
    await supabase.from("posts").update({ auto_tag_status: "done" }).eq("id", postId);

    return NextResponse.json({ tagged: taggedCount });
  } catch (err) {
    console.error("[auto-tag]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

/* ─── LLM prompt ─── */
function buildPrompt(title: string, body: string, existingSlugs: string[]): string {
  return `You are a topic tagging engine for a social media platform called "moment." that covers crypto, finance, sports, politics, gaming, tech, and culture.

Analyze the post below and extract 1–5 relevant topics.

## Rules
1. PREFER matching to existing topics from the list below. Use the EXACT slug.
2. Only create a new topic if nothing in the existing list matches.
3. New topics must use lowercase English slugs with hyphens (e.g., "spot-bitcoin-etf").
4. New topics MUST include labels in all 3 languages: ko, en, es.
5. Assign kind: "category" (broad), "entity" (proper noun: company, person, league), or "ai_keyword" (specific concept).
6. Avoid overly generic topics (e.g., "news", "post", "update").
7. Avoid overly specific topics (e.g., "bitcoin-price-may-21-2026").
8. Each topic should have a confidence score (0.0–1.0).

## Existing Topics (slug — kind: label)
${existingSlugs.slice(0, 200).join("\n")}

## Post to Analyze
Title: ${title}
Body: ${body}

## Response Format (JSON only, no markdown)
{"topics":[{"slug":"bitcoin","kind":"entity","canonical_label":"Bitcoin","labels":{"ko":"비트코인","en":"Bitcoin","es":"Bitcoin"},"confidence":0.95}]}`;
}

/* ─── OpenAI call ─── */
async function callOpenAI(prompt: string): Promise<LLMResponse | null> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    console.error("[auto-tag] OpenAI error:", response.status, await response.text());
    return null;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content) as LLMResponse;
  } catch {
    console.error("[auto-tag] Failed to parse LLM response:", content);
    return null;
  }
}
