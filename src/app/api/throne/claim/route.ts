import { NextRequest, NextResponse } from "next/server";

import { findBannedWord } from "@/lib/banned-words";
import { getClientIp } from "@/lib/get-client-ip";
import { getPaymentProvider } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchTweetSnapshot } from "@/lib/x-post";

// Claim flow, now payment-gated (see scripts/setup-payments.mjs): a
// `payments` row is created ('pending') before anything provider-specific
// happens, the active PaymentProvider (src/lib/payments) is asked to
// create the payment, and — for a provider that resolves synchronously
// (the mock provider always does, "test mode always succeeds") —
// finalize_payment() is called immediately, which is the only place a
// throne is ever actually granted (via claim_throne(), server-side,
// re-validated against the live thrones row regardless of what this
// route computed a moment earlier). A redirect-based real provider would
// instead return `checkoutUrl` here and let its webhook
// (/api/payments/webhook/[provider]) call finalize_payment() later.
//
// The two checks that need no DB state (sensitive post, banned words)
// still happen here first, before a payment row (or any charge) exists.
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
  // to have already fetched, or the amount it displayed. This is the one
  // and only place a claim's stored post data comes from; the amount
  // itself is re-validated again below, inside claim_throne(), against
  // whatever the throne is actually worth at finalize time.
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
    amount: offeredAmount,
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
