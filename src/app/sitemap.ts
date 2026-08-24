import type { MetadataRoute } from "next";

import { getAllCountrySlugs } from "@/lib/country-slug";

const STATIC_ROUTES = ["", "/leaders", "/champions", "/about", "/rules"];

// AŞAMA 3 — every static route plus all ~250 country pages, so search
// engines discover them without having to crawl the leaderboard links one
// by one. metadataBase (see layout.tsx) already resolves these to full
// worldleaders.lol URLs.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `https://worldleaders.lol${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "hourly" : "daily",
    priority: path === "" ? 1 : 0.6,
  }));

  const countryEntries: MetadataRoute.Sitemap = getAllCountrySlugs().map((entry) => ({
    url: `https://worldleaders.lol/${entry.slug}`,
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.7,
  }));

  return [...staticEntries, ...countryEntries];
}
