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

/** Validates `url` against `platform`'s profile-URL shape and returns the handle, or null if it doesn't match. A missing scheme (e.g. "x.com/user") is treated as https, same as typing it into a browser's address bar. */
export function parseSocialUrl(platform: SocialPlatform, url: string): string | null {
  const def = PLATFORM_DEFS[platform];
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
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

/**
 * Same validation as parseSocialUrl, but returns the absolute (https://…)
 * URL instead of just the handle — this is what should actually get
 * stored/linked, since a schemeless value like "x.com/user" saved as-is
 * would render as a broken relative link (`<a href="x.com/user">` resolves
 * against the current page, not as https://x.com/user).
 */
export function normalizeSocialUrl(platform: SocialPlatform, url: string): string | null {
  if (!parseSocialUrl(platform, url)) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function platformLabel(platform: SocialPlatform): string {
  return PLATFORM_DEFS[platform].label;
}

// Fixed priority order a leader's four possible identity fields collapse
// into a single stable key — same person, same key, every claim, as long
// as they keep re-linking at least one of the same profiles. Used for
// throne credit (see scripts/setup-persistent-leader-credit.mjs): a
// claim's credit toward a country is every net dollar previously spent
// under this same key, indefinitely, not tied to a cycle or to whichever
// post happened to be displayed. X is checked first simply because it's
// the platform the rest of this feature (posts, handles) is built around;
// the order itself doesn't need to mean anything beyond "always the same".
const LEADER_IDENTITY_PRIORITY: SocialPlatform[] = ["x", "instagram", "tiktok", "facebook"];

/**
 * Collapses a claim's (already-validated) leader identity URLs into one
 * key, or null if none parse — e.g. only X and Instagram are filled in,
 * X wins: `"x:someuser"`. Two claims naturally share a key exactly when
 * they share a real platform handle, regardless of which of the four
 * fields carried it or what casing was typed.
 */
export function computeLeaderIdentityKey(urls: {
  x: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
}): string | null {
  for (const platform of LEADER_IDENTITY_PRIORITY) {
    const url = urls[platform];
    if (!url) continue;
    const handle = parseSocialUrl(platform, url);
    if (handle) return `${platform}:${handle.toLowerCase()}`;
  }
  return null;
}

/**
 * A URL for the leader's own profile photo, sourced from whichever
 * platform they actually declared as their identity (same priority as
 * computeLeaderIdentityKey above) — direct request: "sosyal medya hesabı
 * girdiyse o hesabın profil fotoğrafı." Used by the map's leader markers
 * (WorldMapInteractive.tsx), which fall back further to the leader's
 * website logo, then a plain flag+crown, if this returns null.
 *
 * Real capability varies a lot by platform:
 * - X: no direct profile-photo API, but every claim requires a linked
 *   post (see the module header comment above), which we already fetch
 *   server-side and get the author's avatar from for free. Best-effort,
 *   not verified: that post can technically be *any* public post, not
 *   necessarily one by this exact account — but it's the closest real
 *   photo available, and correct in the overwhelmingly common case of a
 *   leader linking their own post.
 * - Facebook: `graph.facebook.com/{id}/picture` serves a Page/profile's
 *   picture with no access token required — one of the only Graph API
 *   fields Meta still exposes unauthenticated. Doesn't resolve for every
 *   account (older personal profiles especially) — the caller's onError
 *   handling is expected to fall back gracefully, same as any other
 *   marker image.
 * - Instagram/TikTok: no free, stable, unauthenticated way to fetch a
 *   profile photo from either today (Instagram's Graph API requires an
 *   access token even for public profiles; TikTok's oEmbed only covers
 *   individual videos/photos, not bare profile URLs) — scraping either
 *   would be unreliable and against their terms, so this deliberately
 *   returns null for both rather than attempting it.
 */
export function leaderAvatarSourceUrl(fields: {
  x: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  /** The linked post's author avatar (see throne.ts) — used for the "x" case, and as a last-resort fallback when no identity field parses at all. */
  postAuthorAvatarUrl: string | null;
}): string | null {
  const key = computeLeaderIdentityKey(fields);
  if (!key) return fields.postAuthorAvatarUrl;

  const separator = key.indexOf(":");
  const platform = key.slice(0, separator) as SocialPlatform;
  const handle = key.slice(separator + 1);

  switch (platform) {
    case "x":
      return fields.postAuthorAvatarUrl;
    case "facebook":
      return `https://graph.facebook.com/${encodeURIComponent(handle)}/picture?type=large`;
    case "instagram":
    case "tiktok":
      return null;
  }
}
