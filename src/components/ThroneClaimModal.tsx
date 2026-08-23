"use client";

import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import { BETA_HOLD_HOURS, BETA_MAX_COUNTRIES_PER_USER, PAYMENTS_ENABLED } from "@/lib/beta-mode";
import { getFingerprint } from "@/lib/fingerprint";
import { isVacant, requiredMinimum, type ThroneEntry } from "@/lib/throne";

interface ThroneClaimModalProps {
  isoCode: string;
  countryName: string;
  throne: ThroneEntry | undefined;
  onClose: () => void;
  onClaimed: () => void;
}

interface PreviewSnapshot {
  text: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  imageUrl: string | null;
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
export default function ThroneClaimModal({ isoCode, countryName, throne, onClose, onClaimed }: ThroneClaimModalProps) {
  const minimum = requiredMinimum(throne);
  // In beta mode a claim modal should only ever be opened for a vacant
  // country (see ThronePanel — occupied countries show no claim button
  // there), but two tabs can race, so this is a defensive fallback: show
  // the reason and nothing else rather than let a doomed submit happen.
  const betaBlocked = !PAYMENTS_ENABLED && !isVacant(throne);

  const [tweetUrl, setTweetUrl] = useState("");
  const [brandTitle, setBrandTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewSnapshot | null>(null);
  // What content the last successful preview covered — compared against the
  // current fields below (contentKey) so an edit after previewing
  // invalidates it, computed during render rather than via an effect.
  const [previewedFor, setPreviewedFor] = useState<string | null>(null);

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
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed.");
      setPreviewStatus("error");
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
          linkUrl: linkUrl || undefined,
          logoUrl: logoUrl || undefined,
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

  const canOffer = previewIsCurrent;
  const offered = Number(offeredAmount) || minimum;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-surface p-5"
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
                  is {formatMoney(minimum)}.
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted">Vacant — base price is {formatMoney(minimum)}.</p>
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
            className="rounded-full bg-surface-hover px-4 py-2 text-sm font-medium text-foreground hover:brightness-110"
          >
            Close
          </button>
        ) : (
          <>
            <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
              {PAYMENTS_ENABLED
                ? "Test mode — no real payment happens. This just records the claim for testing."
                : `Free during the beta. Claiming holds a country for ${BETA_HOLD_HOURS} hour — nobody can take it over until it expires. You can lead up to ${BETA_MAX_COUNTRIES_PER_USER} countries at once. This becomes a paid system later.`}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Content + Preview */}
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">Content</p>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Your X post URL — required</span>
                  <input
                    type="text"
                    required
                    value={tweetUrl}
                    onChange={(event) => setTweetUrl(event.target.value)}
                    placeholder="https://x.com/user/status/1234567890"
                    className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-2 outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Brand / title (optional)</span>
                  <input
                    type="text"
                    value={brandTitle}
                    onChange={(event) => setBrandTitle(event.target.value)}
                    className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Description or slogan (optional)</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    className="resize-none rounded-xl border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Website / X / Instagram link (optional)</span>
                  <input
                    type="text"
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Logo image URL (optional)</span>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(event) => setLogoUrl(event.target.value)}
                    className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                </label>

                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={!tweetUrl || previewStatus === "loading"}
                  className="self-start rounded-full border border-accent/40 px-4 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {previewStatus === "loading" ? "Checking…" : "Preview"}
                </button>

                {previewStatus === "error" && <p className="text-xs text-danger">{previewError}</p>}
                {previewIsCurrent && preview && (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-black/20 p-3">
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
              </div>

              {/* Offer — paid mode only; beta claims are free (see the
                  banner above), so there's nothing to bid. */}
              {PAYMENTS_ENABLED && (
                <div className={`flex flex-col gap-2 ${canOffer ? "" : "pointer-events-none opacity-40"}`}>
                  <p className="text-sm font-medium text-foreground">Offer</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[minimum, minimum + 2, minimum + 5].map((amount, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setOfferedAmount(amount.toFixed(2))}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:bg-surface-hover"
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
                    className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-accent"
                  />
                  <p className="text-xs text-muted-2">
                    Paying more raises the price others must pay to take your throne — the next bidder would need at
                    least {formatMoney(offered + 2)}.
                  </p>
                </div>
              )}

              {/* Rules */}
              <div className="flex flex-col gap-1 rounded-xl border border-border bg-black/15 p-3 text-xs text-muted">
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
                className={`flex items-start gap-2 text-xs text-muted ${canOffer ? "" : "pointer-events-none opacity-40"}`}
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
                disabled={!canOffer || !acceptedRules || submitting}
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-muted"
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
