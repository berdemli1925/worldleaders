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

export interface RivalInfo {
  isoCode: string;
  name: string;
  voteCount: number;
  direction: "ahead" | "behind";
  gap: number;
}

// A gap only reads as a real "matchup" — worth calling out by name in a
// share card — if it's small relative to the two countries' own vote
// counts. A 40-vote gap between two countries with 60 votes each is
// basically a coin flip; the same 40-vote gap next to leaders with
// thousands of votes is noise. The floor keeps small/new countries from
// being excluded just for having small absolute numbers.
//
// Loosened from an initial 0.15/25 (direct correction): the site's own
// curated starting scores (seed-score.ts) deliberately put Turkey ~150
// points ahead of Greece on day one ("Turkey first... with real gaps
// between them"), which a strict ratio treated as "not a real rivalry" —
// exactly backwards for the site's own flagship match-up. 0.5 keeps a
// truly lopsided leader (10x the runner-up) falling back to the
// single-country card, while letting intentional-but-sizeable gaps like
// TR/GR still read as a contest.
const RIVAL_GAP_RATIO = 0.5;
const RIVAL_GAP_FLOOR = 30;

/**
 * The country worth calling a "rival" for `isoCode` within `entries`
 * (already sorted desc by vote count — see toRankedEntries): whichever
 * neighbor immediately above or below in rank has the smaller gap. Direct
 * request: "puan olarak ona en yakın olan ülke olsun — üstünde veya
 * altında, hangisi daha yakınsa" (whichever neighbor is closer in points,
 * above or below). Returns null when there's no neighbor on either side, or
 * the closest one still isn't close enough to read as a real contest — the
 * caller should fall back to a single-country presentation in that case.
 */
export function findClosestRival(entries: RankedCountry[], isoCode: string): RivalInfo | null {
  const index = entries.findIndex((entry) => entry.isoCode === isoCode);
  if (index < 0) return null;
  const self = entries[index];
  const above = index > 0 ? entries[index - 1] : null;
  const below = index < entries.length - 1 ? entries[index + 1] : null;

  const gapAbove = above ? above.voteCount - self.voteCount : null;
  const gapBelow = below ? self.voteCount - below.voteCount : null;

  let neighbor: RankedCountry | null = null;
  let direction: "ahead" | "behind" = "ahead";
  let gap = 0;
  if (gapAbove !== null && (gapBelow === null || gapAbove <= gapBelow)) {
    neighbor = above;
    direction = "ahead";
    gap = gapAbove;
  } else if (gapBelow !== null && below) {
    neighbor = below;
    direction = "behind";
    gap = gapBelow;
  }
  if (!neighbor) return null;

  const threshold = Math.max(RIVAL_GAP_FLOOR, Math.max(self.voteCount, neighbor.voteCount) * RIVAL_GAP_RATIO);
  if (gap > threshold) return null;

  return { isoCode: neighbor.isoCode, name: neighbor.name, voteCount: neighbor.voteCount, direction, gap };
}
