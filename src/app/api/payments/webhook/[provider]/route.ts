import { NextRequest, NextResponse } from "next/server";

import { getPaymentProviderByName } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Not exercised by the mock provider (it resolves synchronously in the
// claim route itself — see src/app/api/throne/claim/route.ts) but built
// now so plugging in a real, redirect-based provider later is just
// "point its webhook URL here" — no new route, no change to the claim
// flow or finalize_payment().
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerName } = await params;
  const provider = getPaymentProviderByName(providerName);
  if (!provider) {
    return NextResponse.json({ error: `Unknown payment provider "${providerName}".` }, { status: 404 });
  }

  const event = await provider.parseWebhook(request);
  if (!event) {
    // Not a recognized/validly-signed event for this provider — ack with
    // 200 anyway so the provider doesn't retry something we'll never
    // understand, matching most providers' recommended webhook posture.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { data: payment, error: lookupError } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("provider_reference", event.providerReference)
    .maybeSingle();
  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!payment) {
    // Unknown reference — ack anyway, nothing more we can do with it.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { error: finalizeError } = await supabaseAdmin.rpc("finalize_payment", {
    p_payment_id: payment.id,
    p_provider_success: event.result.ok,
  });
  if (finalizeError) {
    return NextResponse.json({ error: finalizeError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
