// Shared "start of the current UTC month" helpers — every month-scoped
// bonus/ranking computation (src/lib/throne-bonus.ts, momentum.ts,
// country-rank.ts) needs the exact same cutoff, so it lives in one place
// rather than three slightly-different reimplementations.
export function currentMonthStartMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

export function currentMonthStartIso(): string {
  return new Date(currentMonthStartMs()).toISOString();
}
