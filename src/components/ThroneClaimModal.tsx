"use client";

import { useState } from "react";

import { requiredMinimum, type ThroneEntry } from "@/lib/throne";

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
// covers. The Offer/Confirm sections stay disabled until a successful
// Preview response, which is what makes "Preview yapılmadan ödeme aktif
// olmaz" true here; the actual integrity guarantee is server-side
// (/api/throne/claim re-fetches and re-checks everything independently).
export default function ThroneClaimModal({ isoCode, countryName, throne, onClose, onClaimed }: ThroneClaimModalProps) {
  const minimum = requiredMinimum(throne);

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
    try {
      const amount = Number(offeredAmount);
      if (!Number.isFinite(amount) || amount < minimum) {
        throw new Error(`Offer must be at least ${formatMoney(minimum)}.`);
      }
      const res = await fetch("/api/throne/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryIsoCode: isoCode,
          tweetUrl,
          offeredAmount: amount,
          brandTitle: brandTitle || undefined,
          description: description || undefined,
          linkUrl: linkUrl || undefined,
          logoUrl: logoUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Claim failed.");
      onClaimed();
      onClose();
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
            {throne?.currentValue !== null && throne?.handle ? (
              <p className="mt-1 text-xs text-muted">
                Currently held by @{throne.handle} for {formatMoney(throne.currentValue ?? 0)} — minimum to take it is{" "}
                {formatMoney(minimum)}.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted">Vacant — base price is {formatMoney(minimum)}.</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-lg leading-none text-muted hover:text-foreground">
            ×
          </button>
        </div>

        <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
          Test mode — no real payment happens. This just records the claim for testing.
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

          {/* Offer */}
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
              Paying more raises the price others must pay to take your throne — the next bidder would need at least{" "}
              {formatMoney(offered + 2)}.
            </p>
          </div>

          {/* Rules */}
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-black/15 p-3 text-xs text-muted">
            <p>• The throne lasts 1 week, starting from when it&apos;s first claimed.</p>
            <p>• Taking it over requires at least the current value + $2 — no cap.</p>
            <p>• Money you&apos;ve put into a country stands as credit toward reclaiming it later.</p>
            <p>• When the week ends, the throne and any credit for that country reset.</p>
            <p>• Your handle stays visible in past leaders permanently.</p>
            <p>• There are no refunds.</p>
          </div>

          {/* Confirm */}
          <label className={`flex items-start gap-2 text-xs text-muted ${canOffer ? "" : "pointer-events-none opacity-40"}`}>
            <input
              type="checkbox"
              required
              checked={acceptedRules}
              onChange={(event) => setAcceptedRules(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              I understand the throne can be taken over, there are no refunds, and content that breaks the rules can
              be removed without a refund.
            </span>
          </label>

          {submitError && <p className="text-xs text-danger">{submitError}</p>}

          <button
            type="submit"
            disabled={!canOffer || !acceptedRules || submitting}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-hover disabled:text-muted"
          >
            {submitting ? "Claiming…" : `Claim for ${formatMoney(offered)}`}
          </button>
        </form>
      </div>
    </div>
  );
}
