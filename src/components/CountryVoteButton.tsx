"use client";

import { useCallback, useRef, useState } from "react";

import { CTA_CLASSES } from "@/lib/cta-style";
import { getFingerprint } from "@/lib/fingerprint";
import {
  buildShareText,
  claimShareBonus,
  countryShareUrl,
  detectShareLocale,
  openShareWindow,
  xIntentUrl,
} from "@/lib/share";
import { useVote } from "@/lib/use-vote";
import TurnstileWidget, { type TurnstileWidgetHandle } from "./TurnstileWidget";

interface CountryVoteButtonProps {
  isoCode: string;
  countryName: string;
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
  const [bonusGranted, setBonusGranted] = useState(false);

  const getTurnstileToken = useCallback(async () => {
    if (!turnstileSiteKey || !turnstileRef.current) return undefined;
    return turnstileRef.current.getToken();
  }, [turnstileSiteKey]);

  const { status, submittingIso, error, castVote } = useVote({ getTurnstileToken });

  const voted = status?.votedCountryIsoCode === isoCode;
  const submitting = submittingIso === isoCode;

  // Opens the share window in the visitor's own language (see
  // src/lib/share.ts), then claims their one-time +5-vote share bonus in
  // the background.
  const handleShareOnX = () => {
    const locale = detectShareLocale();
    openShareWindow(xIntentUrl(buildShareText(countryName, rank, locale), countryShareUrl(isoCode)));
    void (async () => {
      const fingerprint = await getFingerprint();
      const result = await claimShareBonus(isoCode, fingerprint);
      if (result.granted) setBonusGranted(true);
    })();
  };

  return (
    <div className="flex flex-col gap-2">
      {turnstileSiteKey && <TurnstileWidget ref={turnstileRef} siteKey={turnstileSiteKey} />}
      <button
        type="button"
        onClick={() => castVote(isoCode)}
        disabled={submitting || voted}
        className={`px-5 py-3 text-base font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-hover disabled:text-muted ${CTA_CLASSES}`}
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
        onClick={handleShareOnX}
        className="rounded-sm border border-border px-5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        {bonusGranted ? "Shared — +5 votes!" : "Share on X"}
      </button>
    </div>
  );
}
