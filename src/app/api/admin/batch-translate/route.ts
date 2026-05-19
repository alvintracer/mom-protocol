import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import { ADMIN_COOKIE_NAME, isValidAdminSession } from "@/shared/lib/admin/session";

/* ── Config ─────────────────────────────────────────────────── */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const BATCH_SIZE = 50;
const TARGET_LANGUAGES = ["ko", "en", "es"] as const;
const MODEL = "gpt-4o-mini";

/* ── Types ──────────────────────────────────────────────────── */

type ContentRow = {
  id: string;
  type: "post" | "comment" | "event" | "attention";
  original_language: string;
  original_title?: string | null;
  original_body: string;
};

type TranslationResult = {
  id: string;
  translations: Record<string, { title?: string; body: string }>;
};

/* ── POST /api/admin/batch-translate ────────────────────────── */

export async function POST() {
  const cookieStore = await cookies();
  if (!isValidAdminSession(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const batch: ContentRow[] = [];
  let remaining = BATCH_SIZE;

  // ── 1. Posts ──────────────────────────────────────────────
  const { data: posts } = await supabase
    .from("posts")
    .select("id, original_language, original_title, original_body")
    .eq("translation_status", "pending")
    .eq("is_deleted", false)
    .order("created_at", { ascending: true })
    .limit(remaining);

  for (const p of posts ?? []) {
    batch.push({
      id: p.id,
      type: "post",
      original_language: p.original_language,
      original_title: p.original_title,
      original_body: p.original_body,
    });
  }
  remaining = BATCH_SIZE - batch.length;

  // ── 1b. Posts with incomplete translations (marked translated but missing languages) ──
  if (remaining > 0) {
    const expectedLangs = TARGET_LANGUAGES.length - 1; // each post needs translations in all langs except its own
    const { data: incompletePosts } = await supabase
      .from("posts")
      .select("id, original_language, original_title, original_body")
      .eq("translation_status", "translated")
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(remaining * 2); // fetch more, we'll filter

    const alreadyInBatch = new Set(batch.map((b) => b.id));
    for (const p of incompletePosts ?? []) {
      if (alreadyInBatch.has(p.id)) continue;
      // Check if this post has all required translations
      const { count } = await supabase
        .from("post_translations")
        .select("id", { count: "exact", head: true })
        .eq("post_id", p.id);

      if ((count ?? 0) < expectedLangs) {
        batch.push({
          id: p.id,
          type: "post",
          original_language: p.original_language,
          original_title: p.original_title,
          original_body: p.original_body,
        });
        remaining = BATCH_SIZE - batch.length;
        if (remaining <= 0) break;
      }
    }
  }
  remaining = BATCH_SIZE - batch.length;

  // ── 2. Comments ──────────────────────────────────────────
  if (remaining > 0) {
    const { data: comments } = await supabase
      .from("comments")
      .select("id, original_language, original_body")
      .eq("translation_status", "pending")
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(remaining);

    for (const c of comments ?? []) {
      batch.push({
        id: c.id,
        type: "comment",
        original_language: c.original_language,
        original_body: c.original_body,
      });
    }
    remaining = BATCH_SIZE - batch.length;
  }

  // ── 3. Events (missing translations) ─────────────────────
  if (remaining > 0) {
    const { data: events } = await supabase
      .from("events")
      .select("id, original_language, title, description")
      .not("status", "eq", "archived")
      .order("created_at", { ascending: true })
      .limit(remaining);

    for (const e of events ?? []) {
      // Check if translations exist for this event
      const { count } = await supabase
        .from("event_translations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", e.id);

      const expectedTranslations = TARGET_LANGUAGES.length - 1; // minus original
      if ((count ?? 0) < expectedTranslations) {
        batch.push({
          id: e.id,
          type: "event",
          original_language: e.original_language,
          original_title: e.title,
          original_body: e.description ?? e.title,
        });
        remaining = BATCH_SIZE - batch.length;
        if (remaining <= 0) break;
      }
    }
  }

  // ── 4. Attention Clusters (missing translations → store in event_translations via canonical_event_id) ──
  // Attention clusters have title/description but no dedicated translation table.
  // We translate them as "event" type since they're linked via canonical_event_id.
  // The translated title/description will be stored in event_translations for the linked event.
  if (remaining > 0) {
    const { data: clusters } = await supabase
      .from("attention_clusters")
      .select("id, original_language, title, description, canonical_event_id")
      .in("status", ["active", "reviewing"])
      .not("canonical_event_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(remaining);

    for (const ac of clusters ?? []) {
      if (!ac.canonical_event_id) continue;
      // Check if event already has translations
      const { count } = await supabase
        .from("event_translations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", ac.canonical_event_id);

      const expectedTranslations = TARGET_LANGUAGES.length - 1;
      if ((count ?? 0) < expectedTranslations) {
        batch.push({
          id: ac.canonical_event_id, // use event id for storage
          type: "event", // store in event_translations
          original_language: ac.original_language,
          original_title: ac.title,
          original_body: ac.description ?? ac.title,
        });
        remaining = BATCH_SIZE - batch.length;
        if (remaining <= 0) break;
      }
    }
  }

  if (batch.length === 0) {
    return NextResponse.json({ message: "No pending translations", translated: 0 });
  }

  // ── 5. Build GPT prompt ──────────────────────────────────
  // Add explicit target languages per item so GPT knows exactly what to produce
  const inputItems = batch.map((item) => {
    const missing = TARGET_LANGUAGES.filter((l) => l !== item.original_language);
    return {
      id: item.id,
      type: item.type,
      lang: item.original_language,
      translate_to: missing,
      ...(item.original_title ? { title: item.original_title } : {}),
      body: item.original_body,
    };
  });

  const systemPrompt = `You are a translation engine for the social platform "momment."
For each item, translate into ALL languages listed in its "translate_to" array.
You MUST produce a translation for EVERY language in "translate_to". Do NOT skip any.

Rules:
- Keep the tone natural and conversational (social media style).
- Preserve URLs, @mentions, #hashtags, and emoji exactly as-is.
- If an item has a "title" field, translate it separately.
- If the body is very short (1-2 words), still translate it.

Return a JSON object:
{
  "items": [
    {
      "id": "<item id>",
      "translations": {
        "<lang>": { "title": "<translated title if exists>", "body": "<translated body>" }
      }
    }
  ]
}

CRITICAL: Every item MUST have translations for ALL languages in its "translate_to" array.
Return ONLY the JSON object.`;

  // ── 6. Call GPT ──────────────────────────────────────────
  let results: TranslationResult[];
  try {
    const gptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(inputItems) },
        ],
      }),
    });

    if (!gptResponse.ok) {
      const errText = await gptResponse.text();
      return NextResponse.json({ error: "GPT API error", detail: errText }, { status: 502 });
    }

    const gptData = await gptResponse.json();
    const content = gptData.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    results = Array.isArray(parsed) ? parsed : (parsed.items ?? parsed.translations ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: "GPT parse error", detail: String(err) },
      { status: 500 },
    );
  }

  // ── 7. Upsert translations ──────────────────────────────
  let insertedCount = 0;
  const errors: string[] = [];

  for (const result of results) {
    const item = batch.find((b) => b.id === result.id);
    if (!item) continue;

    for (const [lang, translation] of Object.entries(result.translations)) {
      if (lang === item.original_language) continue;

      try {
        if (item.type === "post") {
          await supabase.from("post_translations").upsert(
            {
              post_id: item.id,
              source_version: 1,
              language: lang,
              title: translation.title ?? null,
              body: translation.body,
              status: "translated",
              provider: "llm",
              model: MODEL,
            },
            { onConflict: "post_id,source_version,language" },
          );
        } else if (item.type === "comment") {
          await supabase.from("comment_translations").upsert(
            {
              comment_id: item.id,
              source_version: 1,
              language: lang,
              body: translation.body,
              status: "translated",
              provider: "llm",
              model: MODEL,
            },
            { onConflict: "comment_id,source_version,language" },
          );
        } else if (item.type === "event") {
          await supabase.from("event_translations").upsert(
            {
              event_id: item.id,
              language: lang,
              title: translation.title ?? translation.body,
              description: translation.body,
              status: "translated",
              translated_by: "llm",
              model: MODEL,
            },
            { onConflict: "event_id,language" },
          );
        }
        insertedCount++;
      } catch (err) {
        errors.push(`${item.type}:${item.id}:${lang} - ${String(err)}`);
      }
    }

    // Mark source as translated
    if (item.type === "post") {
      await supabase
        .from("posts")
        .update({ translation_status: "translated" })
        .eq("id", item.id);
    } else if (item.type === "comment") {
      await supabase
        .from("comments")
        .update({ translation_status: "translated" })
        .eq("id", item.id);
    }
    // Events/attention don't have translation_status — tracked by event_translations count
  }

  // ── 8. Record batch ──────────────────────────────────────
  const contentTypes = [...new Set(batch.map((b) => b.type))];
  await supabase.from("translation_batches").insert({
    status: "completed",
    target_languages: TARGET_LANGUAGES,
    content_types: contentTypes,
    job_count: batch.length,
    completed_count: results.length,
    failed_count: errors.length,
    provider: "openai",
    model: MODEL,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  });

  // ── 9. Count remaining pending items ────────────────────
  const [{ count: remainPosts }, { count: remainComments }] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("translation_status", "pending").eq("is_deleted", false),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("translation_status", "pending").eq("is_deleted", false),
  ]);
  const remainingPending = (remainPosts ?? 0) + (remainComments ?? 0);

  return NextResponse.json({
    message: "Batch translation complete",
    batchSize: batch.length,
    contentTypes,
    translated: insertedCount,
    remainingPending,
    errors: errors.length > 0 ? errors : undefined,
  });
}
