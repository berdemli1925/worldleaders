import { parseSocialUrl, SOCIAL_PLATFORMS } from "@/lib/social-links";
import SocialPlatformIcon from "./SocialPlatformIcon";

interface LeaderIdentityBadgesProps {
  xUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  facebookUrl: string | null;
  brandTitle?: string | null;
  /** Ticker/history-badge context: first identity only, no brand title, tighter spacing. */
  compact?: boolean;
  className?: string;
}

const URL_BY_PLATFORM_KEY = ["xUrl", "instagramUrl", "tiktokUrl", "facebookUrl"] as const;

// Who's actually leading — separate from whatever X post is shown as
// content (see ThronePanel.tsx) — as one badge per linked platform. None of
// these are verified (a claimer just types a profile URL, see
// src/lib/social-links.ts), so every badge carries a small "unverified"
// mark; that's the one visual language shared across the map's side panel,
// the leaderboard cards, /leaders, and the ticker, so "who's the leader" vs
// "who posted this" never gets ambiguous no matter where it's shown.
export default function LeaderIdentityBadges({
  xUrl,
  instagramUrl,
  tiktokUrl,
  facebookUrl,
  brandTitle,
  compact = false,
  className,
}: LeaderIdentityBadgesProps) {
  const raw = { xUrl, instagramUrl, tiktokUrl, facebookUrl };
  const identities = SOCIAL_PLATFORMS.map((def, index) => {
    const url = raw[URL_BY_PLATFORM_KEY[index]];
    if (!url) return null;
    const handle = parseSocialUrl(def.platform, url);
    return { platform: def.platform, url, handle: handle ?? url };
  }).filter((entry): entry is { platform: (typeof SOCIAL_PLATFORMS)[number]["platform"]; url: string; handle: string } =>
    entry !== null,
  );

  if (identities.length === 0) return null;

  const shown = compact ? identities.slice(0, 1) : identities;

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className ?? ""}`}>
      {!compact && brandTitle && <span className="font-medium text-foreground">{brandTitle}</span>}
      {shown.map((identity) => (
        <a
          key={identity.platform}
          href={identity.url}
          target="_blank"
          rel="noreferrer"
          title={`Unverified — anyone can link this profile`}
          className="inline-flex items-center gap-1 text-sm text-foreground hover:text-accent"
        >
          <SocialPlatformIcon platform={identity.platform} className="h-3.5 w-3.5 shrink-0 text-muted-2" />
          <span className="truncate">@{identity.handle}</span>
          <span className="text-[10px] font-normal uppercase tracking-wide text-muted-2">unverified</span>
        </a>
      ))}
      {compact && identities.length > 1 && (
        <span className="text-[11px] text-muted-2">+{identities.length - 1}</span>
      )}
    </div>
  );
}
