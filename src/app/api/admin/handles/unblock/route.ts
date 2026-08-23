import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const xHandle = typeof body?.xHandle === "string" ? body.xHandle.trim().replace(/^@/, "") : null;
  if (!xHandle) {
    return NextResponse.json({ error: "Missing 'xHandle'." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("blocked_handles").delete().eq("x_handle", xHandle);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
