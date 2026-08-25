// Shared types/helpers for the Hype feature — one global spotlight above
// the map, paid for by a country's current throne holder, showing whatever
// their claim already has (brand/description/logo/post) regardless of vote
// rank. See scripts/setup-hype.mjs for the DB side this mirrors.

export const HYPE_BASE_PRICE = 1;
/** How much more than the current hype's value a *different* country must offer to take the spotlight over. */
export const HYPE_OUTBID_INCREMENT = 1;
/** How long a successful hype (new or self-extended) holds the spotlight. */
export const HYPE_DURATION_HOURS = 3;

export interface HypeEntry {
  isoCode: string;
  currentValue: number | null;
  cycleStart: number | null;
  cycleEnd: number | null;
  handle: string | null;
  brandTitle: string | null;
  description: string | null;
  logoUrl: string | null;
  linkUrl: string | null;
  postText: string | null;
  postImageUrl: string | null;
  postImageWidth: number | null;
  postImageHeight: number | null;
  postImageScale: number | null;
  postImageOffsetX: number | null;
  postImageOffsetY: number | null;
  leaderXUrl: string | null;
  leaderInstagramUrl: string | null;
  leaderTiktokUrl: string | null;
  leaderFacebookUrl: string | null;
}

// Raw row shape from hype_slot_public (see scripts/setup-hype.mjs) — the
// view itself already only returns a row when the hype is live (not
// expired, not kill-switched), so a present row always means "currently
// active," never a stale/expired one the client has to double-check.
export interface HypeRow {
  country_iso_code: string;
  current_value: number | null;
  cycle_start: string | null;
  cycle_end: string | null;
  x_handle: string | null;
  brand_title: string | null;
  description: string | null;
  logo_url: string | null;
  link_url: string | null;
  post_text: string | null;
  post_image_url: string | null;
  post_image_width: number | null;
  post_image_height: number | null;
  post_image_scale: number | null;
  post_image_offset_x: number | null;
  post_image_offset_y: number | null;
  leader_x_url: string | null;
  leader_instagram_url: string | null;
  leader_tiktok_url: string | null;
  leader_facebook_url: string | null;
}

export function mapHypeRow(row: HypeRow): HypeEntry {
  return {
    isoCode: row.country_iso_code,
    currentValue: row.current_value,
    cycleStart: row.cycle_start ? new Date(row.cycle_start).getTime() : null,
    cycleEnd: row.cycle_end ? new Date(row.cycle_end).getTime() : null,
    handle: row.x_handle,
    brandTitle: row.brand_title,
    description: row.description,
    logoUrl: row.logo_url,
    linkUrl: row.link_url,
    postText: row.post_text,
    postImageUrl: row.post_image_url,
    postImageWidth: row.post_image_width,
    postImageHeight: row.post_image_height,
    postImageScale: row.post_image_scale,
    postImageOffsetX: row.post_image_offset_x,
    postImageOffsetY: row.post_image_offset_y,
    leaderXUrl: row.leader_x_url,
    leaderInstagramUrl: row.leader_instagram_url,
    leaderTiktokUrl: row.leader_tiktok_url,
    leaderFacebookUrl: row.leader_facebook_url,
  };
}

// hype_slot_public already excludes expired/hidden rows server-side, so in
// practice a non-null `hype` is always active — this re-checks cycleEnd
// against the shared clock anyway so a client holding onto a slightly
// stale fetch (between the moment it expired and the next refetch) doesn't
// keep showing it as live for those few seconds.
export function isHypeActive(hype: HypeEntry | null, now: number | null): boolean {
  return Boolean(hype && hype.cycleEnd !== null && now !== null && hype.cycleEnd > now);
}

// What a new hype purchase for `isoCode` must offer at minimum: base price
// if the spotlight is free or expired, the same flat base price again if
// this country already holds it (self-extend, not a bidding war against
// yourself), or current + the outbid increment to take it from a different
// country. Mirrors src/lib/throne.ts's requiredMinimum, just with the
// three-way branch this feature's self-extend case adds.
export function requiredHypeMinimum(hype: HypeEntry | null, isoCode: string, now: number | null): number {
  if (!isHypeActive(hype, now)) return HYPE_BASE_PRICE;
  if (hype!.isoCode === isoCode) return HYPE_BASE_PRICE;
  return (hype!.currentValue ?? 0) + HYPE_OUTBID_INCREMENT;
}
