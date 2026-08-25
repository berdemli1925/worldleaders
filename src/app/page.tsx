import type { Metadata } from "next";

import { getCountryMeta } from "@/lib/country-meta";
import { getRankedLeaderboard } from "@/lib/country-rank";
import { getGeoCountryIso } from "@/lib/geo";
import { LogoMark } from "@/components/Logo";
import WorldMap from "@/components/WorldMap";

// With no ?country= param this returns {} and the page inherits the root
// layout's static title/description plus src/app/opengraph-image.tsx as
// the default share card. With ?country=XX (set by the share button on a
// leaderboard row — see Leaderboard.tsx) it overrides both with
// country-specific copy and /api/og/country/[iso] as the image, so a
// shared link previews the right country instead of the generic card.
export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const params = await searchParams;
  const countryParam = typeof params.country === "string" ? params.country.toUpperCase() : null;
  if (!countryParam) return {};

  const meta = getCountryMeta(countryParam);
  if (!meta) return {};

  // Ranked by total power (AŞAMA 5), same as everywhere else — see src/lib/rank.ts.
  const rows = await getRankedLeaderboard();
  const rankIndex = rows.findIndex((row) => row.isoCode === countryParam);
  const voteCount = rankIndex >= 0 ? rows[rankIndex].voteCount : 0;

  const title = `${meta.name} — World Leaders`;
  const description =
    rankIndex >= 0
      ? `${meta.name} is ranked #${rankIndex + 1} this month with ${voteCount.toLocaleString("en-US")} votes. Vote or claim the throne.`
      : `Vote for ${meta.name}, or claim its throne, on World Leaders.`;
  const imageUrl = `/api/og/country/${countryParam}`;

  return {
    title,
    description,
    openGraph: { title, description, images: [imageUrl] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const countryParam = typeof params.country === "string" ? params.country.toUpperCase() : undefined;
  const guessCountryIso = await getGeoCountryIso();

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-6 sm:py-10">
      {/* max-w-7xl — the map is meant to almost fill the screen (direct
          request), and the leaderboard grid below still reads fine at this
          width. */}
      <main className="flex w-full max-w-7xl flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="flex items-center gap-3 text-foreground">
            <LogoMark className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
            <span className="flex items-baseline gap-2 whitespace-nowrap text-xl uppercase tracking-tight sm:text-2xl">
              <span className="text-[0.94em] font-normal tracking-[0.02em] text-muted">World</span>
              <span className="font-bold tracking-[0.005em]">Leaders</span>
            </span>
          </h1>
        </div>
        <WorldMap initialHighlightIso={countryParam} guessCountryIso={guessCountryIso} />
      </main>
    </div>
  );
}
