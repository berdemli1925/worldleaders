"use client";

import { useState } from "react";

import { PAYMENTS_ENABLED } from "@/lib/beta-mode";
import { isHypeActive, type HypeEntry } from "@/lib/hype";
import { isVacant, requiredMinimum, type ThroneClaimHistoryEntry, type ThroneEntry } from "@/lib/throne";
import ClaimThroneButton from "./ClaimThroneButton";
import CountdownTimer from "./CountdownTimer";
import CroppedLeaderImage from "./CroppedLeaderImage";
import HypeModal from "./HypeModal";
import LeaderIdentityBadges from "./LeaderIdentityBadges";
import ReportButton from "./ReportButton";

interface ThronePanelProps {
  isoCode: string;
  countryName: string;
  throne: ThroneEntry | undefined;
  /** Full claim history across all countries — filtered to this one internally. */
  claimHistory: ThroneClaimHistoryEntry[];
  now: number | null;
  onOpenClaim: () => void;
  /** Current global hype state (see src/lib/hype.ts) — only used here to know whether *this* country already holds the spotlight, for the Hype button's label. */
  hype: HypeEntry | null;
  onHyped: () => void;
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

// A past claim's amount is 0 only when it was made during the free beta
// (see src/lib/beta-mode.ts / claim_throne_beta) — paid-mode's minimum is
// always > 0, so this is an unambiguous signal regardless of which mode is
// active right now.
function formatPastAmount(amount: number): string {
  return amount > 0 ? formatMoney(amount) : "Free";
}

// The "who leads this country, and how to take it over" block — shared by
// the leaderboard's expandable cards (Leaderboard.tsx) and the map's
// country side panel (WorldMapInteractive.tsx) so both show the exact same
// leader info/claim button instead of two copies drifting apart.
//
// Direct request: match memleket.lol's "[City] Ağası" nested card —
// a distinctly bordered box labeled with a crown + country name, a square
// brand icon next to bold name + truncated description, price and the
// takeover button on one row, and a "previous leaders" section that shows
// just the most recent one collapsed with a "Show all (N)" toggle rather
// than a wall of chips.
export default function ThronePanel({
  isoCode,
  countryName,
  throne,
  claimHistory,
  now,
  onOpenClaim,
  hype,
  onHyped,
}: ThronePanelProps) {
  const hasLeader = !isVacant(throne);
  const pastClaims = claimHistory.filter((claim) => claim.isoCode === isoCode && claim.id !== throne?.currentClaimId);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [hypeModalOpen, setHypeModalOpen] = useState(false);
  const isHypedNow = isHypeActive(hype, now) && hype?.isoCode === isoCode;
  // The tall post photo (see h-80 below) is the single biggest thing in
  // this card — direct request: let it collapse instead of always eating
  // that much vertical space. Defaults open (unchanged behavior); once
  // someone collapses it, it stays collapsed only for this render of the
  // panel (no persistence — reopening the map panel/switching countries
  // resets it, same as historyExpanded above).
  const [photoExpanded, setPhotoExpanded] = useState(true);
  const visiblePastClaims = historyExpanded ? pastClaims : pastClaims.slice(0, 1);

  return (
    <div className="flex flex-col gap-3 border-2 border-cta-border/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-cta-border">
          <span aria-hidden="true">👑</span>
          {countryName} Throne
        </p>
        {hasLeader && throne && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-2">Reign ends in</p>
            <CountdownTimer target={throne.cycleEnd ?? 0} now={now} className="font-mono text-xs text-foreground" />
          </div>
        )}
      </div>

      {hasLeader && throne ? (
        <>
          {throne.postImageUrl && (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setPhotoExpanded((expanded) => !expanded)}
                className="self-start text-[11px] uppercase tracking-wide text-accent hover:underline"
              >
                {photoExpanded ? "Hide photo ▲" : "Show photo ▼"}
              </button>
              {photoExpanded && (
                <CroppedLeaderImage
                  imageUrl={throne.postImageUrl}
                  imageWidth={throne.postImageWidth}
                  imageHeight={throne.postImageHeight}
                  scale={throne.postImageScale}
                  offsetX={throne.postImageOffsetX}
                  offsetY={throne.postImageOffsetY}
                  className="h-80 w-full rounded-sm"
                />
              )}
            </div>
          )}

          {/* Brand row — square logo (not a circular avatar; deliberately
              matches the memleket.lol reference's icon shape) + bold
              name + truncated description, the way a sponsor card reads
              at a glance rather than a personal profile. */}
          <div className="flex items-start gap-2.5">
            {throne.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={throne.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-sm object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <LeaderIdentityBadges
                  xUrl={throne.leaderXUrl}
                  instagramUrl={throne.leaderInstagramUrl}
                  tiktokUrl={throne.leaderTiktokUrl}
                  facebookUrl={throne.leaderFacebookUrl}
                  brandTitle={throne.brandTitle}
                />
                {!PAYMENTS_ENABLED && (
                  <span className="rounded-sm bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                    Free (beta)
                  </span>
                )}
                <ReportButton throneClaimId={throne.currentClaimId ?? 0} compact />
              </div>
              {throne.description ? (
                <p className="line-clamp-2 text-xs text-muted">{throne.description}</p>
              ) : throne.postText ? (
                <p className="line-clamp-2 text-xs italic text-muted">&ldquo;{throne.postText}&rdquo;</p>
              ) : null}
              {!throne.leaderXUrl &&
                !throne.leaderInstagramUrl &&
                !throne.leaderTiktokUrl &&
                !throne.leaderFacebookUrl &&
                throne.linkUrl && (
                  <a
                    href={throne.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-xs text-muted-2 hover:text-accent"
                  >
                    {throne.linkUrl}
                  </a>
                )}
              {throne.postText && (
                <a
                  href={`https://x.com/${throne.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-[11px] text-muted-2 hover:text-accent"
                >
                  Post shown via @{throne.handle} on X
                </a>
              )}
            </div>
          </div>

          {/* Price + takeover — the memleket-style "$103 · Devral $104" row. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="border border-border px-3 py-1.5 font-mono text-sm text-foreground">
              {formatMoney(throne.currentValue ?? 0)}
            </span>
            <div className="flex items-center gap-2">
              {/* Only the country's own throne panel gets this — hyping
                  puts *this* claim in the one spotlight above the map for
                  a few hours, regardless of vote rank. Server-side (beta
                  mode) checks the browser's fingerprint against this
                  claim's own, so it can't be used to hype someone else's
                  country — see /api/hype/claim. */}
              <button
                type="button"
                onClick={() => setHypeModalOpen(true)}
                className="border border-cta-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-cta-border transition-colors hover:bg-cta-border/10 sm:text-sm"
              >
                🔥 {isHypedNow ? "Extend hype" : "Hype"}
              </button>
              <ClaimThroneButton throne={throne} onOpenClaim={onOpenClaim} className="px-4 py-2 text-xs sm:text-sm" />
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {PAYMENTS_ENABLED ? (
            <p className="text-sm text-muted-2">No leader yet — base price {formatMoney(requiredMinimum(throne))}</p>
          ) : (
            <p className="text-sm text-muted-2">
              No leader yet — <s className="text-muted-2">{formatMoney(requiredMinimum(throne))}</s>{" "}
              <span className="font-medium text-accent">Free during beta</span>
            </p>
          )}
          <ClaimThroneButton throne={throne} onOpenClaim={onOpenClaim} />
        </div>
      )}

      {pastClaims.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-2">Previous leaders</p>
          {visiblePastClaims.map((past) => (
            <p key={past.id} className="flex items-center justify-between text-xs text-muted">
              <span>@{past.handle}</span>
              <span className="font-mono">{formatPastAmount(past.amountPaid)}</span>
            </p>
          ))}
          {!historyExpanded && pastClaims.length > 1 && (
            <button
              type="button"
              onClick={() => setHistoryExpanded(true)}
              className="self-start text-[11px] text-accent hover:underline"
            >
              Show all ({pastClaims.length})
            </button>
          )}
        </div>
      )}

      {hypeModalOpen && throne && (
        <HypeModal
          isoCode={isoCode}
          countryName={countryName}
          hype={hype}
          now={now}
          onClose={() => setHypeModalOpen(false)}
          onHyped={onHyped}
        />
      )}
    </div>
  );
}
