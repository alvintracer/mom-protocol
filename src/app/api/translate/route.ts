/**
 * Lightweight translation API using Google Translate's free endpoint.
 * Results are cached in-memory (Map) so the same text is never translated twice.
 *
 * GET /api/translate?text=Hello&target=ko
 * POST /api/translate  { texts: ["Hello", "World"], target: "ko" }
 *
 * Supported targets: ko, en, es, ja, zh, fr, de, ...
 * No API key required (uses unofficial translate.googleapis.com).
 */

// In-memory cache: key = `${target}:${text}` → translated string
const translationCache = new Map<string, string>();

// Max cache size to prevent memory leaks
const MAX_CACHE_SIZE = 2000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text")?.trim();
  const target = searchParams.get("target")?.trim() || "ko";

  if (!text) {
    return Response.json({ error: "Missing text parameter" }, { status: 400 });
  }

  const translated = await translateText(text, target);

  return Response.json({
    original: text,
    translated,
    target,
    cached: translationCache.has(`${target}:${text}`),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      texts?: string[];
      target?: string;
    };

    const texts = body.texts ?? [];
    const target = body.target?.trim() || "ko";

    if (!Array.isArray(texts) || texts.length === 0) {
      return Response.json(
        { error: "Missing texts array" },
        { status: 400 },
      );
    }

    // Limit batch size
    const batch = texts.slice(0, 50);

    const results = await Promise.all(
      batch.map(async (text) => {
        const translated = await translateText(text, target);
        return { original: text, translated };
      }),
    );

    return Response.json({ results, target });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

async function translateText(
  text: string,
  target: string,
): Promise<string> {
  if (!text.trim()) return text;

  // Don't translate if target is English and text looks English
  if (target === "en") return text;

  const cacheKey = `${target}:${text}`;

  // Check cache first
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "auto"); // auto-detect source language
    url.searchParams.set("tl", target);
    url.searchParams.set("dt", "t"); // return translated text
    url.searchParams.set("q", text);

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.warn(`Translation failed for: "${text}" → ${response.status}`);
      return text;
    }

    // Response format: [[["translated text","original text",null,null,10]],null,"en"]
    const data = (await response.json()) as unknown[][];

    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      return text;
    }

    // Concatenate all translated segments
    const translated = (data[0] as unknown[][])
      .map((segment) => (Array.isArray(segment) ? String(segment[0]) : ""))
      .join("");

    if (!translated.trim()) return text;

    // Store in cache
    if (translationCache.size >= MAX_CACHE_SIZE) {
      // Evict oldest entries (first 500)
      const keys = Array.from(translationCache.keys()).slice(0, 500);
      for (const key of keys) {
        translationCache.delete(key);
      }
    }
    translationCache.set(cacheKey, translated);

    return translated;
  } catch (err) {
    console.warn(`Translation error for: "${text}"`, err);
    return text; // Return original on failure
  }
}
