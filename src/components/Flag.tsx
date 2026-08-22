import { flagSrcSet, flagUrl } from "@/lib/flag";

interface FlagProps {
  alpha2?: string;
  /** Rendered width in px — height follows the image's natural 4:3-ish ratio. */
  width: number;
  className?: string;
}

export default function Flag({ alpha2, width, className }: FlagProps) {
  if (!alpha2) {
    // Disputed territories with no ISO code: a neutral placeholder swatch
    // instead of a broken image request.
    return (
      <span
        className={`inline-block shrink-0 rounded-[3px] bg-surface-hover ${className ?? ""}`}
        style={{ width, aspectRatio: "4 / 3" }}
        aria-hidden="true"
      />
    );
  }

  return (
    // flagcdn.com is an external CDN of small flat images — not worth
    // Next/Image's remote-pattern config and optimization pipeline for
    // assets this size.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagUrl(alpha2, width)}
      srcSet={flagSrcSet(alpha2, width)}
      width={width}
      alt=""
      loading="lazy"
      className={`inline-block shrink-0 rounded-[3px] bg-surface-hover object-cover ${className ?? ""}`}
      style={{ width, aspectRatio: "4 / 3" }}
    />
  );
}
