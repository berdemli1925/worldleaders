"use client";

import { useState } from "react";

import {
  buildShareText,
  countryShareUrl,
  openShareWindow,
  telegramShareUrl,
  whatsappShareUrl,
  xIntentUrl,
} from "@/lib/share";
import Flag from "./Flag";

export interface VoteResult {
  isoCode: string;
  countryName: string;
  newRank: number;
  newVoteCount: number;
  /** Starting score + votes (AŞAMA 5) — what the rival gap below is actually measured in. */
  newTotalPower: number;
  /** Rank before this vote — undefined if unknown (first load) or unchanged from newRank means no movement to call out. */
  prevRank?: number;
  /** How much this vote actually added — 0 for a same-country revote (already voted today), which the API no-ops. */
  voteDelta: number;
  rival: {
    isoCode: string;
    name: string;
    totalPower: number;
    direction: "ahead" | "behind";
  } | null;
}

interface VoteResultModalProps {
  result: VoteResult;
  onClose: () => void;
}

// The result screen shown right after a vote — AŞAMA 2: "oy vermek şu an
// sessiz bir işlem, olay olmalı" (voting is currently silent, it should feel
// like an event). Dismissible, never blocks the rest of the page.
export default function VoteResultModal({ result, onClose }: VoteResultModalProps) {
  const [copied, setCopied] = useState(false);
  const { isoCode, countryName, newRank, newVoteCount, newTotalPower, prevRank, voteDelta, rival } = result;

  const moved = prevRank !== undefined && prevRank !== newRank;
  const movedUp = moved && prevRank! > newRank;

  const shareText = buildShareText(countryName, newRank);
  const shareUrl = countryShareUrl(isoCode);
  const shareImage = `/api/og/country/${isoCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — non-fatal, the link is still visible
      // via the other share buttons.
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Vote result"
    >
      <div
        className="w-full max-w-sm animate-[pop-in_280ms_ease-out] rounded-2xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Flag alpha2={isoCode} width={32} />
            <div>
              <p className="text-xs text-muted">
                You just moved <span className="font-medium text-foreground">{countryName}</span>
              </p>
              <p className="font-mono text-lg font-bold text-accent">
                {voteDelta > 0 ? `+${voteDelta}` : "Already voted"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-lg leading-none text-muted hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-black/20 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-2">Now ranked</p>
            <p className="font-mono text-2xl font-bold text-foreground">#{newRank}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-2">Total votes</p>
            <p className="font-mono text-xl font-semibold text-foreground">
              {newVoteCount.toLocaleString("en-US")}
            </p>
          </div>
        </div>

        {moved && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-center text-sm font-medium ${
              movedUp ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
            }`}
          >
            {countryName} moved {movedUp ? "up" : "down"} to #{newRank}
          </p>
        )}

        {rival && (
          <p className="mt-3 text-center text-sm text-muted">
            <span className="font-medium text-foreground">{rival.name}</span> is only{" "}
            <span className="font-mono font-semibold text-foreground">
              {Math.abs(rival.totalPower - newTotalPower).toLocaleString("en-US")}
            </span>{" "}
            points {rival.direction}
          </p>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shareImage}
          alt={`${countryName} share card`}
          width={1200}
          height={630}
          className="mt-4 w-full rounded-xl border border-border"
        />

        <div className="mt-4 grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => openShareWindow(xIntentUrl(shareText, shareUrl))}
            aria-label="Share on X"
            className="flex flex-col items-center gap-1 rounded-xl border border-border py-2.5 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-[10px]">X</span>
          </button>
          <button
            type="button"
            onClick={() => openShareWindow(whatsappShareUrl(shareText, shareUrl))}
            aria-label="Share on WhatsApp"
            className="flex flex-col items-center gap-1 rounded-xl border border-border py-2.5 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
              <path d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.762.462 3.484 1.34 5.002L2 22.003l5.117-1.342a9.96 9.96 0 004.887 1.244h.004c5.514 0 9.996-4.483 9.996-9.997 0-2.67-1.04-5.18-2.929-7.069a9.933 9.933 0 00-7.07-2.836zm0 18.174h-.003a8.163 8.163 0 01-4.166-1.14l-.299-.177-3.037.796.81-2.96-.194-.304a8.16 8.16 0 01-1.254-4.393c0-4.517 3.677-8.194 8.196-8.194a8.14 8.14 0 015.795 2.402 8.14 8.14 0 012.398 5.796c0 4.518-3.677 8.174-8.246 8.174z" />
            </svg>
            <span className="text-[10px]">WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={() => openShareWindow(telegramShareUrl(shareText, shareUrl))}
            aria-label="Share on Telegram"
            className="flex flex-col items-center gap-1 rounded-xl border border-border py-2.5 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
              <path d="M21.998 4.42a1.99 1.99 0 00-.855.21L2.6 11.44c-1.31.512-1.3 1.226-.24 1.548l4.716 1.47 1.813 5.516c.226.605.39.842.798.842.362 0 .524-.166.727-.365l1.734-1.69 4.634 3.415c.855.472 1.474.228 1.688-.792l3.06-14.42c.303-1.24-.474-1.8-1.532-1.545z" />
            </svg>
            <span className="text-[10px]">Telegram</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy link"
            className="flex flex-col items-center gap-1 rounded-xl border border-border py-2.5 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="9" y="9" width="12" height="12" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            <span className="text-[10px]">{copied ? "Copied!" : "Copy"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
