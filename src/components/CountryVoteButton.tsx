"use client";

import { useCallback, useRef } from "react";

import { buildShareText, countryShareUrl, openShareWindow, xIntentUrl } from "@/lib/share";
import { useVote } from "@/lib/use-vote";
import TurnstileWidget, { type TurnstileWidgetHandle } from "./TurnstileWidget";

interface CountryVoteButtonProps {
  isoCode: string;
  countryName: string;
  /** For the "Voted! You're #N" line after a successful vote — this page's own rank isn't live, so it's the last-known rank plus what the vote API itself returns. */
  rank: number;
}

// A self-contained vote button for the standalone country pages (AŞAMA 3) —
// same castVote/Turnstile flow as the main dashboard, but without the rest
// of Dashboard's realtime machinery: a visitor landing here from search
// just needs to be able to vote on the spot, not run the full live map.
// The full post-vote result screen (AŞAMA 2) lives on the home page — this
// links there instead of reimplementing it.
export default function CountryVoteButton({ isoCode, countryName, rank }: CountryVoteButtonProps) {
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const getTurnstileToken = useCallback(async () => {
    if (!turnstileSiteKey || !turnstileRef.current) return undefined;
    return turnstileRef.current.getToken();
  }, [turnstileSiteKey]);

  const { status, submittingIso, error, castVote } = useVote({ getTurnstileToken });

  const voted = status?.votedCountryIsoCode === isoCode;
  const submitting = submittingIso === isoCode;

  return (
    <div className="flex flex-col gap-2">
      {turnstileSiteKey && <TurnstileWidget ref={turnstileRef} siteKey={turnstileSiteKey} />}
      <button
        type="button"
        onClick={() => castVote(isoCode)}
        disabled={submitting || voted}
        className="rounded-full bg-accent px-5 py-3 text-base font-bold uppercase tracking-wide text-accent-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-muted"
      >
        {submitting ? "Voting…" : voted ? "You voted here" : `Vote for ${countryName}`}
      </button>
      {voted && (
        <p className="text-center text-xs text-success">
          Thanks — was ranked #{rank}. See the live map for the new standing.
        </p>
      )}
      {error && <p className="text-center text-xs text-danger">{error}</p>}
      <button
        type="button"
        onClick={() =>
          openShareWindow(xIntentUrl(buildShareText(countryName, rank), countryShareUrl(isoCode)))
        }
        className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        Share on X
      </button>
    </div>
  );
}
