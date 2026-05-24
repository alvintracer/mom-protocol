/**
 * Resolve metadata from a prediction market URL.
 * Supports: Polymarket, Manifold, Kalshi.
 *
 * Query params:
 *   url — The market URL to resolve
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim();

  if (!rawUrl) {
    return Response.json({ error: "url required" }, { status: 400 });
  }

  let hostname: string;
  let pathname: string;
  try {
    const parsed = new URL(rawUrl);
    hostname = parsed.hostname.replace(/^www\./, "");
    pathname = parsed.pathname;
  } catch {
    return Response.json({ error: "invalid url" }, { status: 400 });
  }

  try {
    if (hostname.includes("polymarket")) {
      const result = await resolvePolymarket(pathname);
      return Response.json(result);
    }

    if (hostname.includes("manifold")) {
      const result = await resolveManifold(pathname);
      return Response.json(result);
    }

    if (hostname.includes("kalshi")) {
      const result = await resolveKalshi(pathname);
      return Response.json(result);
    }

    return Response.json({
      platform: hostname,
      title: null,
      outcomes: [],
      volume: null,
      endDate: null,
    });
  } catch {
    return Response.json({
      platform: hostname,
      title: null,
      outcomes: [],
      volume: null,
      endDate: null,
    });
  }
}

/* ─── Polymarket ─── */
async function resolvePolymarket(pathname: string) {
  // URL patterns:
  //   /event/{slug}
  //   /ko/event/{slug}
  //   /{lang}/event/{slug}
  const segments = pathname.split("/").filter(Boolean);
  // Remove language prefix if present (e.g., "ko", "en", "es")
  const eventIdx = segments.indexOf("event");
  const slug = eventIdx >= 0 ? segments[eventIdx + 1] : segments.at(-1);

  if (!slug) {
    return { platform: "Polymarket", title: null, outcomes: [], volume: null, endDate: null };
  }

  // Search by slug via Gamma API
  const res = await fetch(
    `https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}&limit=1`,
    { next: { revalidate: 60 } },
  );

  if (!res.ok) {
    // Try searching by slug as keyword
    const fallbackRes = await fetch(
      `https://gamma-api.polymarket.com/markets?_q=${encodeURIComponent(slug)}&limit=1`,
      { next: { revalidate: 60 } },
    );
    if (!fallbackRes.ok) {
      return { platform: "Polymarket", title: slug, outcomes: ["YES", "NO"], volume: null, endDate: null };
    }
    const fallbackData = (await fallbackRes.json()) as Record<string, unknown>[];
    if (!fallbackData.length) {
      return { platform: "Polymarket", title: slug, outcomes: ["YES", "NO"], volume: null, endDate: null };
    }
    return mapPolymarketResult(fallbackData[0]);
  }

  const data = (await res.json()) as Record<string, unknown>[];
  if (!data.length) {
    // Try condition_id or event search
    const eventRes = await fetch(
      `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}&limit=1`,
      { next: { revalidate: 60 } },
    );
    if (eventRes.ok) {
      const eventData = (await eventRes.json()) as Record<string, unknown>[];
      if (eventData.length) {
        const event = eventData[0];
        const markets = Array.isArray(event.markets) ? event.markets as Record<string, unknown>[] : [];
        const firstMarket = markets[0];
        return {
          platform: "Polymarket",
          title: str(event.title) || str(firstMarket?.question) || slug,
          description: str(event.description) || str(firstMarket?.description),
          outcomes: firstMarket ? parseOutcomes(firstMarket.outcomes) : ["YES", "NO"],
          volume: markets.reduce((sum, m) => sum + (num(m.volumeNum ?? m.volume) ?? 0), 0) || null,
          endDate: str(firstMarket?.endDate ?? firstMarket?.end_date),
          oracleType: "UMA reference",
          subMarketCount: markets.length,
        };
      }
    }
    return { platform: "Polymarket", title: slug, outcomes: ["YES", "NO"], volume: null, endDate: null };
  }

  return mapPolymarketResult(data[0]);
}

function mapPolymarketResult(m: Record<string, unknown>) {
  return {
    platform: "Polymarket",
    title: str(m.question) || str(m.title),
    description: str(m.description),
    outcomes: parseOutcomes(m.outcomes),
    volume: num(m.volumeNum ?? m.volume),
    endDate: str(m.endDate ?? m.end_date),
    oracleType: "UMA reference",
  };
}

/* ─── Manifold ─── */
async function resolveManifold(pathname: string) {
  // URL: /username/slug
  const segments = pathname.split("/").filter(Boolean);
  const slug = segments.at(-1);

  if (!slug) {
    return { platform: "Manifold", title: null, outcomes: [], volume: null, endDate: null };
  }

  const res = await fetch(
    `https://api.manifold.markets/v0/slug/${encodeURIComponent(slug)}`,
    { next: { revalidate: 60 } },
  );

  if (!res.ok) {
    return { platform: "Manifold", title: slug, outcomes: ["YES", "NO"], volume: null, endDate: null };
  }

  const m = (await res.json()) as Record<string, unknown>;
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

  return {
    platform: "Manifold",
    title: str(m.question),
    description: str(m.description),
    outcomes,
    volume: num(m.totalLiquidity ?? m.volume),
    endDate: m.closeTime ? new Date(Number(m.closeTime)).toISOString() : null,
    oracleType: "Community resolution",
  };
}

/* ─── Kalshi ─── */
async function resolveKalshi(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const ticker = segments.at(-1)?.toUpperCase();

  if (!ticker) {
    return { platform: "Kalshi", title: null, outcomes: [], volume: null, endDate: null };
  }

  const res = await fetch(
    `https://api.elections.kalshi.com/trade-api/v2/events/${encodeURIComponent(ticker)}?with_nested_markets=true`,
    { next: { revalidate: 120 } },
  );

  if (!res.ok) {
    return { platform: "Kalshi", title: ticker, outcomes: ["YES", "NO"], volume: null, endDate: null };
  }

  const data = (await res.json()) as { event?: Record<string, unknown> };
  const e = data.event;
  if (!e) {
    return { platform: "Kalshi", title: ticker, outcomes: ["YES", "NO"], volume: null, endDate: null };
  }

  let outcomes: string[] = ["YES", "NO"];
  let volume: number | null = null;
  let endDate: string | null = null;

  if (Array.isArray(e.markets) && (e.markets as unknown[]).length > 0) {
    const markets = e.markets as Record<string, unknown>[];
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
    platform: "Kalshi",
    title: str(e.title),
    description: str(e.description),
    outcomes,
    volume,
    endDate,
    oracleType: "Kalshi settlement",
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
