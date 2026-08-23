// X/Twitter's media CDN (pbs.twimg.com) supports a `?name=` size-variant
// query param (e.g. "240x240", "small", "large", "orig"). Used to request a
// small crop for the map's per-country clipped image tiles instead of
// pulling full-resolution photos across up to 250 countries at once.
export function twitterImageVariant(url: string, name: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("name", name);
    return u.toString();
  } catch {
    return url;
  }
}
