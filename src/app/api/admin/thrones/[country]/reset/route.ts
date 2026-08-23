import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Blunt "reset this country's throne" action — vacates it unconditionally,
// no claim-row bookkeeping (that's remove_claim's job, for content
// takedowns specifically). See scripts/setup-moderation.mjs.
export async function POST(request: NextRequest, { params }: { params: Promise<{ country: string }> }) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { country } = await params;
  const { error } = await supabaseAdmin.rpc("reset_throne", { p_country: country.toUpperCase() });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
