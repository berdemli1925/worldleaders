import { NextRequest, NextResponse } from "next/server";

import { findBannedWord } from "@/lib/banned-words";
import { fetchTweetSnapshot } from "@/lib/x-post";

// Pure UX helper for ThroneClaimModal's mandatory "Preview" step — fetches
// the post and runs the same sensitive/banned-word checks the real claim
// route runs, but commits nothing. /api/throne/claim re-fetches and
// re-checks everything independently on submit, so this route's result is
// never trusted as proof of anything — it's just here so the user sees a
// rejection *before* filling out the rest of the form.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const tweetUrl = typeof body?.tweetUrl === "string" ? body.tweetUrl : null;
  const brandTitle = typeof body?.brandTitle === "string" ? body.brandTitle : "";
  const description = typeof body?.description === "string" ? body.description : "";

  if (!tweetUrl) {
    return NextResponse.json({ ok: false, error: "Missing 'tweetUrl'." }, { status: 400 });
  }

  const snapshot = await fetchTweetSnapshot(tweetUrl);
  if (!snapshot.ok) {
    return NextResponse.json({ ok: false, error: snapshot.reason }, { status: 422 });
  }

  if (snapshot.possiblySensitive) {
    return NextResponse.json(
      { ok: false, error: "This post is marked sensitive by X and can't be used for a claim." },
      { status: 422 },
    );
  }

  const bannedHit = findBannedWord(`${snapshot.text} ${brandTitle} ${description}`);
  if (bannedHit) {
    return NextResponse.json(
      { ok: false, error: "Your post, brand title, or description contains language that isn't allowed here." },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    snapshot: {
      text: snapshot.text,
      authorName: snapshot.authorName,
      authorHandle: snapshot.authorHandle,
      authorAvatarUrl: snapshot.authorAvatarUrl,
      imageUrls: snapshot.imageUrls,
      createdAt: snapshot.createdAt,
    },
  });
}
