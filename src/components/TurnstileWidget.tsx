"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Script from "next/script";

export interface TurnstileWidgetHandle {
  /** Runs one invisible challenge and resolves with a fresh, single-use token. */
  getToken: () => Promise<string>;
}

interface TurnstileWidgetProps {
  siteKey: string;
}

interface TurnstileRenderOptions {
  sitekey: string;
  execution: "execute";
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      execute: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

// Invisible Cloudflare Turnstile widget. Rendered once and kept off to the
// side; callers trigger a fresh check on demand via getToken() (execution
// mode "execute" — the challenge only runs when we explicitly ask for it,
// right before a vote is submitted, rather than automatically on page load).
const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(function TurnstileWidget(
  { siteKey },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingRef = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady || !containerRef.current || widgetIdRef.current) return;
    const turnstile = window.turnstile;
    if (!turnstile) return;

    widgetIdRef.current = turnstile.render(containerRef.current, {
      sitekey: siteKey,
      // No `size` here — "invisible" isn't a valid size value. Whether the
      // widget renders invisibly is determined by the widget's mode, chosen
      // for this site key in the Cloudflare dashboard.
      execution: "execute",
      callback: (token) => {
        pendingRef.current?.resolve(token);
        pendingRef.current = null;
      },
      "error-callback": () => {
        pendingRef.current?.reject(new Error("Verification failed. Please try again."));
        pendingRef.current = null;
      },
      "expired-callback": () => {
        pendingRef.current?.reject(new Error("Verification expired. Please try again."));
        pendingRef.current = null;
      },
    });
  }, [scriptReady, siteKey]);

  useImperativeHandle(
    ref,
    () => ({
      getToken: () =>
        new Promise<string>((resolve, reject) => {
          const turnstile = window.turnstile;
          const widgetId = widgetIdRef.current;
          if (!turnstile || !widgetId) {
            reject(new Error("Verification isn't ready yet — please try again in a moment."));
            return;
          }
          pendingRef.current = { resolve, reject };
          // Each vote needs its own single-use token, so reset before every
          // execute — otherwise a repeated execute() on an already-solved
          // widget doesn't run a new challenge.
          turnstile.reset(widgetId);
          turnstile.execute(widgetId);
        }),
    }),
    [],
  );

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        onLoad={() => setScriptReady(true)}
      />
      <div ref={containerRef} />
    </>
  );
});

export default TurnstileWidget;
