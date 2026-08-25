import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CountryVoteButton from "@/components/CountryVoteButton";
import Flag from "@/components/Flag";
import { getCountryMeta } from "@/lib/country-meta";
import { getRankedLeaderboard } from "@/lib/country-rank";
import { getCountryBySlug, getAllCountrySlugs } from "@/lib/country-slug";
import { getCountryPath } from "@/lib/country-topology";
import { getMomentumData } from "@/lib/momentum";
import { findClosestRival } from "@/lib/rank";
import { supabaseAdmin } from "@/lib/supabase/admin";

// AŞAMA 3 — one statically-generated page per country (/turkiye, /greece,
// /japan, …), each with its own title/description/share card so it can rank
// on its own in search rather than only the homepage. See
// src/lib/country-slug.ts for the slug scheme.
export async function generateStaticParams() {
  return getAllCountrySlugs().map((entry) => ({ country: entry.slug }));
}

async function loadCountryPage(slug: string) {
  const entry = getCountryBySlug(slug);
  if (!entry) return null;

  const [rows, { data: throneRow }, momentum] = await Promise.all([
    getRankedLeaderboard(), // ranked by total power (AŞAMA 5) — see src/lib/rank.ts
    supabaseAdmin
      .from("thrones_with_leader")
      .select("x_handle, brand_title, description, link_url, logo_url, current_value, cycle_end")
      .eq("country_iso_code", entry.alpha2)
      .not("current_value", "is", null)
      .maybeSingle(),
    getMomentumData(),
  ]);

  const index = rows.findIndex((row) => row.isoCode === entry.alpha2);
  const rank = index >= 0 ? index + 1 : rows.length + 1;
  const row = index >= 0 ? rows[index] : null;
  const voteCount = row?.voteCount ?? 0;
  const nextAbove = index > 0 ? rows[index - 1] : null;
  const votesToOvertake = nextAbove ? nextAbove.voteCount - voteCount + 1 : null;
  // Same "closest rival" definition the share card/text and vote-result
  // screen use — see src/lib/rank.ts. Drives both the share button's
  // matchup text and the OG description below.
  const rival = findClosestRival(rows, entry.alpha2);

  const rankNow = momentum.rankNow.get(entry.alpha2) ?? rank;
  const rank7dAgo = momentum.rank7dAgo.get(entry.alpha2) ?? rankNow;
  const weeklyChange = rank7dAgo - rankNow; // positive: climbed that many places

  return {
    entry,
    meta: getCountryMeta(entry.alpha2),
    rank,
    voteCount,
    nextAboveName: nextAbove?.name ?? null,
    votesToOvertake,
    weeklyChange,
    rival,
    throne: throneRow as
      | {
          x_handle: string | null;
          brand_title: string | null;
          description: string | null;
          link_url: string | null;
          logo_url: string | null;
          current_value: number | null;
          cycle_end: string | null;
        }
      | null,
    mapPath: getCountryPath(entry.alpha2),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>;
}): Promise<Metadata> {
  const { country } = await params;
  const data = await loadCountryPage(country);
  if (!data) return {};

  const title = `${data.entry.name} — Ranked #${data.rank} on World Leaders`;
  const description = data.rival
    ? // rival.direction is from entry's POV: "ahead" means the rival is
      // ahead of entry, so entry reads as "behind" it, and vice versa.
      `${data.entry.name} (${data.voteCount.toLocaleString("en-US")}) is only ${data.rival.gap.toLocaleString("en-US")} votes ${data.rival.direction === "ahead" ? "behind" : "ahead of"} ${data.rival.name} (${data.rival.voteCount.toLocaleString("en-US")}) on World Leaders. Pick a side.`
    : `${data.entry.name} has ${data.voteCount.toLocaleString("en-US")} votes this month on World Leaders. Vote for ${data.entry.name}, or claim its throne.`;
  const imageUrl = `/api/og/country/${data.entry.alpha2}`;

  return {
    title,
    description,
    alternates: { canonical: `/${data.entry.slug}` },
    openGraph: { title, description, images: [imageUrl] },
    twitter: { card: "summary_large_image", title, description, images: [imageUrl] },
  };
}

