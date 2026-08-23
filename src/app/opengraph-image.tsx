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
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          background: "#0a0a0b",
          color: "#f4f4f5",
        }}
      >
        {/* Corner brand mark — same "Coordinate" glyph as the site header
            (see components/Logo.tsx), redrawn for satori. */}
        <div style={{ position: "absolute", top: 52, left: 68, display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
            <path d="M4 12c6-4 18-4 24 0" stroke="#f4f4f5" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M4 21c6 3.6 18 3.6 24 0" stroke="#f4f4f5" strokeWidth="1.7" strokeLinecap="round" opacity={0.6} />
            <path d="M16 4c4.3 5.3 4.3 18.7 0 24" stroke="#f4f4f5" strokeWidth="1.7" strokeLinecap="round" opacity={0.55} />
            <circle cx="22.5" cy="15.5" r="2.4" fill="#f5b301" />
          </svg>
          <span style={{ display: "flex", fontSize: 20, textTransform: "uppercase" }}>
            <span style={{ color: "#9c9ca4", marginRight: 7 }}>World</span>
            <span style={{ color: "#f4f4f5", fontWeight: 700 }}>Leaders</span>
          </span>
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
