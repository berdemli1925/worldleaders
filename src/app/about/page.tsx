import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — World Leaders",
  description: "What World Leaders is and how it works.",
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">About</h1>
          <p className="max-w-xl text-sm text-muted">What World Leaders is, and how it works.</p>
        </div>

        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">What is this?</h2>
            <p>
              World Leaders is an interactive world map where every country competes by vote. Anyone can vote for
              free, once a day, for their favorite country. Countries with the most votes rise to the top of the
              monthly ranking — see the &quot;This month,&quot; &quot;All time,&quot; and{" "}
              <a href="/champions" className="text-accent hover:underline">
                Champions
              </a>{" "}
              tabs for the different views on that.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Becoming a leader</h2>
            <p>
              Beyond voting, anyone can claim a country&apos;s &quot;throne&quot; by linking a public X post here,
              along with an optional brand name, description, and link. While you hold the throne, that content is
              shown on top of the country — in the leaderboard card, on the map, and in the scrolling ticker — for
              the whole site to see.
            </p>
            <p>
              A throne lasts one week from the moment it&apos;s first claimed. Anyone can outbid the current
              leader by paying at least $2 more than the throne&apos;s current value, with no upper limit. Full
              details are on the{" "}
              <a href="/rules" className="text-accent hover:underline">
                Rules
              </a>{" "}
              page.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Why we built this</h2>
            <p>
              It&apos;s a lightweight, global, slightly absurd popularity contest — a live map that reacts to real
              votes and real posts instead of sitting static, with just enough at stake (a real post, a real
              handle, a real week-long claim) to make holding a country&apos;s throne mean something.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