export default async function CountryPage({ params }: { params: Promise<{ country: string }> }) {
  const { country } = await params;
  const data = await loadCountryPage(country);
  if (!data) notFound();

  const { entry, meta, rank, voteCount, nextAboveName, votesToOvertake, weeklyChange, throne, mapPath, rival } = data;

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-4">
          <Flag alpha2={entry.alpha2} width={56} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl">{entry.name}</h1>
            <p className="text-sm text-muted">
              {meta?.capital ?? "Unknown capital"} · {meta?.continent ?? "—"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-surface p-4">
            <p className="text-xs text-muted-2">Rank this month</p>
            <p className="font-mono text-2xl font-bold text-foreground">#{rank}</p>
          </div>
          <div className="rounded-md border border-accent/40 bg-accent/10 p-4">
            <p className="text-xs text-accent">Votes</p>
            <p className="font-mono text-2xl font-bold text-accent">{voteCount.toLocaleString("en-US")}</p>
          </div>
          <div className="col-span-2 rounded-md border border-border bg-surface p-4 sm:col-span-1">
            <p className="text-xs text-muted-2">Last 7 days</p>
            <p
              className={`font-mono text-2xl font-bold ${
                weeklyChange > 0 ? "text-success" : weeklyChange < 0 ? "text-danger" : "text-muted"
              }`}
            >
              {weeklyChange > 0 ? `↑${weeklyChange}` : weeklyChange < 0 ? `↓${Math.abs(weeklyChange)}` : "—"}
            </p>
          </div>
        </div>

        {nextAboveName && votesToOvertake !== null && (
          <p className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted">
            <span className="font-semibold text-foreground">{votesToOvertake.toLocaleString("en-US")}</span> more
            vote{votesToOvertake === 1 ? "" : "s"} to pass{" "}
            <span className="font-medium text-foreground">{nextAboveName}</span> and take #{rank - 1}.
          </p>
        )}

        {mapPath && (
          <div className="overflow-hidden rounded-md border border-border bg-[#040508]">
            <svg
              viewBox={(() => {
                const [x0, y0, x1, y1] = mapPath.bounds;
                const w = x1 - x0;
                const h = y1 - y0;
                const pad = Math.max(w, h, 4) * 0.35;
                return `${x0 - pad} ${y0 - pad} ${w + pad * 2} ${h + pad * 2}`;
              })()}
              className="h-52 w-full"
            >
              <path d={mapPath.d} className="fill-accent/80 stroke-accent" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            </svg>
            <Link
              href={`/?country=${entry.alpha2}`}
              className="block border-t border-border px-4 py-2 text-center text-xs text-muted hover:bg-surface-hover hover:text-foreground"
            >
              View on the full live map →
            </Link>
          </div>
        )}

        <div className="rounded-md border border-border bg-surface p-5">
          {throne?.current_value !== null && throne ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-wide text-accent">Currently led by</p>
              <div className="flex items-center gap-2">
                {throne.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={throne.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                )}
                <p className="font-semibold text-foreground">
                  {throne.brand_title ?? (throne.x_handle ? `@${throne.x_handle}` : "Unnamed leader")}
                </p>
              </div>
              {throne.description && <p className="text-sm text-muted">{throne.description}</p>}
              {throne.link_url && (
                <a href={throne.link_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
                  {throne.link_url}
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-2">
              No leader yet.{" "}
              <Link href={`/?country=${entry.alpha2}`} className="text-accent hover:underline">
                Claim the throne
              </Link>
              .
            </p>
          )}
        </div>

        <CountryVoteButton
          isoCode={entry.alpha2}
          countryName={entry.name}
          rank={rank}
          voteCount={voteCount}
          rival={rival}
        />
      </main>
    </div>
  );
}
