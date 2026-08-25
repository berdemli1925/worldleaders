"use client";

import { useMemo } from "react";

import { isVacant, type ThroneEntry } from "@/lib/throne";
import Flag from "./Flag";
import type { LeaderboardEntry } from "./Leaderboard";

interface ClosestBattlesProps {
  entries: LeaderboardEntry[];
  thrones: ThroneEntry[];
  submittingIso: string | null;
  onVote: (isoCode: string) => void;
  onSelectCountry: (isoCode: string) => void;
}

const MAX_BATTLES = 6;
const MIN_BATTLES = 3;

// Direct request: real rivalries, not just "whichever two countries
// happen to be closest in votes right now" — a curated, fixed list of
// well-known geopolitical/cultural match-ups, shown in this order as long
// as at least MIN_BATTLES of them exist on the map (all of them do — see
// world-countries — so in practice all MAX_BATTLES show).
const CURATED_RIVALRIES: [string, string][] = [
  ["TR", "GR"], // Turkey – Greece
  ["RU", "UA"], // Russia – Ukraine
  ["IR", "IL"], // Iran – Israel
  ["AM", "AZ"], // Armenia – Azerbaijan
  ["US", "IR"], // USA – Iran
  ["CN", "TW"], // China – Taiwan
  ["KP", "KR"], // North Korea – South Korea
  ["JP", "CN"], // Japan – China
  ["IN", "PK"], // India – Pakistan
];

export default function ClosestBattles({ entries, thrones, submittingIso, onVote, onSelectCountry }: ClosestBattlesProps) {
  const entryByIso = useMemo(() => new Map(entries.map((entry) => [entry.isoCode, entry])), [entries]);
  const throneByIso = useMemo(() => new Map(thrones.map((throne) => [throne.isoCode, throne])), [thrones]);

  const battles = useMemo(() => {
    return CURATED_RIVALRIES.map(([isoA, isoB]) => {
      const a = entryByIso.get(isoA);
      const b = entryByIso.get(isoB);
      if (!a || !b) return null;
      // Higher vote count shown first within the pair, not the fixed a/b order above.
      const [first, second] = a.voteCount >= b.voteCount ? [a, b] : [b, a];
      return { first, second, gap: first.voteCount - second.voteCount };
    })
      .filter((battle) => battle !== null)
      .slice(0, MAX_BATTLES);
  }, [entryByIso]);

  if (battles.length < MIN_BATTLES) return null;

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-lg font-semibold text-foreground">Closest battles</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {battles.map(({ first, second, gap }) => (
          <div
            key={`${first.isoCode}-${second.isoCode}`}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
          >
            {[first, second].map((side, index) => {
              const throne = throneByIso.get(side.isoCode);
              const hasLeader = !isVacant(throne);
              const leaderAvatar = throne?.postAuthorAvatarUrl || throne?.logoUrl || null;
              const submitting = submittingIso === side.isoCode;

              return (
                <div key={side.isoCode} className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectCountry(side.isoCode)}
                    className="flex w-full items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-surface-hover"
                  >
                    <Flag alpha2={side.isoCode} width={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{side.name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted">
                        {leaderAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={leaderAvatar}
                            alt=""
                            className="h-4 w-4 rounded-full border border-accent object-cover"
                          />
                        ) : null}
                        {hasLeader ? (
                          <span className="truncate text-accent">
                            {throne?.brandTitle ?? (throne?.handle ? `@${throne.handle}` : "Has a leader")}
                          </span>
                        ) : (
                          <span className="text-muted-2">No leader</span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm text-muted">
                      {side.voteCount.toLocaleString("en-US")}
                    </span>
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(event) => {
                        event.stopPropagation();
                        onVote(side.isoCode);
                      }}
                      className="shrink-0 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
                    >
                      {submitting ? "…" : "Vote"}
                    </span>
                  </button>
                  {index === 0 && (
                    <p className="px-1 text-center text-[11px] uppercase tracking-wide text-muted-2">
                      {gap === 0 ? "Tied" : `${gap.toLocaleString("en-US")} votes apart`} · VS
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
