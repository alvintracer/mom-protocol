/**
 * Unified trending markets API.
 * Fetches hot/popular markets from Polymarket (events-level),
 * Manifold, and Kalshi in parallel — no API keys required.
 *
 * GET /api/markets/trending
 * Query params:
 *   limit   — max results per platform (default: 4, max: 8)
 *   sort    — "volume" | "newest" | "ending_soon" (default: volume)
 *   sources — comma-separated: "polymarket,manifold,kalshi" (default: all)
 */

export type TrendingMarket = {
  id: string;
  question: string;
  slug: string | null;
  url: string | null;
  outcomes: string[];
  volume: number | null;
  endDate: string | null;
  platform: "polymarket" | "manifold" | "kalshi";
  /** Number of sub-markets in this event (Polymarket negRisk events) */
  subMarketCount?: number;
  /** Thumbnail image URL */
  image?: string | null;
  /** When the market was created (ISO) */
  createdAt?: string | null;
};

type SortMode = "newest" | "volume" | "popular";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 4, 8);
  const sort = (searchParams.get("sort") ?? "volume") as SortMode;
  const sourcesRaw = searchParams.get("sources")?.toLowerCase() ?? "";

  const enabled = parseSources(sourcesRaw);

  const fetchers: Promise<TrendingMarket[]>[] = [];
  if (enabled.polymarket) fetchers.push(fetchPolymarketEvents(limit, sort));
  if (enabled.manifold) fetchers.push(fetchManifoldTrending(limit, sort));
  if (enabled.kalshi) fetchers.push(fetchKalshiEvents(limit, sort));

  const results = await Promise.allSettled(fetchers);
  const markets = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  );

  // Client-side final sort
  sortMarkets(markets, sort);

  return Response.json({
    markets: markets.slice(0, limit * 3),
    sources: {
      polymarket: enabled.polymarket,
      manifold: enabled.manifold,
      kalshi: enabled.kalshi,
    },
    sort,
  });
}

function parseSources(raw: string) {
  if (!raw) return { polymarket: true, manifold: true, kalshi: true };
  const parts = raw.split(",").map((s) => s.trim());
  return {
    polymarket: parts.includes("polymarket"),
    manifold: parts.includes("manifold"),
    kalshi: parts.includes("kalshi"),
  };
}

function sortMarkets(markets: TrendingMarket[], sort: SortMode) {
  switch (sort) {
    case "newest":
      markets.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
      break;
    case "popular":
      // Popular = high volume, but keep platform-native "popular" ordering
      markets.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      break;
    case "volume":
    default:
      markets.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
      break;
  }
}

/* ─── Polymarket: Use /events endpoint for multi-outcome support ─── */
async function fetchPolymarketEvents(
  limit: number,
  sort: SortMode,
): Promise<TrendingMarket[]> {
  try {
    // Map our sort to Polymarket Gamma API params
    // popular → use num_traders for most-participated markets
    const orderParam = sort === "newest" ? "startDate" : sort === "popular" ? "num_traders" : "volume";
    const ascParam = "false";

    const response = await fetch(
      `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=${limit}&order=${orderParam}&ascending=${ascParam}`,
      { next: { revalidate: 300 } },
    );

    if (!response.ok) return [];

    const data = (await response.json()) as unknown[];
    if (!Array.isArray(data)) return [];

    return data
      .map((item) => mapPolymarketEvent(item))
      .filter((m): m is TrendingMarket => m !== null);
  } catch {
    return [];
  }
}

function mapPolymarketEvent(value: unknown): TrendingMarket | null {
  if (!value || typeof value !== "object") return null;

  const e = value as Record<string, unknown>;
  const title = str(e.title);
  if (!title) return null;

  const slug = str(e.slug);
  const image = str(e.image ?? e.icon);

  // Events contain nested markets array
  const nestedMarkets = Array.isArray(e.markets)
    ? (e.markets as Record<string, unknown>[])
    : [];

  // Build outcomes from sub-market groupItemTitle (for multi-outcome events)
  let outcomes: string[];
  if (nestedMarkets.length > 1) {
    outcomes = nestedMarkets
      .map((m) => str(m.groupItemTitle) ?? str(m.question) ?? "")
      .filter(Boolean)
      .slice(0, 12);
  } else if (nestedMarkets.length === 1) {
    outcomes = parseOutcomes(nestedMarkets[0].outcomes);
  } else {
    outcomes = ["YES", "NO"];
  }

  const volume = num(e.volume) ?? num(e.volume1yr);
  const endDate = str(e.endDate);
  const createdAt = str(e.createdAt ?? e.startDate);

  return {
    id: str(e.id) || slug || title,
    question: title,
    slug,
    url: slug ? `https://polymarket.com/event/${slug}` : null,
    outcomes,
    volume,
    endDate,
    platform: "polymarket",
    subMarketCount: nestedMarkets.length,
    image,
    createdAt,
  };
}

