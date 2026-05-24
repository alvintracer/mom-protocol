/**
 * Lightweight Google Translate proxy.
 * Uses the free Google Translate endpoint (no API key required).
 *
 * Query params:
 *   text — text to translate (max 2000 chars)
 *   to   — target language code (e.g. "ko", "es", "en")
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text")?.trim();
  const to = searchParams.get("to")?.trim() || "ko";

  if (!text || text.length > 2000) {
    return Response.json({ translated: text ?? "" });
  }

  // Skip translation if already in target language or text is too short
  if (text.length < 3) {
    return Response.json({ translated: text });
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (!res.ok) {
      return Response.json({ translated: text });
    }

    const data = (await res.json()) as unknown;

    // Google returns [[["translated","original",...],...],...] structure
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = (data[0] as unknown[][])
        .map((segment) => (Array.isArray(segment) ? String(segment[0]) : ""))
        .join("");
      return Response.json({ translated: translated || text });
    }

    return Response.json({ translated: text });
  } catch {
    return Response.json({ translated: text });
  }
}
