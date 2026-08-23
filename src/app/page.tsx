import type { Metadata } from "next";

import { getCountryMeta } from "@/lib/country-meta";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

  const { data: ranking } = await supabaseAdmin
    .from("leaderboard")
    .select("iso_code, vote_count")
    .order("vote_count", { ascending: false });
  const rows = (ranking ?? []) as { iso_code: string; vote_count: number }[];
  const rank = rows.findIndex((row) => row.iso_code === countryParam);
  const voteCount = rank >= 0 ? rows[rank].vote_count : 0;

  const title = `${meta.name} — World Leaders`;
  const description =
    rank >= 0
      ? `${meta.name} is ranked #${rank + 1} this month with ${voteCount.toLocaleString("en-US")} votes. Vote or claim the throne.`
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

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-4xl flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">World leaders</h1>
          <p className="max-w-xl text-sm text-muted">
            Vote for your country, watch the ranking shift, and see who&apos;s currently sitting on the throne.
          </p>
        </div>
        <WorldMap initialHighlightIso={countryParam} />
      </main>
    </div>
  );
}
