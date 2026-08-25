// Routes an arbitrary external image URL through Next.js's built-in Image
// Optimization endpoint (/_next/image) instead of hotlinking it directly.
// Two reasons this matters for the map's leader markers specifically
// (src/components/WorldMapInteractive.tsx): leader-submitted avatar/logo
// URLs (src/lib/throne.ts's postAuthorAvatarUrl/logoUrl) come from
// third-party hosts we don't control, some of which block direct hotlinking
// — a broken-image icon on the map instead of the marker. The optimizer
// fetches server-side from Vercel's infra, not the visitor's browser,
// which sidesteps that; it also downsamples to marker size instead of
// shipping a full-resolution avatar/logo for a ~20px circle.
//
// Requires next.config.ts's images.remotePatterns to allow the host — see
// that file's comment for why it's a wildcard here (arbitrary,
// leader-submitted URLs, not a fixed set of hosts we can list upfront).
//
// `width` must be one of next.config.ts's images.imageSizes (defaults —
// unconfigured here — include 16/32/48/64/96/128/256/384), or the
// optimizer 400s.
export function optimizedImageUrl(src: string, width: number, quality = 75): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}
