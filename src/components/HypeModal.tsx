"use client";

import { useState } from "react";

import { PAYMENTS_ENABLED } from "@/lib/beta-mode";
import { CTA_CLASSES } from "@/lib/cta-style";
import { getFingerprint } from "@/lib/fingerprint";
import { HYPE_DURATION_HOURS, isHypeActive, requiredHypeMinimum, type HypeEntry } from "@/lib/hype";

interface HypeModalProps {
  isoCode: string;
  countryName: string;
  hype: HypeEntry | null;
  now: number | null;
  onClose: () => void;
  onHyped: () => void;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// The "put this country in the spotlight above the map" modal — only ever
// opened from ThronePanel for a country whose throne *you* currently hold
// (the button that opens this doesn't render otherwise); no separate
// content form here, hype just puts the claim that's already there on
// display. Free during the beta (server-side identity check via
// fingerprint — see /api/hype/claim), real money once PAYMENTS_ENABLED.
export default function HypeModal({ isoCode, countryName, hype, now, onClose, onHyped }: HypeModalProps) {
  const active = isHypeActive(hype, now);
  const isSelf = active && hype?.isoCode === isoCode;
  const minimum = requiredHypeMinimum(hype, isoCode, now);

  const [offeredAmount, setOfferedAmount] = useState(() => minimum.toFixed(2));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const amount = Number(offeredAmount);
      if (PAYMENTS_ENABLED && (!Number.isFinite(amount) || amount < minimum)) {
        throw new Error(`Offer must be at least ${formatMoney(minimum)}.`);
      }
      const fingerprint = PAYMENTS_ENABLED ? undefined : await getFingerprint();
      const res = await fetch("/api/hype/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryIsoCode: isoCode,
          offeredAmount: PAYMENTS_ENABLED ? amount : undefined,
          fingerprint,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status === "failed") throw new Error(data?.error ?? "Hype failed.");
      onHyped();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hype failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-sm flex-col gap-4 border-2 border-cta-border bg-surface p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-cta-border">🔥 Hype</p>
            <h2 className="text-lg font-semibold text-foreground">{countryName}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-lg leading-none text-muted hover:text-foreground">
            ×
          </button>
        </div>

        <p className="text-sm text-muted">
          Puts {countryName} — and everything on your throne card right now — in the one spotlight above the map for{" "}
          {HYPE_DURATION_HOURS} hours, seen by everyone whether or not they click into your country.
        </p>

        {active && !isSelf && (
          <p className="text-xs text-muted-2">
            Currently hyping <span className="text-foreground">{hype!.isoCode}</span> at{" "}
            {formatMoney(hype!.currentValue ?? 0)} — you need at least {formatMoney(minimum)} to take it over.
          </p>
        )}
        {isSelf && (
          <p className="text-xs text-muted-2">
            You&apos;re already the one hyped — paying again adds {HYPE_DURATION_HOURS} more hours on top of your
            remaining time, doesn&apos;t reset it.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {PAYMENTS_ENABLED ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Offer (min {formatMoney(minimum)})</span>
              <input
                type="number"
                required
                min={minimum}
                step="0.01"
                value={offeredAmount}
                onChange={(event) => setOfferedAmount(event.target.value)}
                className="border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
              />
            </label>
          ) : (
            <p className="rounded-sm border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
              Free during the beta — no payment happens. Only the throne holder who claimed {countryName} can hype it.
            </p>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className={`px-4 py-2 text-sm font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60 ${CTA_CLASSES}`}
          >
            {submitting ? "Hyping…" : PAYMENTS_ENABLED ? `Hype for ${formatMoney(minimum)}` : "Hype for free"}
          </button>
        </form>
      </div>
    </div>
  );
}
