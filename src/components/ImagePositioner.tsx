"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  clampImageCrop,
  computeImageRect,
  DEFAULT_IMAGE_CROP,
  MAX_IMAGE_CROP_SCALE,
  minImageCropScale,
  type ImageCropTransform,
  type Size,
} from "@/lib/image-crop";

interface Point {
  x: number;
  y: number;
}

interface DragState {
  mode: "pan" | "pinch";
  last: Point;
  lastDist?: number;
}

const WHEEL_ZOOM_FACTOR = 1.08;
// A country's silhouette can be tiny on a phone screen — too small to
// pinch inside accurately — so the +/- buttons and slider below need a
// bigger per-tap step than the wheel gets per notch to actually be usable
// as the primary zoom control there, not just a fallback.
const BUTTON_ZOOM_FACTOR = 1.25;
// Fine enough that dragging the slider across its full range takes a
// deliberate sweep rather than jumping in a couple of visible steps.
const SLIDER_STEP = 0.01;

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

interface ImagePositionerProps {
  imageUrl: string;
  /** The claimed country's own outline — same `d` string WorldMap.tsx computes, used identically here as a clipPath. */
  countryPathD: string;
  /** [x0, y0, x1, y1], same coordinate space as countryPathD — see WorldMap.tsx. */
  countryBounds: [number, number, number, number];
  value: ImageCropTransform;
  onChange: (transform: ImageCropTransform) => void;
  /** Fires whenever the image (re)loads, with its natural pixel size — null while loading/on error. Needed both for the crop math here and for what gets saved with the claim. */
  onNaturalSize: (size: Size | null) => void;
}

