import { countryPaths, MAP_HEIGHT, MAP_WIDTH } from "@/lib/country-topology";
import Dashboard from "./Dashboard";

interface WorldMapProps {
  /** ISO code to scroll-to and expand on mount — see page.tsx's ?country= handling. */
  initialHighlightIso?: string;
  /** IP-based country guess for the hero — see src/lib/geo.ts. */
  guessCountryIso?: string;
}

export default function WorldMap({ initialHighlightIso, guessCountryIso }: WorldMapProps) {
  return (
    <Dashboard
      countries={countryPaths}
      width={MAP_WIDTH}
      height={MAP_HEIGHT}
      initialHighlightIso={initialHighlightIso}
      guessCountryIso={guessCountryIso}
    />
  );
}
