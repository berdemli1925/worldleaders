import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — World Leaders",
  description: "The rules for voting, claiming leadership, and using World Leaders.",
};

/* DRAFT — this page has not been reviewed by a lawyer. In particular the
   liability-limitation and governing-law language below is generic
   boilerplate, not jurisdiction-specific advice — get it reviewed
   (and pick a real governing law/jurisdiction) before relying on it for
   real users / real payments. */
export default function TermsPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Terms of Service</h1>
          <p className="max-w-xl text-sm text-muted">
            Draft — pending legal review. Last updated August 23, 2026.
          </p>
        </div>

        <div className="flex flex-col gap-8 rounded-md border border-border bg-surface p-6 text-sm text-muted">
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">1. Acceptance</h2>
            <p>
              By using World Leaders (the &quot;Service&quot;), you agree to these Terms. If you don&apos;t
              agree, don&apos;t use the Service.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">2. Voting</h2>
            <p>
              Voting is free and requires no account. Automated, scripted, or otherwise manipulated voting is
              prohibited and may be blocked or reversed.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">3. Leadership claims</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                Claiming a country&apos;s &quot;throne&quot; requires linking a public X post and, optionally,
                a brand name, description, link, and logo. This content is displayed publicly on top of that
                country for the duration of your reign.
              </li>
              <li>
                A throne lasts <strong className="text-foreground">one week</strong> from when it&apos;s first
                claimed. Being outbid during that week does not extend or reset the cycle.
              </li>
              <li>
                Taking an occupied throne requires paying at least $2 more than its current value — there is no
                cap on how much more you may offer. Amounts you&apos;ve previously paid for a country stand as
                credit toward reclaiming it, and are specific to that country and that throne cycle.
              </li>
              <li>
                Content is checked against automated filters and periodically re-checked against the live post.
                We may reject or remove content — including content that has already been paid for — that: is
                marked sensitive by X, is deleted or edited after being claimed, contains language our filters
                or moderators find abusive, illegal, or otherwise unacceptable, or is the subject of a
                credible abuse report.
              </li>
              <li>Your X handle remains visible in a country&apos;s past-leaders history permanently, even after your reign ends.</li>
              <li>
                We make no guarantee that claimed content is published instantly or without moderation review —
                we do not promise &quot;instant, unmoderated&quot; posting of any kind.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">4. Payments and refunds</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                Leadership claims are currently processed in a free test mode — no real payment is taken today.
                Once real payments are enabled, all sales are final.
              </li>
              <li>
                <strong className="text-foreground">There are no refunds.</strong> If you&apos;re outbid before
                your week is up, you do not get your money back — it stands as credit toward reclaiming that
                country instead.
              </li>
              <li>Content removed for violating these Terms is not refunded, in whole or in part.</li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">5. Your content</h2>
            <p>
              You retain rights to the content you link or provide (your X post, brand name, description, logo,
              link). By submitting a leadership claim, you grant us a license to display that content on the
              Service for as long as it remains live, and to retain a record of it (including in past-leaders
              history) after your reign ends. You confirm you have the right to post and link this content.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">6. The country list</h2>
            <p>
              The list of countries on the Service follows the ISO 3166-1 standard, and continent/region
              groupings follow the UN geoscheme. This is a technical convention we use for consistency, not a
              political statement about sovereignty, territorial disputes, or recognition of any government or
              boundary.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">7. Disclaimers</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind. We don&apos;t guarantee
              uninterrupted availability, that linked X content will remain accessible (X&apos;s infrastructure
              is outside our control), or that the Service is error-free.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">8. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, World Leaders and its operator are not liable for
              indirect, incidental, or consequential damages arising from your use of the Service. Our total
              liability for any claim relating to the Service is limited to the amount you paid us in the 12
              months before the claim arose.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">9. Changes</h2>
            <p>
              We may update these Terms or remove/suspend the Service at any time. Continued use after a change
              means you accept the updated Terms.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">10. Contact</h2>
            <p>
              Questions about these Terms:{" "}
              <a href="mailto:contact@worldleaders.lol" className="text-accent hover:underline">
                contact@worldleaders.lol
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
