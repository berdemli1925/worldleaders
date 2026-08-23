import type { CountryPath } from "@/components/WorldMapInteractive";

// A handful of countries are split into multiple features at 50m
// resolution — e.g. Australia's mainland and the tiny, separately-listed
// Ashmore & Cartier Is. both resolve to alpha2 "AU" (see WorldMap.tsx).
// Keeping the one with the larger bounding box, rather than whichever
// happens to sort last, is what both WorldMapInteractive's focusCountry
// and Leaderboard's claim-modal wiring need — shared here so the two never
// drift into picking different features for the same country.
export function buildCountryByAlpha2(countries: CountryPath[]): Map<string, CountryPath> {
  const map = new Map<string, CountryPath>();
  for (const country of countries) {
    if (!country.alpha2) continue;
    const existing = map.get(country.alpha2);
    if (!existing) {
      map.set(country.alpha2, country);
      continue;
    }
    const [ex0, ey0, ex1, ey1] = existing.bounds;
    const [x0, y0, x1, y1] = country.bounds;
    if ((x1 - x0) * (y1 - y0) > (ex1 - ex0) * (ey1 - ey0)) {
      map.set(country.alpha2, country);
    }
  }
  return map;
}
