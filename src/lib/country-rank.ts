// Server-only: fetches the current month's ranking and ranks it by total
// votes (src/lib/rank.ts, folding in the starting baseline, throne-claim
// bonus, and share bonus). Kept separate from rank.ts itself (which is pure
// and imported client-side too, e.g. by Dashboard.tsx) because this one
// touches supabaseAdmin — bundling that into a client component would leak
// server-only env vars into the browser bundle and crash on init.
import { bonusByIso, mergeBonusMaps, THRONE_CLAIM_BONUS } from "./throne-bonus";
import { toRankedEntries, type RankedCountry } from "./rank";
import { SHARE_VOTE_BONUS } from "./share-bonus";
import { supabaseAdmin } from "./supabase/admin";
import { currentMonthStartIso } from "./time";

export async function getRankedLeaderboard(): Promise<RankedCountry[]> {
  const monthStartIso = currentMonthStartIso();
  const monthStartMs = new Date(monthStartIso).getTime();

  const [{ data: rows }, { data: claimRows }, shareResult] = await Promise.all([
    supabaseAdmin.from("leaderboard").select("iso_code, name, continent, vote_count"),
    supabaseAdmin.from("throne_claims_public").select("country_iso_code, created_at").gte("created_at", monthStartIso),
    // share_bonuses_public may not exist yet (see scripts/setup-share-bonus.mjs)
    // — treated as "no bonuses yet" rather than a hard error until it's run.
    supabaseAdmin.from("share_bonuses_public").select("country_iso_code, created_at").gte("created_at", monthStartIso),
  ]);

  const claimEvents = (claimRows ?? []).map((row) => ({
    isoCode: row.country_iso_code as string,
    createdAt: new Date(row.created_at as string).getTime(),
  }));
  const shareEvents = (shareResult.data ?? []).map((row) => ({
    isoCode: row.country_iso_code as string,
    createdAt: new Date(row.created_at as string).getTime(),
  }));

  const bonus = mergeBonusMaps(
    bonusByIso(claimEvents, monthStartMs, THRONE_CLAIM_BONUS),
    bonusByIso(shareEvents, monthStartMs, SHARE_VOTE_BONUS),
  );

  return toRankedEntries(
    (rows ?? []).map((row) => ({
      isoCode: row.iso_code as string,
      name: row.name as string,
      continent: row.continent as string,
      voteCount: row.vote_count as number,
    })),
    bonus,
  );
}
