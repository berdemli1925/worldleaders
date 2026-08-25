"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { buildCountryByAlpha2 } from "@/lib/country-path";
import { getCountryMeta } from "@/lib/country-meta";
import { CTA_CLASSES } from "@/lib/cta-style";
import type { RankedCountry } from "@/lib/rank";
import { isVacant, requiredMinimum, type ThroneClaimHistoryEntry, type ThroneEntry } from "@/lib/throne";
import type { MyVoteStatus } from "@/lib/use-vote";
import Flag from "./Flag";
import ThroneClaimModal from "./ThroneClaimModal";
import ThronePanel from "./ThronePanel";
import type { CountryPath } from "./WorldMapInteractive";

export type HeroEntry = RankedCountry;

interface HeroProps {
  leader?: HeroEntry;
  runnerUp?: HeroEntry;
  rankByIso: Map<string, number>;
  entries: HeroEntry[];
  /** IP-based guess from Vercel's edge headers — see src/lib/geo.ts. */
  serverGuessIso?: string;
  voteStatus: MyVoteStatus | null;
  submittingIso: string | null;
  onVote: (isoCode: string) => void;
  onSelectCountry: (isoCode: string) => void;
  /** For the "Claim {leader}'s throne" CTA below — same data ThronePanel/WorldMapInteractive use. */
  countries: CountryPath[];
  thrones: ThroneEntry[];
  claimHistory: ThroneClaimHistoryEntry[];
  now: number | null;
  onThroneClaimed: () => void;
  /** Fires once the visitor's own country is known (IP guess, browser-language fallback, or a manual "Not you?" pick) — Dashboard uses this to auto-zoom the map there, direct request: land straight on "here's where you are" instead of the whole-world default view. */
  onGuessedCountry?: (isoCode: string) => void;
}

const OVERRIDE_KEY = "wl-country-override";

// Only reached when serverGuessIso is missing (non-Vercel host, or a
// visitor whose network Vercel couldn't geolocate) — navigator.language's
// region subtag ("en-US" -> "US") is a rough but client-only-available
// fallback. Not run on the server: navigator doesn't exist there, and the
// value would differ from what actually renders anyway (browser locale vs.
// IP), so it's deliberately deferred to an effect rather than computed
// during render.
function languageGuess(): string | undefined {
  try {
    const locale = new Intl.Locale(navigator.language);
    return locale.region;
  } catch {
    return undefined;
  }
}

