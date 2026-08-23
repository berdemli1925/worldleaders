import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyPostUnchanged } from "@/lib/x-post";

// Periodic change-audit: re-checks every currently-active leader's post via
// oEmbed (see src/lib/x-post.ts's verifyPostUnchanged — deliberately fuzzy
// text comparison, documented there) and auto-removes any that are
// deleted/hidden/edited. Configured to run on a schedule via Vercel Cron —
// see vercel.json — but is a plain HTTP route, so it's also testable by
// hand any time:
//   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/check-active-leaders
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("thrones_with_leader")
    .select("country_iso_code, current_claim_id, post_text")
    .not("current_claim_id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const checked: string[] = [];
  const removed: { country: string; claimId: number; reason: string }[] = [];

  for (const row of rows ?? []) {
    const claimId = row.current_claim_id as number;
    checked.push(row.country_iso_code as string);

    // We never stored the post's own URL — rebuild it from the syndication
    // snapshot's tweet id + author handle instead.
    const { data: claim } = await supabaseAdmin
      .from("throne_claims")
      .select("post_snapshot")
      .eq("id", claimId)
      .maybeSingle();
    const snapshotId = (claim?.post_snapshot as { id_str?: string } | null)?.id_str;
    const authorHandle = (claim?.post_snapshot as { user?: { screen_name?: string } } | null)?.user?.screen_name;
    if (!snapshotId || !authorHandle) {
      continue; // can't rebuild a URL to check — leave it alone rather than guess
    }
    const url = `https://x.com/${authorHandle}/status/${snapshotId}`;

    const result = await verifyPostUnchanged(url, (row.post_text as string | null) ?? "");
    if (!result.ok) {
      const reason =
        result.reason === "deleted"
          ? "Post was deleted or is no longer reachable (automated check)."
          : result.reason === "edited"
            ? "Post text no longer matches the claimed snapshot (automated check)."
            : "Post couldn't be verified (automated check).";
      // "unverifiable" (network hiccup, X rate limit, etc.) shouldn't nuke a
      // leader on a transient blip — only act on confirmed deleted/edited.
      if (result.reason !== "unverifiable") {
        await supabaseAdmin.rpc("remove_claim", { p_claim_id: claimId, p_reason: reason });
        removed.push({ country: row.country_iso_code as string, claimId, reason });
      }
    }
  }

  return NextResponse.json({ checked: checked.length, removed });
}
