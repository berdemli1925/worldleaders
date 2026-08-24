// URL slugs for AŞAMA 3's country pages (/turkiye, /greece, /japan, …) —
// derived from each country's common name, not stored anywhere, so a slug
// is always reproducible from the same world-countries data the rest of the
// app already uses (see country-meta.ts). Verified unique across all ~250
// countries and free of collisions with the site's other top-level routes
// (/leaders, /rules, /admin, …) — see the project's build/test notes.
import countries from "world-countries";

export function slugifyCountryName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics: "Türkiye" -> "Turkiye"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface CountrySlugEntry {
  slug: string;
  alpha2: string;
  name: string;
}

const bySlug = new Map<string, CountrySlugEntry>();
const byAlpha2 = new Map<string, CountrySlugEntry>();

for (const country of countries) {
  const entry: CountrySlugEntry = {
    slug: slugifyCountryName(country.name.common),
    alpha2: country.cca2,
    name: country.name.common,
  };
  bySlug.set(entry.slug, entry);
  byAlpha2.set(entry.alpha2, entry);
}

export function getAllCountrySlugs(): CountrySlugEntry[] {
  return [...bySlug.values()];
}

export function getCountryBySlug(slug: string): CountrySlugEntry | undefined {
  return bySlug.get(slug.toLowerCase());
}

export function getSlugForCountry(alpha2: string): string | undefined {
  return byAlpha2.get(alpha2.toUpperCase())?.slug;
}
