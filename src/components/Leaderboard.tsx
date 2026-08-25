"use client";

import { useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { PAYMENTS_ENABLED } from "@/lib/beta-mode";
import { buildCountryByAlpha2 } from "@/lib/country-path";
import { getCountryMeta } from "@/lib/country-meta";
import { getSlugForCountry } from "@/lib/country-slug";
import { getFingerprint } from "@/lib/fingerprint";
import type { SerializedMomentum } from "@/lib/momentum";
import type { RankedCountry } from "@/lib/rank";
import {
  buildShareText,
  claimShareBonus,
  countryShareUrl,
  detectShareLocale,
  openShareWindow,
  xIntentUrl,
} from "@/lib/share";
import { isVacant, requiredMinimum, type ThroneEntry } from "@/lib/throne";
import { twitterImageVariant } from "@/lib/twitter-image";
import type { MyVoteStatus } from "@/lib/use-vote";
import ClaimThroneButton from "./ClaimThroneButton";
import Flag from "./Flag";
import ThroneClaimModal from "./ThroneClaimModal";
import type { CountryPath } from "./WorldMapInteractive";

// Re-exported under this name since every existing caller (Dashboard,
// ClosestBattles, VoteResultModal, ...) already imports LeaderboardEntry
// from here — see src/lib/rank.ts for the actual shape/ranking logic.
export type LeaderboardEntry = RankedCountry;

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  allTimeEntries: LeaderboardEntry[];
  voteStatus: MyVoteStatus | null;
  submittingIso: string | null;
  voteError: string | null;
  onVote: (isoCode: string) => void;
  highlightedIso: string | null;
  thrones: ThroneEntry[];
  /** Pans/zooms the map to a country — fired on card click and on Enter in the search box. */
  onSelectCountry: (isoCode: string) => void;
  /** AŞAMA 4 rank/vote snapshots — null until the first poll lands (see Dashboard.tsx). */
  momentum: SerializedMomentum | null;
  /** Called after a share-on-X bonus is newly granted, so the parent can refetch and reflect it — see src/lib/share-bonus.ts. */
  onShareBonusGranted?: () => void;
  /** Country outline/bounds data — same as WorldMapInteractive/Hero — needed here now that cards open ThroneClaimModal directly (its image positioner clips to the country's own shape). */
  countries: CountryPath[];
  /** Refetches throne state after a claim completes — same callback Hero/WorldMapInteractive already use. */
  onThroneClaimed: () => void;
}

const CONTINENTS = ["All", "Europe", "Asia", "Africa", "Americas", "Oceania"] as const;
type ContinentFilter = (typeof CONTINENTS)[number];

type LeaderFilter = "all" | "has" | "none";

// AŞAMA 4 — additional sort modes layered on top of the existing period/
// continent/leader filters, all derived from the same momentum snapshot
// (see src/lib/momentum.ts):
//  - climbers: biggest positive rank change over the last 7 days
//  - rising: fastest-growing by rate (24h votes relative to what a country
//    had before), so a small country picking up steam outranks a top
//    country's much larger but proportionally smaller gain
//  - active: most raw votes in the last 24 hours
//  - cheapest: lowest price to take over right now (ascending, unlike the
//    others) — only meaningful once real money is on the line, so it's
//    left out of the tab list entirely during the free beta (every
//    occupied country's "price" is a flat $2 there — see claim_throne_beta
//    in scripts/setup-leader-identity.mjs — which would just be noise).
type SortMode = "votes" | "climbers" | "rising" | "active" | "cheapest";
const SORT_MODES: [SortMode, string][] = [
  ["votes", "Ranking"],
  ["climbers", "Biggest climbers"],
  ["rising", "Rising"],
  ["active", "Most active today"],
  ...(PAYMENTS_ENABLED ? ([["cheapest", "Cheapest to claim"]] as [SortMode, string][]) : []),
];

type Period = "month" | "allTime";
const PERIODS: [Period, string][] = [
  ["month", "This month"],
  ["allTime", "All time"],
];

// How many cards show up front, and how many more each "Load more" click
// reveals — a grid of ~250 countries all at once is a lot to paint/scroll
// past, so only a page's worth renders until asked for more.
const PAGE_SIZE = 24;

