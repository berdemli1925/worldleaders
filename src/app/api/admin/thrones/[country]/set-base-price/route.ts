import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Direct request: a way to correct a country's base price by hand — the
// automated refresh_throne_base_prices() cron (scripts/setup-throne-system.mjs)
// re-derives every price on its own schedule, but "fix this one country
// right now" (mispriced, or hand-tuning a launch promo) had no lever
// before this. Plain table update — base_price carries no cross-row math
// the way current_value/credit does in claim_throne(), so no RPC needed.
export async function POST(request: NextRequest, { params }: { params: Promise<{ country: string }> }) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { country } = await params;
  const body = await request.json().catch(() => null);
  const basePrice = typeof body?.basePrice === "number" ? body.basePrice : NaN;
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    return NextResponse.json({ error: "basePrice must be a non-negative number." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("thrones")
    .update({ base_price: basePrice })
    .eq("country_iso_code", country.toUpperCase())
    .select("country_iso_code");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: `Unknown country: ${country}` }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
