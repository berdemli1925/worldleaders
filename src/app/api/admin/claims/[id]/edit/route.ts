import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Direct request: admin needed a way to fix a claim's content in place
// (typo, swap a broken logo link, tone down a description) instead of the
// only lever being "remove entirely" (see ../[id]/remove). Plain table
// update, not an RPC — there's no business-rule math here (unlike
// claim_throne's credit/pricing), just four columns an admin already has
// full access to via supabaseAdmin. Each field is independently optional
// (undefined = leave alone) so a partial edit — just the logo, say —
// doesn't blank out the others.
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
  const update: Record<string, string | null> = {};
  for (const [bodyKey, column] of [
    ["brandTitle", "brand_title"],
    ["description", "description"],
    ["logoUrl", "logo_url"],
    ["linkUrl", "link_url"],
  ] as const) {
    const value = body?.[bodyKey];
    if (typeof value === "string") update[column] = value.trim() || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update — pass at least one field." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("throne_claims").update(update).eq("id", claimId).select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: `Unknown claim: ${claimId}` }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
