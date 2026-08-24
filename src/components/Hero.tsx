"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getCountryMeta } from "@/lib/country-meta";
import type { MyVoteStatus } from "@/lib/use-vote";
import Flag from "./Flag";

export interface HeroEntry {
  isoCode: string;
  name: string;
  voteCount: number;
}

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

// Hero: the first thing a visitor sees, above/beside the map (see
// Dashboard.tsx). Answers "who's winning" and "where does my country
// stand" without any scrolling or clicking — see gelistirme-plani-v2.md
// AŞAMA 1.
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
}: HeroProps) {
  const [override, setOverride] = useState<string | null>(null);
  const [clientGuess, setClientGuess] = useState<string | undefined>(undefined);
  const [picking, setPicking] = useState(false);

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

  return (
    <section className="flex w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:w-[380px] lg:shrink-0">
      <h1 className="text-3xl font-black uppercase leading-[1.05] tracking-tight text-foreground sm:text-4xl">
        Who rules
        <br />
        the world?
      </h1>

      {leader ? (
        <button
          type="button"
          onClick={() => onSelectCountry(leader.isoCode)}
          className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 p-3 text-left transition-colors hover:bg-accent/15"
        >
          <Flag alpha2={leader.isoCode} width={40} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-accent">Currently ruling</p>
            <p className="truncate text-lg font-semibold text-foreground">{leader.name}</p>
          </div>
          <p className="shrink-0 font-mono text-lg font-bold text-accent">
            {leader.voteCount.toLocaleString("en-US")}
          </p>
        </button>
      ) : (
        <div className="h-[68px] animate-pulse rounded-xl bg-surface-hover" aria-hidden="true" />
      )}

      {runnerUp && gap !== null && (
        <button
          type="button"
          onClick={() => onSelectCountry(runnerUp.isoCode)}
          className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover"
        >
          <Flag alpha2={runnerUp.isoCode} width={24} />
          <span className="min-w-0 flex-1 truncate text-muted">#2 {runnerUp.name}</span>
          <span className="shrink-0 font-mono text-xs text-muted-2">−{gap.toLocaleString("en-US")}</span>
        </button>
      )}

      <div className="flex flex-col gap-2.5 border-t border-border pt-4">
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
              className="rounded-full bg-accent px-5 py-3.5 text-base font-bold uppercase tracking-wide text-accent-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-muted"
            >
              {submitting ? "Voting…" : votedHere ? "You voted here" : `Vote for ${guessMeta.name}`}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="rounded-full bg-accent px-5 py-3.5 text-base font-bold uppercase tracking-wide text-accent-foreground transition-colors hover:brightness-110"
          >
            Vote for your country
          </button>
        )}
      </div>

      {picking && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-24"
          onClick={() => setPicking(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="mb-2 text-sm font-medium text-foreground">Pick your country</p>
            <select
              autoFocus
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) pickCountry(event.target.value);
              }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
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
              className="mt-3 w-full rounded-full border border-border py-2 text-sm text-muted hover:bg-surface-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
