import countries from "world-countries";

export interface CountryMeta {
  alpha2: string;
  name: string;
  capital: string;
  continent: string;
}

// Keyed by ISO 3166-1 alpha-2 so it lines up with the `iso_code`/
// `country_iso_code` columns the Supabase views return — name/capital/
// continent live only in this static dataset, never in the database
// (except `countries.name`, which this duplicates for callers — like
// src/app/leaders/page.tsx — that only have an ISO code to work with,
// no separate vote-leaderboard row supplying the name already).
const metaByAlpha2 = new Map<string, CountryMeta>(
  countries.map((country) => [
    country.cca2,
    {
      alpha2: country.cca2,
      name: country.name.common,
      capital: country.capital?.[0] ?? "No capital",
      continent: country.region || "Other",
    },
  ]),
);

export function getCountryMeta(alpha2: string | undefined | null): CountryMeta | undefined {
  if (!alpha2) return undefined;
  return metaByAlpha2.get(alpha2.toUpperCase());
}
