import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * GET /api/og?title=...&category=...&energy=...&posts=...&type=attention|post&author=...
 *
 * Generates a dynamic OG image for link previews on KakaoTalk, Telegram, etc.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title") || "moment.";
  const category = searchParams.get("category") || "";
  const energy = searchParams.get("energy") || "0";
  const posts = searchParams.get("posts") || "0";
  const type = searchParams.get("type") || "attention";
  const author = searchParams.get("author") || "";
  const outcomes = searchParams.get("outcomes") || "";

  const isAttention = type === "attention";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0f0f14 0%, #1a1a2e 50%, #16213e 100%)",
          padding: "0",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            width: "100%",
            height: "6px",
            background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 30%, #a855f7 60%, #ec4899 100%)",
            display: "flex",
          }}
        />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "48px 60px 40px",
          }}
        >
          {/* Header: Logo + Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 900,
                color: "#a78bfa",
                letterSpacing: "-0.5px",
                display: "flex",
              }}
            >
              moment.
            </div>

            {category && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "rgba(139, 92, 246, 0.15)",
                  color: "#c4b5fd",
                  fontSize: "16px",
                  fontWeight: 700,
                  padding: "4px 14px",
                  borderRadius: "20px",
                  border: "1px solid rgba(139, 92, 246, 0.25)",
                }}
              >
                {category}
              </div>
            )}

            {isAttention && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "rgba(251, 191, 36, 0.12)",
                  color: "#fbbf24",
                  fontSize: "15px",
                  fontWeight: 700,
                  padding: "4px 14px",
                  borderRadius: "20px",
                  border: "1px solid rgba(251, 191, 36, 0.2)",
                }}
              >
                ⚡ 예측 어텐션
              </div>
            )}
          </div>

          {/* Title */}
          <div
            style={{
              marginTop: "32px",
              fontSize: title.length > 40 ? "40px" : "48px",
              fontWeight: 900,
              color: "#f1f5f9",
              lineHeight: 1.25,
              letterSpacing: "-0.5px",
              display: "flex",
              maxWidth: "1000px",
              wordBreak: "break-word",
            }}
          >
            {title.length > 80 ? title.slice(0, 80) + "…" : title}
          </div>

          {/* Outcomes pills */}
          {outcomes && (
            <div style={{ display: "flex", gap: "10px", marginTop: "24px", flexWrap: "wrap" }}>
              {outcomes.split(",").slice(0, 4).map((outcome, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "6px 18px",
                    borderRadius: "24px",
                    fontSize: "18px",
                    fontWeight: 700,
                    backgroundColor: i === 0 ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                    color: i === 0 ? "#4ade80" : "#f87171",
                    border: `1px solid ${i === 0 ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                  }}
                >
                  {outcome.trim()}
                </div>
              ))}
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1, display: "flex" }} />

          {/* Footer stats */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "32px",
              borderTop: "1px solid rgba(148, 163, 184, 0.15)",
              paddingTop: "24px",
            }}
          >
            {isAttention && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "22px" }}>⚡</span>
                  <span style={{ color: "#fbbf24", fontSize: "22px", fontWeight: 800 }}>
                    {Number(energy).toLocaleString()}
                  </span>
                  <span style={{ color: "#94a3b8", fontSize: "16px", fontWeight: 600 }}>
                    Energy
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "22px" }}>📝</span>
                  <span style={{ color: "#e2e8f0", fontSize: "22px", fontWeight: 800 }}>
                    {posts}
                  </span>
                  <span style={{ color: "#94a3b8", fontSize: "16px", fontWeight: 600 }}>
                    Posts
                  </span>
                </div>
              </>
            )}

            {!isAttention && author && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#cbd5e1", fontSize: "18px", fontWeight: 700 }}>
                  @{author}
                </span>
              </div>
            )}

            <div style={{ flex: 1, display: "flex" }} />

            <div
              style={{
                color: "#64748b",
                fontSize: "18px",
                fontWeight: 600,
                display: "flex",
              }}
            >
              momment.xyz
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
