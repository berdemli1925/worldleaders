"use client";

import { useMemo, useState } from "react";

import { getCountryMeta } from "@/lib/country-meta";
import { isVacant, type ThroneClaimHistoryEntry, type ThroneEntry } from "@/lib/throne";
import type { MyVoteStatus } from "@/lib/use-vote";
import Flag from "./Flag";
import ThroneClaimModal from "./ThroneClaimModal";
import ThronePanel from "./ThronePanel";

export interface LeaderboardEntry {
  isoCode: string;
  name: string;
  continent: string;
  voteCount: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  allTimeEntries: LeaderboardEntry[];
  totalVotes: number;
  now: number | null;
  voteStatus: MyVoteStatus | null;
  submittingIso: string | null;
  voteError: string | null;
  onVote: (isoCode: string) => void;
  highlightedIso: string | null;
  thrones: ThroneEntry[];
  claimHistory: ThroneClaimHistoryEntry[];
  onThroneClaimed: () => void;
  /** Pans/zooms the map to a country — fired on row click and on Enter in the search box. */
  onSelectCountry: (isoCode: string) => void;
}

const CONTINENTS = ["All", "Europe", "Asia", "Africa", "Americas", "Oceania"] as const;
type ContinentFilter = (typeof CONTINENTS)[number];

type LeaderFilter = "all" | "has" | "none";

// Opens an X share-intent window pre-filled with a link back to this
// country (?country=XX, read by page.tsx's generateMetadata for the
// per-country OG card — see /api/og/country) — no popup blocked, since
// this only ever runs from a direct click.
function shareOnX(isoCode: string, countryName: string, rank: number, voteCount: number): void {
  const url = `https://worldleaders.lol/?country=${isoCode}`;
  const text = `${countryName} is ranked #${rank} on World Leaders with ${voteCount.toLocaleString("en-US")} votes.`;
  const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(intentUrl, "_blank", "noopener,noreferrer");
}

type Period = "month" | "allTime";
const PERIODS: [Period, string][] = [
  ["month", "This month"],
  ["allTime", "All time"],
];

