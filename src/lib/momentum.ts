// "Momentum" data — rank/vote snapshots at other points in time, derived
// entirely from the existing `votes` table (never deleted, only summarized
// elsewhere — see scripts/setup-monthly-archive.mjs) rather than a new
// table. Backs AŞAMA 4's rank-change arrows/tabs and AŞAMA 3's per-country
// "last 7 days" line — see /api/momentum (client-side callers) and
// src/app/[country]/page.tsx (calls this directly, server-side).
//
// Deliberately scoped to the current UTC month, same as the main
// `leaderboard` view/AŞAMA 5's "monthly reset": a "24h ago" or "7d ago"
// snapshot that reached back across a reset would compare two different
// competitions. The one edge case this doesn't handle perfectly is the
// first ~7 days of a new month, where "7 days ago" partially or fully
// predates the reset and under-counts — accepted as a minor, self-correcting
// rough edge rather than added complexity (a real historical-snapshot table)
// for something that fixes itself within a week of every reset.
import countries from "world-countries";

import { getStartingScore } from "./seed-score";
import { supabaseAdmin } from "./supabase/admin";

export interface MomentumData {
  /** Rank right now, this month. */
  rankNow: Map<string, number>;
  rank24hAgo: Map<string, number>;
  rank7dAgo: Map<string, number>;
  voteCountNow: Map<string, number>;
  votesLast24h: Map<string, number>;
}

function currentMonthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function zeroMap(keys: string[]): Map<string, number> {
  return new Map(keys.map((key) => [key, 0]));
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

// Ranks by total power (AŞAMA 5: starting score + votes at that point in
// time), the same metric the main leaderboard/hero/map use — see
// src/lib/rank.ts. Every snapshot (now, 24h ago, 7d ago) adds the same
// per-country starting score, so it cancels out of a *change* like the 24h
// arrow, but it does affect each snapshot's absolute rank order, which is
// what "biggest climbers"/"rising" ultimately sort by.
function rankFromCounts(counts: Map<string, number>): Map<string, number> {
  const sorted = [...counts.entries()].sort(
    (a, b) => b[1] + getStartingScore(b[0]) - (a[1] + getStartingScore(a[0])) || a[0].localeCompare(b[0]),
  );
  const rank = new Map<string, number>();
  sorted.forEach(([iso], index) => rank.set(iso, index + 1));
  return rank;
}

export async function getMomentumData(): Promise<MomentumData> {
  const allIso = countries.map((c) => c.cca2);
  const countsNow = zeroMap(allIso);
  const counts24hAgo = zeroMap(allIso);
  const counts7dAgo = zeroMap(allIso);
  const votes24h = zeroMap(allIso);

  const nowMs = Date.now();
  const cutoff24h = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const cutoff7d = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString();

  // One query, aggregated in JS below — cheap enough at this site's current
  // vote volume (pre-launch) and avoids needing a Postgres function/view
  // that would have to be created via direct DB access this app doesn't
  // have at runtime (see scripts/*.mjs — those all require a
  // command-line-only DATABASE_URL, deliberately never available here).
  const { data, error } = await supabaseAdmin
    .from("votes")
    .select("country_iso_code, created_at")
    .gte("created_at", currentMonthStartIso());

  if (!error && data) {
    for (const row of data as { country_iso_code: string; created_at: string }[]) {
      bump(countsNow, row.country_iso_code);
      if (row.created_at < cutoff24h) {
        bump(counts24hAgo, row.country_iso_code);
      } else {
        bump(votes24h, row.country_iso_code);
      }
      if (row.created_at < cutoff7d) {
        bump(counts7dAgo, row.country_iso_code);
      }
    }
  }

  return {
    rankNow: rankFromCounts(countsNow),
    rank24hAgo: rankFromCounts(counts24hAgo),
    rank7dAgo: rankFromCounts(counts7dAgo),
    voteCountNow: countsNow,
    votesLast24h: votes24h,
  };
}

export interface SerializedMomentum {
  rankNow: Record<string, number>;
  rank24hAgo: Record<string, number>;
  rank7dAgo: Record<string, number>;
  voteCountNow: Record<string, number>;
  votesLast24h: Record<string, number>;
}

export function serializeMomentum(data: MomentumData): SerializedMomentum {
  const toObject = (map: Map<string, number>) => Object.fromEntries(map);
  return {
    rankNow: toObject(data.rankNow),
    rank24hAgo: toObject(data.rank24hAgo),
    rank7dAgo: toObject(data.rank7dAgo),
    voteCountNow: toObject(data.voteCountNow),
    votesLast24h: toObject(data.votesLast24h),
  };
}
