"use client";

import { useMemo } from "react";

import type { ThroneClaimHistoryEntry } from "@/lib/throne";
import Flag from "./Flag";

interface RecentVote {
  isoCode: string;
  createdAt: number;
}

interface LiveFeedProps {
  recentVotes: RecentVote[];
  claimHistory: ThroneClaimHistoryEntry[];
  countryNameByIso: Map<string, string>;
  now: number | null;
}

type FeedItem =
  | { key: string; type: "vote"; isoCode: string; countryName: string; createdAt: number }
  | { key: string; type: "throne"; isoCode: string; countryName: string; handle: string; amountPaid: number; createdAt: number };

const MAX_ITEMS = 8;

function formatRelative(deltaMs: number): string {
  const clamped = Math.max(0, deltaMs);
  const seconds = Math.floor(clamped / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// AŞAMA 6: "Ana sayfaya küçük bir canlı akış ekle: son verilen oylar ve
// son alınan tahtlar" — merges the two most recent-activity sources
// already available (momentum's recentVotes, see src/lib/momentum.ts, and
// the existing throne claim history) into one feed instead of fetching
// anything new.
export default function LiveFeed({ recentVotes, claimHistory, countryNameByIso, now }: LiveFeedProps) {
  const items = useMemo<FeedItem[]>(() => {
    const votes: FeedItem[] = recentVotes.map((vote) => ({
      key: `vote-${vote.isoCode}-${vote.createdAt}`,
      type: "vote",
      isoCode: vote.isoCode,
      countryName: countryNameByIso.get(vote.isoCode) ?? vote.isoCode,
      createdAt: vote.createdAt,
    }));
    const claims: FeedItem[] = claimHistory.slice(0, MAX_ITEMS).map((claim) => ({
      key: `throne-${claim.id}`,
      type: "throne",
      isoCode: claim.isoCode,
      countryName: countryNameByIso.get(claim.isoCode) ?? claim.isoCode,
      handle: claim.handle,
      amountPaid: claim.amountPaid,
      createdAt: claim.createdAt,
    }));
    return [...votes, ...claims].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_ITEMS);
  }, [recentVotes, claimHistory, countryNameByIso]);

  if (items.length === 0) return null;

  return (
    <section className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-success" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Live activity</h2>
      </div>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            <Flag alpha2={item.isoCode} width={18} />
            {item.type === "vote" ? (
              <span className="min-w-0 flex-1 truncate text-muted">
                <span className="font-medium text-foreground">{item.countryName}</span> just got a vote
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate text-muted">
                <span className="font-medium text-accent">@{item.handle}</span> claimed{" "}
                <span className="font-medium text-foreground">{item.countryName}</span>
                {item.amountPaid > 0 ? ` for $${item.amountPaid.toLocaleString("en-US")}` : " — free"}
              </span>
            )}
            <span className="shrink-0 font-mono text-xs text-muted-2">
              {now !== null ? formatRelative(now - item.createdAt) : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
