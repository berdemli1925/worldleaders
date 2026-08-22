"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { getMockLeaderData, type MockLeader } from "@/lib/mock-leaders";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useVote } from "@/lib/use-vote";
import Leaderboard, { type LeaderboardEntry } from "./Leaderboard";
import LeaderTicker, { type TickerItem } from "./LeaderTicker";
import TopBar from "./TopBar";
import TurnstileWidget, { type TurnstileWidgetHandle } from "./TurnstileWidget";
import WorldMapInteractive, { type CountryPath } from "./WorldMapInteractive";

interface DashboardProps {
  countries: CountryPath[];
  width: number;
  height: number;
}

const VOTES_CHANNEL = "votes-updates";
const PRESENCE_CHANNEL = "online-visitors";
const HIGHLIGHT_DURATION_MS = 2200;

function nextUtcMidnight(from: number): number {
  const d = new Date(from);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export default function Dashboard({ countries, width, height }: DashboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [highlightedIso, setHighlightedIso] = useState<string | null>(null);
  const votesChannelRef = useRef<RealtimeChannel | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Single shared clock: every live countdown on the page (reset timer, per-
  // country "reign ends in") reads this instead of running its own
  // setInterval. Starts `null` and is only set inside an effect so the first
  // client render matches the server-rendered markup exactly — see
  // CountdownTimer.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    const { data, error } = await supabaseBrowser
      .from("leaderboard")
      .select("iso_code, name, continent, vote_count");
    if (error || !data) return;

    const mapped: LeaderboardEntry[] = data
      .map((row) => ({
        isoCode: row.iso_code as string,
        name: row.name as string,
        continent: row.continent as string,
        voteCount: row.vote_count as number,
      }))
      .sort((a, b) => b.voteCount - a.voteCount || a.name.localeCompare(b.name));
    setEntries(mapped);
  }, []);

  // Initial load. fetchLeaderboard is an async data-fetching call (setState
  // only happens after the network response, inside its own .then/promise
  // body) — same accepted pattern as the vote-status fetch in useVote; see
  // the comment there for why this needs silencing.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Broadcast channel: any client that just cast a vote tells everyone else
  // to refetch the leaderboard. No table data is sent over the wire — just a
  // "something changed" ping — so this needs no RLS/authorization setup.
  useEffect(() => {
    const channel = supabaseBrowser.channel(VOTES_CHANNEL);
    channel.on("broadcast", { event: "vote-cast" }, () => fetchLeaderboard()).subscribe();
    votesChannelRef.current = channel;
    return () => {
      supabaseBrowser.removeChannel(channel);
      votesChannelRef.current = null;
    };
  }, [fetchLeaderboard]);

  // Presence channel: every open tab tracks itself; the online count is just
  // the size of the resulting presence set. Ephemeral, not stored in Postgres.
  useEffect(() => {
    const presenceKey = Math.random().toString(36).slice(2);
    const channel = supabaseBrowser.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: presenceKey } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        setOnlineCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  const handleVoteCast = useCallback(() => {
    fetchLeaderboard();
    votesChannelRef.current?.send({ type: "broadcast", event: "vote-cast", payload: {} });
  }, [fetchLeaderboard]);

  const getTurnstileToken = useCallback(async () => {
    if (!turnstileSiteKey || !turnstileRef.current) return undefined;
    return turnstileRef.current.getToken();
  }, [turnstileSiteKey]);

  const { status: voteStatus, submittingIso, error: voteError, castVote } = useVote({
    getTurnstileToken,
    onVoteCast: handleVoteCast,
  });

  const totalVotes = useMemo(() => entries.reduce((sum, entry) => sum + entry.voteCount, 0), [entries]);
  const maxVotes = useMemo(() => Math.max(1, ...entries.map((entry) => entry.voteCount)), [entries]);
  const voteCounts = useMemo(() => new Map(entries.map((entry) => [entry.isoCode, entry.voteCount])), [entries]);
  const resetTarget = useMemo(() => (now !== null ? nextUtcMidnight(now) : null), [now]);

  const tickerItems = useMemo<TickerItem[]>(() => {
    return entries
      .map((entry) => ({ entry, leader: getMockLeaderData(entry.isoCode).leader }))
      .filter((row): row is { entry: LeaderboardEntry; leader: MockLeader } => row.leader !== null)
      .sort((a, b) => b.leader.amountPaid - a.leader.amountPaid)
      .slice(0, 24)
      .map(({ entry, leader }) => ({
        isoCode: entry.isoCode,
        countryName: entry.name,
        handle: leader.handle,
        amountPaid: leader.amountPaid,
      }));
  }, [entries]);

  const handleTickerSelect = useCallback((isoCode: string) => {
    setHighlightedIso(isoCode);
    document.getElementById(`country-${isoCode}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlightedIso((current) => (current === isoCode ? null : current)), HIGHLIGHT_DURATION_MS);
  }, []);

  return (
    <div className="flex w-full flex-col gap-6 pb-16">
      {turnstileSiteKey && <TurnstileWidget ref={turnstileRef} siteKey={turnstileSiteKey} />}
      <TopBar totalVotes={totalVotes} onlineCount={onlineCount} resetTarget={resetTarget} now={now} />
      <div className="w-full rounded-2xl border border-border bg-surface p-4">
        <WorldMapInteractive
          countries={countries}
          width={width}
          height={height}
          voteCounts={voteCounts}
          maxVotes={maxVotes}
          voteStatus={voteStatus}
          submittingIso={submittingIso}
          voteError={voteError}
          onVote={castVote}
        />
      </div>
      <Leaderboard
        entries={entries}
        totalVotes={totalVotes}
        now={now}
        voteStatus={voteStatus}
        submittingIso={submittingIso}
        voteError={voteError}
        onVote={castVote}
        highlightedIso={highlightedIso}
      />
      <LeaderTicker items={tickerItems} onSelect={handleTickerSelect} />
    </div>
  );
}
