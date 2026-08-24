import { headers } from "next/headers";

// Vercel's edge network sets this automatically on every request to a
// production/preview deployment — no external geolocation API call needed,
// and no client-side permission prompt. "XX" is Vercel's own placeholder for
// "couldn't determine a country" (e.g. some VPNs/corporate proxies), treated
// the same as absent. Returns undefined on localhost and any non-Vercel
// host, where the hero section falls back to the client-only
// navigator.language guess instead — see Hero.tsx.
export async function getGeoCountryIso(): Promise<string | undefined> {
  const h = await headers();
  const code = h.get("x-vercel-ip-country");
  return code && code !== "XX" ? code.toUpperCase() : undefined;
}
