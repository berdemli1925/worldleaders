import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // The map's leader markers (src/lib/image-proxy.ts) route arbitrary,
    // leader-submitted avatar/logo URLs through Next's Image Optimization
    // endpoint rather than hotlinking them directly. Those URLs come from
    // whatever host a leader linked at claim time — not a fixed set we can
    // enumerate upfront — hence the wildcard. Next's own docs call an open
    // hostname pattern "not recommended," but the app already accepts and
    // directly renders these same arbitrary external URLs with no
    // allowlist today (ThronePanel's logo, Leaderboard's post thumbnails,
    // …); this doesn't add a new class of exposure, it only moves the
    // fetch server-side instead of the visitor's browser doing it.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
