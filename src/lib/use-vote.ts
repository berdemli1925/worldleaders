"use client";

import { useCallback, useEffect, useState } from "react";

import { track } from "@/lib/analytics";
import { getFingerprint } from "@/lib/fingerprint";

export interface MyVoteStatus {
  votedToday: boolean;
  votedCountryIsoCode: string | null;
}

interface UseVoteOptions {
  /** Resolves an invisible-Turnstile token, or undefined if Turnstile isn't configured. */
  getTurnstileToken?: () => Promise<string | undefined>;
  /** Called after a vote is successfully cast/moved, so the caller can refresh the leaderboard. */
  onVoteCast?: () => void;
}

// Shared by the map's side panel and every leaderboard row's "Vote" button.
// "Have I voted today, and for which country" is one global fact — fetched
// once here — rather than once per country as the original per-country
// effect did (see /api/votes GET, which now makes `country` optional for
// exactly this reason). Per-country vote *counts* still come from the
// realtime `leaderboard` table read in Dashboard, not from here.
export function useVote({ getTurnstileToken, onVoteCast }: UseVoteOptions = {}) {
  const [status, setStatus] = useState<MyVoteStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [submittingIso, setSubmittingIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const fingerprint = await getFingerprint();
      const res = await fetch(`/api/votes?fingerprint=${encodeURIComponent(fingerprint)}`);
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      setStatus({ votedToday: Boolean(data.votedToday), votedCountryIsoCode: data.votedCountryIsoCode ?? null });
    } catch {
      // Non-fatal: vote buttons still work, they just can't show "already
      // voted" state until this succeeds (e.g. retried on next mount/vote).
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // Initial load — same accepted setState-in-effect pattern used elsewhere in
  // this app for data-fetching effects (see WorldMapInteractive/Dashboard).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshStatus();
  }, [refreshStatus]);

  const castVote = useCallback(
    async (isoCode: string) => {
      setSubmittingIso(isoCode);
      setError(null);
      try {
        const [fingerprint, turnstileToken] = await Promise.all([
          getFingerprint(),
          getTurnstileToken ? getTurnstileToken() : Promise.resolve(undefined),
        ]);
        const res = await fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ countryIsoCode: isoCode, fingerprint, turnstileToken }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Vote failed.");
        setStatus({ votedToday: true, votedCountryIsoCode: isoCode });
        track("vote_cast", { country: isoCode });
        onVoteCast?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Vote failed.");
      } finally {
        setSubmittingIso(null);
      }
    },
    [getTurnstileToken, onVoteCast],
  );

  return { status, statusLoading, submittingIso, error, castVote };
}
