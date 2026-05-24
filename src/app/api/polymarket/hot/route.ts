export type PolymarketHotMarket = {
  id: string;
  question: string;
  slug: string | null;
  url: string | null;
  outcomes: string[];
  volume: number | null;
  endDate: string | null;
};

const fallbackMarkets: PolymarketHotMarket[] = [];

export async function GET() {
  try {
    const response = await fetch(
      "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=12&order=volumeNum&ascending=false",
      { next: { revalidate: 300 } },
    );

    if (!response.ok) {
      return Response.json({ markets: fallbackMarkets, source: "fallback" });
    }

    const data = (await response.json()) as unknown[];
    const markets = data
      .map(mapGammaMarket)
      .filter((market): market is PolymarketHotMarket => Boolean(market))
      .slice(0, 8);

    return Response.json({
      markets: markets.length > 0 ? markets : fallbackMarkets,
      source: markets.length > 0 ? "polymarket" : "fallback",
    });
  } catch {
    return Response.json({ markets: fallbackMarkets, source: "fallback" });
  }
}

function mapGammaMarket(value: unknown): PolymarketHotMarket | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const market = value as Record<string, unknown>;
  const question = stringValue(market.question);

  if (!question) {
    return null;
  }

  const slug = stringValue(market.slug);

  return {
    id: stringValue(market.id) || slug || question,
    question,
    slug,
    url: slug ? `https://polymarket.com/event/${slug}` : null,
    outcomes: parseOutcomes(market.outcomes),
    volume: numberValue(market.volumeNum ?? market.volume),
    endDate: stringValue(market.endDate ?? market.end_date),
  };
}

function parseOutcomes(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean).slice(0, 12);
  }

  if (typeof value !== "string") {
    return ["YES", "NO"];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.map(String).filter(Boolean).slice(0, 12)
      : ["YES", "NO"];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}
