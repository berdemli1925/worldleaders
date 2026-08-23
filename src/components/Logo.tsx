import Link from "next/link";

// The "Coordinate" mark: two curved parallels + a meridian arc (an open
// graticule, no closed globe outline) with a small accent dot marking a
// claimed point — echoes the site's "claim the throne" mechanic. Reused
// as-is for the favicon (app/icon.tsx) and the OG image corners
// (app/opengraph-image.tsx, app/api/og/country/[iso]/route.tsx) so the
// mark stays identical everywhere. Code + currentColor only, no image
// asset.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <path d="M4 12c6-4 18-4 24 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 21c6 3.6 18 3.6 24 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <path d="M16 4c4.3 5.3 4.3 18.7 0 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
      <circle cx="22.5" cy="15.5" r="2.2" fill="var(--accent)" />
    </svg>
  );
}

// Site wordmark + mark, linking home. Collapses to the mark alone below
// the sm breakpoint (see SiteNav) — the two words stay legible at nav
// scale but would crowd the mobile header next to the menu button.
export default function Logo() {
  return (
    <Link
      href="/"
      aria-label="World Leaders — home"
      className="inline-flex items-center gap-2.5 rounded-sm text-foreground transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4"
    >
      <LogoMark className="h-6 w-6 shrink-0" />
      <span className="hidden items-baseline gap-[0.3em] whitespace-nowrap text-[15px] uppercase sm:inline-flex">
        <span className="text-[0.94em] font-normal tracking-[0.02em] text-muted">World</span>
        <span className="font-bold tracking-[0.005em]">Leaders</span>
      </span>
    </Link>
  );
}