export default function Leaderboard({
  entries,
  allTimeEntries,
  voteStatus,
  submittingIso,
  voteError,
  onVote,
  highlightedIso,
  thrones,
  onSelectCountry,
  momentum,
  onShareBonusGranted,
  countries,
  onThroneClaimed,
}: LeaderboardProps) {
  const router = useRouter();
  const countryByAlpha2 = useMemo(() => buildCountryByAlpha2(countries), [countries]);
  // Which country's claim modal is open, if any — a card's own crown/claim
  // button opens this directly rather than routing through the map, so a
  // claim can happen without ever leaving the leaderboard grid.
  const [claimIso, setClaimIso] = useState<string | null>(null);

  // Opens an X share-intent window pre-filled with a link back to this
  // country (?country=XX, read by page.tsx's generateMetadata for the
  // per-country OG card — see /api/og/country), in the sharer's own
  // language (see src/lib/share.ts), then claims their one-time +5-vote
  // share bonus in the background — never blocks or delays the share
  // window itself opening.
  const handleShareOnX = useCallback(
    (isoCode: string, countryName: string, rank: number) => {
      const locale = detectShareLocale();
      openShareWindow(xIntentUrl(buildShareText(countryName, rank, locale), countryShareUrl(isoCode)));
      void (async () => {
        const fingerprint = await getFingerprint();
        const result = await claimShareBonus(isoCode, fingerprint);
        if (result.granted) onShareBonusGranted?.();
      })();
    },
    [onShareBonusGranted],
  );

  const [search, setSearch] = useState("");
  const [continent, setContinent] = useState<ContinentFilter>("All");
  const [leaderFilter, setLeaderFilter] = useState<LeaderFilter>("all");
  const [period, setPeriod] = useState<Period>("month");
  const [sortMode, setSortMode] = useState<SortMode>("votes");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const throneByIso = useMemo(() => new Map(thrones.map((throne) => [throne.isoCode, throne])), [thrones]);

  const activeEntries = period === "month" ? entries : allTimeEntries;

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

  // Rank change over the last 24h, global (not affected by the filters
  // below) — positive means it climbed that many places. Shared by the
  // arrow on every card and the "climbers"/"rising"/"active" sort modes.
  const rankChange24h = useCallback(
    (isoCode: string): number | null => {
      if (!momentum) return null;
      const now = momentum.rankNow[isoCode];
      const before = momentum.rank24hAgo[isoCode];
      if (now === undefined || before === undefined) return null;
      return before - now;
    },
    [momentum],
  );

  const sortValue = useCallback(
    (isoCode: string): number => {
      if (!momentum) return 0;
      switch (sortMode) {
        case "climbers": {
          const now = momentum.rankNow[isoCode];
          const before = momentum.rank7dAgo[isoCode];
          return now !== undefined && before !== undefined ? before - now : 0;
        }
        case "rising": {
          const total = momentum.voteCountNow[isoCode] ?? 0;
          const last24h = momentum.votesLast24h[isoCode] ?? 0;
          const before = Math.max(1, total - last24h);
          return last24h / before;
        }
        case "active":
          return momentum.votesLast24h[isoCode] ?? 0;
        default:
          return 0;
      }
    },
    [momentum, sortMode],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = withLeaderInfo.filter(({ entry, throne }) => {
      if (continent !== "All" && entry.continent !== continent) return false;
      if (leaderFilter === "has" && isVacant(throne)) return false;
      if (leaderFilter === "none" && !isVacant(throne)) return false;
      if (q && !entry.name.toLowerCase().includes(q) && !entry.isoCode.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sortMode === "votes") {
      return [...list].sort(
        (a, b) => b.entry.voteCount - a.entry.voteCount || a.entry.name.localeCompare(b.entry.name),
      );
    }
    if (sortMode === "cheapest") {
      // Ascending — cheapest first, the one sort mode that isn't "biggest
      // number wins" — and, unlike climbers/rising/active, driven directly
      // by throne data rather than the momentum snapshot.
      return [...list].sort(
        (a, b) => requiredMinimum(a.throne) - requiredMinimum(b.throne) || a.entry.name.localeCompare(b.entry.name),
      );
    }
    return [...list].sort(
      (a, b) =>
        sortValue(b.entry.isoCode) - sortValue(a.entry.isoCode) || a.entry.name.localeCompare(b.entry.name),
    );
  }, [withLeaderInfo, continent, leaderFilter, search, sortMode, sortValue]);

  // Both below are derived-during-render state sync (React's documented
  // alternative to an effect for "adjust state when a prop/value changes")
  // rather than useEffect, which would set state after an extra commit
  // instead of before paint — same pattern Dashboard.tsx uses for its own
  // "sync on prop change" case.

  // Changing any filter/sort/period starts back at the first page — staying
  // deep in a "load more"'d list after the list underneath it changes would
  // just show a confusing, disconnected slice.
  const filterKey = `${search}|${continent}|${leaderFilter}|${sortMode}|${period}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(PAGE_SIZE);
  }

  // A ticker/hero click can target a country ranked well past the current
  // page — pull enough pages in to actually include it before the
  // scroll-into-view below runs.
  const [prevHighlightedIso, setPrevHighlightedIso] = useState(highlightedIso);
  if (highlightedIso !== prevHighlightedIso) {
    setPrevHighlightedIso(highlightedIso);
    if (highlightedIso) {
      const index = filtered.findIndex((row) => row.entry.isoCode === highlightedIso);
      if (index >= 0 && index >= visibleCount) {
        setVisibleCount(Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE);
      }
    }
  }

  const visible = filtered.slice(0, visibleCount);

  // AŞAMA 6: "Sıralama değiştiğinde satırlar yumuşak bir animasyonla yer
  // değiştirsin" — a plain FLIP (First, Last, Invert, Play): each card's
  // *previous* screen position (both axes — a grid reorder can move a card
  // to a different column, not just a different row) is compared to its new
  // one after every reorder, and any that moved get an instant,
  // transition-free translate back to where they used to be, then are
  // released into a transition to 0 — so the card visibly slides from old
  // spot to new instead of jumping.
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const prevPosByIso = useRef(new Map<string, { top: number; left: number }>());
  useLayoutEffect(() => {
    const nextPosByIso = new Map<string, { top: number; left: number }>();
    cardRefs.current.forEach((el, iso) => {
      const rect = el.getBoundingClientRect();
      nextPosByIso.set(iso, { top: rect.top, left: rect.left });
    });

    cardRefs.current.forEach((el, iso) => {
      const prev = prevPosByIso.current.get(iso);
      const next = nextPosByIso.get(iso);
      if (!prev || !next || (prev.top === next.top && prev.left === next.left)) return;
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      // Two rAFs: one to let the transform above actually paint before the
      // transition is re-enabled, one more because some browsers otherwise
      // batch both style writes into the same frame and skip the animation.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = "transform 400ms ease";
          el.style.transform = "";
        });
      });
    });

    prevPosByIso.current = nextPosByIso;
  }, [visible]);

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
                  ? "rounded-sm bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
                  : "rounded-sm border border-border px-3 py-1 text-sm text-muted transition-colors hover:bg-surface-hover"
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
        className="w-full rounded-sm border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted-2 outline-none focus:border-accent"
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
                ? "rounded-sm bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
                : "rounded-sm border border-border px-3 py-1 text-sm text-muted transition-colors hover:bg-surface-hover"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Sort by">
        {SORT_MODES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={sortMode === value}
            onClick={() => setSortMode(value)}
            disabled={value !== "votes" && value !== "cheapest" && !momentum}
            title={value !== "votes" && value !== "cheapest" && !momentum ? "Loading…" : undefined}
            className={
              sortMode === value
                ? "rounded-sm bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
                : "rounded-sm border border-border px-3 py-1 text-sm text-muted transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
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
                ? "rounded-sm bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
                : "rounded-sm border border-border px-3 py-1 text-sm text-muted transition-colors hover:bg-surface-hover"
            }
          >
            {option}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(({ entry, throne }, index) => {
          const votedHere = voteStatus?.votedCountryIsoCode === entry.isoCode;
          const submitting = submittingIso === entry.isoCode;
          const voteLabel = submitting ? "…" : votedHere ? "Voted" : "Vote";
          const change = rankChange24h(entry.isoCode);
          const hasLeader = !isVacant(throne);
          const leaderAvatar = throne?.postAuthorAvatarUrl || throne?.logoUrl || null;
          const leaderName = throne?.brandTitle ?? (throne?.handle ? `@${throne.handle}` : "Has a leader");
          // What shows in the hover preview when this country has a leader
          // — their pinned/linked post first, falling back to their own
          // description if the post has no text. Same pattern as
          // ClosestBattles' hover preview.
          const previewText = throne?.postText || throne?.description || null;
          const previewImage = throne?.postImageUrl ? twitterImageVariant(throne.postImageUrl, "small") : null;
          const href = `/${getSlugForCountry(entry.isoCode) ?? entry.isoCode.toLowerCase()}`;

          const openCountry = () => {
            onSelectCountry(entry.isoCode);
            router.push(href);
          };

          return (
            <div
              key={entry.isoCode}
              id={`country-${entry.isoCode}`}
              ref={(el) => {
                if (el) cardRefs.current.set(entry.isoCode, el);
                else cardRefs.current.delete(entry.isoCode);
              }}
              role="link"
              tabIndex={0}
              onClick={openCountry}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openCountry();
                }
              }}
              className={`relative flex cursor-pointer flex-col items-center gap-3 rounded-md border bg-surface p-5 text-center transition-colors hover:bg-surface-hover ${
                highlightedIso === entry.isoCode ? "border-accent ring-2 ring-accent" : "border-border"
              }`}
            >
              <div className="flex w-full items-start justify-between">
                <span className="font-mono text-sm text-muted">#{index + 1}</span>
                {change !== null && change !== 0 && (
                  <span className={`font-mono text-xs ${change > 0 ? "text-success" : "text-danger"}`}>
                    {change > 0 ? "↑" : "↓"}
                    {Math.abs(change)}
                  </span>
                )}
              </div>

              <Flag alpha2={entry.isoCode} width={56} />
              <p className="w-full truncate text-base font-semibold text-foreground">{entry.name}</p>

              {/* Leadership — a crown (solid when held, faded/desaturated
                  when vacant, so it reads at a glance) plus a small,
                  always-visible thumbnail of what the leader posted (their
                  own post image, falling back to their avatar/logo) — not
                  just their name — so there's actually something to look at
                  before hovering. Hovering enlarges it into a readable
                  preview (image + full quoted text), same interaction
                  Closest Battles' cards use. */}
              <div
                className="group/leader relative flex items-center gap-2 text-xs"
                onClick={(event) => event.stopPropagation()}
              >
                <span aria-hidden="true" className={hasLeader ? "text-sm" : "text-sm opacity-30 grayscale"}>
                  👑
                </span>
                {(previewImage || leaderAvatar) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewImage || (leaderAvatar as string)}
                    alt=""
                    className="h-7 w-7 rounded-md border border-accent object-cover"
                  />
                )}
                {hasLeader ? (
                  <span className="max-w-[120px] truncate text-accent">{leaderName}</span>
                ) : (
                  <span className="text-muted-2">No leader</span>
                )}

                {hasLeader && (previewText || previewImage) && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 max-w-[80vw] -translate-x-1/2 rounded-md border border-border bg-surface p-3 opacity-0 shadow-xl transition-opacity duration-150 group-hover/leader:opacity-100">
                    {previewImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewImage} alt="" className="mb-2 h-24 w-full rounded-sm object-cover" />
                    )}
                    {previewText && (
                      <p className="line-clamp-4 text-left text-xs italic text-muted">&ldquo;{previewText}&rdquo;</p>
                    )}
                  </div>
                )}
              </div>

              <p className="font-mono text-lg font-bold text-foreground">
                {entry.voteCount.toLocaleString("en-US")}
              </p>

              <div className="flex w-full items-center gap-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onVote(entry.isoCode);
                  }}
                  disabled={submitting || votedHere}
                  className="flex-1 rounded-sm bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-muted"
                >
                  {voteLabel}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleShareOnX(entry.isoCode, entry.name, index + 1);
                  }}
                  aria-label={`Share ${entry.name} on X`}
                  title="Share on X"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width={13}
                    height={13}
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
              </div>

              <div className="w-full" onClick={(event) => event.stopPropagation()}>
                <ClaimThroneButton throne={throne} onOpenClaim={() => setClaimIso(entry.isoCode)} className="w-full" />
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="col-span-full rounded-md border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
            No countries match these filters.
          </p>
        )}
      </div>

      {visibleCount < filtered.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          className="self-center rounded-sm border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          Load more ({filtered.length - visibleCount} more)
        </button>
      )}

      {voteError && <p className="text-sm text-danger">{voteError}</p>}

      {claimIso &&
        (() => {
          const country = countryByAlpha2.get(claimIso);
          const meta = getCountryMeta(claimIso);
          return (
            <ThroneClaimModal
              isoCode={claimIso}
              countryName={meta?.name ?? claimIso}
              throne={throneByIso.get(claimIso)}
              countryPathD={country?.d}
              countryBounds={country?.bounds}
              onClose={() => setClaimIso(null)}
              onClaimed={onThroneClaimed}
            />
          );
        })()}
    </section>
  );
}
