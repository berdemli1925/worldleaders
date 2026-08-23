import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// One-click content takedown — used by the admin dashboard and, with a
// different `reason`, by the automated change-check cron
// (src/app/api/cron/check-active-leaders). Calls the same remove_claim()
// Postgres function either way — see scripts/setup-moderation.mjs.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  const claimId = Number(id);
  if (!Number.isInteger(claimId)) {
    return NextResponse.json({ error: "Invalid claim id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : "Removed by admin.";

  const { error } = await supabaseAdmin.rpc("remove_claim", { p_claim_id: claimId, p_reason: reason });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
