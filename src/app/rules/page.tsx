import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rules — World Leaders",
  description: "Voting rules, leadership rules, pricing, and refund policy.",
};

// Draft copy adapted from the project spec — replace with your own wording.
// Kept in sync with what's actually implemented (see proje-spesifikasyonu.md
// and the throne/voting system code) rather than the older 30-min/2x-cap
// numbers from an earlier draft of the spec.
export default function RulesPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Rules</h1>
          <p className="max-w-xl text-sm text-muted">Draft copy — edit freely.</p>
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
            <h2 className="text-base font-semibold text-foreground">Leadership</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>Claiming a country&apos;s throne requires linking a public X post — it&apos;s shown, along with a
                brand name, description, and link you provide, on top of that country.</li>
              <li>A throne lasts <strong className="text-foreground">1 week</strong> from the moment it&apos;s first
                claimed. Being outbid during that week does not extend or reset it.</li>
              <li>The linked post is snapshotted at claim time and checked periodically — if it&apos;s deleted, hidden,
                or edited, the content is automatically taken down.</li>
              <li>Posts marked sensitive by X, or containing disallowed language, are rejected up front. Anyone can
                report shown content; reports go to moderation.</li>
              <li>Your handle stays visible in a country&apos;s past-leaders history permanently, even after your
                reign ends.</li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Pricing</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>Every country has a base price set by its current monthly voting rank — top 10: $3.00, 11–30:
                $2.50, 31–70: $2.00, everyone else: $1.50.</li>
              <li>Base prices refresh hourly, so the price can&apos;t shift on you mid-claim. In the first 24 hours of
                a new month, prices are still based on the previous month&apos;s ranking.</li>
              <li>Taking an occupied throne costs at least <strong className="text-foreground">$2 more</strong> than
                its current value — you can offer more, there&apos;s no cap.</li>
              <li>Money you&apos;ve put into a country stands as credit: reclaiming it later costs you only the
                difference. Credit is specific to that country and resets once its throne cycle fully lapses.</li>
              <li>
                <strong className="text-foreground">Note:</strong> payments aren&apos;t live yet — claiming currently
                runs in a free test mode.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Refunds</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>There are no refunds. If you&apos;re outbid before your week is up, you don&apos;t get your money
                back — it stays as credit toward reclaiming the country instead.</li>
              <li>Content removed for breaking the rules is not refunded.</li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}
