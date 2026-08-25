// Fetches a plain web page's og:/meta tags server-side so a claimer can
// auto-fill the Content section (brand title, description, logo) from a
// link instead of typing everything by hand — the memleket.lol-style
// "Bilgileri Çek" affordance. Deliberately separate from x-post.ts: that
// fetches an X post's own content to *display* on the throne; this only
// reads a page's <head> metadata to *prefill form fields*, works for any
// site (not just X), and is never trusted as-is — /api/throne/claim runs
// the same banned-word/length checks on whatever ends up in those fields
// regardless of whether the claimer typed them or this filled them in.
//
// Server-only: never call this from a "use client" file.

const FETCH_TIMEOUT_MS = 8000;
// Enough to comfortably cover a page's <head> (where all the meta tags
// live) without pulling an entire page body for no reason — reading stops
// once this many bytes have arrived, not after a fixed byte count is
// merely requested, so a slow/huge response can't tie up the request.
const MAX_RESPONSE_BYTES = 300_000;

export interface LinkPreview {
  ok: true;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}
export interface LinkPreviewError {
  ok: false;
  reason: string;
}

// Basic SSRF guard — this endpoint fetches a URL of the caller's choosing
// server-side, so it must not become a way to probe this server's own
// internal network. Literal-IP checks only (no DNS-rebinding protection —
// that would need resolving the hostname ourselves and fetching by IP,
// more machinery than a "nice-to-have autofill" feature warrants), but
// blocks the obvious cases: localhost and the private/link-local ranges.
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (h === "localhost" || h === "0.0.0.0" || h === "::1") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  return false;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

// A <meta> tag's property/content pair can appear in either attribute
// order (`<meta property="og:title" content="…">` or the reverse) — this
// finds the whole tag first, then pulls `content` out of it regardless of
// where it sits, rather than assuming a fixed order.
function metaContent(html: string, key: string, attr: "property" | "name" = "property"): string | null {
  const tagPattern = new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*>`, "i");
  const tag = html.match(tagPattern)?.[0];
  if (!tag) return null;
  const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeHtmlEntities(content) : null;
}

async function fetchCapped(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WorldLeadersLinkPreview/1.0)",
        Accept: "text/html",
      },
    });
    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (received >= MAX_RESPONSE_BYTES) break;
    }
    reader.cancel().catch(() => {});
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | LinkPreviewError> {
  const withScheme = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, reason: "That doesn't look like a valid link." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "Only http/https links are supported." };
  }
  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, reason: "That link can't be fetched." };
  }

  const html = await fetchCapped(parsed.toString());
  if (!html) {
    return { ok: false, reason: "Couldn't reach that link." };
  }

  const rawTitle =
    metaContent(html, "og:title") ?? decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const title = rawTitle || null;
  const description = metaContent(html, "og:description") ?? metaContent(html, "description", "name");
  const rawImage = metaContent(html, "og:image") ?? metaContent(html, "twitter:image", "name");
  // og:image is often relative — resolve it against the page's own URL
  // the same way a browser would, so a bare "/logo.png" still works.
  const imageUrl = rawImage
    ? (() => {
        try {
          return new URL(rawImage, parsed).toString();
        } catch {
          return null;
        }
      })()
    : null;

  return { ok: true, title, description: description || null, imageUrl };
}
