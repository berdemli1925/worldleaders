import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy — World Leaders",
  description: "The cookies and similar storage World Leaders uses.",
};

/* DRAFT — this page has not been reviewed by a lawyer. Keep it in sync
   with what's actually set: today that's admin_session (essential) plus,
   when NEXT_PUBLIC_POSTHOG_KEY is configured, PostHog's analytics
   cookie/localStorage. */
export default function CookiesPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-background px-4 py-8 sm:py-12">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Cookie Policy</h1>
          <p className="max-w-xl text-sm text-muted">
            Draft — pending legal review. Last updated August 23, 2026.
          </p>
        </div>

        <div className="flex flex-col gap-8 rounded-md border border-border bg-surface p-6 text-sm text-muted">
          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Essential</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <code className="rounded bg-black/30 px-1 py-0.5 text-xs text-foreground">admin_session</code> —
                a signed session cookie used only for the admin panel. Regular visitors never receive this
                cookie.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Bot protection</h2>
            <p>
              Cloudflare Turnstile, which runs invisibly when you vote to distinguish humans from bots, may set
              its own cookies or use device signals as part of that check. See Cloudflare&apos;s documentation
              for details.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Analytics</h2>
            <p>
              When enabled, we use PostHog to understand aggregate traffic and usage (visits, votes cast,
              leadership claims). PostHog may use cookies or local browser storage to distinguish visitors
              across a session. It does not receive the content of your votes or leadership claims.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Managing cookies</h2>
            <p>
              You can block or delete cookies through your browser&apos;s settings. Blocking the essential
              cookie only affects the admin panel, which regular visitors don&apos;t use.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">Changes</h2>
            <p>We&apos;ll update this page if what we set changes.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
