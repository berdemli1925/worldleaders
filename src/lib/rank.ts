// The site's one definition of "rank": total power (starting score + real
// votes), highest first — see src/lib/seed-score.ts for why a starting
// score exists at all. Every ranked list in the app (leaderboard, hero,
// map color scale, country pages, closest battles) goes through this so
// they all agree on the same order, instead of some sorting by raw votes
// and others by power.
import { getStartingScore } from "./seed-score";

export interface RankedCountry {
  isoCode: string;
  name: string;
  continent: string;
  voteCount: number;
  startingScore: number;
  totalPower: number;
}

export interface CountryRow {
  isoCode: string;
  name: string;
  continent: string;
  voteCount: number;
}

export function toRankedEntries(rows: CountryRow[]): RankedCountry[] {
  return rows
    .map((row) => {
      const startingScore = getStartingScore(row.isoCode);
      return { ...row, startingScore, totalPower: startingScore + row.voteCount };
    })
    .sort((a, b) => b.totalPower - a.totalPower || a.name.localeCompare(b.name));
}
