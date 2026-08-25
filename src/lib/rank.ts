// The site's one definition of "votes" and rank: real votes cast here,
// plus a starting baseline (src/lib/seed-score.ts) and any bonuses
// (throne claims — src/lib/throne-bonus.ts; X shares — src/lib/share-bonus.ts)
// — all folded into a single number, always just presented as "votes."
//
// (Earlier revision showed this as a "starting score / total power"
// breakdown, kept deliberately separate from "votes" in every UI. Changed
// on direct request: the baseline should read as real votes, not a
// separately-labeled mechanic.)
//
// Every ranked list in the app (leaderboard, hero, map color scale,
// country pages, closest battles) goes through this so they all agree on
// the same order.
import { getStartingScore } from "./seed-score";

export interface RankedCountry {
  isoCode: string;
  name: string;
  continent: string;
  voteCount: number;
}

export interface CountryRow {
  isoCode: string;
  name: string;
  continent: string;
  voteCount: number;
}

/**
 * @param bonusByIso Combined throne-claim + share bonuses (already merged —
 * see src/lib/throne-bonus.ts's mergeBonusMaps), scoped to whatever period
 * the caller's `rows` themselves are scoped to (this month vs. all time).
 */
export function toRankedEntries(rows: CountryRow[], bonusByIso: Map<string, number> = new Map()): RankedCountry[] {
  return rows
    .map((row) => ({
      ...row,
      voteCount: row.voteCount + getStartingScore(row.isoCode) + (bonusByIso.get(row.isoCode) ?? 0),
    }))
    .sort((a, b) => b.voteCount - a.voteCount || a.name.localeCompare(b.name));
}
