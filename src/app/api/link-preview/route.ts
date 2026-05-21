import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; moment-link-preview/1.0)",
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch URL" }, { status: response.status });
    }

    const html = await response.text();

    // Parse Open Graph metadata using basic regex
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/i) || 
                         html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:title"[^>]*>/i);
    const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/i) ||
                        html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:description"[^>]*>/i);
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i) ||
                         html.match(/<meta[^>]*content="([^"]*)"[^>]*property="og:image"[^>]*>/i);
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);

    // Fallbacks
    const title = ogTitleMatch?.[1] || titleMatch?.[1] || "";
    const description = ogDescMatch?.[1] || "";
    const image = ogImageMatch?.[1] || "";

    // Decode HTML entities roughly
    const decode = (str: string) => str.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

    return NextResponse.json({
      title: decode(title),
      description: decode(description),
      image: image,
    });
  } catch (error) {
    return NextResponse.json({ error: "Error fetching metadata" }, { status: 500 });
  }
}
