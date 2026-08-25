import { NextRequest, NextResponse } from "next/server";

import { getClientIp } from "@/lib/get-client-ip";
import { supabaseAdmin } from "@/lib/supabase/admin";

// +5 votes, once ever per person (IP + browser fingerprint, same pairing
// voting itself uses), for sharing your vote on X — see
// src/lib/share-bonus.ts. Needs the `share_bonuses` table from
// scripts/setup-share-bonus.mjs; until that's been run (with
// DATABASE_URL), every call here resolves to `{ granted: false }` rather
// than erroring, so the share button itself never breaks.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const isoCode = typeof body?.isoCode === "string" ? body.isoCode.toUpperCase() : null;
  const fingerprint = typeof body?.fingerprint === "string" ? body.fingerprint : null;

  if (!isoCode || !fingerprint) {
    return NextResponse.json({ error: "Missing 'isoCode' or 'fingerprint' in request body." }, { status: 400 });
  }

  try {
    const { data: country, error: countryError } = await supabaseAdmin
      .from("countries")
      .select("iso_code")
      .eq("iso_code", isoCode)
      .maybeSingle();
    if (countryError) throw countryError;
    if (!country) {
      return NextResponse.json({ error: "Unknown country." }, { status: 404 });
    }

    const ip = getClientIp(request);

    const { error: insertError } = await supabaseAdmin
      .from("share_bonuses")
      .insert({ voter_ip: ip, fingerprint, country_iso_code: isoCode });

    if (!insertError) {
      return NextResponse.json({ granted: true, alreadyClaimed: false });
    }

    // 23505 = unique_violation — this voter already has a row (primary key
    // is (voter_ip, fingerprint)), i.e. they've already claimed their
    // one-time bonus, for this or another country.
    if (insertError.code === "23505") {
      return NextResponse.json({ granted: false, alreadyClaimed: true });
    }

    // 42P01 = undefined_table — the migration hasn't been run yet. Not an
    // error from the sharer's point of view: they already shared
    // successfully, this is purely a bonus that isn't switched on yet.
    if (insertError.code === "42P01") {
      return NextResponse.json({ granted: false, alreadyClaimed: false, enabled: false });
    }

    throw insertError;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
