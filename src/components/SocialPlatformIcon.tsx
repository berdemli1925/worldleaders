import type { SocialPlatform } from "@/lib/social-links";

// Minimal geometric glyphs, not literal brand marks — just enough to tell
// the four platforms apart at a glance next to their label/handle text.
export default function SocialPlatformIcon({ platform, className }: { platform: SocialPlatform; className?: string }) {
  switch (platform) {
    case "x":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className={className}>
          <line x1="4" y1="4" x2="20" y2="20" />
          <line x1="20" y1="4" x2="4" y2="20" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M16.5 3c.3 2.1 1.7 3.7 4 4v3c-1.5 0-2.9-.5-4-1.3v6.8a5.5 5.5 0 1 1-5.5-5.5c.3 0 .7 0 1 .1v3.1a2.4 2.4 0 1 0 1.7 2.3V3h2.8Z" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.2-1.5 1.6-1.5h1.6V3.7C15.9 3.6 14.9 3.5 13.8 3.5c-2.4 0-4 1.5-4 4.1v2.3H7v3.1h2.8v8h3.7Z" />
        </svg>
      );
  }
}
