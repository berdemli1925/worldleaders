"use client";

import { getCountryMeta } from "@/lib/country-meta";
import { isHypeActive, type HypeEntry } from "@/lib/hype";
import { twitterImageVariant } from "@/lib/twitter-image";
import CountdownTimer from "./CountdownTimer";
import Flag from "./Flag";
import LeaderIdentityBadges from "./LeaderIdentityBadges";

interface HypeBannerProps {
  hype: HypeEntry | null;
  now: number | null;
  onSelectCountry: (isoCode: string) => void;
}

// Direct request: a "hype" spotlight above the map — a country's current
// throne holder can pay to put their country (and whatever's already on
// their throne card) here for 3 hours regardless of vote rank, so it isn't
// only ever the #1 country that gets this kind of prominence. Renders
// nothing when nobody's hyping right now — see isHypeActive — rather than
// an empty placeholder box.
export default function HypeBanner({ hype, now, onSelectCountry }: HypeBannerProps) {
  if (!isHypeActive(hype, now) || !hype) return null;

  const meta = getCountryMeta(hype.isoCode);
  const image = hype.postImageUrl ? twitterImageVariant(hype.postImageUrl, "small") : null;

  return (
    <button
      type="button"
      onClick={() => onSelectCountry(hype.isoCode)}
      className="flex w-full items-center gap-3 border-2 border-cta-border bg-cta-bg p-3 text-left transition-colors hover:border-danger"
    >
      <span aria-hidden="true" className="shrink-0 text-2xl leading-none">
        🔥
      </span>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-14 w-14 shrink-0 rounded-sm border border-cta-border object-cover" />
      )}
      <Flag alpha2={hype.isoCode} width={40} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-cta-text">
          Hyped now — {meta?.name ?? hype.isoCode}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <LeaderIdentityBadges
            xUrl={hype.leaderXUrl}
            instagramUrl={hype.leaderInstagramUrl}
            tiktokUrl={hype.leaderTiktokUrl}
            facebookUrl={hype.leaderFacebookUrl}
            brandTitle={hype.brandTitle}
          />
        </div>
        {(hype.description || hype.postText) && (
          <p className="line-clamp-1 text-xs text-muted">{hype.description || hype.postText}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] uppercase tracking-wide text-cta-text/70">Ends in</p>
        <CountdownTimer target={hype.cycleEnd ?? 0} now={now} className="font-mono text-xs text-cta-text" />
      </div>
    </button>
  );
}
