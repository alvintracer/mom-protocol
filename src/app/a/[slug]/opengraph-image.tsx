import { ImageResponse } from "next/og";

import {
  createSeoSupabaseClient,
  safeDecodePathSegment,
} from "@/shared/lib/seo";

export const runtime = "edge";
export const alt = "momment. attention";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type AttentionOgRow = {
  title: string;
  description: string | null;
  category: string | null;
  attention_score: number;
  post_count: number;
  comment_count: number;
};

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lookupSlug = safeDecodePathSegment(slug);
  const attention = await fetchAttentionOg(lookupSlug);

  const title = attention?.title ?? decodeURIComponent(slug);
  const category = attention?.category ?? "Attention";
  const postCount = attention?.post_count ?? 0;
  const commentCount = attention?.comment_count ?? 0;
  const attentionScore = attention?.attention_score ?? 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 64px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: category + score */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                background: "#2563eb",
                color: "#fff",
                fontSize: "18px",
                fontWeight: 900,
                padding: "6px 16px",
                borderRadius: "20px",
              }}
            >
              a/
            </div>
            <span
              style={{
                color: "#94a3b8",
                fontSize: "20px",
                fontWeight: 700,
              }}
            >
              {category}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#60a5fa",
              fontSize: "22px",
              fontWeight: 900,
            }}
          >
            <span>🔥</span>
            <span>{formatNumber(attentionScore)}</span>
          </div>
        </div>

        {/* Middle: title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <h1
            style={{
              color: "#f8fafc",
              fontSize: title.length > 40 ? "42px" : "52px",
              fontWeight: 900,
              lineHeight: 1.2,
              margin: 0,
              maxWidth: "900px",
            }}
          >
            {title.length > 80 ? title.slice(0, 77) + "..." : title}
          </h1>
        </div>

        {/* Bottom: stats + brand */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div style={{ display: "flex", gap: "32px" }}>
            <StatBadge label="포스트" value={postCount} />
            <StatBadge label="댓글" value={commentCount} />
          </div>
          <div
            style={{
              color: "#475569",
              fontSize: "28px",
              fontWeight: 900,
              letterSpacing: "-0.02em",
            }}
          >
            momment.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
      <span
        style={{
          color: "#e2e8f0",
          fontSize: "28px",
          fontWeight: 900,
        }}
      >
        {formatNumber(value)}
      </span>
      <span
        style={{
          color: "#64748b",
          fontSize: "18px",
          fontWeight: 700,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

async function fetchAttentionOg(slug: string): Promise<AttentionOgRow | null> {
  const supabase = createSeoSupabaseClient();

  if (!supabase) {
    return null;
  }

  const fields = "title, description, category, attention_score, post_count, comment_count";

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(slug)) {
    const { data } = await supabase
      .from("attention_clusters")
      .select(fields)
      .eq("id", slug)
      .maybeSingle();
    return data;
  }

  const { data } = await supabase
    .from("attention_clusters")
    .select(fields)
    .eq("slug", slug)
    .maybeSingle();

  return data;
}
