// Shared share-link builders — used by the post-vote result screen
// (VoteResultModal), the leaderboard card's share button, and the country
// page's share button, so the link/text format only lives in one place.

/** Canonical shareable link for a country — ?country=XX drives page.tsx's
 * generateMetadata (title/OG image) so the preview matches the country, not
 * the generic site card. */
export function countryShareUrl(isoCode: string): string {
  return `https://worldleaders.lol/?country=${isoCode}`;
}

// Direct request: everyone's share text should come out in the language
// they voted in, not always English. Detected from the browser rather than
// asked for — see detectShareLocale below. Covers English plus the
// languages of the site's most-engaged countries (see seed-score.ts's
// curated list) — anything else falls back to English rather than a wrong
// guess in a language nobody involved actually reads.
const SHARE_TEMPLATES: Record<string, (name: string, rank: number) => string> = {
  en: (name, rank) => `${name.toUpperCase()} IS #${rank} on World Leaders. Can your country beat us?`,
  tr: (name, rank) => `${name.toUpperCase()} World Leaders'ta #${rank}. Senin ülken bizi geçebilir mi?`,
  el: (name, rank) => `Η ${name.toUpperCase()} ΕΙΝΑΙ #${rank} στο World Leaders. Η χώρα σου μπορεί να μας νικήσει;`,
  ru: (name, rank) => `${name.toUpperCase()} — #${rank} в World Leaders. Сможет ли твоя страна нас обойти?`,
  uk: (name, rank) => `${name.toUpperCase()} — #${rank} у World Leaders. Чи зможе твоя країна нас обійти?`,
  az: (name, rank) => `${name.toUpperCase()} World Leaders-də #${rank}. Sənin ölkən bizi keçə bilərmi?`,
  de: (name, rank) => `${name.toUpperCase()} ist #${rank} auf World Leaders. Kann dein Land uns schlagen?`,
  ar: (name, rank) => `${name} في المرتبة #${rank} على World Leaders. هل يمكن لبلدك أن يتفوق علينا؟`,
  fa: (name, rank) => `${name} در رتبه #${rank} در World Leaders است. آیا کشور تو می‌تواند از ما جلو بزند؟`,
  he: (name, rank) => `${name} במקום #${rank} ב-World Leaders. האם המדינה שלך יכולה להביס אותנו?`,
};

/** Primary language subtag from a BCP-47 tag ("tr-TR" -> "tr"), lowercased. */
function primarySubtag(locale: string): string {
  return locale.split("-")[0].toLowerCase();
}

/** Browser locale, client-only — call this from an event handler (never during render/SSR, where navigator doesn't exist). */
export function detectShareLocale(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.language;
}

export function buildShareText(countryName: string, rank: number, locale?: string): string {
  const lang = locale ? primarySubtag(locale) : "en";
  const template = SHARE_TEMPLATES[lang] ?? SHARE_TEMPLATES.en;
  return template(countryName, rank);
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

export interface ShareBonusResult {
  granted: boolean;
  alreadyClaimed: boolean;
}

// +5 votes, once ever per person, for sharing on X — see
// src/lib/share-bonus.ts for why this is the one bonus that needs a real
// database table, and what happens (a harmless no-op) before that table
// exists. Never throws — a failed/not-yet-enabled bonus should never break
// the share action itself, which has already opened by the time this runs.
export async function claimShareBonus(isoCode: string, fingerprint: string): Promise<ShareBonusResult> {
  try {
    const res = await fetch("/api/share/bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isoCode, fingerprint }),
    });
    const data = await res.json().catch(() => ({}));
    return { granted: Boolean(data?.granted), alreadyClaimed: Boolean(data?.alreadyClaimed) };
  } catch {
    return { granted: false, alreadyClaimed: false };
  }
}
