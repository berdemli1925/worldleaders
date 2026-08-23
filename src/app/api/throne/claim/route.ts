import { NextRequest, NextResponse } from "next/server";

import { findBannedWord } from "@/lib/banned-words";
import { BETA_MAX_COUNTRIES_PER_USER, PAYMENTS_ENABLED } from "@/lib/beta-mode";
import { getClientIp } from "@/lib/get-client-ip";
import { getPaymentProvider } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchTweetSnapshot } from "@/lib/x-post";

// Claim flow, payment-gated by NEXT_PUBLIC_PAYMENTS_ENABLED (see
// src/lib/beta-mode.ts):
//
// - PAYMENTS_ENABLED=true: unchanged from before beta mode existed. A
//   `payments` row is created ('pending') before anything provider-specific
//   happens (see scripts/setup-payments.mjs), the active PaymentProvider
//   (src/lib/payments) is asked to create the payment, and — for a
//   provider that resolves synchronously (the mock provider always does,
//   "test mode always succeeds") — finalize_payment() is called
//   immediately, which is the only place a throne is granted via
//   claim_throne(), re-validated server-side against the live thrones row.
//   A redirect-based real provider would instead return `checkoutUrl` here
//   and let its webhook (/api/payments/webhook/[provider]) call
//   finalize_payment() later.
// - PAYMENTS_ENABLED=false (default — free beta): no payments row, no
//   provider. claim_throne_beta() (scripts/setup-beta-mode.mjs) is called
//   directly — free, 1-hour hold, no takeover, capped at
//   BETA_MAX_COUNTRIES_PER_USER concurrent countries per IP+fingerprint
//   identity (same pairing /api/votes uses). The cap is checked here first
//   (via beta_holdings()) so a blocked claim can tell the user exactly
//   which countries they're holding, and re-checked inside
//   claim_throne_beta() itself as a race-condition backstop.
//
// Either way, the checks that need no DB state (sensitive post, banned
// words) happen first, before anything is created or charged.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const countryIsoCode = typeof body?.countryIsoCode === "string" ? body.countryIsoCode : null;
  const tweetUrl = typeof body?.tweetUrl === "string" ? body.tweetUrl : null;
  const offeredAmount = typeof body?.offeredAmount === "number" ? body.offeredAmount : null;
  const fingerprint = typeof body?.fingerprint === "string" ? body.fingerprint : null;
  const brandTitle = typeof body?.brandTitle === "string" ? body.brandTitle.trim() || null : null;
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  const linkUrl = typeof body?.linkUrl === "string" ? body.linkUrl.trim() || null : null;
  const logoUrl = typeof body?.logoUrl === "string" ? body.logoUrl.trim() || null : null;

  if (!countryIsoCode || !tweetUrl) {
    return NextResponse.json({ error: "Missing 'countryIsoCode' or 'tweetUrl' in request body." }, { status: 400 });
  }
  if (PAYMENTS_ENABLED && (offeredAmount === null || !Number.isFinite(offeredAmount) || offeredAmount <= 0)) {
    return NextResponse.json({ error: "offeredAmount must be a positive number." }, { status: 400 });
  }
  if (!PAYMENTS_ENABLED && !fingerprint) {
    return NextResponse.json({ error: "Missing 'fingerprint' in request body." }, { status: 400 });
  }

  // Always re-fetch server-side — never trust a snapshot the client claims
  // to have already fetched, or the amount it displayed. This is the one
  // and only place a claim's stored post data comes from; in paid mode the
  // amount itself is re-validated again below, inside claim_throne().
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

  if (!PAYMENTS_ENABLED) {
    const { data: holdings, error: holdingsError } = await supabaseAdmin.rpc("beta_holdings", {
      p_ip: ip,
      p_fingerprint: fingerprint,
    });
    if (holdingsError) {
      return NextResponse.json({ error: holdingsError.message }, { status: 500 });
    }
    const heldCountries = ((holdings ?? []) as { country_iso_code: string }[]).map((row) => row.country_iso_code);
    if (heldCountries.length >= BETA_MAX_COUNTRIES_PER_USER) {
      return NextResponse.json(
        {
          error: `You're already leading ${heldCountries.length} countries — the beta limit is ${BETA_MAX_COUNTRIES_PER_USER}. Wait for one to expire before claiming another.`,
          heldCountries,
        },
        { status: 409 },
      );
    }

    const { data: claimId, error: claimError } = await supabaseAdmin.rpc("claim_throne_beta", {
      p_country: countryIsoCode,
      p_x_handle: snapshot.authorHandle,
      p_post_snapshot: snapshot.raw,
      p_post_text: snapshot.text,
      p_post_author_name: snapshot.authorName,
      p_post_author_avatar_url: snapshot.authorAvatarUrl,
      p_post_image_url: snapshot.imageUrl,
      p_post_created_at: snapshot.createdAt,
      p_claimer_ip: ip,
      p_fingerprint: fingerprint,
      p_brand_title: brandTitle,
      p_description: description,
      p_link_url: linkUrl,
      p_logo_url: logoUrl,
    });
    if (claimError || !claimId) {
      return NextResponse.json({ error: claimError?.message ?? "Claim failed." }, { status: 400 });
    }

    const { data: throneRow, error: readError } = await supabaseAdmin
      .from("thrones_with_leader")
      .select("*")
      .eq("country_iso_code", countryIsoCode)
      .maybeSingle();
    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }
    return NextResponse.json({ status: "completed", throne: throneRow });
  }

  const provider = getPaymentProvider();

  const { data: paymentRow, error: insertError } = await supabaseAdmin
    .from("payments")
    .insert({
      country_iso_code: countryIsoCode,
      x_handle: snapshot.authorHandle,
      amount: offeredAmount,
      provider: provider.name,
      post_snapshot: snapshot.raw,
      post_text: snapshot.text,
      post_author_name: snapshot.authorName,
      post_author_avatar_url: snapshot.authorAvatarUrl,
      post_image_url: snapshot.imageUrl,
      post_created_at: snapshot.createdAt,
      brand_title: brandTitle,
      description,
      link_url: linkUrl,
      logo_url: logoUrl,
      claimer_ip: ip,
    })
    .select("id")
    .single();

  if (insertError || !paymentRow) {
    return NextResponse.json({ error: insertError?.message ?? "Could not start payment." }, { status: 500 });
  }
  const paymentId = paymentRow.id as number;

  const outcome = await provider.createPayment({
    paymentId,
    countryIsoCode,
    xHandle: snapshot.authorHandle,
    amount: offeredAmount as number,
    description: `World Leaders throne claim: ${countryIsoCode}`,
  });

  await supabaseAdmin.from("payments").update({ provider_reference: outcome.providerReference }).eq("id", paymentId);

  // Redirect-based provider (no immediate result) — the payment stays
  // 'pending' until its webhook calls finalize_payment().
  if (outcome.checkoutUrl && !outcome.immediateResult) {
    return NextResponse.json({ status: "pending", checkoutUrl: outcome.checkoutUrl });
  }

  const { data: result, error: finalizeError } = await supabaseAdmin.rpc("finalize_payment", {
    p_payment_id: paymentId,
    p_provider_success: outcome.immediateResult?.ok ?? false,
  });
  if (finalizeError) {
    return NextResponse.json({ error: finalizeError.message }, { status: 500 });
  }

  const finalStatus = (result as { status?: string } | null)?.status;
  if (finalStatus === "completed") {
    const { data: throneRow, error: readError } = await supabaseAdmin
      .from("thrones_with_leader")
      .select("*")
      .eq("country_iso_code", countryIsoCode)
      .maybeSingle();
    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }
    return NextResponse.json({ status: "completed", throne: throneRow });
  }

  const reason = (result as { reason?: string } | null)?.reason ?? "Payment failed.";
  return NextResponse.json({ status: "failed", error: reason }, { status: 400 });
}
