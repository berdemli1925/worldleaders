// Placeholder data for the "country leader" feature — there is no leader
// system yet (no throne claims, no payments), so this generates plausible
// example data instead. Everything here is deterministic (seeded by ISO
// code, anchored to a fixed date rather than `Date.now()`) so it renders
// identically on the server and the client — real wall-clock time only
// enters the picture later, in the live countdown display.
export interface MockLeader {
  handle: string;
  amountPaid: number;
  claimedAt: number;
  expiresAt: number;
}

export interface MockHistoryEntry {
  handle: string;
  amountPaid: number;
}

export interface MockCountryLeaderData {
  leader: MockLeader | null;
  basePrice: number;
  history: MockHistoryEntry[];
}

// Fixed reference point for all generated timestamps — keeps countdowns
// looking fresh around "today" without depending on real render time.
const ANCHOR_MS = Date.UTC(2026, 7, 22, 12, 0, 0);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 — small, fast, deterministic PRNG from an integer seed.
function mulberry32(seed: number) {
  let s = seed;
  return function random() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HANDLE_PREFIX = [
  "king",
  "lord",
  "baron",
  "emperor",
  "duke",
  "chief",
  "boss",
  "shadow",
  "crypto",
  "night",
  "iron",
  "golden",
  "silent",
  "mystic",
  "rogue",
  "captain",
  "lone",
  "el",
];
const HANDLE_SUFFIX = [
  "wolf",
  "raven",
  "fox",
  "hawk",
  "viper",
  "storm",
  "phoenix",
  "titan",
  "ghost",
  "nomad",
  "comet",
  "falcon",
  "otter",
  "panda",
  "bull",
];

function randomHandle(rng: () => number): string {
  const prefix = HANDLE_PREFIX[Math.floor(rng() * HANDLE_PREFIX.length)];
  const suffix = HANDLE_SUFFIX[Math.floor(rng() * HANDLE_SUFFIX.length)];
  const number = Math.floor(rng() * 99);
  return `${prefix}${suffix}${number}`;
}

function roundToNiceAmount(value: number): number {
  const step = value < 100 ? 5 : value < 1000 ? 10 : 50;
  return Math.max(step, Math.round(value / step) * step);
}

const cache = new Map<string, MockCountryLeaderData>();

export function getMockLeaderData(isoCode: string): MockCountryLeaderData {
  const cached = cache.get(isoCode);
  if (cached) return cached;

  const rng = mulberry32(hashSeed(isoCode));

  const basePrice = roundToNiceAmount(20 + rng() * 480);
  const hasLeader = rng() < 0.58;

  let leader: MockLeader | null = null;
  if (hasLeader) {
    const claimedAt = ANCHOR_MS - Math.floor(rng() * 3 * DAY);
    const expiresAt = claimedAt + 7 * DAY;
    const amountPaid = roundToNiceAmount(basePrice * (1 + rng() * 3));
    leader = { handle: randomHandle(rng), amountPaid, claimedAt, expiresAt };
  }

  const historyCount = Math.floor(rng() * 9);
  const history: MockHistoryEntry[] = Array.from({ length: historyCount }, () => ({
    handle: randomHandle(rng),
    amountPaid: roundToNiceAmount(basePrice * (0.5 + rng() * 2)),
  }));

  const data: MockCountryLeaderData = { leader, basePrice, history };
  cache.set(isoCode, data);
  return data;
}
