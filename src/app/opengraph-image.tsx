import { ImageResponse } from "next/og";

export const alt = "World Leaders — vote for your country";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Site-wide default OG/Twitter card — applies to every route that doesn't
// override it. src/app/page.tsx's generateMetadata overrides this
// explicitly for a specific ?country= share link (see /api/og/country).
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          background: "#0a0a0b",
          color: "#f4f4f5",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: 28,
            background: "#f5b301",
            color: "#1a1203",
            fontSize: 64,
            fontWeight: 700,
          }}
        >
          W
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>World Leaders</div>
        <div style={{ display: "flex", fontSize: 32, color: "#9c9ca4" }}>
          Vote for your country. Claim the throne.
        </div>
      </div>
    ),
    { ...size },
  );
}
