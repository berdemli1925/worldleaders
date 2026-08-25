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

export interface MatchupSide {
  isoCode: string;
  name: string;
  voteCount: number;
}

/** Unicode regional-indicator flag emoji from an ISO 3166-1 alpha-2 code — the
 * only way to put a flag inside plain share text (X/WhatsApp/Telegram intents
 * can't embed the site's flagcdn images). */
export function isoToFlagEmoji(alpha2: string): string {
  const code = alpha2.toUpperCase();
  if (code.length !== 2) return "";
  const REGIONAL_INDICATOR_A = 0x1f1e6;
  return [...code]
    .map((char) => String.fromCodePoint(REGIONAL_INDICATOR_A + char.charCodeAt(0) - 65))
    .join("");
}

function formatSide(side: MatchupSide): string {
  return `${isoToFlagEmoji(side.isoCode)} ${side.name} ${side.voteCount.toLocaleString("en-US")}`;
}

type MatchupTemplate = (first: MatchupSide, second: MatchupSide, gap: number) => string;

// Direct request: a "matchup" share format — the country against its
// closest rival (src/lib/rank.ts's findClosestRival), not shown alone.
// Several templates per language so the same two countries don't always
// produce the identical sentence. `first` is always the side with more
// votes (matches the card image and ClosestBattles' own convention).
//
// Full variety only for en/tr — the site's default and primary-audience
// languages; every other locale gets 2 shorter templates rather than a
// rushed, lower-confidence translation of the richer English set. Falls
// back to English for any locale not listed here.
const MATCHUP_TEMPLATES: Record<string, MatchupTemplate[]> = {
  en: [
    (a, b, gap) => `${formatSide(a)} — ${formatSide(b)}. Only ${gap.toLocaleString("en-US")} points apart. Pick a side.`,
    (a, b, gap) =>
      `${isoToFlagEmoji(a.isoCode)} ${a.name} vs ${isoToFlagEmoji(b.isoCode)} ${b.name}: ${gap.toLocaleString("en-US")} votes between them. Who do you back?`,
    (a, b, gap) =>
      `${gap.toLocaleString("en-US")} votes. That's all that separates ${a.name} from ${b.name} on World Leaders right now.`,
  ],
  tr: [
    (a, b, gap) => `${formatSide(a)} — ${formatSide(b)}. Aralarında sadece ${gap.toLocaleString("en-US")} oy var. Taraf seç.`,
    (a, b, gap) =>
      `${isoToFlagEmoji(a.isoCode)} ${a.name} - ${isoToFlagEmoji(b.isoCode)} ${b.name} kapışıyor: fark sadece ${gap.toLocaleString("en-US")} oy.`,
  ],
  el: [
    (a, b, gap) => `${formatSide(a)} — ${formatSide(b)}. Μόλις ${gap.toLocaleString("en-US")} ψήφους διαφορά. Διάλεξε πλευρά.`,
    (a, b, gap) =>
      `${isoToFlagEmoji(a.isoCode)} ${a.name} εναντίον ${isoToFlagEmoji(b.isoCode)} ${b.name}: ${gap.toLocaleString("en-US")} ψήφοι τους χωρίζουν.`,
  ],
  ru: [
    (a, b, gap) => `${formatSide(a)} — ${formatSide(b)}. Разница всего ${gap.toLocaleString("en-US")} голосов. Выбирай сторону.`,
    (a, b, gap) =>
      `${isoToFlagEmoji(a.isoCode)} ${a.name} против ${isoToFlagEmoji(b.isoCode)} ${b.name}: между ними ${gap.toLocaleString("en-US")} голосов.`,
  ],
  uk: [
    (a, b, gap) => `${formatSide(a)} — ${formatSide(b)}. Різниця лише ${gap.toLocaleString("en-US")} голосів. Обирай сторону.`,
    (a, b, gap) =>
      `${isoToFlagEmoji(a.isoCode)} ${a.name} проти ${isoToFlagEmoji(b.isoCode)} ${b.name}: між ними ${gap.toLocaleString("en-US")} голосів.`,
  ],
  az: [
    (a, b, gap) => `${formatSide(a)} — ${formatSide(b)}. Aralarında cəmi ${gap.toLocaleString("en-US")} səs var. Tərəf seç.`,
    (a, b, gap) => `${isoToFlagEmoji(a.isoCode)} ${a.name} - ${isoToFlagEmoji(b.isoCode)} ${b.name}: fərq ${gap.toLocaleString("en-US")} səs.`,
  ],
  de: [
    (a, b, gap) => `${formatSide(a)} — ${formatSide(b)}. Nur ${gap.toLocaleString("en-US")} Stimmen Unterschied. Wähl eine Seite.`,
    (a, b, gap) =>
      `${isoToFlagEmoji(a.isoCode)} ${a.name} gegen ${isoToFlagEmoji(b.isoCode)} ${b.name}: ${gap.toLocaleString("en-US")} Stimmen trennen sie.`,
  ],
  ar: [
    (a, b, gap) => `${formatSide(a)} — ${formatSide(b)}. الفرق بينهما ${gap.toLocaleString("en-US")} صوت فقط. اختر طرفًا.`,
    (a, b, gap) =>
      `${isoToFlagEmoji(a.isoCode)} ${a.name} ضد ${isoToFlagEmoji(b.isoCode)} ${b.name}: يفصل بينهما ${gap.toLocaleString("en-US")} صوت.`,
  ],
  fa: [
    (a, b, gap) => `${formatSide(a)} — ${formatSide(b)}. فقط ${gap.toLocaleString("en-US")} رأی فاصله دارند. طرف خود را انتخاب کن.`,
    (a, b, gap) =>
      `${isoToFlagEmoji(a.isoCode)} ${a.name} در برابر ${isoToFlagEmoji(b.isoCode)} ${b.name}: ${gap.toLocaleString("en-US")} رأی فاصله.`,
  ],
  he: [
    (a, b, gap) => `${formatSide(a)} — ${formatSide(b)}. רק ${gap.toLocaleString("en-US")} קולות ביניהם. בחר צד.`,
    (a, b, gap) =>
      `${isoToFlagEmoji(a.isoCode)} ${a.name} מול ${isoToFlagEmoji(b.isoCode)} ${b.name}: ${gap.toLocaleString("en-US")} קולות מפרידים ביניהם.`,
  ],
};

export function buildMatchupShareText(self: MatchupSide, rival: MatchupSide, locale?: string): string {
  const [first, second] = self.voteCount >= rival.voteCount ? [self, rival] : [rival, self];
  const gap = first.voteCount - second.voteCount;
  const lang = locale ? primarySubtag(locale) : "en";
  const templates = MATCHUP_TEMPLATES[lang] ?? MATCHUP_TEMPLATES.en;
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template(first, second, gap);
}

/** The one function share buttons should actually call: matchup format
 * when there's a real rival close enough to name (see findClosestRival),
 * single-country format otherwise. */
export function buildShareTextFor(self: MatchupSide, rank: number, rival: MatchupSide | null, locale?: string): string {
  return rival ? buildMatchupShareText(self, rival, locale) : buildShareText(self.name, rank, locale);
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
