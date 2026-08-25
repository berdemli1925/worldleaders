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

// The one "claim/take over a throne" button — same squared-off, flat-
// bordered look everywhere it appears (ThronePanel's own claim row, and now
// the Leaderboard grid's cards directly) rather than each place styling its
// own smaller version. Direct request: make claiming impossible to miss —
// but deliberately not a soft glowing pill; sharp corners, a hard double
// border, no drop shadow. Reads as a stamped plate/insignia rather than a
// friendly "buy now" button, matching the sharper, less candy-colored
// theme direction (see globals.css's --accent).
export default function ClaimThroneButton({ throne, onOpenClaim, className }: ClaimThroneButtonProps) {
  const vacant = isVacant(throne);

  // Occupied + beta mode: no takeover is possible at all (see
  // ThroneClaimModal's own betaBlocked) — a live button here would just
  // open a modal that immediately dead-ends, so this shows the held state
  // as plain text instead of a CTA that goes nowhere.
  if (!vacant && !PAYMENTS_ENABLED) {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1.5 border border-dashed border-border px-4 py-2 text-xs uppercase tracking-wide text-muted-2 ${className ?? ""}`}
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
      className={`flex items-center justify-center gap-2 border-2 border-accent-foreground/25 bg-accent px-5 py-3 text-sm font-bold uppercase tracking-widest text-accent-foreground transition-colors hover:border-accent-foreground/50 hover:bg-accent/90 active:bg-accent/80 ${className ?? ""}`}
    >
      <span aria-hidden="true" className="text-lg leading-none">
        👑
      </span>
      {label}
    </button>
  );
}
