"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { twitterImageVariant } from "@/lib/twitter-image";
import { voteCountToColor } from "@/lib/vote-color-scale";
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
  /** Live vote counts keyed by ISO alpha-2 code, used to color the map. */
  voteCounts: Map<string, number>;
  /** Highest count across all countries — the top of the color scale. */
  maxVotes: number;
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

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const WHEEL_ZOOM_FACTOR = 1.2;
const BUTTON_ZOOM_FACTOR = 1.4;
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
  // Generous bound that just keeps the map from being dragged completely out
  // of view — not a pixel-perfect edge lock.
  const marginX = (width * scale) / 2;
  const marginY = (height * scale) / 2;
  return {
    x: Math.min(marginX, Math.max(-marginX, t.x)),
    y: Math.min(marginY, Math.max(-marginY, t.y)),
  };
}

export default function WorldMapInteractive({
  countries,
  width,
  height,
  voteCounts,
  maxVotes,
  voteStatus,
  submittingIso,
  voteError,
  onVote,
  thrones,
  claimHistory,
  now,
  onThroneClaimed,
}: WorldMapInteractiveProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef<Map<number, Point>>(new Map());
  const dragRef = useRef<DragState | null>(null);

  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [claimModalOpen, setClaimModalOpen] = useState(false);

  const countryById = useMemo(() => new Map(countries.map((country) => [country.id, country])), [countries]);
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
    const images: { country: CountryPath; imageUrl: string }[] = [];
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
        images.push({ country, imageUrl: twitterImageVariant(throne.postImageUrl, "240x240") });
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
      const factor = event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
      zoomAt(event.clientX, event.clientY, factor);
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [zoomAt]);

  const handlePointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

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
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-lg bg-black/20">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerLeave}
          >
            <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
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

                  {leaderLayers.images.map(({ country, imageUrl }) => {
                    const [x0, y0, x1, y1] = country.bounds;
                    return (
                      <g key={country.id} pointerEvents="none" clipPath={`url(#clip-img-${country.id})`}>
                        <image
                          href={imageUrl}
                          x={x0}
                          y={y0}
                          width={x1 - x0}
                          height={y1 - y0}
                          preserveAspectRatio="xMidYMid slice"
                        />
                        {/* Light darkening so the (redrawn, on-top) border and hover tooltip name stay readable. */}
                        <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="black" fillOpacity={0.35} />
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
          {hoveredCountry && (
            <div
              className="pointer-events-none fixed z-50 -translate-y-full rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-foreground shadow-md"
              style={{ left: (hover?.x ?? 0) + 12, top: (hover?.y ?? 0) - 10 }}
            >
              {hoveredCountry.name}
            </div>
          )}
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
                  className="rounded-full bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-muted"
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
          onClose={() => setClaimModalOpen(false)}
          onClaimed={onThroneClaimed}
        />
      )}
    </div>
  );
}
