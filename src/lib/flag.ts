// flagcdn.com serves flat PNG/WEBP flag images by ISO 3166-1 alpha-2 code.
// We use it instead of flag emoji: Windows has no color emoji font for
// Regional Indicator Symbol pairs, so flag emoji render as two letters there.
const AVAILABLE_WIDTHS = [20, 40, 80, 160, 320, 640, 1280] as const;
type FlagWidth = (typeof AVAILABLE_WIDTHS)[number];

// Picks the smallest CDN asset that's still at least `minWidth` px, so we
// never ship a 1280px flag for a 24px thumbnail.
function widthBucket(minWidth: number): FlagWidth {
  return AVAILABLE_WIDTHS.find((w) => w >= minWidth) ?? AVAILABLE_WIDTHS[AVAILABLE_WIDTHS.length - 1];
}

export function flagUrl(alpha2: string, displayWidth: number): string {
  const code = alpha2.toLowerCase();
  return `https://flagcdn.com/w${widthBucket(displayWidth)}/${code}.png`;
}

export function flagSrcSet(alpha2: string, displayWidth: number): string {
  const code = alpha2.toLowerCase();
  return `https://flagcdn.com/w${widthBucket(displayWidth)}/${code}.png 1x, https://flagcdn.com/w${widthBucket(displayWidth * 2)}/${code}.png 2x`;
}
