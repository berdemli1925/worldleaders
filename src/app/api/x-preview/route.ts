import { NextRequest, NextResponse } from "next/server";

import { extractTweetId, syndicationToken } from "@/lib/x-post";

// Diagnostic-only route for testing whether we can fetch an X/Twitter post's
// data (text, author, profile photo, media, date) without authentication —
// see src/app/dev/x-test/page.tsx. Tries two unauthenticated endpoints and
// returns both raw responses so the test page can show exactly what each one
// gives back. The real throne-claim flow (src/app/api/throne/claim) uses
// src/lib/x-post.ts's fetchTweetSnapshot() instead — that one only needs the
// syndication endpoint's parsed data, not this side-by-side raw comparison.

interface EndpointResult {
  ok: boolean;
  status: number;
  contentType: string | null;
  data: unknown;
}

async function fetchJsonOrRaw(url: string, headers?: HeadersInit): Promise<EndpointResult> {
  const res = await fetch(url, { headers });
  const contentType = res.headers.get("content-type");
  const text = await res.text();

  if (contentType?.includes("application/json")) {
    try {
      return { ok: res.ok, status: res.status, contentType, data: JSON.parse(text) };
    } catch {
      // Fall through to raw text below.
    }
  }
  // Non-JSON response (e.g. X's HTML 404 page) — return a trimmed snippet so
  // the test page can still show *something* raw instead of just failing.
  return { ok: res.ok, status: res.status, contentType, data: text.slice(0, 1000) };
}

export async function GET(request: NextRequest) {
  const tweetUrl = request.nextUrl.searchParams.get("url");
  if (!tweetUrl) {
    return NextResponse.json({ error: "Missing 'url' query parameter." }, { status: 400 });
  }

  const id = extractTweetId(tweetUrl);
  if (!id) {
    return NextResponse.json({ error: "Couldn't find a tweet/status ID in that URL." }, { status: 400 });
  }

  const token = syndicationToken(id);
  const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}`;
  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`;

  const [syndication, oembed] = await Promise.all([
    fetchJsonOrRaw(syndicationUrl, { "User-Agent": "Mozilla/5.0" }).catch(
      (err): EndpointResult => ({
        ok: false,
        status: 0,
        contentType: null,
        data: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      }),
    ),
    fetchJsonOrRaw(oembedUrl).catch(
      (err): EndpointResult => ({
        ok: false,
        status: 0,
        contentType: null,
        data: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      }),
    ),
  ]);

  return NextResponse.json({
    tweetId: id,
    requestedUrls: { syndication: syndicationUrl, oembed: oembedUrl },
    syndication,
    oembed,
  });
}
