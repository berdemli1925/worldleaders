import { NextRequest, NextResponse } from "next/server";

import { PAYMENTS_ENABLED } from "@/lib/beta-mode";
import { getClientIp } from "@/lib/get-client-ip";
import { mapHypeRow, type HypeRow } from "@/lib/hype";
import { getPaymentProvider } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Hype claim flow — same PAYMENTS_ENABLED-gated dual-mode shape as
// /api/throne/claim (see src/lib/beta-mode.ts): free via hype_country_beta()
// in beta (checked server-side against the country's current claim's
// fingerprint — only that claim's holder can hype it), real money via
// hype_country() + the payments provider layer once paid mode is on.
// See scripts/setup-hype.mjs for both SQL functions.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const countryIsoCode = typeof body?.countryIsoCode === "string" ? body.countryIsoCode : null;
  const fingerprint = typeof body?.fingerprint === "string" ? body.fingerprint : null;
  const offeredAmount = typeof body?.offeredAmount === "number" ? body.offeredAmount : null;

  if (!countryIsoCode) {
    return NextResponse.json({ error: "Missing 'countryIsoCode'." }, { status: 400 });
  }
  if (!PAYMENTS_ENABLED && !fingerprint) {
    return NextResponse.json({ error: "Missing 'fingerprint'." }, { status: 400 });
  }
  if (PAYMENTS_ENABLED && (offeredAmount === null || !Number.isFinite(offeredAmount) || offeredAmount <= 0)) {
    return NextResponse.json({ error: "offeredAmount must be a positive number." }, { status: 400 });
  }

  const ip = getClientIp(request);

  async function currentHype() {
    const { data } = await supabaseAdmin.from("hype_slot_public").select("*").maybeSingle();
    return data ? mapHypeRow(data as HypeRow) : null;
  }

  if (!PAYMENTS_ENABLED) {
    const { data: purchaseId, error } = await supabaseAdmin.rpc("hype_country_beta", {
      p_country: countryIsoCode,
      p_claimer_ip: ip,
      p_fingerprint: fingerprint,
    });
    if (error || !purchaseId) {
      return NextResponse.json({ error: error?.message ?? "Hype failed." }, { status: 400 });
    }
    return NextResponse.json({ status: "completed", hype: await currentHype() });
  }

  const provider = getPaymentProvider();
  const { data: paymentRow, error: insertError } = await supabaseAdmin
    .from("hype_payments")
    .insert({
      country_iso_code: countryIsoCode,
      amount: offeredAmount,
      provider: provider.name,
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
    // Hype has no per-payer identity the way a throne claim's xHandle
    // does — the country code is the only stable label there is to give
    // the provider.
    xHandle: countryIsoCode,
    amount: offeredAmount as number,
    description: `World Leaders hype: ${countryIsoCode}`,
  });

  await supabaseAdmin.from("hype_payments").update({ provider_reference: outcome.providerReference }).eq("id", paymentId);

  if (outcome.checkoutUrl && !outcome.immediateResult) {
    return NextResponse.json({ status: "pending", checkoutUrl: outcome.checkoutUrl });
  }

  const { data: result, error: finalizeError } = await supabaseAdmin.rpc("finalize_hype_payment", {
    p_payment_id: paymentId,
    p_provider_success: outcome.immediateResult?.ok ?? false,
  });
  if (finalizeError) {
    return NextResponse.json({ error: finalizeError.message }, { status: 500 });
  }

  const finalStatus = (result as { status?: string } | null)?.status;
  if (finalStatus === "completed") {
    return NextResponse.json({ status: "completed", hype: await currentHype() });
  }

  const reason = (result as { reason?: string } | null)?.reason ?? "Payment failed.";
  return NextResponse.json({ status: "failed", error: reason }, { status: 400 });
}
