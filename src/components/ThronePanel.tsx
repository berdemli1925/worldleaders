"use client";

import { PAYMENTS_ENABLED } from "@/lib/beta-mode";
import { isVacant, requiredMinimum, type ThroneClaimHistoryEntry, type ThroneEntry } from "@/lib/throne";
import ClaimThroneButton from "./ClaimThroneButton";
import CountdownTimer from "./CountdownTimer";
import CroppedLeaderImage from "./CroppedLeaderImage";
import LeaderIdentityBadges from "./LeaderIdentityBadges";
import ReportButton from "./ReportButton";

interface ThronePanelProps {
  isoCode: string;
  throne: ThroneEntry | undefined;
  /** Full claim history across all countries — filtered to this one internally. */
  claimHistory: ThroneClaimHistoryEntry[];
  now: number | null;
  onOpenClaim: () => void;
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
export default function ThronePanel({ isoCode, throne, claimHistory, now, onOpenClaim }: ThronePanelProps) {
  const hasLeader = !isVacant(throne);
  const pastClaims = claimHistory.filter((claim) => claim.isoCode === isoCode && claim.id !== throne?.currentClaimId);
  const visibleHistory = pastClaims.slice(0, 5);
  const extraHistory = pastClaims.length - visibleHistory.length;

  return (
    <div className="flex flex-col gap-3">
      {hasLeader && throne ? (
        <>
          {throne.postImageUrl && (
            <CroppedLeaderImage
              imageUrl={throne.postImageUrl}
              imageWidth={throne.postImageWidth}
              imageHeight={throne.postImageHeight}
              scale={throne.postImageScale}
              offsetX={throne.postImageOffsetX}
              offsetY={throne.postImageOffsetY}
              className="h-56 w-full rounded-md"
            />
          )}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              {/* Leader — who's claiming, kept visually separate from the
                  post content below since they can be different people
                  (see LeaderIdentityBadges.tsx). */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                {throne.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={throne.logoUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
                )}
                <LeaderIdentityBadges
                  xUrl={throne.leaderXUrl}
                  instagramUrl={throne.leaderInstagramUrl}
                  tiktokUrl={throne.leaderTiktokUrl}
                  facebookUrl={throne.leaderFacebookUrl}
                  brandTitle={throne.brandTitle}
                />
                {PAYMENTS_ENABLED ? (
                  <>
                    <span className="text-muted-2">paid</span>
                    <span className="font-mono font-medium text-accent">{formatMoney(throne.currentValue ?? 0)}</span>
                  </>
                ) : (
                  <span className="rounded-sm bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                    Free (beta)
                  </span>
                )}
                <ReportButton throneClaimId={throne.currentClaimId ?? 0} compact />
              </div>
              {/* Content — the linked X post, shown separately since it
                  isn't necessarily the leader's own post. */}
              {throne.postText && (
                <div className="flex flex-col gap-0.5">
                  <a
                    href={`https://x.com/${throne.handle}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-muted-2 hover:text-accent"
                  >
                    Post shown via @{throne.handle} on X
                  </a>
                  <p className="border-l-2 border-border pl-2 text-xs italic text-muted">&ldquo;{throne.postText}&rdquo;</p>
                </div>
              )}
              {throne.description && <p className="text-xs text-muted">{throne.description}</p>}
              {!throne.leaderXUrl && !throne.leaderInstagramUrl && !throne.leaderTiktokUrl && !throne.leaderFacebookUrl && throne.linkUrl && (
                <a
                  href={throne.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-xs text-muted-2 hover:text-accent"
                >
                  {throne.linkUrl}
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[11px] text-muted-2">Reign ends in</p>
                <CountdownTimer target={throne.cycleEnd ?? 0} now={now} className="font-mono text-sm text-foreground" />
              </div>
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

      {visibleHistory.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {visibleHistory.map((past) => (
            <span key={past.id} className="rounded-sm bg-white/5 px-2 py-1 text-[11px] text-muted">
              @{past.handle} · {formatPastAmount(past.amountPaid)}
            </span>
          ))}
          {extraHistory > 0 && <span className="px-1 text-[11px] text-muted-2">History (+{extraHistory})</span>}
        </div>
      )}
    </div>
  );
}