export default function Leaderboard({
  entries,
  allTimeEntries,
  totalVotes,
  now,
  voteStatus,
  submittingIso,
  voteError,
  onVote,
  highlightedIso,
  thrones,
  claimHistory,
  onThroneClaimed,
  onSelectCountry,
}: LeaderboardProps) {
  const [search, setSearch] = useState("");
  const [continent, setContinent] = useState<ContinentFilter>("All");
  const [leaderFilter, setLeaderFilter] = useState<LeaderFilter>("all");
  const [period, setPeriod] = useState<Period>("month");
  const [openClaimIso, setOpenClaimIso] = useState<string | null>(null);
  // Accordion: at most one card's details are open at a time. Separate from
  // openClaimIso above — that's "which country's claim modal overlay is
  // showing," an unrelated concern (the modal floats above everything
  // regardless of which card is expanded).
  const [expandedIso, setExpandedIso] = useState<string | null>(null);

  // A ticker click sets highlightedIso to scroll to + ring a card — also
  // expand it, since leader details are now collapsed by default and
  // landing on a closed card would defeat the point of jumping to it.
  // Derived-during-render sync (React's documented alternative to an
  // effect for "adjust state when a prop changes") rather than useEffect,
  // which would set state after an extra commit instead of before paint.
  const [syncedHighlight, setSyncedHighlight] = useState(highlightedIso);
  if (highlightedIso !== syncedHighlight) {
    setSyncedHighlight(highlightedIso);
    if (highlightedIso) setExpandedIso(highlightedIso);
  }

  const throneByIso = useMemo(() => new Map(thrones.map((throne) => [throne.isoCode, throne])), [thrones]);

  const activeEntries = period === "month" ? entries : allTimeEntries;
  // `totalVotes` from the parent is already this-month's sum (it also drives
  // the top stat bar) — reuse it for that tab instead of re-summing, and only
  // compute the all-time sum here since nothing else needs it.
  const periodTotalVotes = useMemo(
    () => (period === "month" ? totalVotes : allTimeEntries.reduce((sum, entry) => sum + entry.voteCount, 0)),
    [period, totalVotes, allTimeEntries],
  );

  const withLeaderInfo = useMemo(
    () =>
      activeEntries.map((entry) => ({
        entry,
        meta: getCountryMeta(entry.isoCode),
        throne: throneByIso.get(entry.isoCode),
      })),
    [activeEntries, throneByIso],
  );

  const hasLeaderCount = useMemo(
    () => withLeaderInfo.filter((row) => !isVacant(row.throne)).length,
    [withLeaderInfo],
  );
  const noLeaderCount = withLeaderInfo.length - hasLeaderCount;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = withLeaderInfo.filter(({ entry, throne }) => {
      if (continent !== "All" && entry.continent !== continent) return false;
      if (leaderFilter === "has" && isVacant(throne)) return false;
      if (leaderFilter === "none" && !isVacant(throne)) return false;
      if (q && !entry.name.toLowerCase().includes(q) && !entry.isoCode.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort(
      (a, b) => b.entry.voteCount - a.entry.voteCount || a.entry.name.localeCompare(b.entry.name),
    );
  }, [withLeaderInfo, continent, leaderFilter, search]);

  return (
    <section className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground">Leaderboard</h2>
        <div className="flex gap-1.5" role="tablist" aria-label="Ranking period">
          {PERIODS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={period === value}
              onClick={() => setPeriod(value)}
              className={
                period === value
                  ? "rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
                  : "rounded-full border border-border px-3 py-1 text-sm text-muted transition-colors hover:bg-surface-hover"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          // Enter jumps the map to the top match — lets "type a name, hit
          // enter" find a small country without scrolling the list at all.
          if (event.key !== "Enter" || filtered.length === 0) return;
          event.preventDefault();
          onSelectCountry(filtered[0].entry.isoCode);
        }}
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
        {filtered.map(({ entry, meta, throne }, index) => {
          const pct = periodTotalVotes > 0 ? (entry.voteCount / periodTotalVotes) * 100 : 0;
          const votedHere = voteStatus?.votedCountryIsoCode === entry.isoCode;
          const submitting = submittingIso === entry.isoCode;
          const voteLabel = submitting ? "Voting…" : votedHere ? "Voted" : "Vote";
          const isExpanded = expandedIso === entry.isoCode;

          const toggleExpanded = () => {
            setExpandedIso((current) => (current === entry.isoCode ? null : entry.isoCode));
            onSelectCountry(entry.isoCode);
          };

          return (
            <article
              key={entry.isoCode}
              id={`country-${entry.isoCode}`}
              className={`overflow-hidden rounded-2xl border bg-surface transition-shadow ${
                highlightedIso === entry.isoCode ? "border-accent ring-2 ring-accent" : "border-border"
              }`}
            >
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={toggleExpanded}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleExpanded();
                  }
                }}
                className="flex cursor-pointer items-center gap-3 p-4"
              >
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
                    onClick={(event) => {
                      event.stopPropagation();
                      shareOnX(entry.isoCode, entry.name, index + 1, entry.voteCount);
                    }}
                    aria-label={`Share ${entry.name} on X`}
                    title="Share on X"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width={14}
                      height={14}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onVote(entry.isoCode);
                    }}
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

              {/* Animated accordion body — grid-template-rows 0fr/1fr is the
                  CSS-only way to transition to "auto" height smoothly. */}
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                  isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-border bg-black/15 p-4">
                    <ThronePanel
                      isoCode={entry.isoCode}
                      throne={throne}
                      claimHistory={claimHistory}
                      now={now}
                      onOpenClaim={() => setOpenClaimIso(openClaimIso === entry.isoCode ? null : entry.isoCode)}
                    />

                    {openClaimIso === entry.isoCode && (
                      <ThroneClaimModal
                        isoCode={entry.isoCode}
                        countryName={entry.name}
                        throne={throne}
                        onClose={() => setOpenClaimIso(null)}
                        onClaimed={onThroneClaimed}
                      />
                    )}
                  </div>
                </div>
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
