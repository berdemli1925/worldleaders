import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Emergency kill switch — flips site_settings.leadership_hidden. When true,
// thrones_live (see scripts/setup-moderation.mjs) reads every country as
// vacant, hiding every currently-displayed leader everywhere on the public
// site instantly, and claim_throne() itself rejects new claims — nothing is
// deleted, this is fully reversible.
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const hidden = typeof body?.hidden === "boolean" ? body.hidden : null;
  if (hidden === null) {
    return NextResponse.json({ error: "Missing boolean 'hidden'." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("site_settings")
    .upsert({ key: "leadership_hidden", value: hidden, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, hidden });
}
