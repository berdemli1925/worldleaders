"use client";

import { BETA_HOLD_HOURS, PAYMENTS_ENABLED } from "@/lib/beta-mode";
import { isVacant, requiredMinimum, type ThroneEntry } from "@/lib/throne";

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

interface ClaimThroneButtonProps {
  throne: ThroneEntry | undefined;
  onOpenClaim: () => void;
  className?: string;
}

// The one "claim/take over a throne" button — a big gold crown CTA, same
// look everywhere it appears (ThronePanel's own claim row, and now the
// Leaderboard grid's cards directly) rather than each place styling its own
// smaller version. Direct request: make claiming impossible to miss, not
// a quiet link buried under the vote button.
export default function ClaimThroneButton({ throne, onOpenClaim, className }: ClaimThroneButtonProps) {
  const vacant = isVacant(throne);

  // Occupied + beta mode: no takeover is possible at all (see
  // ThroneClaimModal's own betaBlocked) — a live button here would just
  // open a modal that immediately dead-ends, so this shows the held state
  // as plain text instead of a CTA that goes nowhere.
  if (!vacant && !PAYMENTS_ENABLED) {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs text-muted-2 ${className ?? ""}`}
        title="No takeovers during the free beta"
      >
        Held up to {BETA_HOLD_HOURS}h
      </span>
    );
  }

  const label = vacant
    ? PAYMENTS_ENABLED
      ? `Claim throne · ${formatMoney(requiredMinimum(throne))}`
      : "Claim throne — free"
    : `Take the throne · ${formatMoney(requiredMinimum(throne))}`;

  return (
    <button
      type="button"
      onClick={onOpenClaim}
      className={`flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent-foreground shadow-md transition-all hover:brightness-110 hover:shadow-lg active:scale-[0.98] ${className ?? ""}`}
    >
      <span aria-hidden="true" className="text-lg leading-none">
        👑
      </span>
      {label}
    </button>
  );
}
