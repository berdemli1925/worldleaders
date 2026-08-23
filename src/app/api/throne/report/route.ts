import { NextRequest, NextResponse } from "next/server";

import { getClientIp } from "@/lib/get-client-ip";
import { REPORT_REASONS } from "@/lib/report-reasons";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Report button target — records into moderation_reports for an admin to
// review at /admin. Doesn't take any action itself (no auto-removal on
// report count), just queues it for a human.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const throneClaimId = typeof body?.throneClaimId === "number" ? body.throneClaimId : null;
  const reason = typeof body?.reason === "string" ? body.reason : null;
  const details = typeof body?.details === "string" ? body.details.trim() || null : null;

  if (!throneClaimId || !reason || !(REPORT_REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json({ error: "Missing or invalid 'throneClaimId'/'reason'." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("moderation_reports").insert({
    throne_claim_id: throneClaimId,
    reason,
    details,
    reporter_ip: getClientIp(request),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
