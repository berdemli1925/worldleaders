import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — World Leaders",
  description: "What data World Leaders collects, why, and how to request it be deleted.",
};

/* DRAFT — this page describes what the code actually does as of this
   writing, but it has not been reviewed by a lawyer. Get it reviewed
   before relying on it for real users / real payments, especially the
   retention and third-party sections, and fill in a real contact
   address before publishing. */
export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="max-w-xl text-sm text-muted">
            Draft — pending legal review. Last updated August 23, 2026.
          </p>
        </div>

        <div className="flex flex-col gap-8 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">What we collect</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong className="text-foreground">Votes:</strong> your IP address and a browser fingerprint
                (a value derived from your browser/device characteristics), tied to each vote you cast.
              </li>
              <li>
                <strong className="text-foreground">Leadership claims:</strong> the X (Twitter) handle and post
                you link, the brand name/description/link/logo you provide, the IP address the claim was made
                from, and payment records (amount, status, and a reference to the payment provider — we never
                see or store your card number).
              </li>
              <li>
                <strong className="text-foreground">Admin access:</strong> a signed session cookie for the small
                number of site administrators — not applicable to regular visitors.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Why we collect it</h2>
            <p>
              The IP address and browser fingerprint collected on votes exist for exactly one purpose:{" "}
              <strong className="text-foreground">preventing vote fraud</strong> (the same person voting many
              times for the same country in one day). We don&apos;t use them for anything else — not
              advertising, not profiling, not resale.
            </p>
            <p>
              Leadership claim data (handle, post, content, IP) is collected so we can display your claim,
              verify the linked post still exists and is unedited, and investigate abuse reports.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">How long we keep it</h2>
            <p>
              Being straightforward about the current state: vote and leadership-claim records are{" "}
              <strong className="text-foreground">not automatically deleted</strong>. Past votes and past
              leaders remain visible (see the &quot;All time&quot; ranking and the Champions/past-leaders pages)
              indefinitely, by design. We retain the underlying records for as long as the site operates unless
              you request deletion (see below).
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Third parties involved</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong className="text-foreground">Cloudflare Turnstile</strong> — an invisible bot-detection
                challenge run when you vote, so we can tell humans from bots. See Cloudflare&apos;s own privacy
                policy for what it collects.
              </li>
              <li>
                <strong className="text-foreground">Payment provider</strong> — leadership claims currently run
                in a free test mode with no real payment processor connected. Once real payments go live, a
                third-party payment processor will handle your payment details directly; we will never see or
                store full card numbers.
              </li>
              <li>
                <strong className="text-foreground">Analytics</strong> — we use a privacy-focused analytics tool
                to understand traffic and usage in aggregate (see the Cookie Policy for details). It does not
                receive your vote or claim content.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Your rights</h2>
            <p>
              You can request that we delete data tied to your IP address, browser fingerprint, or X handle by
              contacting us at{" "}
              <a href="mailto:contact@worldleaders.lol" className="text-accent hover:underline">
                contact@worldleaders.lol
              </a>
              . Note that removing a past leader&apos;s record may leave a gap in a country&apos;s public
              history.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Children</h2>
            <p>World Leaders is not directed at children under 13, and we do not knowingly collect data from them.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Changes to this policy</h2>
            <p>We may update this page as the site changes. Material changes will update the date above.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
