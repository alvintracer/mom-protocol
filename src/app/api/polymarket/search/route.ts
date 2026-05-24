import type { PolymarketHotMarket } from "@/app/api/polymarket/hot/route";

/**
 * Unified prediction market search API.
 * Searches Polymarket, Manifold, and Kalshi in parallel.
 *
 * Auth requirements:
 * - Polymarket Gamma API: No key needed (public read-only)
 * - Manifold Markets API: No key needed (public read-only)
 * - Kalshi Trade API: No key needed for public market listing
 *
 * Query params:
 *   q      — search keyword (min 2 chars)
 *   source — optional, comma-separated: "polymarket,manifold,kalshi" (default: all)
 */

export type UnifiedMarket = PolymarketHotMarket & {
  platform: "polymarket" | "manifold" | "kalshi";
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const sourceFilter = searchParams.get("source")?.toLowerCase() ?? "";

  if (!query || query.length < 2) {
    return Response.json({ markets: [], source: "empty" });
  }

  const enabledSources = parseSourceFilter(sourceFilter);

  const fetchers: Promise<UnifiedMarket[]>[] = [];

  if (enabledSources.polymarket) {
    fetchers.push(searchPolymarket(query));
  }
  if (enabledSources.manifold) {
    fetchers.push(searchManifold(query));
  }
  if (enabledSources.kalshi) {
    fetchers.push(searchKalshi(query));
  }

  const results = await Promise.allSettled(fetchers);
  const markets = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );

  // Score by relevance: title match + volume
  const lowerQ = query.toLowerCase();
  markets.sort((a, b) => {
    const aTitle = a.question.toLowerCase();
    const bTitle = b.question.toLowerCase();
    // Exact keyword match in title gets priority
    const aMatch = aTitle.includes(lowerQ) ? 1 : 0;
    const bMatch = bTitle.includes(lowerQ) ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    // Then by volume
    return (b.volume ?? 0) - (a.volume ?? 0);
  });

  return Response.json({
    markets: markets.slice(0, 15),
    source: "unified",
  });
}

function parseSourceFilter(filter: string) {
  if (!filter) return { polymarket: true, manifold: true, kalshi: true };

  const parts = filter.split(",").map((s) => s.trim());
  return {
    polymarket: parts.includes("polymarket"),
    manifold: parts.includes("manifold"),
    kalshi: parts.includes("kalshi"),
  };
}

/* ─── Polymarket (Gamma API — no auth) ─── */
async function searchPolymarket(query: string): Promise<UnifiedMarket[]> {
  try {
    const response = await fetch(
      `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=8&order=volumeNum&ascending=false&_q=${encodeURIComponent(query)}`,
      { next: { revalidate: 60 } },
    );

    if (!response.ok) return [];

    const data = (await response.json()) as unknown[];
    return data
      .map((item) => mapGammaMarket(item))
      .filter((m): m is UnifiedMarket => m !== null)
      .slice(0, 6);
  } catch {
    return [];
  }
}

function mapGammaMarket(value: unknown): UnifiedMarket | null {
  if (!value || typeof value !== "object") return null;

  const m = value as Record<string, unknown>;
  const question = str(m.question);
  if (!question) return null;

  const slug = str(m.slug);

  return {
    id: str(m.id) || slug || question,
    question,
    slug,
    url: slug ? `https://polymarket.com/event/${slug}` : null,
    outcomes: parseOutcomes(m.outcomes),
    volume: num(m.volumeNum ?? m.volume),
    endDate: str(m.endDate ?? m.end_date),
    platform: "polymarket",
  };
}

/* ─── Manifold Markets (public, no auth) ─── */
async function searchManifold(query: string): Promise<UnifiedMarket[]> {
  try {
    const response = await fetch(
      `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(query)}&sort=liquidity&filter=open&limit=6`,
      { next: { revalidate: 60 } },
    );

    if (!response.ok) return [];

    const data = (await response.json()) as unknown[];
    if (!Array.isArray(data)) return [];

    return data
      .map((item) => mapManifoldMarket(item))
      .filter((m): m is UnifiedMarket => m !== null)
      .slice(0, 6);
  } catch {
    return [];
  }
}

