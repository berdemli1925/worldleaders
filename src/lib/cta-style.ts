// Shared color/border treatment for every primary "solid" action button
// site-wide — Vote, Claim throne, form submits, the nav's active tab, admin
// approve buttons, etc. Direct request (second pass on the theme — the
// first attempt just darkened the gold and wasn't enough): a near-black
// stenciled plate, a bold yellow label, a thin war-red frame — "siyah
// üstüne sarı yazı, kenarda kırmızı" — not a solid colored pill. See
// globals.css's --cta-* tokens.
//
// Centralized here rather than each of the ~10 call sites hand-rolling its
// own bg-accent/text-accent-foreground combination, which is exactly how
// the old pill-button look drifted into slightly different shades/borders
// per file. Callers add their own padding/text-size/rounded/disabled
// classes on top — this is only the part that makes it *this* button
// rather than a plain outline.
export const CTA_CLASSES =
  "border-2 border-cta-border bg-cta-bg text-cta-text transition-colors hover:border-danger";
