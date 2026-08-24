"use client";

import { useMemo } from "react";

import Flag from "./Flag";
import type { LeaderboardEntry } from "./Leaderboard";

interface ClosestBattlesProps {
  entries: LeaderboardEntry[];
  submittingIso: string | null;
  onVote: (isoCode: string) => void;
  onSelectCountry: (isoCode: string) => void;
}

const MAX_BATTLES = 5;

// AŞAMA 4: automatically finds the closest adjacent-rank pairs (smallest
// vote gap) and surfaces them as head-to-head match-ups with a vote button
// on each side — the "sit and watch the leaderboard" version of AŞAMA 2's
// per-vote rival callout.
function findClosestBattles(entries: LeaderboardEntry[]) {
  const battles: { a: LeaderboardEntry; b: LeaderboardEntry; gap: number }[] = [];
  for (let i = 0; i < entries.length - 1; i++) {
    const a = entries[i];
    const b = entries[i + 1];
    // A 0-vote vs 0-vote pair anywhere in the long tail is a "battle" in
    // name only — every one of those adjacent pairs would tie for closest
    // and crowd out the real ones.
    if (a.voteCount === 0 && b.voteCount === 0) continue;
    // Total power (AŞAMA 5), not raw votes — the gap that actually
    // separates these two in rank.
    battles.push({ a, b, gap: a.totalPower - b.totalPower });
  }
  return battles.sort((x, y) => x.gap - y.gap).slice(0, MAX_BATTLES);
}

export default function ClosestBattles({ entries, submittingIso, onVote, onSelectCountry }: ClosestBattlesProps) {
  const battles = useMemo(() => findClosestBattles(entries), [entries]);
  if (battles.length === 0) return null;

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">Closest battles</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {battles.map(({ a, b, gap }) => (
          <div key={`${a.isoCode}-${b.isoCode}`} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
            {[a, b].map((side) => (
              <button
                key={side.isoCode}
                type="button"
                onClick={() => onSelectCountry(side.isoCode)}
                className="flex items-center gap-2 rounded-xl px-1 py-1 text-left transition-colors hover:bg-surface-hover"
              >
                <Flag alpha2={side.isoCode} width={24} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{side.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted">
                  {side.totalPower.toLocaleString("en-US")}
                </span>
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(event) => {
                    event.stopPropagation();
                    onVote(side.isoCode);
                  }}
                  className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/25"
                >
                  {submittingIso === side.isoCode ? "…" : "Vote"}
                </span>
              </button>
            ))}
            <p className="px-1 text-center text-[11px] text-muted-2">
              {gap === 0 ? "Tied" : `${gap.toLocaleString("en-US")} point${gap === 1 ? "" : "s"} apart`}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
