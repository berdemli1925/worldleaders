// Server-only: fetches the current month's ranking and ranks it by total
// power (src/lib/rank.ts). Kept separate from rank.ts itself (which is pure
// and imported client-side too, e.g. by Dashboard.tsx) because this one
// touches supabaseAdmin — bundling that into a client component would leak
// server-only env vars into the browser bundle and crash on init.
import { toRankedEntries, type RankedCountry } from "./rank";
import { supabaseAdmin } from "./supabase/admin";

export async function getRankedLeaderboard(): Promise<RankedCountry[]> {
  const { data } = await supabaseAdmin.from("leaderboard").select("iso_code, name, continent, vote_count");
  return toRankedEntries(
    (data ?? []).map((row) => ({
      isoCode: row.iso_code as string,
      name: row.name as string,
      continent: row.continent as string,
      voteCount: row.vote_count as number,
    })),
  );
}
