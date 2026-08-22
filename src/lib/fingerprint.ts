// Client-only browser fingerprint, used together with IP address to define
// "one voter" for the daily vote limit (see /api/votes). This is the
// open-source FingerprintJS build — everything runs locally in the browser,
// no account, no API key, no network call to a third-party service.
let cached: Promise<string> | null = null;

export function getFingerprint(): Promise<string> {
  if (typeof window === "undefined") {
    return Promise.resolve("server");
  }
  if (!cached) {
    cached = import("@fingerprintjs/fingerprintjs")
      .then((FingerprintJS) => FingerprintJS.load())
      .then((agent) => agent.get())
      .then((result) => result.visitorId)
      .catch(() => {
        // If fingerprinting fails for any reason (blocked script, older
        // browser, …), fall back to a random per-tab id rather than
        // breaking voting entirely. This only weakens the fingerprint half
        // of the check — the IP-based limit still applies.
        return `fallback-${Math.random().toString(36).slice(2)}`;
      });
  }
  return cached;
}