// The "how does my post's photo sit inside this country" tool — an SVG
// clipped to the country's real silhouette (identical technique to the
// leader-image layer in WorldMapInteractive, so what's previewed here is
// exactly what the map will show), with the image draggable/zoomable
// inside it. Mouse drag + wheel, or one-finger drag + two-finger pinch on
// touch, both via the Pointer Events API — same gesture-handling shape as
// WorldMapInteractive's map pan/zoom, scoped down to one shape instead of
// the whole world.
export default function ImagePositioner({
  imageUrl,
  countryPathD,
  countryBounds,
  value,
  onChange,
  onNaturalSize,
}: ImagePositionerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef<Map<number, Point>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [x0, y0, x1, y1] = countryBounds;
  const box: Size = useMemo(() => ({ width: x1 - x0, height: y1 - y0 }), [x1, x0, y1, y0]);
  const clipId = `image-positioner-clip-${useId()}`;

  // `value` is a controlled prop, not local state, so there's no
  // functional-update form to fall back on the way WorldMapInteractive
  // uses `setView(prev => ...)` for the same problem — this ref plays the
  // same role: several wheel/pointermove events can fire before React
  // commits the re-render that would refresh the `value` prop, and without
  // always chaining off the most recently *applied* transform, fast
  // scrolling/dragging would silently drop steps (each handler computing
  // "current + this one delta" from the same stale value instead of
  // compounding).
  const latestValue = useRef(value);
  useEffect(() => {
    latestValue.current = value;
  }, [value]);

  // (Re)load whenever a different photo is selected — also the one place
  // the transform resets to default, so switching photos never carries
  // over a crop that was tuned for a different image's aspect ratio.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageSize(null);
    setLoadError(false);
    onChange(DEFAULT_IMAGE_CROP);
    const img = new Image();
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      setImageSize(size);
      onNaturalSize(size);
    };
    img.onerror = () => {
      setLoadError(true);
      onNaturalSize(null);
    };
    img.src = imageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const applyTransform = useCallback(
    (next: ImageCropTransform) => {
      if (!imageSize) return;
      const clamped = clampImageCrop(box, imageSize, next);
      latestValue.current = clamped;
      onChange(clamped);
    },
    [box, imageSize, onChange],
  );

  const zoomBy = useCallback(
    (factor: number) => applyTransform({ ...latestValue.current, scale: latestValue.current.scale * factor }),
    [applyTransform],
  );

  // React's onWheel can't preventDefault (listeners are passive by
  // default) — same reasoning/fix as WorldMapInteractive's wheel handling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR);
    };
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, [zoomBy]);

  const handlePointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      dragRef.current = { mode: "pan", last: { x: event.clientX, y: event.clientY } };
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      dragRef.current = { mode: "pinch", last: midpoint(a, b), lastDist: dist(a, b) };
    }
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const drag = dragRef.current;
      const svg = svgRef.current;
      if (!drag || !svg || !imageSize) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      if (drag.mode === "pan" && pointers.current.size === 1) {
        const [p] = Array.from(pointers.current.values());
        const dxFrac = (p.x - drag.last.x) / rect.width;
        const dyFrac = (p.y - drag.last.y) / rect.height;
        applyTransform({
          ...latestValue.current,
          offsetX: latestValue.current.offsetX + dxFrac,
          offsetY: latestValue.current.offsetY + dyFrac,
        });
        drag.last = p;
      } else if (drag.mode === "pinch" && pointers.current.size === 2) {
        const [a, b] = Array.from(pointers.current.values());
        const newDist = dist(a, b);
        const factor = drag.lastDist ? newDist / drag.lastDist : 1;
        if (Number.isFinite(factor) && factor > 0) {
          applyTransform({ ...latestValue.current, scale: latestValue.current.scale * factor });
        }
        drag.last = midpoint(a, b);
        drag.lastDist = newDist;
      }
    },
    [applyTransform, imageSize],
  );

  const endPointer = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released by the browser — safe to ignore.
    }
    if (pointers.current.size === 0) {
      dragRef.current = null;
    } else if (pointers.current.size === 1) {
      const [p] = Array.from(pointers.current.values());
      dragRef.current = { mode: "pan", last: p };
    }
  }, []);

  const rect = imageSize ? computeImageRect(box, imageSize, value) : null;
  const canReset = value.scale !== 1 || value.offsetX !== 0 || value.offsetY !== 0;
  const minScale = imageSize ? minImageCropScale(box, imageSize) : 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-md border border-border bg-black/30">
        <svg
          ref={svgRef}
          viewBox={`${x0} ${y0} ${box.width} ${box.height}`}
          className="h-auto w-full touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
        >
          <defs>
            <clipPath id={clipId}>
              <path d={countryPathD} />
            </clipPath>
          </defs>
          {rect && (
            <g clipPath={`url(#${clipId})`}>
              <image
                href={imageUrl}
                x={x0 + rect.x}
                y={y0 + rect.y}
                width={rect.width}
                height={rect.height}
                preserveAspectRatio="none"
                style={{ imageRendering: "auto" }}
              />
            </g>
          )}
          {/* Redrawn on top, same accent-border treatment as the map, so the
              actual claimed shape is unambiguous against the modal's dark
              background. */}
          <path d={countryPathD} fill="none" className="stroke-accent" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {!imageSize && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-2">Loading image…</div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-danger">
            Couldn&apos;t load this image.
          </div>
        )}
      </div>

      {/* Explicit zoom controls, not just pinch/scroll — a claimed country's
          shape is often tiny on a phone screen, too small to pinch inside
          accurately, so this is the primary way to zoom on mobile rather
          than a fallback. The slider's own range communicates the new
          "zoom out past cover" ability directly: its low end now sits at
          minScale (full photo visible, gaps allowed) instead of always
          starting pinned at cover-fit. */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomBy(1 / BUTTON_ZOOM_FACTOR)}
          disabled={!imageSize}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border text-sm leading-none text-muted transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          −
        </button>
        <input
          type="range"
          aria-label="Zoom"
          min={minScale}
          max={MAX_IMAGE_CROP_SCALE}
          step={SLIDER_STEP}
          value={value.scale}
          disabled={!imageSize}
          onChange={(event) => applyTransform({ ...latestValue.current, scale: Number(event.target.value) })}
          className="h-1.5 flex-1 accent-accent disabled:opacity-40"
        />
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomBy(BUTTON_ZOOM_FACTOR)}
          disabled={!imageSize}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border text-sm leading-none text-muted transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-2">
          Drag to reposition. Zoom out to shrink the photo below the country&apos;s shape — gaps are fine.
        </p>
        <button
          type="button"
          onClick={() => applyTransform(DEFAULT_IMAGE_CROP)}
          disabled={!canReset}
          className="rounded-sm border border-border px-3 py-1 text-xs text-muted transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset position
        </button>
      </div>
    </div>
  );
}