function mapManifoldMarket(value: unknown): UnifiedMarket | null {
  if (!value || typeof value !== "object") return null;

  const m = value as Record<string, unknown>;
  const question = str(m.question);
  if (!question) return null;

  const slug = str(m.slug);
  const creatorUsername = str(m.creatorUsername);

  // Manifold outcomes: binary has YES/NO, multi-choice has "answers" array
  let outcomes: string[];
  if (m.outcomeType === "BINARY" || !m.outcomeType) {
    outcomes = ["YES", "NO"];
  } else if (Array.isArray(m.answers)) {
    outcomes = (m.answers as Record<string, unknown>[])
      .map((a) => str(a.text) ?? "")
      .filter(Boolean)
      .slice(0, 12);
  } else {
    outcomes = ["YES", "NO"];
  }

  const url =
    creatorUsername && slug
      ? `https://manifold.markets/${creatorUsername}/${slug}`
      : null;

  return {
    id: str(m.id) || slug || question,
    question,
    slug,
    url,
    outcomes,
    volume: num(m.totalLiquidity ?? m.volume),
    endDate: str(m.closeTime) ? new Date(Number(m.closeTime)).toISOString() : null,
    platform: "manifold",
  };
}

/* ─── Kalshi (public trade API — no auth for market listing) ─── */
async function searchKalshi(query: string): Promise<UnifiedMarket[]> {
  try {
    const response = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/events?status=open&with_nested_markets=true&limit=6`,
      { next: { revalidate: 120 } },
    );

    if (!response.ok) return [];

    const data = (await response.json()) as { events?: unknown[] };
    if (!Array.isArray(data.events)) return [];

    // Client-side text filter since Kalshi API doesn't have a search param
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matched = data.events.filter((event) => {
      if (!event || typeof event !== "object") return false;
      const e = event as Record<string, unknown>;
      const title = str(e.title)?.toLowerCase() ?? "";
      // Every query word must appear in the title
      return queryWords.every((w) => title.includes(w));
    });

    return matched
      .map((event) => mapKalshiEvent(event))
      .filter((m): m is UnifiedMarket => m !== null)
      .slice(0, 4);
  } catch {
    return [];
  }
}

function mapKalshiEvent(value: unknown): UnifiedMarket | null {
  if (!value || typeof value !== "object") return null;

  const e = value as Record<string, unknown>;
  const title = str(e.title);
  if (!title) return null;

  const ticker = str(e.event_ticker ?? e.ticker);

  // Kalshi markets are nested under events
  let outcomes: string[] = ["YES", "NO"];
  let volume: number | null = null;
  let endDate: string | null = null;

  if (Array.isArray(e.markets) && (e.markets as unknown[]).length > 0) {
    const markets = e.markets as Record<string, unknown>[];
    // Get total volume across all sub-markets
    volume = markets.reduce((sum, m) => sum + (num(m.volume) ?? 0), 0) || null;
    // Get end date from first market
    endDate = str(markets[0]?.close_time ?? markets[0]?.expiration_time);
    // If multi-market event, extract subtitles as outcomes
    if (markets.length > 1) {
      outcomes = markets
        .map((m) => str(m.subtitle ?? m.title) ?? "")
        .filter(Boolean)
        .slice(0, 12);
    }
  }

  return {
    id: ticker || title,
    question: title,
    slug: ticker,
    url: ticker ? `https://kalshi.com/markets/${ticker.toLowerCase()}` : null,
    outcomes,
    volume,
    endDate,
    platform: "kalshi",
  };
}

/* ─── Helpers ─── */
function parseOutcomes(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).slice(0, 12);
  if (typeof value !== "string") return ["YES", "NO"];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 12) : ["YES", "NO"];
  } catch {
    return value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12);
  }
}

function str(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
