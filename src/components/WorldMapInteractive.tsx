"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { buildCountryByAlpha2 } from "@/lib/country-path";
import { CTA_CLASSES } from "@/lib/cta-style";
import { flagUrl } from "@/lib/flag";
import { optimizedImageUrl } from "@/lib/image-proxy";
import { leaderAvatarSourceUrl } from "@/lib/social-links";
import { voteColorScaleCss, voteCountToColor } from "@/lib/vote-color-scale";
import type { HypeEntry } from "@/lib/hype";
import type { ThroneClaimHistoryEntry, ThroneEntry } from "@/lib/throne";
import type { MyVoteStatus } from "@/lib/use-vote";
import ThroneClaimModal from "./ThroneClaimModal";
import ThronePanel from "./ThronePanel";

export interface CountryPath {
  id: string;
  name: string;
  d: string;
  alpha2?: string;
  alpha3?: string;
  /** [x0, y0, x1, y1] in the same coordinate space as `d` — see WorldMap.tsx. */
  bounds: [number, number, number, number];
  centroid: [number, number];
}

interface WorldMapInteractiveProps {
  countries: CountryPath[];
  width: number;
  height: number;
  /** Vote counts (starting baseline + real votes + bonuses — see src/lib/rank.ts) keyed by ISO alpha-2 code — drives both the map's fill color and its tooltip/aria-label. */
  voteCounts: Map<string, number>;
  /** Highest count across all countries — the top of the color scale. */
  maxVotes: number;
  /** This month's rank (1-based) keyed by ISO alpha-2 code — shown in the hover tooltip. */
  rankByIso: Map<string, number>;
  /** ISO code of the #1-ranked country — AŞAMA 6: pulses on the map so the current leader is unmistakable. */
  leaderIso?: string;
  /** Global "have I voted today, and for which country" — shared with the leaderboard. */
  voteStatus: MyVoteStatus | null;
  /** ISO code of the vote currently being submitted, if any. */
  submittingIso: string | null;
  voteError: string | null;
  onVote: (isoCode: string) => void;
  /** Live throne state per country, and full claim history — same data the leaderboard uses. */
  thrones: ThroneEntry[];
  claimHistory: ThroneClaimHistoryEntry[];
  /** Shared "now" clock, for the reign countdown — same one the top bar/leaderboard use. */
  now: number | null;
  onThroneClaimed: () => void;
  /** Current global hype state and its refetch — threaded through to ThronePanel's Hype button. See src/lib/hype.ts. */
  hype: HypeEntry | null;
  onHyped: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface ViewState {
  scale: number;
  x: number;
  y: number;
}

interface DragState {
  mode: "pan" | "pinch";
  last: Point;
  lastDist?: number;
  movedTotal: number;
  hadMultiTouch: boolean;
}

interface HoverState {
  id: string;
  x: number;
  y: number;
}

export interface WorldMapHandle {
  /** Pans/zooms to fit the given ISO alpha-2 country and opens its side panel — used by the leaderboard search box and row clicks (see Dashboard.tsx). No-op if the code isn't on the map (see WorldMap.tsx's 50m comment — a handful of very small territories still have no geometry). */
  focusCountry: (isoCode: string) => void;
}

const MIN_SCALE = 1;
// High enough that a small-but-real country (Malta, Andorra, Luxembourg, …)
// fills a good part of the viewport when focusCountry below zooms to fit
// it — border rendering stays exactly as crisp here as at MIN_SCALE, since
// borders are plain SVG paths with vectorEffect="non-scaling-stroke", not a
// raster layer. A literal handful of micro-states (Vatican City, Monaco)
// are a fraction of a viewBox unit wide even at 50m resolution (see
// WorldMap.tsx) and will still render small at this cap — no zoom range is
// going to make a ~1px-wide country fill the screen without also zooming
// into its neighbors, so this is picked to serve the common case well
// rather than chase that unreachable one.
const MAX_SCALE = 250;
const WHEEL_ZOOM_FACTOR = 1.2;
const BUTTON_ZOOM_FACTOR = 1.4;
// Duration of the programmatic pan/zoom transition triggered by
// focusCountry (search box / leaderboard row / ticker selection) — never
// applied to live wheel/drag/pinch input, which stays 1:1 with the pointer.
const FOCUS_TRANSITION_MS = 450;
// Below this much cumulative pointer movement (in CSS pixels), a press+release
// is treated as a click/tap on a country rather than a pan gesture.
const CLICK_THRESHOLD = 6;
// Leader marker radius, in on-screen pixels — grows with zoom (direct
// request: "işaretin boyutu zoom seviyesine göre makul ölçüde ayarlansın,
// küçük ülkelerde bile görünür kalsın ama haritayı boğmasın") instead of
// staying a fixed dot regardless of zoom level. Small at the fully-zoomed-
// out world view so ~100 markers at once don't drown the map, growing
// toward MARKER_MAX_PX as a country fills more of the screen so it's still
// a clear, detailed circle even on a tiny zoomed-in territory — then
// plateaus rather than growing without bound. See markerScreenRadius below.
// Direct correction: the original 7-24px range read as "way too small,
// especially once zoomed in" — a normal-sized country's own on-screen size
// grows a lot faster than a marker capped at 24px ever could, so the
// marker looked like it was shrinking relative to everything around it
// even though it was never actually shrinking in absolute pixels. Both
// ends bumped up substantially, and MARKER_REFERENCE_SCALE raised so the
// marker keeps growing across a wider chunk of the zoom range instead of
// hitting its cap almost immediately (28 was well within what
// focusCountry's fitScale already reaches for an ordinary-sized country).
const MARKER_MIN_PX = 12;
const MARKER_MAX_PX = 46;
// Reference zoom level (roughly "a normal-sized country filling most of
// the screen," see focusCountry) at which the marker reaches MARKER_MAX_PX
// — picked empirically, not derived from anything. sqrt rather than linear
// so most of the growth happens early (low/medium zoom), where it's most
// useful, rather than being spread thin across the huge 1..250 scale range
// that mostly exists to serve micro-states (see MAX_SCALE above).
const MARKER_REFERENCE_SCALE = 90;

function markerScreenRadius(scale: number): number {
  const t = Math.min(1, Math.sqrt(scale / MARKER_REFERENCE_SCALE));
  return MARKER_MIN_PX + (MARKER_MAX_PX - MARKER_MIN_PX) * t;
}

// Fixed source width requested from the image optimizer (src/lib/image-proxy.ts)
// for every marker regardless of its current on-screen size — comfortably
// crisp even at MARKER_MAX_PX on a retina display, and fixed so zooming
// in/out doesn't re-request a different size from the optimizer on every
// frame.
const MARKER_IMAGE_FETCH_PX = 96;
// Unrelated to the leader markers above — radius of the #1-by-votes pulse
// circle further down (AŞAMA 6), which stays a fixed on-screen size
// regardless of zoom, same as the leader markers used to before zoom-based
// sizing was added.
const LEADER_PULSE_RADIUS_PX = 9;

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function clampTranslate(t: Point, scale: number, width: number, height: number): Point {
  // All content lives in [0,width] x [0,height] (that's what fitSize in
  // WorldMap.tsx guarantees) — centering a point p at scale s means
  // t = width/2 - p*s, so p ranging over [0,width] needs t in
  // [width/2 - width*s, width/2]. Below is exactly that range, symmetric at
  // scale 1 with the old ±(width*scale)/2 bound (so unzoomed panning is
  // unchanged) but — unlike that old symmetric bound — still wide enough at
  // high scale to center content on the far/positive side of the viewBox,
  // which is what focusCountry needs for any country whose centroid sits
  // right of center (>width/2) or below center (>height/2). A purely
  // symmetric bound clips exactly that half of the map once scale is large
  // enough for the asymmetry to matter.
  return {
    x: Math.min(width / 2, Math.max(width / 2 - width * scale, t.x)),
    y: Math.min(height / 2, Math.max(height / 2 - height * scale, t.y)),
  };
}

const WorldMapInteractive = forwardRef<WorldMapHandle, WorldMapInteractiveProps>(function WorldMapInteractive(
  {
    countries,
    width,
    height,
    voteCounts,
    maxVotes,
    rankByIso,
    leaderIso,
    voteStatus,
    submittingIso,
    voteError,
    onVote,
    thrones,
    claimHistory,
    now,
    onThroneClaimed,
    hype,
    onHyped,
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef<Map<number, Point>>(new Map());
  const dragRef = useRef<DragState | null>(null);

  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  // ISO codes whose proxied avatar/logo image (see leaderMarkers below)
  // failed to load — falls back to the flag+crown marker for that country
  // from then on, per "görsel yüklenemezse taç ikonuna düş."
  const [failedAvatarIsos, setFailedAvatarIsos] = useState<Set<string>>(new Set());
  // True only while a programmatic focusCountry jump is animating — see
  // FOCUS_TRANSITION_MS. Cleared the instant a real gesture starts so a
  // drag/pinch/wheel right after a jump never fights a CSS transition.
  const [jumping, setJumping] = useState(false);

  const countryById = useMemo(() => new Map(countries.map((country) => [country.id, country])), [countries]);
  // Used by focusCountry below — see src/lib/country-path.ts for why this
  // needs a tie-break, not just a plain by-alpha2 map.
  const countryByAlpha2 = useMemo(() => buildCountryByAlpha2(countries), [countries]);
  // AŞAMA 6: the #1 country gets a pulsing marker on top of its gold fill —
  // "Lider olan ülke haritada belirgin şekilde vurgulansın." Undefined (and
  // so no marker) until the leaderboard has loaded, or if the leader is one
  // of the handful of territories with no geometry at 50m (see WorldMap.tsx).
  const leaderCountry = leaderIso ? countryByAlpha2.get(leaderIso) : undefined;
  const throneByIso = useMemo(() => new Map(thrones.map((throne) => [throne.isoCode, throne])), [thrones]);

  // One small round marker per leadered country, at the current pan/zoom —
  // never a full post image filling the country shape (direct request:
  // "harita yeniden temiz görünsün ve ülkeler oy oranına göre renklensin",
  // the marker is the only leadership signal now). Skips countries panned
  // off-screen, which doubles as the lazy-load mechanism: no <image> node
  // is created, so the browser never fetches an avatar/logo/flag until it
  // actually needs to be shown.
  //
  // avatarUrl priority: the photo of whichever platform the leader
  // actually declared as their identity (leaderAvatarSourceUrl — same
  // priority order used everywhere else a claim's identity matters, see
  // src/lib/social-links.ts), then their linked website's logo, then null
  // — which renders as a plain flag+crown marker (see the JSX below)
  // rather than attempting a fetch. None of these photos are scraped/
  // stored by us; they're fetched live from their source, proxied through
  // src/lib/image-proxy.ts. Real capability varies by platform — X (via
  // the required linked post) and Facebook (a no-auth Graph API field)
  // both resolve to a real photo; Instagram and TikTok have no free,
  // stable, unauthenticated photo source today and always fall through —
  // see leaderAvatarSourceUrl's own comment for why.
  //
  // Kill-switch awareness needs no extra check here — thrones_with_leader
  // already nulls every leader field site-wide when hidden, so throneByIso
  // simply has nothing to show for any country in that case (direct
  // request: "acil durum düğmesi aktifken haritadaki profil fotoğrafları
  // da gizlensin" — inherited for free from that existing mechanism).
  const leaderMarkers = useMemo(() => {
    const markers: { country: CountryPath; throne: ThroneEntry; avatarUrl: string | null }[] = [];

    for (const country of countries) {
      const throne = country.alpha2 ? throneByIso.get(country.alpha2) : undefined;
      if (!throne || throne.currentValue === null) continue;

      const [x0, y0, x1, y1] = country.bounds;
      const screenX0 = x0 * view.scale + view.x;
      const screenY0 = y0 * view.scale + view.y;
      const screenX1 = x1 * view.scale + view.x;
      const screenY1 = y1 * view.scale + view.y;
      const onScreen = screenX1 >= 0 && screenX0 <= width && screenY1 >= 0 && screenY0 <= height;
      if (!onScreen) continue;

      const rawAvatarUrl =
        leaderAvatarSourceUrl({
          x: throne.leaderXUrl,
          instagram: throne.leaderInstagramUrl,
          tiktok: throne.leaderTiktokUrl,
          facebook: throne.leaderFacebookUrl,
          postAuthorAvatarUrl: throne.postAuthorAvatarUrl,
        }) ||
        throne.logoUrl ||
        null;
      const avatarUrl =
        rawAvatarUrl && country.alpha2 && !failedAvatarIsos.has(country.alpha2)
          ? optimizedImageUrl(rawAvatarUrl, MARKER_IMAGE_FETCH_PX)
          : null;
      markers.push({ country, throne, avatarUrl });
    }

    return markers;
  }, [countries, throneByIso, view, width, height, failedAvatarIsos]);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      // Cursor position in the (fixed) viewBox coordinate frame.
      const px = ((clientX - rect.left) / rect.width) * width;
      const py = ((clientY - rect.top) / rect.height) * height;

      setView((prev) => {
        const nextScale = clampScale(prev.scale * factor);
        const applied = nextScale / prev.scale;
        // Keep the point under the cursor stationary while scaling.
        const nextX = px * (1 - applied) + prev.x * applied;
        const nextY = py * (1 - applied) + prev.y * applied;
        const clamped = clampTranslate({ x: nextX, y: nextY }, nextScale, width, height);
        return { scale: nextScale, ...clamped };
      });
    },
    [width, height],
  );

  const panBy = useCallback(
    (dxClient: number, dyClient: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const factor = width / rect.width;
      const dx = dxClient * factor;
      const dy = dyClient * factor;
      setView((prev) => {
        const clamped = clampTranslate({ x: prev.x + dx, y: prev.y + dy }, prev.scale, width, height);
        return { ...prev, ...clamped };
      });
    },
    [width, height],
  );

  const resetView = useCallback(() => setView({ scale: 1, x: 0, y: 0 }), []);

  // Clears itself after FOCUS_TRANSITION_MS — see the `jumping` state
  // comment above.
  useEffect(() => {
    if (!jumping) return;
    const id = setTimeout(() => setJumping(false), FOCUS_TRANSITION_MS);
    return () => clearTimeout(id);
  }, [jumping]);

  // Pan/zoom to fit a country's bounds, centered, with padding — exposed via
  // ref (see useImperativeHandle below) so the leaderboard search box and
  // row clicks, and the leader ticker, can all send the map to a specific
  // country without lifting pan/zoom state up into Dashboard. Also opens
  // the side panel, same as clicking the country directly, so "go to
  // country" always lands somewhere showing its vote/throne info.
  const focusCountry = useCallback(
    (isoCode: string) => {
      const country = countryByAlpha2.get(isoCode);
      if (!country) return; // not on the map — see WorldMap.tsx's 50m comment

      const [x0, y0, x1, y1] = country.bounds;
      // Padding around the country so it doesn't butt against the edges —
      // ~35% of its own size on each side. Floored so a near-zero-area
      // sliver (see MAX_SCALE comment) can't produce a runaway scale.
      const boxWidth = Math.max(x1 - x0, 0.05);
      const boxHeight = Math.max(y1 - y0, 0.05);
      const fitScale = Math.min(width / (boxWidth * 1.7), height / (boxHeight * 1.7));
      const nextScale = clampScale(fitScale);

      const [cx, cy] = country.centroid;
      const clamped = clampTranslate(
        { x: width / 2 - cx * nextScale, y: height / 2 - cy * nextScale },
        nextScale,
        width,
        height,
      );

      setSelectedId(country.id);
      setJumping(true);
      setView({ scale: nextScale, ...clamped });
    },
    [countryByAlpha2, width, height],
  );

  useImperativeHandle(ref, () => ({ focusCountry }), [focusCountry]);

  const zoomButton = useCallback(
    (factor: number) => () => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    },
    [zoomAt],
  );

