"use client";

import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import { BETA_HOLD_HOURS, BETA_MAX_COUNTRIES_PER_USER, PAYMENTS_ENABLED } from "@/lib/beta-mode";
import { CTA_CLASSES } from "@/lib/cta-style";
import { getFingerprint } from "@/lib/fingerprint";
import { DEFAULT_IMAGE_CROP, type ImageCropTransform, type Size } from "@/lib/image-crop";
import { parseSocialUrl, SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/social-links";
import { isVacant, requiredMinimum, type ThroneEntry } from "@/lib/throne";
import ImagePositioner from "./ImagePositioner";
import SocialPlatformIcon from "./SocialPlatformIcon";

interface ThroneClaimModalProps {
  isoCode: string;
  countryName: string;
  throne: ThroneEntry | undefined;
  /** The country's own outline + bounding box — same data WorldMap.tsx computes for the map itself, threaded down so the image positioner clips to the exact same shape (see WorldMapInteractive.tsx / Leaderboard.tsx for where this comes from). Undefined for the handful of territories with no map geometry (see WorldMap.tsx's 50m comment) — the positioner just doesn't appear for those. */
  countryPathD?: string;
  countryBounds?: [number, number, number, number];
  onClose: () => void;
  onClaimed: () => void;
}

interface PreviewSnapshot {
  text: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  /** Every photo on the post, highest-resolution — see src/lib/x-post.ts. Empty (not null) when the post has no photos. */
  imageUrls: string[];
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Five sections read top-to-bottom in one scrollable dialog (Status →
// Content+Preview → Offer → Rules → Confirm) rather than a multi-screen
// wizard — see proje-spesifikasyonu.md section 6 for the content this
// covers in *paid* mode. The Content/Preview/Rules/Confirm sections stay
// the same shape in free-beta mode (NEXT_PUBLIC_PAYMENTS_ENABLED=false —
// see src/lib/beta-mode.ts); only the Offer section and the copy around it
// change — beta claims are free, so there's nothing to bid.
//
// The Offer/Confirm sections stay disabled until a successful Preview
// response, which is what makes "Preview yapılmadan ödeme aktif olmaz"
// true here in both modes; the actual integrity guarantee is server-side
// (/api/throne/claim re-fetches and re-checks everything independently).
export default function ThroneClaimModal({
  isoCode,
  countryName,
  throne,
  countryPathD,
  countryBounds,
  onClose,
  onClaimed,
}: ThroneClaimModalProps) {
  const minimum = requiredMinimum(throne);
  // In beta mode a claim modal should only ever be opened for a vacant
  // country (see ThronePanel — occupied countries show no claim button
  // there), but two tabs can race, so this is a defensive fallback: show
  // the reason and nothing else rather than let a doomed submit happen.
  const betaBlocked = !PAYMENTS_ENABLED && !isVacant(throne);

  // memleket.lol-style fork shown before the form on an occupied throne
  // (paid mode only — beta never reaches this, see betaBlocked above):
  // "reclaim" vs "new leader". Both lead to the exact same form underneath
  // — there's no separate code path or special price, since credit already
  // applies automatically based on whichever profile ends up linked (see
  // scripts/setup-persistent-leader-credit.mjs) — this is purely about
  // setting the right expectation up front rather than burying it in a
  // caption, same as why the "Currently held by…" credit note above
  // exists. null until one is picked; irrecoverable back to null on close
  // since the modal remounts fresh next time it opens.
  const [claimIntent, setClaimIntent] = useState<"reclaim" | "new" | null>(null);
  const showIntroChoice = PAYMENTS_ENABLED && !isVacant(throne) && claimIntent === null;

  // Leader identity — who's claiming — kept entirely separate from the X
  // post below, which is just content and doesn't have to be this
  // person's own post. See src/lib/social-links.ts.
  const [leaderXUrl, setLeaderXUrl] = useState("");
  const [leaderInstagramUrl, setLeaderInstagramUrl] = useState("");
  const [leaderTiktokUrl, setLeaderTiktokUrl] = useState("");
  const [leaderFacebookUrl, setLeaderFacebookUrl] = useState("");
  const leaderFields: { platform: SocialPlatform; value: string; setValue: (value: string) => void }[] = [
    { platform: "x", value: leaderXUrl, setValue: setLeaderXUrl },
    { platform: "instagram", value: leaderInstagramUrl, setValue: setLeaderInstagramUrl },
    { platform: "tiktok", value: leaderTiktokUrl, setValue: setLeaderTiktokUrl },
    { platform: "facebook", value: leaderFacebookUrl, setValue: setLeaderFacebookUrl },
  ];
  const filledLeaderFields = leaderFields.filter((field) => field.value.trim());
  const invalidLeaderFields = filledLeaderFields.filter((field) => !parseSocialUrl(field.platform, field.value.trim()));
  const leaderIdentityValid = filledLeaderFields.length > 0 && invalidLeaderFields.length === 0;

  const [tweetUrl, setTweetUrl] = useState("");
  const [brandTitle, setBrandTitle] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Optional "auto-fill from a link" affordance (memleket.lol calls this
  // "Bilgileri Çek") — a site/X/Instagram URL whose title/description/
  // og:image get pulled in to save typing the three fields above by hand.
  // Kept separate from tweetUrl (which is required and about *content to
  // display*, not identity) — linkUrl is optional and, once fetched, also
  // gets stored on the claim itself (throne.linkUrl — see ThronePanel's
  // fallback link for a leader with no social identity set).
  const [linkUrl, setLinkUrl] = useState("");
  const [linkFetchStatus, setLinkFetchStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [linkFetchError, setLinkFetchError] = useState<string | null>(null);

  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewSnapshot | null>(null);
  // What content the last successful preview covered — compared against the
  // current fields below (contentKey) so an edit after previewing
  // invalidates it, computed during render rather than via an effect.
  const [previewedFor, setPreviewedFor] = useState<string | null>(null);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageCrop, setImageCrop] = useState<ImageCropTransform>(DEFAULT_IMAGE_CROP);
  const [imageNaturalSize, setImageNaturalSize] = useState<Size | null>(null);

  const [offeredAmount, setOfferedAmount] = useState(() => minimum.toFixed(2));
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [heldCountries, setHeldCountries] = useState<string[] | null>(null);

  // "Opened" fires once, on mount — mounting this component IS opening the
  // modal, from either of its two call sites (Leaderboard.tsx / WorldMapInteractive.tsx).
  // "Abandoned" fires on unmount unless a claim just completed, tracked via
  // this ref rather than state so the cleanup closure always reads the
  // latest value without needing to be in the effect's dependency array.
  const completedRef = useRef(false);
  useEffect(() => {
    track("leadership_modal_opened", { country: isoCode });
    return () => {
      if (!completedRef.current) track("leadership_modal_abandoned", { country: isoCode });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contentKey = JSON.stringify([tweetUrl, brandTitle, description]);
  const previewIsCurrent = previewStatus === "ok" && previewedFor === contentKey;

  async function handlePreview() {
    setPreviewStatus("loading");
    setPreviewError(null);
    try {
      const res = await fetch("/api/throne/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tweetUrl, brandTitle, description }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "Preview failed.");
      setPreview(data.snapshot);
      setPreviewedFor(contentKey);
      setPreviewStatus("ok");
      // New post, new set of photos — any positioning done for a previous
      // preview no longer applies.
      setSelectedImageIndex(0);
      setImageCrop(DEFAULT_IMAGE_CROP);
      setImageNaturalSize(null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed.");
      setPreviewStatus("error");
    }
  }

  async function handleFetchLinkInfo() {
    if (!linkUrl.trim()) return;
    setLinkFetchStatus("loading");
    setLinkFetchError(null);
    try {
      const res = await fetch("/api/throne/link-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error ?? "Couldn't fetch that link.");
      if (data.title) setBrandTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.imageUrl) setLogoUrl(data.imageUrl);
      setLinkFetchStatus("ok");
    } catch (err) {
      setLinkFetchError(err instanceof Error ? err.message : "Couldn't fetch that link.");
      setLinkFetchStatus("error");
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setHeldCountries(null);
    try {
      const amount = Number(offeredAmount);
      if (PAYMENTS_ENABLED && (!Number.isFinite(amount) || amount < minimum)) {
        throw new Error(`Offer must be at least ${formatMoney(minimum)}.`);
      }
      const fingerprint = PAYMENTS_ENABLED ? undefined : await getFingerprint();
      const chosenImageUrl = preview?.imageUrls[selectedImageIndex];
      const res = await fetch("/api/throne/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryIsoCode: isoCode,
          tweetUrl,
          offeredAmount: PAYMENTS_ENABLED ? amount : undefined,
          fingerprint,
          brandTitle: brandTitle || undefined,
          description: description || undefined,
          logoUrl: logoUrl || undefined,
          linkUrl: linkUrl.trim() || undefined,
          leaderXUrl: leaderXUrl.trim() || undefined,
          leaderInstagramUrl: leaderInstagramUrl.trim() || undefined,
          leaderTiktokUrl: leaderTiktokUrl.trim() || undefined,
          leaderFacebookUrl: leaderFacebookUrl.trim() || undefined,
          // Only meaningful (and only sent) when the post actually has a
          // photo and it's finished loading — the server re-validates this
          // against its own fetch of the post regardless.
          imageUrl: chosenImageUrl && imageNaturalSize ? chosenImageUrl : undefined,
          imageWidth: imageNaturalSize?.width,
          imageHeight: imageNaturalSize?.height,
          imageScale: imageNaturalSize ? imageCrop.scale : undefined,
          imageOffsetX: imageNaturalSize ? imageCrop.offsetX : undefined,
          imageOffsetY: imageNaturalSize ? imageCrop.offsetY : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data?.heldCountries)) setHeldCountries(data.heldCountries);
        throw new Error(data?.error ?? "Claim failed.");
      }

      if (data.status === "completed") {
        completedRef.current = true;
        track("leadership_claim_completed", { country: isoCode, amount: PAYMENTS_ENABLED ? amount : 0 });
        onClaimed();
        onClose();
        return;
      }
      if (data.status === "pending" && data.checkoutUrl) {
        // Redirect-based provider — not reachable with the mock provider,
        // kept for when a real one is wired in.
        window.location.href = data.checkoutUrl;
        return;
      }
      throw new Error(data.error ?? "Payment failed.");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Claim failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = previewIsCurrent && leaderIdentityValid;
  const offered = Number(offeredAmount) || minimum;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-md border border-border bg-surface p-5"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Status */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-2">Claim throne</p>
            <h2 className="text-lg font-semibold text-foreground">{countryName}</h2>
            {PAYMENTS_ENABLED ? (
              throne?.currentValue !== null && throne?.handle ? (
                <p className="mt-1 text-xs text-muted">
                  Currently held by @{throne.handle} for {formatMoney(throne.currentValue ?? 0)} — minimum to take it
                  is {formatMoney(minimum)}. If you&apos;ve ever led this country before under the same profile,
                  everything you paid in still counts as credit — no time limit — so you&apos;d owe less.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted">
                  Vacant — base price is {formatMoney(minimum)}. Past credit under your profile (if any) still
                  applies here too.
                </p>
              )
            ) : betaBlocked ? (
              <p className="mt-1 text-xs text-muted">
                Currently held by @{throne?.handle} — no takeovers during the free beta. Try again once it expires.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted">
                Vacant — <s className="text-muted-2">{formatMoney(minimum)}</s>{" "}
                <span className="font-medium text-accent">free during the beta</span>.
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-lg leading-none text-muted hover:text-foreground">
            ×
          </button>
        </div>

        {betaBlocked ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm bg-surface-hover px-4 py-2 text-sm font-medium text-foreground hover:brightness-110"
          >
            Close
          </button>
        ) : showIntroChoice ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">How are you claiming this one?</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setClaimIntent("reclaim")}
                className="flex flex-1 flex-col gap-1 rounded-md border border-accent/40 bg-accent/10 p-3 text-left transition-colors hover:bg-accent/20"
              >
                <span className="text-sm font-medium text-accent">I&apos;ve led this country before</span>
                <span className="text-xs text-muted">
                  Link the same profile you used previously and whatever you already paid for it counts as credit
                  automatically — no time limit.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setClaimIntent("new")}
                className="flex flex-1 flex-col gap-1 rounded-md border border-border bg-black/15 p-3 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="text-sm font-medium text-foreground">Claim as a new leader</span>
                <span className="text-xs text-muted">Starting fresh — same form either way, just no past credit to expect.</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {claimIntent === "reclaim" && (
              <p className="rounded-sm border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
                Link the same X/Instagram/TikTok/Facebook profile you led with before below — that&apos;s what your
                credit is tied to, not which post you show.
              </p>
            )}
            <p className="rounded-sm border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
              {PAYMENTS_ENABLED
                ? "Test mode — no real payment happens. This just records the claim for testing."
                : `Free during the beta. Claiming holds a country for ${BETA_HOLD_HOURS} hour — nobody can take it over until it expires. You can lead up to ${BETA_MAX_COUNTRIES_PER_USER} countries at once. This becomes a paid system later.`}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Leader identity — who's claiming, entirely separate from
                  the X post below. At least one platform is required; each
                  filled-in one is validated as a real profile URL for that
                  platform (not a post link, not another platform's URL). */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">Your identity</p>
                <p className="text-xs text-muted-2">
                  Link at least one profile of yours — this is who&apos;s shown as the leader.
                </p>
                {leaderFields.map((field) => {
                  const trimmed = field.value.trim();
                  const invalid = trimmed !== "" && !parseSocialUrl(field.platform, trimmed);
                  const def = SOCIAL_PLATFORMS.find((p) => p.platform === field.platform);
                  return (
                    <label key={field.platform} className="flex flex-col gap-1 text-sm">
                      <span className="flex items-center gap-1.5 text-muted">
                        <SocialPlatformIcon platform={field.platform} className="h-3.5 w-3.5" />
                        {def?.label}
                      </span>
                      <input
                        type="text"
                        value={field.value}
                        onChange={(event) => field.setValue(event.target.value)}
                        placeholder={def?.placeholder}
                        className={`rounded-sm border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-2 outline-none focus:border-accent ${
                          invalid ? "border-danger" : "border-border"
                        }`}
                      />
                      {invalid && <span className="text-xs text-danger">Not a {def?.label} profile URL.</span>}
                    </label>
                  );
                })}
                {filledLeaderFields.length === 0 && (
                  <p className="text-xs text-muted-2">At least one is required.</p>
                )}
              </div>

              {/* Content + Preview — any public X post, doesn't have to be
                  the leader's own. */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">Content</p>
                <p className="text-xs text-muted-2">
                  No direct photo upload — your image comes from a real X post. Post it (or find a public one you
                  want to use) and link it below; if it has a photo, you&apos;ll be able to position it on the map next.
                </p>

                {/* Optional shortcut — pull brand/description/logo from a
                    site or profile link instead of typing the three fields
                    below by hand. */}
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Auto-fill from your site/profile (optional)</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={linkUrl}
                      onChange={(event) => {
                        setLinkUrl(event.target.value);
                        setLinkFetchStatus("idle");
                      }}
                      placeholder="https://yoursite.com or https://x.com/you"
                      className="min-w-0 flex-1 rounded-sm border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-2 outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={handleFetchLinkInfo}
                      disabled={!linkUrl.trim() || linkFetchStatus === "loading"}
                      className="shrink-0 rounded-sm border border-accent/40 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {linkFetchStatus === "loading" ? "Fetching…" : "Fetch info"}
                    </button>
                  </div>
                  {linkFetchStatus === "error" && <span className="text-xs text-danger">{linkFetchError}</span>}
                  {linkFetchStatus === "ok" && (
                    <span className="text-xs text-muted-2">Brand/description/logo below filled in — edit anything before submitting.</span>
                  )}
                </label>

                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">X post to display — required, any public post</span>
                  <input
                    type="text"
                    required
                    value={tweetUrl}
                    onChange={(event) => setTweetUrl(event.target.value)}
                    placeholder="https://x.com/user/status/1234567890"
                    className="rounded-sm border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-2 outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Brand / title (optional)</span>
                  <input
                    type="text"
                    value={brandTitle}
                    onChange={(event) => setBrandTitle(event.target.value)}
                    className="rounded-sm border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Description or slogan (optional)</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    className="resize-none rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Logo image URL (optional)</span>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(event) => setLogoUrl(event.target.value)}
                    className="rounded-sm border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </label>

                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={!tweetUrl || previewStatus === "loading"}
                  className="self-start rounded-sm border border-accent/40 px-4 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {previewStatus === "loading" ? "Checking…" : "Preview"}
                </button>

                {previewStatus === "error" && <p className="text-xs text-danger">{previewError}</p>}
                {previewIsCurrent && preview && (
                  <div className="flex items-center gap-3 rounded-md border border-border bg-black/20 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview.authorAvatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {preview.authorName} <span className="text-muted-2">@{preview.authorHandle}</span>
                      </p>
                      <p className="truncate text-xs text-muted">{preview.text}</p>
                    </div>
                  </div>
                )}

                {/* Image positioning — only when the post actually has a
                    photo (a post with just text/a quote/a link has nothing
                    to crop, so the tool simply doesn't appear). */}
                {previewIsCurrent && preview && preview.imageUrls.length > 0 && countryPathD && countryBounds && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-foreground">Position on the map</p>
                    {preview.imageUrls.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {preview.imageUrls.map((url, index) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setSelectedImageIndex(index)}
                            aria-label={`Use photo ${index + 1}`}
                            aria-pressed={selectedImageIndex === index}
                            className={`h-14 w-14 shrink-0 overflow-hidden rounded-sm border-2 ${
                              selectedImageIndex === index ? "border-accent" : "border-transparent opacity-60 hover:opacity-100"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                    <ImagePositioner
                      imageUrl={preview.imageUrls[selectedImageIndex]}
                      countryPathD={countryPathD}
                      countryBounds={countryBounds}
                      value={imageCrop}
                      onChange={setImageCrop}
                      onNaturalSize={setImageNaturalSize}
                    />
                  </div>
                )}
              </div>

              {/* Offer — paid mode only; beta claims are free (see the
                  banner above), so there's nothing to bid. */}
              {PAYMENTS_ENABLED && (
                <div className={`flex flex-col gap-2 ${canSubmit ? "" : "pointer-events-none opacity-40"}`}>
                  <p className="text-sm font-medium text-foreground">Offer</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[minimum, minimum + 2, minimum + 5].map((amount, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setOfferedAmount(amount.toFixed(2))}
                        className="rounded-sm border border-border px-3 py-1 text-xs text-muted hover:bg-surface-hover"
                      >
                        {index === 0 ? "Minimum" : `+${index === 1 ? "2" : "5"}`} · {formatMoney(amount)}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    required
                    min={minimum}
                    step="0.01"
                    value={offeredAmount}
                    onChange={(event) => setOfferedAmount(event.target.value)}
                    className="rounded-sm border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                  <p className="text-xs text-muted-2">
                    Paying more raises the price others must pay to take your throne — the next bidder would need at
                    least {formatMoney(offered + 2)}.
                  </p>
                </div>
              )}

              {/* Rules */}
              <div className="flex flex-col gap-1 rounded-md border border-border bg-black/15 p-3 text-xs text-muted">
                {PAYMENTS_ENABLED ? (
                  <>
                    <p>• The throne lasts 1 week, starting from when it&apos;s first claimed.</p>
                    <p>• Taking it over requires at least the current value + $2 — no cap.</p>
                    <p>• Money you&apos;ve put into a country stands as credit toward reclaiming it later.</p>
                    <p>• When the week ends, the throne and any credit for that country reset.</p>
                    <p>• Your handle stays visible in past leaders permanently.</p>
                    <p>• There are no refunds.</p>
                  </>
                ) : (
                  <>
                    <p>• Free during the beta — no payment happens.</p>
                    <p>
                      • Claiming holds the country for {BETA_HOLD_HOURS} hour; nobody else can take it over during
                      that time.
                    </p>
                    <p>• You can lead up to {BETA_MAX_COUNTRIES_PER_USER} countries at once.</p>
                    <p>• Once the hour ends, the throne opens back up to everyone.</p>
                    <p>• Your handle stays visible in past leaders permanently.</p>
                    <p>• Content that breaks the rules can be removed at any time.</p>
                    <p>• This becomes a paid system later — see the Rules page for details.</p>
                  </>
                )}
              </div>

              {/* Confirm */}
              <label
                className={`flex items-start gap-2 text-xs text-muted ${canSubmit ? "" : "pointer-events-none opacity-40"}`}
              >
                <input
                  type="checkbox"
                  required
                  checked={acceptedRules}
                  onChange={(event) => setAcceptedRules(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  {PAYMENTS_ENABLED
                    ? "I understand the throne can be taken over, there are no refunds, and content that breaks the rules can be removed without a refund."
                    : "I understand this throne is free for now, held for one hour, and content that breaks the rules can be removed."}
                </span>
              </label>

              {submitError && (
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-danger">{submitError}</p>
                  {heldCountries && heldCountries.length > 0 && (
                    <p className="text-xs text-muted-2">Currently held: {heldCountries.join(", ")}</p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || !acceptedRules || submitting}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-hover disabled:text-muted ${CTA_CLASSES}`}
              >
                {submitting ? "Claiming…" : PAYMENTS_ENABLED ? `Claim for ${formatMoney(offered)}` : "Claim for free"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
