import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { whereNumeric } from "iso-3166-1";

import countriesTopology from "@/data/countries-110m.json";
import Dashboard from "./Dashboard";
import { type CountryPath } from "./WorldMapInteractive";

const WIDTH = 960;
const HEIGHT = 500;

// world-atlas's countries-110m.json ships a TopoJSON topology with a single
// "countries" object — a GeometryCollection where each geometry is one country.
const topology = countriesTopology as unknown as Topology<{
  countries: GeometryCollection;
}>;

const countries = feature(topology, topology.objects.countries);

// features() can technically return a single Feature instead of a
// FeatureCollection depending on the input geometry — countries-110m.json is
// always a GeometryCollection, so this is here purely to satisfy TypeScript.
const countryFeatures = "features" in countries ? countries.features : [countries];

const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], countries);
const pathGenerator = geoPath(projection);

// All the geometry math above runs once at module load, on the server only —
// the client just receives the plain {id, name, d} list below, never the raw
// topology or d3/topojson code.
const countryPaths: CountryPath[] = countryFeatures.map((country, index) => {
  const rawId = country.id;
  const hasIsoId = rawId !== undefined && rawId !== null;

  // A few disputed territories (Kosovo, N. Cyprus, Somaliland, …) have no
  // official ISO 3166-1 numeric code and so no `id` in this dataset. Fall
  // back to a positional id so every feature still gets a stable, unique key
  // — without this, all of them collapse onto the same "undefined" id.
  const id = hasIsoId ? String(rawId) : `no-iso-${index}`;

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
    // avatar marker. Computed once here (server-side, module load) rather
    // than measured at runtime via getBBox().
    bounds: [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]],
    centroid: [centroid[0], centroid[1]],
  };
});

interface WorldMapProps {
  /** ISO code to scroll-to and expand on mount — see page.tsx's ?country= handling. */
  initialHighlightIso?: string;
}

export default function WorldMap({ initialHighlightIso }: WorldMapProps) {
  return (
    <Dashboard countries={countryPaths} width={WIDTH} height={HEIGHT} initialHighlightIso={initialHighlightIso} />
  );
}
