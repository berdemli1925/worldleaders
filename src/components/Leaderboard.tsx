"use client";

import { useMemo, useState } from "react";

import { getCountryMeta } from "@/lib/country-meta";
import { getMockLeaderData } from "@/lib/mock-leaders";
import type { MyVoteStatus } from "@/lib/use-vote";
import CountdownTimer from "./CountdownTimer";
import Flag from "./Flag";

export interface LeaderboardEntry {
  isoCode: string;
  name: string;
  continent: string;
  voteCount: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  totalVotes: number;
  now: number | null;
  voteStatus: MyVoteStatus | null;
  submittingIso: string | null;
  voteError: string | null;
  onVote: (isoCode: string) => void;
  highlightedIso: string | null;
}

const CONTINENTS = ["All", "Europe", "Asia", "Africa", "Americas", "Oceania"] as const;
type ContinentFilter = (typeof CONTINENTS)[number];

type LeaderFilter = "all" | "has" | "none";

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

export default function Leaderboard({
  entries,
  totalVotes,
  now,
  voteStatus,
  submittingIso,
  voteError,
  onVote,
  highlightedIso,
}: LeaderboardProps) {
  const [search, setSearch] = useState("");
  const [continent, setContinent] = useState<ContinentFilter>("All");
  const [leaderFilter, setLeaderFilter] = useState<LeaderFilter>("all");

  const withLeaderInfo = useMemo(
    () =>
      entries.map((entry) => ({
        entry,
        meta: getCountryMeta(entry.isoCode),
        leaderData: getMockLeaderData(entry.isoCode),
      })),
    [entries],
  );

  const hasLeaderCount = useMemo(
    () => withLeaderInfo.filter((row) => row.leaderData.leader !== null).length,
    [withLeaderInfo],
  );
  const noLeaderCount = withLeaderInfo.length - hasLeaderCount;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = withLeaderInfo.filter(({ entry, leaderData }) => {
      if (continent !== "All" && entry.continent !== continent) return false;
      if (leaderFilter === "has" && leaderData.leader === null) return false;
      if (leaderFilter === "none" && leaderData.leader !== null) return false;
      if (q && !entry.name.toLowerCase().includes(q) && !entry.isoCode.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort(
      (a, b) => b.entry.voteCount - a.entry.voteCount || a.entry.name.localeCompare(b.entry.name),
    );
  }, [withLeaderInfo, continent, leaderFilter, search]);

  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">Leaderboard</h2>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by country name or ISO code"
        className="w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted-2 outline-none focus:border-accent"
      />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by leader status">
        {(
          [
            ["all", `All countries (${withLeaderInfo.length})`],
            ["has", `Has leader (${hasLeaderCount})`],
            ["none", `No leader (${noLeaderCount})`],
          ] as [LeaderFilter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={leaderFilter === value}
            onClick={() => setLeaderFilter(value)}
            className={
              leaderFilter === value
                ? "rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
                : "rounded-full border border-border px-3 py-1 text-sm text-muted transition-colors hover:bg-surface-hover"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by continent">
        {CONTINENTS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={continent === option}
            onClick={() => setContinent(option)}
            className={
              continent === option
                ? "rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
                : "rounded-full border border-border px-3 py-1 text-sm text-muted transition-colors hover:bg-surface-hover"
            }
          >
            {option}
          </button>
        ))}
      </div>

      <div className="flex w-full flex-col gap-3">
        {filtered.map(({ entry, meta, leaderData }, index) => {
          const pct = totalVotes > 0 ? (entry.voteCount / totalVotes) * 100 : 0;
          const votedHere = voteStatus?.votedCountryIsoCode === entry.isoCode;
          const submitting = submittingIso === entry.isoCode;
          const voteLabel = submitting ? "Voting…" : votedHere ? "Voted" : "Vote";
          const visibleHistory = leaderData.history.slice(0, 5);
          const extraHistory = leaderData.history.length - visibleHistory.length;

          return (
            <article
              key={entry.isoCode}
              id={`country-${entry.isoCode}`}
              className={`overflow-hidden rounded-2xl border bg-surface transition-shadow ${
                highlightedIso === entry.isoCode ? "border-accent ring-2 ring-accent" : "border-border"
              }`}
            >
              <div className="flex items-center gap-3 p-4">
                <span className="w-6 shrink-0 text-right font-mono text-sm text-muted">{index + 1}</span>
                <Flag alpha2={entry.isoCode} width={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{entry.name}</p>
                  <p className="truncate text-xs text-muted-2">{meta?.capital ?? "Unknown capital"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {entry.voteCount.toLocaleString("en-US")}
                    </p>
                    <p className="font-mono text-xs text-muted">{pct.toFixed(1)}%</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onVote(entry.isoCode)}
                    disabled={submitting || votedHere}
                    className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-muted"
                  >
                    {voteLabel}
                  </button>
                </div>
              </div>

              <div className="h-1 w-full bg-black/30">
                <div className="h-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>

              <div className="border-t border-border bg-black/15 p-4">
                {leaderData.leader ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <a
                        href={`https://x.com/${leaderData.leader.handle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-foreground hover:text-accent"
                      >
                        @{leaderData.leader.handle}
                      </a>
                      <span className="text-muted-2">paid</span>
                      <span className="font-mono font-medium text-accent">
                        {formatMoney(leaderData.leader.amountPaid)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[11px] text-muted-2">Reign ends in</p>
                        <CountdownTimer
                          target={leaderData.leader.expiresAt}
                          now={now}
                          className="font-mono text-sm text-foreground"
                        />
                      </div>
                      <button
                        type="button"
                        disabled
                        title="Leader system isn't live yet"
                        className="cursor-not-allowed rounded-full border border-accent/40 px-3 py-1.5 text-sm font-medium text-accent opacity-60"
                      >
                        Take the throne ({formatMoney(leaderData.leader.amountPaid * 2)})
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-muted-2">No leader yet</p>
                    <button
                      type="button"
                      disabled
                      title="Leader system isn't live yet"
                      className="cursor-not-allowed rounded-full bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent opacity-60"
                    >
                      Claim this country ({formatMoney(leaderData.basePrice)})
                    </button>
                  </div>
                )}

                {visibleHistory.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {visibleHistory.map((past, historyIndex) => (
                      <span
                        key={`${past.handle}-${historyIndex}`}
                        className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-muted"
                      >
                        @{past.handle} · {formatMoney(past.amountPaid)}
                      </span>
                    ))}
                    {extraHistory > 0 && (
                      <span className="px-1 text-[11px] text-muted-2">History (+{extraHistory})</span>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {filtered.length === 0 && (
          <p className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
            No countries match these filters.
          </p>
        )}
      </div>

      {voteError && <p className="text-sm text-danger">{voteError}</p>}
    </section>
  );
}
