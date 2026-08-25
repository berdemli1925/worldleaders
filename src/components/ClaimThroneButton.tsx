"use client";

import { BETA_HOLD_HOURS, PAYMENTS_ENABLED } from "@/lib/beta-mode";
import { CTA_CLASSES } from "@/lib/cta-style";
import { isVacant, requiredMinimum, type ThroneEntry } from "@/lib/throne";

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

interface ClaimThroneButtonProps {
  throne: ThroneEntry | undefined;
  onOpenClaim: () => void;
  className?: string;
}

// The one "claim/take over a throne" button — same look everywhere it
// appears (ThronePanel's own claim row, and now the Leaderboard grid's
// cards directly) rather than each place styling its own smaller version.
// Direct request, second pass: a near-black stenciled plate with a bold
// yellow label and a thin war-red frame ("siyah üstüne sarı yazı, kenarda
// kırmızı") — reads as a warning/hazard marker, not a friendly "buy now"
// pill. See src/lib/cta-style.ts, shared by every primary action button
// site-wide now, not just this one.
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
      className={`flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold uppercase tracking-widest ${CTA_CLASSES} ${className ?? ""}`}
    >
      <span aria-hidden="true" className="text-cta-border">
        ▸
      </span>
      <span aria-hidden="true" className="text-lg leading-none">
        👑
      </span>
      {label}
      <span aria-hidden="true" className="text-cta-border">
        ◂
      </span>
    </button>
  );
}
