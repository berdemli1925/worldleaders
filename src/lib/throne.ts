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

// Raw row shape returned by selecting from the `thrones_with_leader` view
// (see scripts/setup-throne-system.mjs / scripts/setup-moderation.mjs) —
// shared by Dashboard.tsx (client-side fetch via supabaseBrowser) and
// src/app/leaders/page.tsx (server-side fetch via supabaseAdmin) so the
// column-name-to-ThroneEntry mapping only lives in one place.
export interface ThroneRow {
  country_iso_code: string;
  base_price: number;
  current_value: number | null;
  current_claim_id: number | null;
  cycle_start: string | null;
  cycle_end: string | null;
  x_handle: string | null;
  amount_paid: number | null;
  post_text: string | null;
  post_author_name: string | null;
  post_author_avatar_url: string | null;
  post_image_url: string | null;
  post_created_at: string | null;
  brand_title: string | null;
  description: string | null;
  link_url: string | null;
  logo_url: string | null;
  claimed_at: string | null;
}

export function mapThroneRow(row: ThroneRow): ThroneEntry {
  return {
    isoCode: row.country_iso_code,
    basePrice: row.base_price,
    currentValue: row.current_value,
    currentClaimId: row.current_claim_id,
    cycleStart: row.cycle_start ? new Date(row.cycle_start).getTime() : null,
    cycleEnd: row.cycle_end ? new Date(row.cycle_end).getTime() : null,
    handle: row.x_handle,
    amountPaid: row.amount_paid,
    postText: row.post_text,
    postAuthorName: row.post_author_name,
    postAuthorAvatarUrl: row.post_author_avatar_url,
    postImageUrl: row.post_image_url,
    postCreatedAt: row.post_created_at ? new Date(row.post_created_at).getTime() : null,
    brandTitle: row.brand_title,
    description: row.description,
    linkUrl: row.link_url,
    logoUrl: row.logo_url,
    claimedAt: row.claimed_at ? new Date(row.claimed_at).getTime() : null,
  };
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
