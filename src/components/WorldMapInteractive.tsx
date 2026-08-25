"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

import { buildCountryByAlpha2 } from "@/lib/country-path";
import { computeImageRect, DEFAULT_IMAGE_CROP } from "@/lib/image-crop";
import { twitterImageVariant } from "@/lib/twitter-image";
import { voteColorScaleCss, voteCountToColor } from "@/lib/vote-color-scale";
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
// A leadered country's on-screen bounding box must be at least this many
// (viewBox-unit, roughly-pixel) wide *and* tall for its post image to
// replace the small avatar marker — small islands etc. never cross this
// even fully zoomed in, so they always keep the avatar.
const IMAGE_MIN_SCREEN_PX = 32;
// Avatar marker radius, compensated by view.scale below so it stays a
// constant on-screen size regardless of zoom (same idea as the existing
// vectorEffect="non-scaling-stroke" on country borders).
const AVATAR_RADIUS_PX = 9;

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

  // Which leadered countries get the full clipped post image vs. the small
  // avatar marker, at the current pan/zoom — and which get neither because
  // they're currently panned off-screen. An <image>/<circle clip> node is
  // only ever created for a country that lands in one of the two lists
  // below, so this doubles as the lazy-load mechanism: the browser never
  // fetches a leader's image/avatar until it actually needs to be shown.
  // Kill-switch awareness needs no extra check here — thrones_with_leader
  // already nulls every leader field site-wide when hidden, so throneByIso
  // simply has nothing to show for any country in that case.
  const leaderLayers = useMemo(() => {
    const images: { country: CountryPath; imageUrl: string; throne: ThroneEntry }[] = [];
    const avatars: { country: CountryPath; avatarUrl: string }[] = [];

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

      if (throne.postImageUrl && screenX1 - screenX0 >= IMAGE_MIN_SCREEN_PX && screenY1 - screenY0 >= IMAGE_MIN_SCREEN_PX) {
        // "orig" — up from a fixed small variant — now that MAX_SCALE lets a
        // claimed country fill most of the screen, anything less looks
        // visibly soft at that size. See src/lib/twitter-image.ts.
        images.push({ country, imageUrl: twitterImageVariant(throne.postImageUrl, "orig"), throne });
      } else if (throne.postAuthorAvatarUrl) {
        avatars.push({ country, avatarUrl: throne.postAuthorAvatarUrl });
      }
    }

    return { images, avatars };
  }, [countries, throneByIso, view, width, height]);

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
      <div className="flex w-full flex-col gap-4 sm:flex-row">
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

              {/* Leader content layer — painted on top of the base fill/
                  stroke paths above, but pointer-events:none throughout so
                  every existing click/hover/keyboard interaction still
                  targets the base <path> underneath, completely unchanged. */}
              {(leaderLayers.images.length > 0 || leaderLayers.avatars.length > 0) && (
                <>
                  <defs>
                    {leaderLayers.images.map(({ country }) => (
                      <clipPath key={`clip-img-${country.id}`} id={`clip-img-${country.id}`}>
                        <path d={country.d} />
                      </clipPath>
                    ))}
                    {leaderLayers.avatars.map(({ country }) => (
                      <clipPath key={`clip-avatar-${country.id}`} id={`clip-avatar-${country.id}`}>
                        <circle cx={country.centroid[0]} cy={country.centroid[1]} r={AVATAR_RADIUS_PX / view.scale} />
                      </clipPath>
                    ))}
                  </defs>

                  {leaderLayers.images.map(({ country, imageUrl, throne }) => {
                    const [x0, y0, x1, y1] = country.bounds;
                    const boxWidth = x1 - x0;
                    const boxHeight = y1 - y0;
                    // The claimer's chosen crop (ImagePositioner) when we
                    // know the image's natural size — same computeImageRect
                    // call the positioner itself used, so this is pixel-
                    // identical to what they previewed. Falls back to plain
                    // preserveAspectRatio cover-fit for claims made before
                    // image cropping existed (no stored width/height).
                    const rect =
                      throne.postImageWidth && throne.postImageHeight
                        ? computeImageRect(
                            { width: boxWidth, height: boxHeight },
                            { width: throne.postImageWidth, height: throne.postImageHeight },
                            throne.postImageScale !== null && throne.postImageOffsetX !== null && throne.postImageOffsetY !== null
                              ? { scale: throne.postImageScale, offsetX: throne.postImageOffsetX, offsetY: throne.postImageOffsetY }
                              : DEFAULT_IMAGE_CROP,
                          )
                        : null;
                    return (
                      <g key={country.id} pointerEvents="none" clipPath={`url(#clip-img-${country.id})`}>
                        <image
                          href={imageUrl}
                          x={rect ? x0 + rect.x : x0}
                          y={rect ? y0 + rect.y : y0}
                          width={rect ? rect.width : boxWidth}
                          height={rect ? rect.height : boxHeight}
                          preserveAspectRatio={rect ? "none" : "xMidYMid slice"}
                        />
                        {/* Just enough darkening that the (redrawn, on-top)
                            border and hover tooltip name stay readable —
                            AŞAMA 1.5 asks for leader images to read clearly,
                            not be dimmed like before. */}
                        <rect x={x0} y={y0} width={boxWidth} height={boxHeight} fill="black" fillOpacity={0.12} />
                      </g>
                    );
                  })}
                  {/* Redraw each image country's border on top, crisp, unobscured by the photo. */}
                  {leaderLayers.images.map(({ country }) => (
                    <path
                      key={`border-${country.id}`}
                      d={country.d}
                      fill="none"
                      className="stroke-accent"
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  ))}

                  {/* Avatar-only leadered countries (too small on screen for
                      the full post image) still get their border
                      emphasized, same as image countries above — AŞAMA 1.5:
                      "Lideri olan ülkelerin sınırları vurgu rengiyle
                      belirginleşsin," not just the large ones. */}
                  {leaderLayers.avatars.map(({ country }) => (
                    <path
                      key={`border-avatar-${country.id}`}
                      d={country.d}
                      fill="none"
                      className="stroke-accent"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                    />
                  ))}

                  {leaderLayers.avatars.map(({ country, avatarUrl }) => {
                    const r = AVATAR_RADIUS_PX / view.scale;
                    const [cx, cy] = country.centroid;
                    return (
                      <g key={country.id} pointerEvents="none">
                        <image
                          href={avatarUrl}
                          x={cx - r}
                          y={cy - r}
                          width={r * 2}
                          height={r * 2}
                          clipPath={`url(#clip-avatar-${country.id})`}
                          preserveAspectRatio="xMidYMid slice"
                        />
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
                  r={AVATAR_RADIUS_PX / view.scale}
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
          <aside className="w-full shrink-0 border-t border-border pt-4 sm:w-64 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
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
                  className="rounded-sm bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-muted"
                >
                  {voteButtonLabel}
                </button>
                {voteError && <p className="text-xs text-danger">{voteError}</p>}

                <div className="mt-2 border-t border-border pt-4">
                  <ThronePanel
                    isoCode={voteIsoCode}
                    throne={throneByIso.get(voteIsoCode)}
                    claimHistory={claimHistory}
                    now={now}
                    onOpenClaim={() => setClaimModalOpen(true)}
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