// Hero: the first thing a visitor sees, above the map (see Dashboard.tsx —
// full-width banner, map fills almost the rest of the screen right below
// it). Answers "who's winning," "where does my country stand," and "how do
// I put my brand on the #1 country" without any scrolling or clicking —
// see gelistirme-plani-v2.md AŞAMA 1 and the throne-claim CTA added below
// on direct request (researched memleket.lol's equivalent for reference:
// a big map with the price to take over baked right into the button).
export default function Hero({
  leader,
  runnerUp,
  rankByIso,
  entries,
  serverGuessIso,
  voteStatus,
  submittingIso,
  onVote,
  onSelectCountry,
  countries,
  thrones,
  claimHistory,
  now,
  onThroneClaimed,
  onGuessedCountry,
}: HeroProps) {
  const [override, setOverride] = useState<string | null>(null);
  const [clientGuess, setClientGuess] = useState<string | undefined>(undefined);
  const [picking, setPicking] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);

  // Both localStorage and navigator.language are client-only — read once
  // after mount so the server-rendered markup (which only knows
  // serverGuessIso) never mismatches on hydration.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOverride(localStorage.getItem(OVERRIDE_KEY));
    } catch {
      // Private browsing / storage disabled — fall through, override just
      // never activates for this visitor.
    }
    setClientGuess(languageGuess());
  }, []);

  const guessIso = override ?? serverGuessIso ?? clientGuess;

  // Auto-zoom the map to the visitor's own country — direct request. Fires
  // once guessIso first resolves (override/clientGuess only settle after
  // mount, see the effect above — serverGuessIso is available immediately
  // but still waits for that same render) and again on an explicit "Not
  // you?" pick, since re-zooming there is exactly the confirmation a
  // manual correction should give. Doesn't need debouncing beyond the
  // dependency array itself: guessIso only ever changes to a genuinely new
  // value, never re-fires for the same country.
  useEffect(() => {
    if (guessIso) onGuessedCountry?.(guessIso);
  }, [guessIso, onGuessedCountry]);

  const guessMeta = guessIso ? getCountryMeta(guessIso) : undefined;
  const guessRank = guessIso ? rankByIso.get(guessIso) : undefined;

  const votedHere = Boolean(guessIso) && voteStatus?.votedCountryIsoCode === guessIso;
  const submitting = Boolean(guessIso) && submittingIso === guessIso;

  const handleVote = useCallback(() => {
    if (guessIso) onVote(guessIso);
  }, [guessIso, onVote]);

  const pickCountry = useCallback((iso: string) => {
    setOverride(iso);
    try {
      localStorage.setItem(OVERRIDE_KEY, iso);
    } catch {
      // Non-fatal — the pick still applies for this session via state.
    }
    setPicking(false);
  }, []);

  const pickerOptions = useMemo(
    () => [...entries].sort((a, b) => a.name.localeCompare(b.name)),
    [entries],
  );

  const gap = leader && runnerUp ? leader.voteCount - runnerUp.voteCount : null;

  const throneByIso = useMemo(() => new Map(thrones.map((throne) => [throne.isoCode, throne])), [thrones]);
  const countryByAlpha2 = useMemo(() => buildCountryByAlpha2(countries), [countries]);
  const leaderThrone = leader ? throneByIso.get(leader.isoCode) : undefined;
  const leaderCountryPath = leader ? countryByAlpha2.get(leader.isoCode) : undefined;
  const leaderVacant = isVacant(leaderThrone);
  const leaderMinBid = requiredMinimum(leaderThrone);

  return (
    <section className="flex w-full flex-col gap-5 rounded-md border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <h1 className="shrink-0 text-2xl font-black uppercase leading-[1.05] tracking-tight text-foreground sm:text-3xl">
            Who rules
            <br className="sm:hidden" /> the world?
          </h1>

          {leader ? (
            <button
              type="button"
              onClick={() => onSelectCountry(leader.isoCode)}
              className="flex items-center gap-3 rounded-md border border-accent/30 bg-accent/10 p-3 text-left transition-colors hover:bg-accent/15 sm:min-w-[220px]"
            >
              <Flag alpha2={leader.isoCode} width={36} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-accent">Currently ruling</p>
                <p className="truncate text-base font-semibold text-foreground">{leader.name}</p>
              </div>
              <p className="shrink-0 font-mono text-base font-bold text-accent">
                {leader.voteCount.toLocaleString("en-US")}
              </p>
            </button>
          ) : (
            <div className="h-[60px] w-full animate-pulse rounded-md bg-surface-hover sm:w-[220px]" aria-hidden="true" />
          )}

          {runnerUp && gap !== null && (
            <button
              type="button"
              onClick={() => onSelectCountry(runnerUp.isoCode)}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover"
            >
              <Flag alpha2={runnerUp.isoCode} width={22} />
              <span className="min-w-0 truncate text-muted">#2 {runnerUp.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted-2">−{gap.toLocaleString("en-US")}</span>
            </button>
          )}
        </div>

        <div className="h-px w-full bg-border lg:h-12 lg:w-px" />

        <div className="flex flex-col gap-2.5 lg:min-w-[280px]">
          {guessIso && guessMeta ? (
            <>
              <p className="text-sm text-muted">
                Your country: <span className="font-medium text-foreground">{guessMeta.name}</span>
                {guessRank ? (
                  <>
                    {" "}
                    — ranked <span className="font-mono font-semibold text-foreground">#{guessRank}</span>
                  </>
                ) : null}
                {" · "}
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  Not you?
                </button>
              </p>
              <button
                type="button"
                onClick={handleVote}
                disabled={submitting || votedHere}
                className={`px-5 py-3.5 text-base font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-hover disabled:text-muted ${CTA_CLASSES}`}
              >
                {submitting ? "Voting…" : votedHere ? "You voted here" : `Vote for ${guessMeta.name}`}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className={`px-5 py-3.5 text-base font-bold uppercase tracking-wide ${CTA_CLASSES}`}
            >
              Vote for your country
            </button>
          )}
        </div>
      </div>

      {/* Direct request: put claiming front and center — this is the #1
          country on the site, so its throne is the highest-visibility spot
          there is. Reuses ThronePanel/ThroneClaimModal as-is (same leader
          image/badges/pricing everywhere else uses) rather than a second
          copy of that UI. */}
      {leader && (
        <div className="border-t border-border pt-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <span aria-hidden="true">👑</span>
            {leaderVacant
              ? `Nobody leads ${leader.name} yet`
              : `Take over ${leader.name}'s throne`}
          </p>
          {!leaderVacant && (
            <p className="mb-3 -mt-2 text-xs text-muted">
              It&apos;s the #1 country on the site — everyone who lands here sees whoever leads it.
            </p>
          )}
          {leaderVacant && (
            <p className="mb-3 -mt-2 text-xs text-muted">
              It&apos;s the #1 country on the site — put your brand, your post, your link on top of it for{" "}
              <span className="font-medium text-foreground">
                {leaderMinBid > 0 ? `$${leaderMinBid.toLocaleString("en-US")}` : "free, during the beta"}
              </span>
              .
            </p>
          )}
          <ThronePanel
            isoCode={leader.isoCode}
            countryName={leader.name}
            throne={leaderThrone}
            claimHistory={claimHistory}
            now={now}
            onOpenClaim={() => setClaimModalOpen(true)}
          />
        </div>
      )}

      {claimModalOpen && leader && (
        <ThroneClaimModal
          isoCode={leader.isoCode}
          countryName={leader.name}
          throne={leaderThrone}
          countryPathD={leaderCountryPath?.d}
          countryBounds={leaderCountryPath?.bounds}
          onClose={() => setClaimModalOpen(false)}
          onClaimed={onThroneClaimed}
        />
      )}

      {picking && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-24"
          onClick={() => setPicking(false)}
        >
          <div
            className="w-full max-w-sm rounded-md border border-border bg-surface p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="mb-2 text-sm font-medium text-foreground">Pick your country</p>
            <select
              autoFocus
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) pickCountry(event.target.value);
              }}
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            >
              <option value="" disabled>
                Select a country…
              </option>
              {pickerOptions.map((option) => (
                <option key={option.isoCode} value={option.isoCode}>
                  {option.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="mt-3 w-full rounded-sm border border-border py-2 text-sm text-muted hover:bg-surface-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
