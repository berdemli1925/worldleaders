// AŞAMA 5 — starting scores. A curated (not random, not stored) baseline
// every country gets, so the map/leaderboard has visible variation from
// day one instead of 250 identical zeroes, without needing a database
// migration or a "fake activity" generator (both explicitly ruled out — see
// gelistirme-plani-v2.md's YAPILMAYACAKLAR).
//
// Kept deliberately separate from real votes everywhere it's used
// (src/lib/rank.ts's totalPower(), every "Starting score / Votes / Total
// power" breakdown in the UI) — never summed into something presented as
// "votes," per the plan's transparency requirement.
//
// Revision: originally a hash-of-ISO-code function giving every country a
// uniformly-random-looking value in [50,300] — deterministic, but
// meaningless (a hash doesn't know Samoa isn't a country that shows up in
// this kind of online voting/rivalry site). Replaced on direct request
// with a curated table reflecting realistic relative engagement for a
// Turkish-run global rivalry site: Turkey first, its neighbors/rivals and
// the world's most online-prominent countries next with real gaps between
// them, and a long tail of countries that would realistically have no
// organic activity yet at a flat, minimal floor. Still fully deterministic
// (same table every time) — just curated instead of hashed.
import countries from "world-countries";

export const MIN_STARTING_SCORE = 1;
export const MAX_STARTING_SCORE = 350;

// Every country not in this table falls back to this floor — "en alttakiler
// 1 oy olsun."
const DEFAULT_SCORE = 1;

// Roughly ~80 countries with real-world relevance to this site's likely
// audience: Turkey's immediate rivalry (Greece, Cyprus, Armenia), its
// closest ally (Azerbaijan) and neighbors (Russia, Iran, Iraq, Syria,
// Bulgaria, Georgia), the diaspora-heavy EU (Germany, Netherlands, Austria,
// Belgium, France), the rest of the Turkic world (Azerbaijan, Turkmenistan,
// Uzbekistan, Kazakhstan, Kyrgyzstan), the Middle East/Gulf, the Balkans,
// and the world's largest/most internet-prominent countries (US, China,
// India, Japan, Brazil, ...). Values are a hand-set descending curve, not a
// formula — deliberately curated, see the revision note above.
const CURATED_SCORES: Record<string, number> = {
  TR: 350, // Turkey — this is a Turkish site; #1 on day one is intentional.
  GR: 200, // Greece — the site's classic rivalry.
  RU: 150,
  UA: 130,
  AZ: 125, // "One nation, two states."
  DE: 118, // Largest Turkish diaspora in the world.
  US: 112,
  IR: 106,
  IL: 100,
  PS: 96,
  AM: 92,
  SY: 88,
  BG: 84,
  CY: 80,
  EG: 76,
  SA: 73,
  GB: 70,
  FR: 67,
  IQ: 64,
  IT: 61,
  CN: 58,
  IN: 56,
  JP: 54,
  KR: 52,
  BR: 50,
  PK: 48,
  NL: 46,
  AT: 44,
  BE: 42,
  ES: 40,
  GE: 38,
  RS: 37,
  BA: 36,
  AL: 35,
  XK: 34,
  MK: 33,
  RO: 32,
  PL: 31,
  SE: 30,
  CH: 29,
  QA: 28,
  AE: 27,
  KW: 26,
  JO: 25,
  LB: 24,
  LY: 23,
  TN: 22,
  DZ: 21,
  MA: 20,
  SD: 19,
  TM: 18,
  UZ: 17,
  KZ: 17,
  KG: 16,
  TJ: 16,
  AF: 15,
  ID: 15,
  MY: 14,
  MX: 14,
  AR: 13,
  CA: 13,
  AU: 12,
  PT: 12,
  NO: 11,
  DK: 11,
  FI: 10,
  HU: 10,
  CZ: 9,
  SK: 9,
  HR: 8,
  SI: 8,
  ME: 7,
  MD: 7,
  BY: 6,
  NG: 6,
  ZA: 5,
  KE: 5,
  ET: 5,
  VN: 4,
  TH: 4,
  PH: 3,
  SO: 3,
  YE: 2,
  BH: 2,
};

/** Starting score for one ISO alpha-2 code — curated for ~80 countries (see CURATED_SCORES), DEFAULT_SCORE for everyone else. */
export function getStartingScore(alpha2: string): number {
  return CURATED_SCORES[alpha2.toUpperCase()] ?? DEFAULT_SCORE;
}

let cache: Map<string, number> | null = null;

/** All 250 countries' starting scores, computed once and memoized — used anywhere that needs every country's value at once (map coloring, momentum ranking) rather than one at a time. */
export function getAllStartingScores(): Map<string, number> {
  if (!cache) {
    cache = new Map(countries.map((country) => [country.cca2, getStartingScore(country.cca2)]));
  }
  return cache;
}
