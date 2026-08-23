// Sequential fill color for the map's vote choropleth: a vivid blue at zero
// votes (still clearly a *color*, not just dark gray blending into the
// background) up to full accent gold for the current leader. Plain RGB lerp
// rather than a d3-scale dependency — it's one straight line between two
// colors.
const LIGHT: [number, number, number] = [59, 95, 165]; // vivid blue
const DARK: [number, number, number] = [245, 179, 1]; // matches --accent

export function voteCountToColor(count: number, maxCount: number): string {
  const t = maxCount > 0 ? Math.min(1, Math.max(0, count / maxCount)) : 0;
  const [r, g, b] = LIGHT.map((from, i) => Math.round(from + (DARK[i] - from) * t));
  return `rgb(${r}, ${g}, ${b})`;
}
