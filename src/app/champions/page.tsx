import type { Metadata } from "next";
import Link from "next/link";

import Flag from "@/components/Flag";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Champions — World Leaders",
  description: "The top countries archived at the end of each past month.",
};

interface ChampionRow {
  month: string; // plain date, e.g. "2026-08-01" — the first day of the month
  rank: number;
  iso_code: string;
  name: string;
  vote_count: number;
}

// `month` is a plain date column with no time component. Parsing it as UTC
// (rather than letting `new Date("2026-08-01")` get interpreted in the
// server's local timezone) keeps the displayed month from shifting by a day.
function monthLabel(monthDate: string): string {
  const [year, month] = monthDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function nextMonthLabel(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

const RANK_BADGE_STYLE: Record<number, string> = {
  1: "border-accent/60 bg-accent/10 text-accent",
  2: "border-border bg-surface-hover text-foreground",
  3: "border-border bg-surface-hover text-muted",
};

export default async function ChampionsPage() {
  // Server-side read via the service-role client (same one src/app/api/votes
  // uses) — this page never ships that key to the browser, only the rows it
  // fetches with it. `champions` already orders itself (month desc, rank
  // asc) but the explicit .order() calls make that not depend on callers
  // reading the view definition to know the order.
  const { data, error } = await supabaseAdmin
    .from("champions")
    .select("month, rank, iso_code, name, vote_count")
    .order("month", { ascending: false })
    .order("rank", { ascending: true });

  const rows = (error ? [] : (data ?? [])) as ChampionRow[];

  const months = new Map<string, ChampionRow[]>();
  for (const row of rows) {
    if (!months.has(row.month)) months.set(row.month, []);
    months.get(row.month)!.push(row);
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-4xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← Back to rankings
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Champions</h1>
          <p className="max-w-xl text-sm text-muted">
            The top 3 countries archived at the end of each month, right when the ranking resets.
          </p>
        </div>

        {months.size === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-4 py-12 text-center">
            <p className="text-sm text-muted">
              No champions yet. The first monthly winners are archived when {nextMonthLabel()} begins.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {[...months.entries()].map(([month, monthRows]) => (
              <section key={month} className="rounded-2xl border border-border bg-surface p-4">
                <h2 className="mb-3 text-sm font-medium text-muted">{monthLabel(month)}</h2>
                <div className="flex flex-col gap-2">
                  {monthRows.map((row) => (
                    <div key={`${month}-${row.rank}`} className="flex items-center gap-3">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold ${
                          RANK_BADGE_STYLE[row.rank] ?? RANK_BADGE_STYLE[3]
                        }`}
                      >
                        {row.rank}
                      </span>
                      <Flag alpha2={row.iso_code} width={28} />
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{row.name}</span>
                      <span className="font-mono text-sm text-muted">
                        {row.vote_count.toLocaleString("en-US")} vote{row.vote_count === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
