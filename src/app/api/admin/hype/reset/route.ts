import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Blunt "clear the spotlight" admin lever — same posture as
// /api/admin/thrones/[country]/reset, just for the single global hype slot
// instead of a per-country throne. See scripts/setup-hype.mjs's
// reset_hype().
export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { error } = await supabaseAdmin.rpc("reset_hype");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
