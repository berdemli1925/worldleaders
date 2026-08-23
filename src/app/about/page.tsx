import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — World Leaders",
  description: "What World Leaders is and how it works.",
};

// Draft copy — replace with your own wording. Structure/sections are the
// part meant to stick around; the sentences are placeholders.
export default function AboutPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">About</h1>
          <p className="max-w-xl text-sm text-muted">Draft copy — edit freely.</p>
        </div>

        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">What is this?</h2>
            <p>
              World Leaders is an interactive map where every country competes by vote. Anyone can vote for free, once
              a day, for their favorite country. Countries with the most votes rise to the top of the monthly ranking.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Becoming a leader</h2>
            <p>
              Beyond voting, anyone can claim a country&apos;s throne by posting on X and linking that post here. While
              you hold the throne, your post — brand, message, and link — is shown on top of that country for the
              whole site to see.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Why we built this</h2>
            <p>Placeholder — say something here about the idea behind the project.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
