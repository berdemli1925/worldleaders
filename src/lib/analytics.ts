"use client";

import posthog from "posthog-js";

// Entirely no-op without NEXT_PUBLIC_POSTHOG_KEY — local dev (and any
// deployment that hasn't set up a PostHog project yet) never breaks or
// makes network calls because of this file. See AnalyticsInit.tsx for the
// one place init() is called (mounted once from the root layout), and
// proje-spesifikasyonu.md end-of-task report for the account setup step.
let initialized = false;

export function initAnalytics(): void {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    // We fire our own $pageview manually (see AnalyticsInit) so it fires on
    // every client-side route change too, not just the first hard load.
    capture_pageview: false,
    person_profiles: "identified_only",
  });
  initialized = true;
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.capture(event, properties);
}
