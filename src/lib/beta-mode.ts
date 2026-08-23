// Single feature flag: whether the site charges for leadership (the full
// weekly-cycle / tiered-price / credit system from proje-spesifikasyonu.md
// section 4, implemented in claim_throne() + the payment provider layer —
// see scripts/setup-throne-system.mjs, scripts/setup-moderation.mjs,
// scripts/setup-payments.mjs, src/lib/payments/) or the free beta rules
// instead (claim_throne_beta() — see scripts/setup-beta-mode.mjs).
//
// NEXT_PUBLIC_ so both server code (API routes decide which RPC to call)
// and client components (price strikethrough, beta badge, modal copy) read
// the exact same single switch. Flip NEXT_PUBLIC_PAYMENTS_ENABLED in
// .env.local / Vercel and redeploy — nothing else changes. Unset/anything
// other than the literal string "true" means beta mode, so the site is
// free-by-default until this is deliberately turned on. The paid-mode code
// underneath is never modified by beta mode and comes back exactly as
// before once this flips back to true.
export const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";

// Beta-mode constants (irrelevant once PAYMENTS_ENABLED is true). Mirrors
// the shape of the real system's constants (base price tiers, +$2 minimum,
// 7-day cycle) living directly in the claim_throne() SQL function.
export const BETA_HOLD_HOURS = 1;
export const BETA_MAX_COUNTRIES_PER_USER = 5;
