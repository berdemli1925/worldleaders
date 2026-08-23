// Shared types/helpers for the throne (leadership) feature — used by
// Dashboard (fetching), Leaderboard (display), and ThroneClaimForm
// (computing the minimum a new offer must meet). Mirrors the shape of
// thrones_with_leader / throne_claims_public — see scripts/setup-throne-system.mjs.

export interface ThroneEntry {
  isoCode: string;
  basePrice: number;
  /** null = vacant (never claimed, or the cycle has ended). */
  currentValue: number | null;
  currentClaimId: number | null;
  cycleStart: number | null;
  cycleEnd: number | null;
  handle: string | null;
  amountPaid: number | null;
  postText: string | null;
  postAuthorName: string | null;
  postAuthorAvatarUrl: string | null;
  postImageUrl: string | null;
  postCreatedAt: number | null;
  brandTitle: string | null;
  description: string | null;
  linkUrl: string | null;
  logoUrl: string | null;
  claimedAt: number | null;
}

export interface ThroneClaimHistoryEntry {
  id: number;
  isoCode: string;
  handle: string;
  amountPaid: number;
  createdAt: number;
}

export function isVacant(throne: ThroneEntry | undefined): boolean {
  return !throne || throne.currentValue === null;
}

// What a new claim must offer at minimum — vacant countries start at their
// (hourly-refreshed) base price; occupied ones need +$2 over the current
// value. The real check happens server-side in claim_throne(), this is just
// for showing the number in the UI before submitting.
export function requiredMinimum(throne: ThroneEntry | undefined): number {
  if (!throne || throne.currentValue === null) return throne?.basePrice ?? 0;
  return throne.currentValue + 2;
}
