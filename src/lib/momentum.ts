// "Momentum" data — rank/vote snapshots at other points in time, derived
// entirely from the existing `votes` table (never deleted, only summarized
// elsewhere — see scripts/setup-monthly-archive.mjs) plus throne-claim and
// share bonuses (see throne-bonus.ts / share-bonus.ts), rather than a new
// table. Backs AŞAMA 4's rank-change arrows/tabs and AŞAMA 3's per-country
// "last 7 days" line — see /api/momentum (client-side callers) and
// src/app/[country]/page.tsx (calls this directly, server-side).
//
// Deliberately scoped to the current UTC month, same as the main
// `leaderboard` view/the monthly reset: a "24h ago" or "7d ago" snapshot
// that reached back across a reset would compare two different
// competitions. The one edge case this doesn't handle perfectly is the
// first ~7 days of a new month, where "7 days ago" partially or fully
// predates the reset and under-counts — accepted as a minor, self-correcting
// rough edge rather than added complexity (a real historical-snapshot table)
// for something that fixes itself within a week of every reset.
import countries from "world-countries";

import { getStartingScore } from "./seed-score";
import { SHARE_VOTE_BONUS } from "./share-bonus";
import { supabaseAdmin } from "./supabase/admin";
import { currentMonthStartIso } from "./time";
import { THRONE_CLAIM_BONUS } from "./throne-bonus";

export interface RecentVote {
  isoCode: string;
  createdAt: number;
}

export interface MomentumData {
  /** Rank right now, this month. */
  rankNow: Map<string, number>;
  rank24hAgo: Map<string, number>;
  rank7dAgo: Map<string, number>;
  voteCountNow: Map<string, number>;
  votesLast24h: Map<string, number>;
  /** Real votes cast since UTC midnight today — AŞAMA 6's "Votes today" stat. Real votes only, never the starting baseline or bonuses. */
  votesToday: number;
  /** Most recent real votes, newest first — AŞAMA 6's live feed. Country only, no voter identity is ever tracked. */
  recentVotes: RecentVote[];
}

const RECENT_VOTES_LIMIT = 20;

function todayStartUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function zeroMap(keys: string[]): Map<string, number> {
  return new Map(keys.map((key) => [key, 0]));
}

function bump(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

// Ranks by total votes (starting baseline + real votes + bonuses at that
// point in time — see src/lib/rank.ts, which every other ranked list in the
// app also goes through). Every snapshot (now, 24h ago, 7d ago) adds the
// same per-country starting score, so it cancels out of a *change* like the
// 24h arrow, but it does affect each snapshot's absolute rank order, which
// is what "biggest climbers"/"rising" ultimately sort by.
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
  const todayStart = todayStartUtcIso();
  const monthStartIso = currentMonthStartIso();
  let votesToday = 0;

  const [{ data: voteData, error: voteError }, { data: claimData }, shareResult] = await Promise.all([
    supabaseAdmin.from("votes").select("country_iso_code, created_at").gte("created_at", monthStartIso),
    supabaseAdmin.from("throne_claims_public").select("country_iso_code, created_at").gte("created_at", monthStartIso),
    // share_bonuses_public may not exist yet (see scripts/setup-share-bonus.mjs)
    // — treated as "no bonuses yet" rather than a hard error until it's run.
    supabaseAdmin.from("share_bonuses_public").select("country_iso_code, created_at").gte("created_at", monthStartIso),
  ]);

  const voteRows = !voteError && voteData ? (voteData as { country_iso_code: string; created_at: string }[]) : [];

  // Real votes: feed both the ranking counts (weight 1) and the
  // real-activity-only figures (votesToday/recentVotes/votesLast24h).
  for (const row of voteRows) {
    bump(countsNow, row.country_iso_code);
    if (row.created_at < cutoff24h) {
      bump(counts24hAgo, row.country_iso_code);
    } else {
      bump(votes24h, row.country_iso_code);
    }
    if (row.created_at < cutoff7d) {
      bump(counts7dAgo, row.country_iso_code);
    }
    if (row.created_at >= todayStart) {
      votesToday += 1;
    }
  }

  // Throne-claim and share bonuses: feed only the ranking counts, at their
  // own weights — never treated as "real votes" for the activity feed
  // (LiveFeed already shows throne claims as their own distinct event type).
  const bonusRows: { rows: { country_iso_code: string; created_at: string }[] | null | undefined; weight: number }[] = [
    { rows: claimData as { country_iso_code: string; created_at: string }[] | null, weight: THRONE_CLAIM_BONUS },
    { rows: shareResult.data as { country_iso_code: string; created_at: string }[] | null, weight: SHARE_VOTE_BONUS },
  ];
  for (const { rows, weight } of bonusRows) {
    for (const row of rows ?? []) {
      bump(countsNow, row.country_iso_code, weight);
      if (row.created_at < cutoff24h) bump(counts24hAgo, row.country_iso_code, weight);
      if (row.created_at < cutoff7d) bump(counts7dAgo, row.country_iso_code, weight);
    }
  }

  const recentVotes = voteRows
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, RECENT_VOTES_LIMIT)
    .map((row) => ({ isoCode: row.country_iso_code, createdAt: new Date(row.created_at).getTime() }));

  return {
    rankNow: rankFromCounts(countsNow),
    rank24hAgo: rankFromCounts(counts24hAgo),
    rank7dAgo: rankFromCounts(counts7dAgo),
    voteCountNow: countsNow,
    votesLast24h: votes24h,
    votesToday,
    recentVotes,
  };
}

export interface SerializedMomentum {
  rankNow: Record<string, number>;
  rank24hAgo: Record<string, number>;
  rank7dAgo: Record<string, number>;
  voteCountNow: Record<string, number>;
  votesLast24h: Record<string, number>;
  votesToday: number;
  recentVotes: RecentVote[];
}

export function serializeMomentum(data: MomentumData): SerializedMomentum {
  const toObject = (map: Map<string, number>) => Object.fromEntries(map);
  return {
    rankNow: toObject(data.rankNow),
    rank24hAgo: toObject(data.rank24hAgo),
    rank7dAgo: toObject(data.rank7dAgo),
    voteCountNow: toObject(data.voteCountNow),
    votesLast24h: toObject(data.votesLast24h),
    votesToday: data.votesToday,
    recentVotes: data.recentVotes,
  };
}
