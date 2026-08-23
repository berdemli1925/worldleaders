"use client";

import { useEffect, useRef, useState } from "react";

import { computeImageRect, DEFAULT_IMAGE_CROP } from "@/lib/image-crop";

interface CroppedLeaderImageProps {
  imageUrl: string;
  /** Natural pixel size + crop transform from the throne — all null together for claims made before image cropping existed. */
  imageWidth: number | null;
  imageHeight: number | null;
  scale: number | null;
  offsetX: number | null;
  offsetY: number | null;
  className?: string;
}

// Renders a leader's post image inside a rectangular card using the exact
// same crop the claimer chose in ThroneClaimModal's positioner — this is
// the rectangular-card counterpart to WorldMapInteractive's country-shaped
// image layer; both call computeImageRect (src/lib/image-crop.ts) so the
// same claim looks identically framed whether it's clipped to a country's
// silhouette on the map or filling a plain card here.
//
// Needs its own rendered pixel size to do that math (computeImageRect
// works in real box units, not percentages), so it measures itself via
// ResizeObserver rather than relying on CSS object-fit — falls back to
// plain object-cover (the old, pre-cropping look) until that first
// measurement lands, and permanently for claims with no stored image
// dimensions.
export default function CroppedLeaderImage({
  imageUrl,
  imageWidth,
  imageHeight,
  scale,
  offsetX,
  offsetY,
  className,
}: CroppedLeaderImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hasNaturalSize = Boolean(imageWidth && imageHeight);
  const rect =
    box && hasNaturalSize
      ? computeImageRect(
          box,
          { width: imageWidth as number, height: imageHeight as number },
          scale !== null && offsetX !== null && offsetY !== null ? { scale, offsetX, offsetY } : DEFAULT_IMAGE_CROP,
        )
      : null;

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        className={rect ? "absolute max-w-none" : "h-full w-full object-cover"}
        style={rect ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height } : undefined}
      />
    </div>
  );
}
