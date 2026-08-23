import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Simple on-brand glyph (accent gold "W" on the dark background color) —
// no external asset, generated the same way the OG images below are.
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
          borderRadius: 6,
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 700, color: "#f5b301" }}>W</span>
      </div>
    ),
    { ...size },
  );
}
