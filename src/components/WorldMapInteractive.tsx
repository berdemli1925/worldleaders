"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface CountryPath {
  id: string;
  name: string;
  d: string;
  alpha2?: string;
  alpha3?: string;
}

interface WorldMapInteractiveProps {
  countries: CountryPath[];
  width: number;
  height: number;
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
}: WorldMapInteractiveProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef<Map<number, Point>>(new Map());
  const dragRef = useRef<DragState | null>(null);

  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const countryById = useMemo(() => new Map(countries.map((country) => [country.id, country])), [countries]);

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

  const buttonClass =
    "flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-lg leading-none text-zinc-700 shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Hover a country to see its name. Click a country to see its details.
      </p>
      <p className="sr-only">
        Scroll or pinch to zoom, drag to pan. Each country is focusable and can
        be selected with Enter or Space.
      </p>
      <div className="flex w-full flex-col gap-4 sm:flex-row">
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-lg">
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
                return (
                  <path
                    key={country.id}
                    data-country-id={country.id}
                    d={country.d}
                    tabIndex={0}
                    role="button"
                    aria-pressed={isSelected}
                    aria-label={country.name}
                    onKeyDown={(event) => handleKeyDown(event, country.id)}
                    strokeWidth={isSelected ? 1.5 : 0.5}
                    vectorEffect="non-scaling-stroke"
                    className={
                      isSelected
                        ? "cursor-pointer fill-slate-200 stroke-blue-600 hover:fill-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 dark:fill-slate-700 dark:stroke-blue-400 dark:hover:fill-slate-600"
                        : "cursor-pointer fill-slate-200 stroke-slate-500 hover:fill-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 dark:fill-slate-700 dark:stroke-slate-400 dark:hover:fill-slate-600"
                    }
                  />
                );
              })}
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
              className="pointer-events-none fixed z-50 -translate-y-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              style={{ left: (hover?.x ?? 0) + 12, top: (hover?.y ?? 0) - 10 }}
            >
              {hoveredCountry.name}
            </div>
          )}
        </div>
        {selectedCountry && (
          <aside className="w-full shrink-0 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:w-64 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{selectedCountry.name}</h2>
              <button
                type="button"
                aria-label="Close panel"
                onClick={() => setSelectedId(null)}
                className="text-lg leading-none text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                ×
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">ISO 3166-1: {isoLabel}</p>
          </aside>
        )}
      </div>
    </div>
  );
}
