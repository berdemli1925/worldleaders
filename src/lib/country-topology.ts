import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { whereNumeric } from "iso-3166-1";

import countriesTopology from "@/data/countries-50m.json";
import type { CountryPath } from "@/components/WorldMapInteractive";

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 500;

// 50m rather than world-atlas's default 110m: at 110m resolution, 73 of the
// ~250 countries in `countries` (mostly small island nations and
// microstates — Malta, Andorra, Bahrain, Nauru, Brunei, …) have no geometry
// at all and simply can't be shown or clicked on the map, which defeats a
// zoom range built specifically to reach small countries. 50m recovers all
// but a literal handful of them (Tuvalu's islets are still below even this
// resolution) at a still-reasonable data size. See WorldMapInteractive's
// MAX_SCALE comment for the other half of this.
//
// world-atlas's countries-50m.json ships a TopoJSON topology with a single
// "countries" object — a GeometryCollection where each geometry is one country.
const topology = countriesTopology as unknown as Topology<{
  countries: GeometryCollection;
}>;

const countries = feature(topology, topology.objects.countries);

// features() can technically return a single Feature instead of a
// FeatureCollection depending on the input geometry — countries-50m.json is
// always a GeometryCollection, so this is here purely to satisfy TypeScript.
const countryFeatures = "features" in countries ? countries.features : [countries];

const projection = geoNaturalEarth1().fitSize([MAP_WIDTH, MAP_HEIGHT], countries);
// digits(2) rounds path coordinates to 0.01 of a viewBox unit instead of
// d3-geo's default 3 — at MAX_SCALE (see WorldMapInteractive), 0.01 unit is
// ~2.5 screen px, well below what's visible, while cutting the `d` strings'
// gzipped size by about a fifth. Doesn't touch .bounds()/.centroid() below,
// which stay full-precision (they're a handful of numbers per country, not
// worth trading accuracy for).
const pathGenerator = geoPath(projection).digits(2);

// All the geometry math below runs once at module load, on the server only
// (this module is only ever imported from Server Components / other
// server-only modules — see WorldMap.tsx and src/app/[country]/page.tsx) —
// the client just receives the plain {id, name, d} list, never the raw
// topology or d3/topojson code.
export const countryPaths: CountryPath[] = countryFeatures.map((country, index) => {
  const rawId = country.id;
  const hasIsoId = rawId !== undefined && rawId !== null;

  // Always suffixed with the feature's index, even when it has a real ISO
  // id: a few disputed territories (Kosovo, N. Cyprus, Somaliland, …) have
  // no numeric code at all, but 50m resolution also splits some countries
  // into multiple features sharing one code (Australia's mainland and
  // Ashmore & Cartier Is. both carry "036") — either way, without the
  // index suffix two features collide on the same id, and React logs a
  // duplicate-key warning and can drop/mix up one of them.
  const id = hasIsoId ? `${rawId}-${index}` : `no-iso-${index}`;

  // world-atlas stores the ISO 3166-1 numeric code without zero-padding
  // guarantees for lookup libraries, so pad it to the standard 3 digits.
  const isoInfo = hasIsoId ? whereNumeric(String(rawId).padStart(3, "0")) : undefined;

  const bounds = pathGenerator.bounds(country);
  const centroid = pathGenerator.centroid(country);

  return {
    id,
    name:
      (country.properties as { name?: string } | null | undefined)?.name ??
      "Unknown",
    alpha2: isoInfo?.alpha2,
    alpha3: isoInfo?.alpha3,
    d: pathGenerator(country) ?? "",
    // Same 960x500 coordinate space as `d` — used by WorldMapInteractive to
    // decide, per country, whether it's on-screen and large enough at the
    // current zoom to show a leader's clipped post image vs. a small
    // avatar marker, and by src/app/[country]/page.tsx's mini zoomed map.
    bounds: [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]],
    centroid: [centroid[0], centroid[1]],
  };
});

// Same "keep the larger feature" tie-break as src/lib/country-path.ts
// (buildCountryByAlpha2) — duplicated rather than imported from there
// because that helper takes an arbitrary CountryPath[] (it's also used
// client-side on the already-shipped `countries` prop), while this one is
// specifically the server-side singleton above, built once at module load.
const pathByAlpha2 = new Map<string, CountryPath>();
for (const country of countryPaths) {
  if (!country.alpha2) continue;
  const existing = pathByAlpha2.get(country.alpha2);
  if (!existing) {
    pathByAlpha2.set(country.alpha2, country);
    continue;
  }
  const [ex0, ey0, ex1, ey1] = existing.bounds;
  const [x0, y0, x1, y1] = country.bounds;
  if ((x1 - x0) * (y1 - y0) > (ex1 - ex0) * (ey1 - ey0)) {
    pathByAlpha2.set(country.alpha2, country);
  }
}

export function getCountryPath(alpha2: string): CountryPath | undefined {
  return pathByAlpha2.get(alpha2.toUpperCase());
}
