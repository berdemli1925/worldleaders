// AŞAMA 5 — starting scores. A deterministic (never random, never stored)
// baseline every country gets, so the map/leaderboard has visible variation
// from day one instead of 250 identical zeroes, without needing a database
// migration or a "fake activity" generator (both explicitly ruled out — see
// gelistirme-plani-v2.md's YAPILMAYACAKLAR).
//
// Kept deliberately separate from real votes everywhere it's used
// (src/lib/rank.ts's totalPower(), every "Starting score / Votes / Total
// power" breakdown in the UI) — never summed into something presented as
// "votes," per the plan's transparency requirement.
import countries from "world-countries";

export const MIN_STARTING_SCORE = 50;
export const MAX_STARTING_SCORE = 300;

// FNV-1a — a simple, well-known non-cryptographic hash. The only property
// that matters here is that it's a pure function of the ISO code: the same
// country always gets the same starting score, computed fresh every time
// rather than read from a table, and nothing here is trying to be
// unpredictable/secure the way a real hash function would need to be.
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic starting score in [MIN_STARTING_SCORE, MAX_STARTING_SCORE] for one ISO alpha-2 code. */
export function getStartingScore(alpha2: string): number {
  const range = MAX_STARTING_SCORE - MIN_STARTING_SCORE + 1;
  return MIN_STARTING_SCORE + (fnv1a(alpha2.toUpperCase()) % range);
}

let cache: Map<string, number> | null = null;

/** All 250 countries' starting scores, computed once and memoized — used anywhere that needs every country's value at once (map coloring, momentum ranking) rather than one at a time. */
export function getAllStartingScores(): Map<string, number> {
  if (!cache) {
    cache = new Map(countries.map((country) => [country.cca2, getStartingScore(country.cca2)]));
  }
  return cache;
}
