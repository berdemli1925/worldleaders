import { NextRequest, NextResponse } from "next/server";

import { getClientIp } from "@/lib/get-client-ip";
import { supabaseAdmin } from "@/lib/supabase/admin";

// The daily vote limit resets on the UTC calendar day, matching the spec's
// "1 vote per IP per day" rule.
function todayStartUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

async function countVotesFor(countryIsoCode: string) {
  const { count, error } = await supabaseAdmin
    .from("votes")
    .select("*", { count: "exact", head: true })
    .eq("country_iso_code", countryIsoCode);
  if (error) throw error;
  return count ?? 0;
}

// "One voter" = this IP AND this browser fingerprint together, not either one
// alone. That's a deliberate loosening of the pure-IP rule: it lets distinct
// people behind the same shared/CGNAT IP each get their own vote, while still
// requiring both signals to match for someone to be considered "the same
// voter" today.
async function findTodaysVote(voterIp: string, fingerprint: string) {
  const { data, error } = await supabaseAdmin
    .from("votes")
    .select("id, country_iso_code")
    .eq("voter_ip", voterIp)
    .eq("fingerprint", fingerprint)
    .gte("created_at", todayStartUtcIso())
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

async function verifyTurnstile(
  token: string | null | undefined,
  ip: string,
): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Not wired up yet — allow through so the app keeps working while it's
    // being set up. This should never be the case in a real deployment.
    console.warn("TURNSTILE_SECRET_KEY is not set — skipping bot verification.");
    return { ok: true };
  }
  if (!token) {
    return { ok: false, reason: "Missing verification token." };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  body.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const data = (await res.json()) as { success: boolean };
  if (!data.success) {
    return { ok: false, reason: "Verification failed. Please try again." };
  }
  return { ok: true };
}

export async function GET(request: NextRequest) {
  // `country` is optional here: callers that only need the global "have I
  // voted today, and for what" status (e.g. to drive per-row vote buttons in
  // a leaderboard, without one count request per row) can omit it and get
  // `count: null` back.
  const countryIsoCode = request.nextUrl.searchParams.get("country");
  const fingerprint = request.nextUrl.searchParams.get("fingerprint");
  if (!fingerprint) {
    return NextResponse.json({ error: "Missing 'fingerprint' query parameter." }, { status: 400 });
  }

  try {
    const ip = getClientIp(request);
    const [count, todaysVote] = await Promise.all([
      countryIsoCode ? countVotesFor(countryIsoCode) : Promise.resolve(null),
      findTodaysVote(ip, fingerprint),
    ]);

    return NextResponse.json({
      count,
      votedToday: todaysVote !== null,
      votedCountryIsoCode: todaysVote?.country_iso_code ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const countryIsoCode = typeof body?.countryIsoCode === "string" ? body.countryIsoCode : null;
  const fingerprint = typeof body?.fingerprint === "string" ? body.fingerprint : null;
  const turnstileToken = typeof body?.turnstileToken === "string" ? body.turnstileToken : null;

  if (!countryIsoCode || !fingerprint) {
    return NextResponse.json(
      { error: "Missing 'countryIsoCode' or 'fingerprint' in request body." },
      { status: 400 },
    );
  }

  try {
    const ip = getClientIp(request);

    const verification = await verifyTurnstile(turnstileToken, ip);
    if (!verification.ok) {
      return NextResponse.json({ error: verification.reason }, { status: 403 });
    }

    const { data: country, error: countryError } = await supabaseAdmin
      .from("countries")
      .select("iso_code")
      .eq("iso_code", countryIsoCode)
      .maybeSingle();
    if (countryError) throw countryError;
    if (!country) {
      return NextResponse.json({ error: "Unknown country." }, { status: 404 });
    }

    const todaysVote = await findTodaysVote(ip, fingerprint);

    // Already voted for this exact country today — no-op.
    if (todaysVote && todaysVote.country_iso_code === countryIsoCode) {
      const count = await countVotesFor(countryIsoCode);
      return NextResponse.json({ count, votedToday: true, votedCountryIsoCode: countryIsoCode });
    }

    // Voted for a different country today — move the vote by deleting the
    // old one before inserting the new one.
    if (todaysVote) {
      const { error: deleteError } = await supabaseAdmin.from("votes").delete().eq("id", todaysVote.id);
      if (deleteError) throw deleteError;
    }

    const { error: insertError } = await supabaseAdmin
      .from("votes")
      .insert({ country_iso_code: countryIsoCode, voter_ip: ip, fingerprint });
    if (insertError) throw insertError;

    const count = await countVotesFor(countryIsoCode);
    return NextResponse.json({ count, votedToday: true, votedCountryIsoCode: countryIsoCode });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
