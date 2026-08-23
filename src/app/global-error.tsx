"use client";

import { useEffect } from "react";

// Only triggers if the root layout itself throws. Replaces the entire
// document, so — per Next's docs — it gets none of globals.css and must
// bring its own <html>/<body> and inline styles to stay on-theme.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#0a0a0b",
          color: "#f4f4f5",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <p style={{ margin: 0, fontFamily: "ui-monospace, monospace", fontSize: 14, color: "#6c6c74" }}>Error</p>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ margin: 0, maxWidth: 360, fontSize: 14, color: "#9c9ca4" }}>
          The site hit an unexpected error. Please try again.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            marginTop: 8,
            borderRadius: 999,
            border: "none",
            background: "#f5b301",
            color: "#1a1203",
            fontSize: 14,
            fontWeight: 500,
            padding: "8px 16px",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
