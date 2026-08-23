// Shared math for "how is this leader image cropped/positioned" — the one
// piece of logic behind three different renderers that all have to agree
// pixel-for-pixel: the interactive positioner in ThroneClaimModal (an SVG
// clipped to the country's own shape), the map's per-country image layer
// (WorldMapInteractive, same SVG clip), and the rectangular leader-image
// cards (CroppedLeaderImage, used by ThronePanel/LeadersList). All three
// call computeImageRect with their own box size — a country's viewBox
// bounds for the SVG contexts, a measured pixel box for the card — so
// "birebir aynı" (identical) between them falls out of using the same
// function rather than three hand-tuned CSS/SVG treatments that could
// drift apart.

export interface ImageCropTransform {
  /** >= 1. Relative to the auto "cover" fit — 1 is the default (no user zoom). */
  scale: number;
  /** Fraction of the box's own width the image is shifted, clamped so it never leaves a gap. */
  offsetX: number;
  /** Fraction of the box's own height. */
  offsetY: number;
}

export const DEFAULT_IMAGE_CROP: ImageCropTransform = { scale: 1, offsetX: 0, offsetY: 0 };

export const MAX_IMAGE_CROP_SCALE = 5;

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Where to draw the image (position + size, relative to the box's own
// origin) so that at transform = DEFAULT_IMAGE_CROP it exactly covers the
// box — centered, no gaps, nothing overflowing past what the box itself
// clips away — matching CSS `object-fit: cover`. Zooming/panning beyond
// that is `transform.scale`/`offsetX`/`offsetY` on top of the same base.
export function computeImageRect(box: Size, image: Size, transform: ImageCropTransform): Rect {
  if (box.width <= 0 || box.height <= 0 || image.width <= 0 || image.height <= 0) {
    return { x: 0, y: 0, width: box.width, height: box.height };
  }

  const baseScale = Math.max(box.width / image.width, box.height / image.height);
  const scale = baseScale * Math.max(1, transform.scale);
  const width = image.width * scale;
  const height = image.height * scale;

  const maxOffsetXPx = Math.max(0, (width - box.width) / 2);
  const maxOffsetYPx = Math.max(0, (height - box.height) / 2);
  const offsetXPx = clamp(transform.offsetX * box.width, -maxOffsetXPx, maxOffsetXPx);
  const offsetYPx = clamp(transform.offsetY * box.height, -maxOffsetYPx, maxOffsetYPx);

  return {
    x: (box.width - width) / 2 + offsetXPx,
    y: (box.height - height) / 2 + offsetYPx,
    width,
    height,
  };
}

// Re-clamps a transform's offset to what's actually reachable at its scale
// (offset range shrinks as scale drops back toward 1) — called after every
// drag/wheel step in the positioner so it's never possible to end up with a
// gap or an out-of-range value to begin with, before computeImageRect ever
// re-derives the same rect at render/save time.
export function clampImageCrop(box: Size, image: Size, transform: ImageCropTransform): ImageCropTransform {
  const scale = clamp(transform.scale, 1, MAX_IMAGE_CROP_SCALE);
  if (box.width <= 0 || box.height <= 0 || image.width <= 0 || image.height <= 0) {
    return { scale, offsetX: 0, offsetY: 0 };
  }

  const baseScale = Math.max(box.width / image.width, box.height / image.height);
  const width = image.width * baseScale * scale;
  const height = image.height * baseScale * scale;
  const maxOffsetXFrac = Math.max(0, (width - box.width) / 2 / box.width);
  const maxOffsetYFrac = Math.max(0, (height - box.height) / 2 / box.height);

  return {
    scale,
    offsetX: clamp(transform.offsetX, -maxOffsetXFrac, maxOffsetXFrac),
    offsetY: clamp(transform.offsetY, -maxOffsetYFrac, maxOffsetYFrac),
  };
}
