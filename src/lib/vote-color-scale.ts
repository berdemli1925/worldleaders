// Sequential fill color for the map's vote choropleth: matte, dark red at
// zero votes brightening to a vivid yellow for the current leader — direct
// correction of a previous pass that had the two ends backwards (leader was
// coming out matte red instead of the winner-reads-brightest yellow that
// was actually asked for: "Lider ülke parlak sarı, kötü olanlar mat
// kırmızı"). Plain RGB lerp rather than a d3-scale dependency — it's one
// straight line between two colors.
//
// HIGH (the leader) is bright enough to read clearly against the near-black
// map background (see WorldMapInteractive's map container) and to visually
// announce "this is the winner"; LOW is deliberately desaturated/darkened
// rather than a second vivid color, so a country with few/no votes recedes
// into the map instead of competing with the leader for attention. See
// gelistirme-plani-v2.md AŞAMA 1.5.
const LOW: [number, number, number] = [127, 29, 29]; // matte, dark red — 0 votes
const HIGH: [number, number, number] = [250, 204, 21]; // bright yellow — the leader

// A flat linear gradient between the same two endpoints voteCountToColor
// interpolates between — for the map's color-key legend, not the map
// itself. Deliberately linear rather than reproducing the sqrt curve
// below: the legend's job is just "which end is more votes," and a
// straight gradient reads that at a glance, same as any other map legend.
export function voteColorScaleCss(): string {
  return `linear-gradient(to right, rgb(${LOW.join(", ")}), rgb(${HIGH.join(", ")}))`;
}

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
  const [r, g, b] = LOW.map((from, i) => Math.round(from + (HIGH[i] - from) * t));
  return `rgb(${r}, ${g}, ${b})`;
}
