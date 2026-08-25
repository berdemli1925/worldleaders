// Claiming a country's throne gives it a one-time +10 boost to its
// displayed vote count, on top of real votes and the starting baseline
// (see seed-score.ts) — direct request: taking the throne should visibly
// move the needle. Computed on the fly from the existing throne claim
// history (never stored as its own value) — same "no DB migration"
// approach as the starting score and momentum data.
//
// Scoped to the current UTC month for the main ranking, same as votes
// themselves — a claim made last month shouldn't keep inflating this
// month's numbers after the reset. The "All time" view instead passes 0
// as `sinceMs` so every claim ever counts.
export const THRONE_CLAIM_BONUS = 10;

export interface BonusEvent {
  isoCode: string;
  createdAt: number; // ms epoch
}

/** Sums `weight` for every event at or after `sinceMs`, per country. */
export function bonusByIso(events: BonusEvent[], sinceMs: number, weight: number): Map<string, number> {
  const map = new Map<string, number>();
  for (const event of events) {
    if (event.createdAt < sinceMs) continue;
    map.set(event.isoCode, (map.get(event.isoCode) ?? 0) + weight);
  }
  return map;
}

/** Merges any number of per-country bonus maps into one. */
export function mergeBonusMaps(...maps: Map<string, number>[]): Map<string, number> {
  const merged = new Map<string, number>();
  for (const map of maps) {
    for (const [iso, amount] of map) {
      merged.set(iso, (merged.get(iso) ?? 0) + amount);
    }
  }
  return merged;
}