  // React attaches wheel listeners as passive by default, so preventDefault()
  // inside a JSX onWheel handler is silently ignored — the page would scroll
  // even while we "handle" the zoom. A manual non-passive listener is required.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setJumping(false); // a real gesture always wins over an in-progress focusCountry animation
      const factor = event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
      zoomAt(event.clientX, event.clientY, factor);
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [zoomAt]);

  const handlePointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setJumping(false); // a real gesture always wins over an in-progress focusCountry animation

    if (pointers.current.size === 1) {
      dragRef.current = {
        mode: "pan",
        last: { x: event.clientX, y: event.clientY },
        movedTotal: 0,
        hadMultiTouch: false,
      };
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      dragRef.current = {
        mode: "pinch",
        last: midpoint(a, b),
        lastDist: dist(a, b),
        movedTotal: dragRef.current?.movedTotal ?? 0,
        hadMultiTouch: true,
      };
      setHover(null); // no tooltip once a pinch gesture starts
    }
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      // Hover feedback — only relevant while no pan/pinch gesture is active
      // (a real mouse hover never has an active pointer session).
      if (pointers.current.size === 0) {
        const target = event.target as Element;
        const pathEl = target.closest?.("path[data-country-id]") as SVGPathElement | null;
        const id = pathEl?.dataset.countryId;
        setHover(id ? { id, x: event.clientX, y: event.clientY } : null);
      }

      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.mode === "pan" && pointers.current.size === 1) {
        const [p] = Array.from(pointers.current.values());
        const dxClient = p.x - drag.last.x;
        const dyClient = p.y - drag.last.y;
        drag.movedTotal += Math.hypot(dxClient, dyClient);
        panBy(dxClient, dyClient);
        drag.last = p;
      } else if (drag.mode === "pinch" && pointers.current.size === 2) {
        const [a, b] = Array.from(pointers.current.values());
        const newDist = dist(a, b);
        const newMid = midpoint(a, b);
        const factor = drag.lastDist ? newDist / drag.lastDist : 1;
        if (Number.isFinite(factor) && factor > 0) {
          zoomAt(newMid.x, newMid.y, factor);
        }
        drag.last = newMid;
        drag.lastDist = newDist;
      }
    },
    [panBy, zoomAt],
  );

  const handlePointerLeave = useCallback(() => setHover(null), []);

  const endPointer = useCallback((event: React.PointerEvent<SVGSVGElement>, allowClick: boolean) => {
    const drag = dragRef.current;
    pointers.current.delete(event.pointerId);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser; safe to ignore.
    }

    if (pointers.current.size === 0) {
      if (
        allowClick &&
        drag &&
        drag.mode === "pan" &&
        !drag.hadMultiTouch &&
        drag.movedTotal < CLICK_THRESHOLD
      ) {
        const target = document.elementFromPoint(event.clientX, event.clientY);
        const pathEl = target?.closest<SVGPathElement>("path[data-country-id]");
        const id = pathEl?.dataset.countryId;
        if (id) {
          setSelectedId((prev) => (prev === id ? null : id));
        }
      }
      dragRef.current = null;
    } else if (pointers.current.size === 1) {
      // Went from a pinch down to one finger — resume panning, but never
      // treat the eventual release as a click.
      const [p] = Array.from(pointers.current.values());
      dragRef.current = { mode: "pan", last: p, movedTotal: Infinity, hadMultiTouch: true };
    }
  }, []);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => endPointer(event, true),
    [endPointer],
  );
  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => endPointer(event, false),
    [endPointer],
  );

  const handleKeyDown = useCallback((event: React.KeyboardEvent<SVGPathElement>, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedId((prev) => (prev === id ? null : id));
    }
  }, []);

  const selectedCountry = selectedId ? countryById.get(selectedId) : undefined;
  const hoveredCountry = hover ? countryById.get(hover.id) : undefined;
  const isoLabel = selectedCountry
    ? selectedCountry.alpha2 && selectedCountry.alpha3
      ? `${selectedCountry.alpha2} / ${selectedCountry.alpha3}`
      : "No ISO code (disputed territory)"
    : null;
  const voteIsoCode = selectedCountry?.alpha2;

  const votedForSelected = Boolean(voteIsoCode && voteStatus?.votedCountryIsoCode === voteIsoCode);
  const isSubmitting = Boolean(voteIsoCode && submittingIso === voteIsoCode);
  const voteButtonLabel = isSubmitting
    ? "Voting…"
    : votedForSelected
      ? "You already voted today"
      : voteStatus?.votedToday
        ? "Move your vote here"
        : "Vote";

  const handleVoteClick = useCallback(() => {
    if (voteIsoCode) onVote(voteIsoCode);
  }, [voteIsoCode, onVote]);

  const buttonClass =
    "flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-lg leading-none text-foreground shadow-sm hover:bg-surface-hover";

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-sm text-muted">Hover a country to see its name. Click a country to see its details.</p>
      <p className="sr-only">
        Scroll or pinch to zoom, drag to pan. Each country is focusable and can
        be selected with Enter or Space.
      </p>
      <div className="flex w-full flex-col gap-4 lg:flex-row">
        {/* The map is the site's identity — near-fullscreen on every
            breakpoint (direct request/memleket.lol-style: title bar on top,
            map dominates everything below it), and a near-black sea so
            land colors (see vote-color-scale.ts) read clearly against it
            instead of blending into a merely-dim background. */}
        <div className="relative h-[62vh] min-w-0 flex-1 overflow-hidden rounded-sm bg-[#040508] sm:h-[75vh] lg:h-[88vh]">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerLeave}
          >
            <g
              transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}
              style={jumping ? { transition: `transform ${FOCUS_TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)` } : undefined}
            >
              {countries.map((country) => {
                const isSelected = country.id === selectedId;
                const voteCount = country.alpha2 ? (voteCounts.get(country.alpha2) ?? 0) : 0;
                return (
                  <path
                    key={country.id}
                    data-country-id={country.id}
                    d={country.d}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                    aria-label={`${country.name}, ${voteCount} vote${voteCount === 1 ? "" : "s"}`}
                    onKeyDown={(event) => handleKeyDown(event, country.id)}
                    strokeWidth={isSelected ? 1.5 : 0.5}
                    vectorEffect="non-scaling-stroke"
                    style={{ fill: voteCountToColor(voteCount, maxVotes) }}
                    className={
                      isSelected
                        ? "cursor-pointer stroke-accent outline-none transition-opacity hover:opacity-75"
                        : "cursor-pointer stroke-black/40 outline-none transition-opacity hover:opacity-75"
                    }
                  />
                );
              })}

              {/* Leader marker layer — painted on top of the base fill/
                  stroke paths above, but pointer-events:none throughout so
                  every existing click/hover/keyboard interaction still
                  targets the base <path> underneath, completely unchanged.
                  The map itself stays a plain vote-ratio choropleth (direct
                  request) — this is the only leadership signal on it; the
                  leader's full content (post, brand, description, link,
                  amount paid, time left, report button) only shows in the
                  side panel opened by clicking the country — see
                  ThronePanel, used unchanged below. */}
              {leaderMarkers.length > 0 && (
                <>
                  <defs>
                    {leaderMarkers.map(({ country }) => (
                      <clipPath key={`clip-marker-${country.id}`} id={`clip-marker-${country.id}`}>
                        <circle cx={country.centroid[0]} cy={country.centroid[1]} r={markerScreenRadius(view.scale) / view.scale} />
                      </clipPath>
                    ))}
                  </defs>

                  {leaderMarkers.map(({ country, avatarUrl }) => {
                    const r = markerScreenRadius(view.scale) / view.scale;
                    const [cx, cy] = country.centroid;
                    const clipId = `clip-marker-${country.id}`;
                    return (
                      <g key={country.id} pointerEvents="none">
                        {avatarUrl ? (
                          <image
                            href={avatarUrl}
                            x={cx - r}
                            y={cy - r}
                            width={r * 2}
                            height={r * 2}
                            clipPath={`url(#${clipId})`}
                            preserveAspectRatio="xMidYMid slice"
                            onError={() => {
                              const iso = country.alpha2;
                              if (!iso) return;
                              setFailedAvatarIsos((prev) => (prev.has(iso) ? prev : new Set(prev).add(iso)));
                            }}
                          />
                        ) : (
                          // Neither a linked social post nor a website logo
                          // — direct request: fall back to a plain crown
                          // over the country's flag rather than attempting
                          // any further fetch.
                          <>
                            <image
                              href={flagUrl(country.alpha2 ?? "", 80)}
                              x={cx - r}
                              y={cy - r}
                              width={r * 2}
                              height={r * 2}
                              clipPath={`url(#${clipId})`}
                              preserveAspectRatio="xMidYMid slice"
                            />
                            <text
                              x={cx}
                              y={cy}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={r * 1.3}
                              style={{ paintOrder: "stroke" }}
                              stroke="black"
                              strokeWidth={r * 0.12}
                            >
                              👑
                            </text>
                          </>
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill="none"
                          className="stroke-accent"
                          strokeWidth={1.5}
                          vectorEffect="non-scaling-stroke"
                        />
                      </g>
                    );
                  })}
                </>
              )}

              {leaderCountry && (
                <circle
                  cx={leaderCountry.centroid[0]}
                  cy={leaderCountry.centroid[1]}
                  r={LEADER_PULSE_RADIUS_PX / view.scale}
                  className="fill-accent/40 animate-leader-pulse"
                  style={{ transformBox: "fill-box", transformOrigin: "center" }}
                  pointerEvents="none"
                />
              )}
            </g>
          </svg>
          <div className="absolute right-2 top-2 flex flex-col gap-1">
            <button type="button" aria-label="Zoom in" onClick={zoomButton(BUTTON_ZOOM_FACTOR)} className={buttonClass}>
              +
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={zoomButton(1 / BUTTON_ZOOM_FACTOR)}
              className={buttonClass}
            >
              −
            </button>
            <button type="button" aria-label="Reset view" onClick={resetView} className={buttonClass}>
              ⟲
            </button>
          </div>
          {/* Minimal color key — the fill scale (see vote-color-scale.ts) is
              otherwise unexplained on the map itself. Just the two
              endpoints; the map's own sqrt curve between them isn't
              something a legend needs to reproduce, only which direction
              is "more votes." */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md border border-border/60 bg-surface/90 px-2 py-1 text-[10px] text-muted-2 backdrop-blur-sm">
            <span>Fewer votes</span>
            <span className="h-1.5 w-12 rounded-sm" style={{ background: voteColorScaleCss() }} />
            <span>Leader</span>
          </div>
          {hoveredCountry &&
            (() => {
              const iso = hoveredCountry.alpha2;
              const rank = iso ? rankByIso.get(iso) : undefined;
              const votes = iso ? (voteCounts.get(iso) ?? 0) : 0;
              const throne = iso ? throneByIso.get(iso) : undefined;
              return (
                <div
                  className="pointer-events-none fixed z-50 -translate-y-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-md"
                  style={{ left: (hover?.x ?? 0) + 12, top: (hover?.y ?? 0) - 10 }}
                >
                  <p className="font-medium text-foreground">{hoveredCountry.name}</p>
                  {iso && (
                    <p className="mt-0.5 flex items-center gap-1.5 font-mono text-muted-2">
                      {rank && <span>#{rank}</span>}
                      <span>
                        {votes.toLocaleString("en-US")} vote{votes === 1 ? "" : "s"}
                      </span>
                    </p>
                  )}
                  {throne?.handle && <p className="mt-0.5 text-accent">@{throne.handle}</p>}
                </div>
              );
            })()}
        </div>
        {selectedCountry && (
          <aside className="w-full shrink-0 border-t border-border pt-4 lg:w-64 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">{selectedCountry.name}</h2>
              <button
                type="button"
                aria-label="Close panel"
                onClick={() => {
                  setSelectedId(null);
                  setClaimModalOpen(false);
                }}
                className="text-lg leading-none text-muted hover:text-foreground"
              >
                ×
              </button>
            </div>
            <p className="mt-2 text-sm text-muted">ISO 3166-1: {isoLabel}</p>
            {voteIsoCode ? (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-sm text-muted">
                  {(() => {
                    const liveCount = voteCounts.get(voteIsoCode) ?? 0;
                    return `${liveCount} vote${liveCount === 1 ? "" : "s"}`;
                  })()}
                </p>
                <button
                  type="button"
                  onClick={handleVoteClick}
                  disabled={isSubmitting || votedForSelected}
                  className={`px-3 py-2 text-sm font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-hover disabled:text-muted ${CTA_CLASSES}`}
                >
                  {voteButtonLabel}
                </button>
                {voteError && <p className="text-xs text-danger">{voteError}</p>}

                <div className="mt-2 border-t border-border pt-4">
                  <ThronePanel
                    isoCode={voteIsoCode}
                    countryName={selectedCountry.name}
                    throne={throneByIso.get(voteIsoCode)}
                    claimHistory={claimHistory}
                    now={now}
                    onOpenClaim={() => setClaimModalOpen(true)}
                    hype={hype}
                    onHyped={onHyped}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-2">Voting isn&apos;t available for this territory.</p>
            )}
          </aside>
        )}
      </div>

      {claimModalOpen && selectedCountry && voteIsoCode && (
        <ThroneClaimModal
          isoCode={voteIsoCode}
          countryName={selectedCountry.name}
          throne={throneByIso.get(voteIsoCode)}
          countryPathD={selectedCountry.d}
          countryBounds={selectedCountry.bounds}
          onClose={() => setClaimModalOpen(false)}
          onClaimed={onThroneClaimed}
        />
      )}
    </div>
  );
});

export default WorldMapInteractive;
