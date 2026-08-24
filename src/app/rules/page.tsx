import type { Metadata } from "next";

import { BETA_HOLD_HOURS, BETA_MAX_COUNTRIES_PER_USER, PAYMENTS_ENABLED } from "@/lib/beta-mode";

export const metadata: Metadata = {
  title: "Rules — World Leaders",
  description: "Voting rules, leadership rules, pricing, and refund policy.",
};

// Kept in sync with what's actually implemented (see proje-spesifikasyonu.md
// and the throne/voting system code) rather than the older 30-min/2x-cap
// numbers from an earlier draft of the spec. Leadership content branches on
// PAYMENTS_ENABLED (src/lib/beta-mode.ts): while it's off, the site runs
// the free beta rules described here, and the paid system below is framed
// as what's coming later; once it's on, the paid system is simply "how it
// works" and the beta framing disappears.
export default function RulesPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Rules</h1>
          <p className="max-w-xl text-sm text-muted">Voting, leadership, pricing, and refunds.</p>
        </div>

        <div className="flex flex-col gap-8 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Voting</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>Voting is free — no account needed.</li>
              <li>One vote per day, tied to your IP address and browser.</li>
              <li>The monthly ranking resets on the 1st of every month, UTC. Older votes aren&apos;t deleted, just no
                longer counted toward the current month — see the &quot;All time&quot; tab and the Champions page.</li>
              <li>Votes are checked by an invisible bot-protection challenge (Cloudflare Turnstile).</li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Starting scores</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>Every country begins the month with a <strong className="text-foreground">starting score</strong>,
                so the map and leaderboard show real variation from the first vote rather than 250 identical,
                empty-looking countries.</li>
              <li>Starting scores are a fixed, curated list, not a formula and never random — the same country
                always gets the same starting score. They&apos;re not based on population; most countries start at
                a flat, minimal baseline, with a curated set of countries starting higher to reflect where this
                site&apos;s activity realistically concentrates.</li>
              <li>A country&apos;s rank is its <strong className="text-foreground">total power</strong>: starting
                score plus real votes. The two are always shown separately — a starting score is never counted or
                described as a vote.</li>
            </ul>
          </section>

          {!PAYMENTS_ENABLED && (
            <section className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent/10 p-4">
              <h2 className="text-base font-semibold text-accent">Leadership is free during the beta</h2>
              <ul className="list-inside list-disc space-y-1">
                <li>Claiming a country&apos;s throne costs nothing right now — no payment, no account.</li>
                <li>A claim holds the country for <strong className="text-foreground">{BETA_HOLD_HOURS} hour</strong>,
                  starting the moment you claim it. Nobody — including you — can take it over during that hour.</li>
                <li>When the hour ends, the throne empties and opens back up to anyone.</li>
                <li>&quot;One person&quot; is your IP address and browser fingerprint together, the same pairing used
                  for voting. You can lead up to{" "}
                  <strong className="text-foreground">{BETA_MAX_COUNTRIES_PER_USER} countries</strong> at once —
                  trying for a sixth is rejected and shows which countries you&apos;re already holding.</li>
                <li>Everything else about leadership — the required X post, moderation, and history — works exactly
                  as described below; only the price, duration, and takeover rule are different during the beta.</li>
                <li>This is temporary. The paid system described in the sections below is what launches once the
                  beta ends.</li>
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Leadership</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>Claiming a country&apos;s throne requires linking a public X post — it&apos;s shown, along with a
                brand name, description, and link you provide, on top of that country.</li>
              {PAYMENTS_ENABLED ? (
                <li>A throne lasts <strong className="text-foreground">1 week</strong> from the moment it&apos;s
                  first claimed. Being outbid during that week does not extend or reset it.</li>
              ) : (
                <li>During the beta, a throne lasts <strong className="text-foreground">{BETA_HOLD_HOURS} hour</strong>{" "}
                  from the moment it&apos;s claimed, and can&apos;t be taken over while active — see above.</li>
              )}
              <li>The linked post is snapshotted at claim time and checked periodically — if it&apos;s deleted, hidden,
                or edited, the content is automatically taken down. This runs the same way whether or not payments
                are on.</li>
              <li>Posts marked sensitive by X, or containing disallowed language, are rejected up front. Anyone can
                report shown content; reports go to moderation. These checks are never turned off, beta or not.</li>
              <li>Your handle stays visible in a country&apos;s past-leaders history permanently, even after your
                reign ends.</li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">
              Pricing{!PAYMENTS_ENABLED && <span className="text-muted-2"> — after the beta</span>}
            </h2>
            {!PAYMENTS_ENABLED && (
              <p className="text-xs text-muted-2">
                Nothing below is charged right now — leadership is free during the beta (see above). This is the
                system that takes over once it ends; prices you see elsewhere on the site are shown crossed out
                until then.
              </p>
            )}
            <ul className="list-inside list-disc space-y-1">
              <li>Every country has a base price set by its current monthly voting rank — top 10: $3.00, 11–30:
                $2.50, 31–70: $2.00, everyone else: $1.50.</li>
              <li>Base prices refresh hourly, so the price can&apos;t shift on you mid-claim. In the first 24 hours of
                a new month, prices are still based on the previous month&apos;s ranking.</li>
              <li>Taking an occupied throne costs at least <strong className="text-foreground">$2 more</strong> than
                its current value — you can offer more, there&apos;s no cap.</li>
              <li>Money you&apos;ve put into a country stands as credit: reclaiming it later costs you only the
                difference. Credit is specific to that country and resets once its throne cycle fully lapses.</li>
              <li>A throne lasts 1 week from the moment it&apos;s first claimed; being outbid during that week does
                not extend or reset it.</li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">
              Refunds{!PAYMENTS_ENABLED && <span className="text-muted-2"> — after the beta</span>}
            </h2>
            {!PAYMENTS_ENABLED ? (
              <p>No payments happen during the free beta, so there&apos;s nothing to refund. Once the paid system
                above launches, the policy is: there are no refunds. If you&apos;re outbid before your week is up,
                you don&apos;t get your money back — it stays as credit toward reclaiming the country instead.
                Content removed for breaking the rules is not refunded either, beta or not.</p>
            ) : (
              <ul className="list-inside list-disc space-y-1">
                <li>There are no refunds. If you&apos;re outbid before your week is up, you don&apos;t get your money
                  back — it stays as credit toward reclaiming the country instead.</li>
                <li>Content removed for breaking the rules is not refunded.</li>
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">The country list</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>The ~250 countries and territories on this site follow the ISO 3166-1 standard, and continent
                groupings follow the UN geoscheme.</li>
              <li>This is a technical convention used for consistency and completeness — it is{" "}
                <strong className="text-foreground">not</strong> a political statement about sovereignty,
                territorial disputes, or the recognition of any government or boundary.</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
