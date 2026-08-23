import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Same "Coordinate" mark as the site header (see components/Logo.tsx) —
// two parallels + a meridian arc, with an accent dot marking a claimed
// point. Redrawn here with next/og's satori renderer instead of shared
// JSX (ImageResponse can't reuse a "use client" component), stroke
// widened for legibility at 32px/16px. No image asset.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0b",
          borderRadius: 7,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
          <path d="M4 12c6-4 18-4 24 0" stroke="#f4f4f5" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M4 21c6 3.6 18 3.6 24 0" stroke="#f4f4f5" strokeWidth="2.2" strokeLinecap="round" opacity={0.6} />
          <path d="M16 4c4.3 5.3 4.3 18.7 0 24" stroke="#f4f4f5" strokeWidth="2.2" strokeLinecap="round" opacity={0.55} />
          <circle cx="22.5" cy="15.5" r="3.2" fill="#f5b301" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
