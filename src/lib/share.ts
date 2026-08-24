// Shared share-link builders — used by the post-vote result screen
// (VoteResultModal) and the leaderboard row's share button (Leaderboard.tsx)
// so the link/text format only lives in one place.

/** Canonical shareable link for a country — ?country=XX drives page.tsx's
 * generateMetadata (title/OG image) so the preview matches the country, not
 * the generic site card. */
export function countryShareUrl(isoCode: string): string {
  return `https://worldleaders.lol/?country=${isoCode}`;
}

export function buildShareText(countryName: string, rank: number): string {
  return `${countryName.toUpperCase()} IS #${rank} on World Leaders. Can your country beat us?`;
}

export function xIntentUrl(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function whatsappShareUrl(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}

export function telegramShareUrl(text: string, url: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

// Opens an external share-intent window — no popup blocked as long as this
// only ever runs from a direct click (true for every caller).
export function openShareWindow(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
