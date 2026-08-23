// Leader identity — separate from the X post a claim displays (see
// x-post.ts): a claimer proves who *they* are by linking at least one of
// their own X/Instagram/TikTok/Facebook profiles, unrelated to whose post
// gets shown. None of these are OAuth-verified — anyone can type any
// profile URL — which is exactly why the UI always shows an "unverified"
// mark next to them (see LeaderIdentityBadges.tsx).

export type SocialPlatform = "x" | "instagram" | "tiktok" | "facebook";

interface PlatformDef {
  platform: SocialPlatform;
  label: string;
  placeholder: string;
  hosts: string[];
  /** Matched against the URL's pathname; capture group 1 is the handle. */
  pathPattern: RegExp;
}

const PLATFORM_DEFS: Record<SocialPlatform, PlatformDef> = {
  x: {
    platform: "x",
    label: "X",
    placeholder: "https://x.com/username",
    hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
    pathPattern: /^\/([A-Za-z0-9_]{1,15})\/?$/,
  },
  instagram: {
    platform: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/username",
    hosts: ["instagram.com", "www.instagram.com"],
    pathPattern: /^\/([A-Za-z0-9_.]{1,30})\/?$/,
  },
  tiktok: {
    platform: "tiktok",
    label: "TikTok",
    placeholder: "https://tiktok.com/@username",
    hosts: ["tiktok.com", "www.tiktok.com"],
    pathPattern: /^\/@([A-Za-z0-9_.]{1,24})\/?$/,
  },
  facebook: {
    platform: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/username",
    hosts: ["facebook.com", "www.facebook.com", "fb.com"],
    pathPattern: /^\/([A-Za-z0-9.]{2,50})\/?$/,
  },
};

export const SOCIAL_PLATFORMS: PlatformDef[] = [
  PLATFORM_DEFS.x,
  PLATFORM_DEFS.instagram,
  PLATFORM_DEFS.tiktok,
  PLATFORM_DEFS.facebook,
];

// A handful of reserved first path segments that are pages, not profiles —
// rejected so e.g. "x.com/home" or "instagram.com/explore" can't slip
// through as someone's identity.
const RESERVED_HANDLES = new Set([
  "home",
  "explore",
  "settings",
  "search",
  "login",
  "i",
  "about",
  "help",
  "reel",
  "reels",
  "p",
  "tv",
  "pages",
  "groups",
  "watch",
  "tag",
  "tags",
  "discover",
  "foryou",
  "following",
]);

/** Validates `url` against `platform`'s profile-URL shape and returns the handle, or null if it doesn't match. */
export function parseSocialUrl(platform: SocialPlatform, url: string): string | null {
  const def = PLATFORM_DEFS[platform];
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!def.hosts.includes(parsed.hostname.toLowerCase())) return null;
  const match = parsed.pathname.match(def.pathPattern);
  if (!match) return null;
  const handle = match[1];
  if (RESERVED_HANDLES.has(handle.toLowerCase())) return null;
  return handle;
}

export function platformLabel(platform: SocialPlatform): string {
  return PLATFORM_DEFS[platform].label;
}
