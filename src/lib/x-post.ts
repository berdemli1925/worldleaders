import { twitterImageVariant } from "./twitter-image";

// Fetches an X/Twitter post's data without authentication, via the same
// unofficial-but-stable syndication endpoint X's own embed widget script
// uses. Server-only: never call this from a "use client" file. Used by
// both /api/throne/preview and /api/throne/claim, so a claim's snapshot is
// fetched with the exact same logic the modal previewed.

export function extractTweetId(input: string): string | null {
  const match = input.match(/(?:twitter|x)\.com\/(?:#!\/)?\w+\/status(?:es)?\/(\d+)/i);
  return match?.[1] ?? null;
}

// Reverse-engineered token X's widgets.js sends to the syndication endpoint.
// Undocumented, but stable and widely relied on by open-source embed
// libraries (e.g. Vercel's react-tweet). No API key or login involved.
export function syndicationToken(tweetId: string): string {
  return ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

interface SyndicationPhoto {
  url: string;
}

interface SyndicationUser {
  name: string;
  screen_name: string;
  profile_image_url_https: string;
}

interface SyndicationTweet {
  text: string;
  created_at: string;
  user: SyndicationUser;
  photos?: SyndicationPhoto[];
  mediaDetails?: { type: string; media_url_https: string }[];
  possibly_sensitive?: boolean;
}

export interface TweetSnapshot {
  ok: true;
  id: string;
  raw: unknown;
  text: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  /** First entry of imageUrls, or null — kept for callers that only ever
   *  wanted "the" image (OG cards, etc.); the throne claim flow itself
   *  uses imageUrls so the poster can pick which one to use. */
  imageUrl: string | null;
  /** Every still photo on the post, highest-resolution CDN variant
   *  (`?name=orig`), in the order X returned them. Deliberately excludes
   *  videos/GIFs — there's no single frame to crop a country's silhouette
   *  to — and is empty (not null) when the post has no photos, so callers
   *  can just check `.length`. */
  imageUrls: string[];
  createdAt: string;
  /** X's own sensitive-media flag — confirmed present in the syndication payload during testing. */
  possiblySensitive: boolean;
}

export interface TweetSnapshotError {
  ok: false;
  reason: string;
}

export async function fetchTweetSnapshot(tweetUrl: string): Promise<TweetSnapshot | TweetSnapshotError> {
  const id = extractTweetId(tweetUrl);
  if (!id) {
    return { ok: false, reason: "Couldn't find a tweet/status ID in that URL." };
  }

  const token = syndicationToken(id);
  const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  }).catch(() => null);

  if (!res) {
    return { ok: false, reason: "Couldn't reach X — network error." };
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("application/json")) {
    return {
      ok: false,
      reason: res.status === 404 ? "Post not found — it may be deleted or private." : `X returned ${res.status}.`,
    };
  }

  let data: SyndicationTweet;
  try {
    data = (await res.json()) as SyndicationTweet;
  } catch {
    return { ok: false, reason: "Couldn't parse X's response." };
  }

  // `photos` covers the common case; `mediaDetails` is the fallback for
  // posts where `photos` came back empty but media is present — filtered to
  // type "photo" only, since videos/GIFs show up there too and have no
  // single frame to use. Deduped (the two arrays can overlap) and requested
  // at the CDN's highest-resolution variant for the positioning tool and
  // the map to actually have something worth zooming into.
  const rawUrls = [
    ...(data.photos?.map((photo) => photo.url) ?? []),
    ...(data.mediaDetails?.filter((media) => media.type === "photo").map((media) => media.media_url_https) ?? []),
  ];
  const imageUrls = [...new Set(rawUrls)].map((url) => twitterImageVariant(url, "orig"));

  return {
    ok: true,
    id,
    raw: data,
    text: data.text,
    authorName: data.user.name,
    authorHandle: data.user.screen_name,
    authorAvatarUrl: data.user.profile_image_url_https,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    createdAt: data.created_at,
    possiblySensitive: data.possibly_sensitive === true,
  };
}

// --- Change auditing (background job) --------------------------------

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

function normalizeOembedText(html: string): string {
  const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  const inner = match?.[1] ?? html;
  const withoutTags = inner.replace(/<[^>]+>/g, "");
  const decoded = withoutTags.replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => HTML_ENTITIES[entity] ?? entity);
  return decoded.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizePlainText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export interface PostStillValid {
  ok: true;
}
export interface PostChanged {
  ok: false;
  reason: "deleted" | "edited" | "unverifiable";
}

/**
 * Re-checks a claimed post via the official oEmbed endpoint (no auth
 * needed) — used by the periodic change-auditing job, not by the claim
 * flow itself (that always uses the richer syndication endpoint).
 *
 * The text comparison is intentionally fuzzy: oEmbed's `html` wraps the
 * text in link tags for URLs/mentions and HTML-escapes it, so byte-exact
 * equality against our stored plain text would false-positive on nearly
 * every untouched post. This strips tags, decodes the common entities, and
 * does a normalized substring check — a reasonable-effort signal that the
 * text changed, not a guaranteed exact diff.
 */
export async function verifyPostUnchanged(tweetUrl: string, expectedText: string): Promise<PostStillValid | PostChanged> {
  const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`).catch(
    () => null,
  );

  if (!res) return { ok: false, reason: "unverifiable" };
  if (res.status === 404) return { ok: false, reason: "deleted" };
  if (!res.ok) return { ok: false, reason: "unverifiable" };

  const data = (await res.json().catch(() => null)) as { html?: string } | null;
  if (!data?.html) return { ok: false, reason: "unverifiable" };

  const normalizedOembed = normalizeOembedText(data.html);
  const normalizedExpected = normalizePlainText(expectedText);
  if (!normalizedExpected) return { ok: true };

  // Substring rather than equality: oEmbed's link display text
  // ("twitter.com/…") differs from our raw URL text, so we only require
  // that a meaningful prefix of the original text still appears.
  const probe = normalizedExpected.slice(0, 40);
  if (probe && !normalizedOembed.includes(probe)) {
    return { ok: false, reason: "edited" };
  }
  return { ok: true };
}
