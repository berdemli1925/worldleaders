// Sequential fill color for the map's vote choropleth: a vivid blue at zero
// votes (still clearly a *color*, not just dark gray blending into the
// background) up to full accent gold for the current leader. Plain RGB lerp
// rather than a d3-scale dependency — it's one straight line between two
// colors.
//
// Brighter than the original LIGHT — needs to read clearly against the
// much darker map background introduced alongside this (see
// WorldMapInteractive's map container) so land stays obviously land, not a
// shade away from the sea. See gelistirme-plani-v2.md AŞAMA 1.5.
const LIGHT: [number, number, number] = [88, 133, 214]; // bright vivid blue
const DARK: [number, number, number] = [245, 179, 1]; // matches --accent

export function voteCountToColor(count: number, maxCount: number): string {
  const raw = maxCount > 0 ? Math.min(1, Math.max(0, count / maxCount)) : 0;
  // sqrt rather than linear: with vote totals concentrated in a handful of
  // countries, a linear 0..max scale crowds almost every country into the
  // bottom sliver of the range and the map reads as "one gold country,
  // everything else identically navy." sqrt spreads the low/mid range out so
  // real differences between low-vote countries stay visible, while the
  // top of the scale (the actual leader) is unaffected — sqrt(1) = 1.
  // The 0.08 floor on top of that keeps a country with even a single vote
  // visibly distinct from one with zero, which a bare sqrt (sqrt of a tiny
  // fraction is still tiny) wouldn't guarantee at high vote totals.
  const t = raw > 0 ? Math.max(Math.sqrt(raw), 0.08) : 0;
  const [r, g, b] = LIGHT.map((from, i) => Math.round(from + (DARK[i] - from) * t));
  return `rgb(${r}, ${g}, ${b})`;
}