/* ─── Manifold Markets: Use search with empty term for trending ─── */
async function fetchManifoldTrending(
  limit: number,
  sort: SortMode,
): Promise<TrendingMarket[]> {
  try {
    // Manifold sort options: "liquidity", "newest", "close-date", "score"
    const manifoldSort =
      sort === "newest"
        ? "newest"
        : sort === "popular"
          ? "score"
          : "liquidity";

    const response = await fetch(
      `https://api.manifold.markets/v0/search-markets?term=&sort=${manifoldSort}&filter=open&limit=${limit}`,
      { next: { revalidate: 300 } },
    );

    if (!response.ok) return [];

    const data = (await response.json()) as unknown[];
    if (!Array.isArray(data)) return [];

    return data
      .map((item) => mapManifoldMarket(item))
      .filter((m): m is TrendingMarket => m !== null);
  } catch {
    return [];
  }
}

function mapManifoldMarket(value: unknown): TrendingMarket | null {
  if (!value || typeof value !== "object") return null;

  const m = value as Record<string, unknown>;
  const question = str(m.question);
  if (!question) return null;

  const slug = str(m.slug);
  const creatorUsername = str(m.creatorUsername);

  let outcomes: string[];
  const outcomeType = str(m.outcomeType);

  if (outcomeType === "MULTIPLE_CHOICE" && Array.isArray(m.answers)) {
    outcomes = (m.answers as Record<string, unknown>[])
      .map((a) => str(a.text) ?? "")
      .filter(Boolean)
      .slice(0, 12);
  } else if (outcomeType === "PSEUDO_NUMERIC") {
    const min = num(m.min);
    const max = num(m.max);
    const current = num(m.value);
    outcomes = current !== null ? [`~${Math.round(current)}`] : [];
    if (min !== null && max !== null) {
      outcomes.push(`${min}–${max}`);
    }
  } else {
    outcomes = ["YES", "NO"];
  }

  const url =
    str(m.url) ??
    (creatorUsername && slug
      ? `https://manifold.markets/${creatorUsername}/${slug}`
      : null);

  const createdAt = m.createdTime
    ? new Date(Number(m.createdTime)).toISOString()
    : null;

  return {
    id: str(m.id) || slug || question,
    question,
    slug,
    url,
    outcomes,
    volume: num(m.volume) ?? num(m.totalLiquidity),
    endDate: m.closeTime ? new Date(Number(m.closeTime)).toISOString() : null,
    platform: "manifold",
    image: null,
    createdAt,
  };
}

/* ─── Kalshi: Use events endpoint ─── */
async function fetchKalshiEvents(
  limit: number,
  _sort: SortMode,
): Promise<TrendingMarket[]> {
  try {
    const response = await fetch(
      `https://api.elections.kalshi.com/trade-api/v2/events?status=open&with_nested_markets=true&limit=${limit}`,
      { next: { revalidate: 300 } },
    );

    if (!response.ok) return [];

    const data = (await response.json()) as { events?: unknown[] };
    if (!Array.isArray(data.events)) return [];

    return data.events
      .map((event) => mapKalshiEvent(event))
      .filter((m): m is TrendingMarket => m !== null);
  } catch {
    return [];
  }
}

function mapKalshiEvent(value: unknown): TrendingMarket | null {
  if (!value || typeof value !== "object") return null;

  const e = value as Record<string, unknown>;
  const title = str(e.title);
  if (!title) return null;

  const ticker = str(e.event_ticker ?? e.ticker);

  let outcomes: string[] = ["YES", "NO"];
  let volume: number | null = null;
  let endDate: string | null = null;
  let subMarketCount = 1;

  if (Array.isArray(e.markets) && (e.markets as unknown[]).length > 0) {
    const markets = e.markets as Record<string, unknown>[];
    subMarketCount = markets.length;
    volume = markets.reduce((sum, m) => sum + (num(m.volume) ?? 0), 0) || null;
    endDate = str(markets[0]?.close_time ?? markets[0]?.expiration_time);
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
    subMarketCount,
    image: null,
    createdAt: null,
  };
}

/* ─── Helpers ─── */
function parseOutcomes(value: unknown) {
  if (Array.isArray(value))
    return value.map(String).filter(Boolean).slice(0, 12);
  if (typeof value !== "string") return ["YES", "NO"];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.map(String).filter(Boolean).slice(0, 12)
      : ["YES", "NO"];
  } catch {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);
  }
}

function str(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
