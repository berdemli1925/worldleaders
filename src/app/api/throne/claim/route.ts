import { NextRequest, NextResponse } from "next/server";

import { findBannedWord } from "@/lib/banned-words";
import { getClientIp } from "@/lib/get-client-ip";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchTweetSnapshot } from "@/lib/x-post";

// Free "test mode" claim — no payment provider wired up yet (see
// proje-spesifikasyonu.md section 5 and this session's chat, which
// overrides some of the spec's numbers: 1-week cycles that outbidding
// doesn't extend, a flat +$2 minimum raise with no cap). All the actual
// business logic (vacancy check, minimum-raise validation, credit math,
// cycle timing, blocked-handle/kill-switch gating) lives in the
// claim_throne() Postgres function — see scripts/setup-moderation.mjs — so
// it's atomic under concurrent claims instead of split across several
// round-trips here. The two checks that need no DB state (sensitive post,
// banned words) happen here first, before that round-trip.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const countryIsoCode = typeof body?.countryIsoCode === "string" ? body.countryIsoCode : null;
  const tweetUrl = typeof body?.tweetUrl === "string" ? body.tweetUrl : null;
  const offeredAmount = typeof body?.offeredAmount === "number" ? body.offeredAmount : null;
  const brandTitle = typeof body?.brandTitle === "string" ? body.brandTitle.trim() || null : null;
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const linkUrl = typeof body?.linkUrl === "string" ? body.linkUrl.trim() || null : null;
  const logoUrl = typeof body?.logoUrl === "string" ? body.logoUrl.trim() || null : null;

  if (!countryIsoCode || !tweetUrl || offeredAmount === null) {
    return NextResponse.json(
      { error: "Missing 'countryIsoCode', 'tweetUrl', or 'offeredAmount' in request body." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(offeredAmount) || offeredAmount <= 0) {
    return NextResponse.json({ error: "offeredAmount must be a positive number." }, { status: 400 });
  }

  // Always re-fetch server-side — never trust a snapshot the client claims
  // to have already fetched. This is the one and only place a claim's
  // stored post data comes from.
  const snapshot = await fetchTweetSnapshot(tweetUrl);
  if (!snapshot.ok) {
    return NextResponse.json({ error: snapshot.reason }, { status: 422 });
  }

  if (snapshot.possiblySensitive) {
    return NextResponse.json(
      { error: "This post is marked sensitive by X and can't be used for a claim." },
      { status: 422 },
    );
  }

  const bannedHit = findBannedWord(`${snapshot.text} ${brandTitle ?? ""} ${description ?? ""}`);
  if (bannedHit) {
    return NextResponse.json(
      { error: "Your post, brand title, or description contains language that isn't allowed here." },
      { status: 422 },
    );
  }

  const ip = getClientIp(request);

  const { data, error } = await supabaseAdmin.rpc("claim_throne", {
    p_country: countryIsoCode,
    p_x_handle: snapshot.authorHandle,
    p_offered: offeredAmount,
    p_post_snapshot: snapshot.raw,
    p_post_text: snapshot.text,
    p_post_author_name: snapshot.authorName,
    p_post_author_avatar_url: snapshot.authorAvatarUrl,
    p_post_image_url: snapshot.imageUrl,
    p_post_created_at: snapshot.createdAt,
    p_claimer_ip: ip,
    p_brand_title: brandTitle,
    p_description: description,
    p_link_url: linkUrl,
    p_logo_url: logoUrl,
  });

  if (error) {
    // claim_throne() raises a plain-text exception for "unknown country" and
    // "offer below minimum" — both are the caller's fault, not a server
    // error, so surface the message as-is rather than a generic 500.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: throneRow, error: readError } = await supabaseAdmin
    .from("thrones_with_leader")
    .select("*")
    .eq("country_iso_code", countryIsoCode)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  return NextResponse.json({ claimId: data, throne: throneRow });
}
