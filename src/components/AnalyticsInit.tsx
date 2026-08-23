"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { initAnalytics, track } from "@/lib/analytics";

// Mounted once from the root layout. Renders nothing — purely a hook for
// two effects: initialize PostHog once, then fire a $pageview on every
// route change (including client-side next/link navigation, which a plain
// capture_pageview:true wouldn't catch beyond the very first hard load).
export default function AnalyticsInit() {
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    track("$pageview", { $current_url: window.location.href });
  }, [pathname]);

  return null;
}
