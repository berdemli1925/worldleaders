"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import type { SerializedMomentum } from "@/lib/momentum";
import { toRankedEntries } from "@/lib/rank";
import { supabaseBrowser } from "@/lib/supabase/client";
import { mapThroneRow, type ThroneClaimHistoryEntry, type ThroneEntry, type ThroneRow } from "@/lib/throne";
import { useVote } from "@/lib/use-vote";
import ClosestBattles from "./ClosestBattles";
import Hero from "./Hero";
import Leaderboard, { type LeaderboardEntry } from "./Leaderboard";
import LeaderTicker, { type TickerItem } from "./LeaderTicker";
import TopBar from "./TopBar";
import TurnstileWidget, { type TurnstileWidgetHandle } from "./TurnstileWidget";
import VoteResultModal, { type VoteResult } from "./VoteResultModal";
import WorldMapInteractive, { type CountryPath, type WorldMapHandle } from "./WorldMapInteractive";

interface DashboardProps {
  countries: CountryPath[];
  width: number;
  height: number;
  /** ISO code to scroll-to and expand once the leaderboard has loaded — see WorldMap.tsx. */
  initialHighlightIso?: string;
  /** IP-based country guess for the hero's "Your country" line — see src/lib/geo.ts. */
  guessCountryIso?: string;
}

const VOTES_CHANNEL = "votes-updates";
const THRONES_CHANNEL = "thrones-updates";
const PRESENCE_CHANNEL = "online-visitors";
const HIGHLIGHT_DURATION_MS = 2200;

function nextUtcMidnight(from: number): number {
  const d = new Date(from);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export default function Dashboard({ countries, width, height, initialHighlightIso, guessCountryIso }: DashboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [allTimeEntries, setAllTimeEntries] = useState<LeaderboardEntry[]>([]);
  const [thrones, setThrones] = useState<ThroneEntry[]>([]);
  const [claimHistory, setClaimHistory] = useState<ThroneClaimHistoryEntry[]>([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [highlightedIso, setHighlightedIso] = useState<string | null>(null);
  const votesChannelRef = useRef<RealtimeChannel | null>(null);
  const thronesChannelRef = useRef<RealtimeChannel | null>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const mapRef = useRef<WorldMapHandle>(null);
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

  // Shared by both rankings below — "leaderboard" (this UTC month, the main
  // ranking) and "leaderboard_all_time" (cumulative, backs the "All time"
  // tab) are two Supabase views with the identical column shape, differing
  // only in whether vote_count is date-scoped. See scripts/setup-monthly-archive.mjs.
  // toRankedEntries (AŞAMA 5) adds each country's starting score and sorts
  // by total power, not raw votes — see src/lib/rank.ts.
  const fetchRanking = useCallback(async (view: "leaderboard" | "leaderboard_all_time") => {
    const { data, error } = await supabaseBrowser.from(view).select("iso_code, name, continent, vote_count");
    if (error || !data) return null;

    return toRankedEntries(
      (data as { iso_code: string; name: string; continent: string; vote_count: number }[]).map((row) => ({
        isoCode: row.iso_code,
        name: row.name,
        continent: row.continent,
        voteCount: row.vote_count,
      })),
    );
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    const [month, allTime] = await Promise.all([
      fetchRanking("leaderboard"),
      fetchRanking("leaderboard_all_time"),
    ]);
    if (month) setEntries(month);
    if (allTime) setAllTimeEntries(allTime);
    // Returned (not just set as state) so callers that need the *freshly
    // fetched* ranking right away — see handleVoteCast below — don't have
    // to wait an extra render for `entries` state to catch up.
    return month;
  }, [fetchRanking]);

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

  // thrones_with_leader (current state, one row per country) and
  // throne_claims_public (full history, for the "past leaders" badges) —
  // see scripts/setup-throne-system.mjs for both views' shapes.
  const fetchThrones = useCallback(async () => {
    const [{ data: throneRows, error: throneError }, { data: claimRows, error: claimError }] = await Promise.all([
      supabaseBrowser
        .from("thrones_with_leader")
        .select(
          "country_iso_code, base_price, current_value, current_claim_id, cycle_start, cycle_end, x_handle, amount_paid, post_text, post_author_name, post_author_avatar_url, post_image_url, post_created_at, brand_title, description, link_url, logo_url, claimed_at, post_image_width, post_image_height, post_image_scale, post_image_offset_x, post_image_offset_y, leader_x_url, leader_instagram_url, leader_tiktok_url, leader_facebook_url",
        ),
      supabaseBrowser
        .from("throne_claims_public")
        .select("id, country_iso_code, x_handle, amount_paid, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    if (!throneError && throneRows) {
      setThrones((throneRows as ThroneRow[]).map(mapThroneRow));
    }

    if (!claimError && claimRows) {
      setClaimHistory(
        claimRows.map((row) => ({
          id: row.id as number,
          isoCode: row.country_iso_code as string,
          handle: row.x_handle as string,
          amountPaid: row.amount_paid as number,
          createdAt: new Date(row.created_at as string).getTime(),
        })),
      );
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchThrones();
  }, [fetchThrones]);

  // Same broadcast-ping pattern as VOTES_CHANNEL — ThroneClaimForm sends
  // this after a successful claim so every open tab refetches.
  useEffect(() => {
    const channel = supabaseBrowser.channel(THRONES_CHANNEL);
    channel.on("broadcast", { event: "throne-claimed" }, () => fetchThrones()).subscribe();
    thronesChannelRef.current = channel;
    return () => {
      supabaseBrowser.removeChannel(channel);
      thronesChannelRef.current = null;
    };
  }, [fetchThrones]);

  const handleThroneClaimed = useCallback(() => {
    fetchThrones();
    thronesChannelRef.current?.send({ type: "broadcast", event: "throne-claimed", payload: {} });
  }, [fetchThrones]);

  // AŞAMA 4 momentum data (24h/7d rank snapshots) — polled rather than
  // pushed over realtime like votes/thrones above: it's derived from a full
  // scan of this month's votes (see src/lib/momentum.ts), too heavy to
  // recompute on every single vote broadcast, and "biggest climbers this
  // week" doesn't need second-level freshness anyway.
  const [momentum, setMomentum] = useState<SerializedMomentum | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/momentum");
        const data = await res.json();
        if (!cancelled && !data?.error) setMomentum(data);
      } catch {
        // Non-fatal — rank-change arrows/tabs just stay hidden until the
        // next successful poll.
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

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

  // Snapshot of the vote in flight — rank/votes *before* it lands — so
  // handleVoteCast below can diff against the freshly-fetched ranking and
  // build the AŞAMA 2 result screen ("Turkey moved up to #4", nearest
  // rival, …). A ref, not state: it's write-then-read-once bookkeeping for
  // a single async round trip, not something that should trigger a render.
  const pendingVoteRef = useRef<{ isoCode: string; prevRank: number | undefined; prevVoteCount: number } | null>(
    null,
  );
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null);

  const handleVoteCast = useCallback(async () => {
    const fresh = await fetchLeaderboard();
    votesChannelRef.current?.send({ type: "broadcast", event: "vote-cast", payload: {} });

    const pending = pendingVoteRef.current;
    pendingVoteRef.current = null;
    if (!pending || !fresh) return;

    const newIndex = fresh.findIndex((entry) => entry.isoCode === pending.isoCode);
    const newEntry = newIndex >= 0 ? fresh[newIndex] : undefined;
    if (!newEntry) return;
    const newRank = newIndex + 1;

    // Nearest rival: whoever's immediately above in rank (the one worth
    // catching), or — if this country is already #1 — whoever's immediately
    // below (the one worth watching). Gap is in total power (AŞAMA 5),
    // matching what actually separates their ranks — see VoteResultModal.
    const rivalEntry = newIndex > 0 ? fresh[newIndex - 1] : fresh[newIndex + 1];
    const rival = rivalEntry
      ? {
          isoCode: rivalEntry.isoCode,
          name: rivalEntry.name,
          totalPower: rivalEntry.totalPower,
          direction: (newIndex > 0 ? "ahead" : "behind") as "ahead" | "behind",
        }
      : null;

    setVoteResult({
      isoCode: pending.isoCode,
      countryName: newEntry.name,
      newRank,
      newVoteCount: newEntry.voteCount,
      newTotalPower: newEntry.totalPower,
      prevRank: pending.prevRank,
      voteDelta: newEntry.voteCount - pending.prevVoteCount,
      rival,
    });
  }, [fetchLeaderboard]);

  const getTurnstileToken = useCallback(async () => {
    if (!turnstileSiteKey || !turnstileRef.current) return undefined;
    return turnstileRef.current.getToken();
  }, [turnstileSiteKey]);

  const { status: voteStatus, submittingIso, error: voteError, castVote } = useVote({
    getTurnstileToken,
    onVoteCast: handleVoteCast,
  });

  // Wraps castVote so every entry point (hero, map panel, leaderboard rows)
  // snapshots "where this country stood" right before the vote lands —
  // castVote itself has no rank/vote-count context, only an ISO code.
  // `entries` is already sorted desc by vote count (see fetchRanking), so
  // rank is just its index.
  const castVoteWithResult = useCallback(
    (isoCode: string) => {
      const index = entries.findIndex((entry) => entry.isoCode === isoCode);
      pendingVoteRef.current = {
        isoCode,
        prevRank: index >= 0 ? index + 1 : undefined,
        prevVoteCount: index >= 0 ? entries[index].voteCount : 0,
      };
      castVote(isoCode);
    },
    [castVote, entries],
  );

  // Real votes only — the top stat bar and the map hover tooltip's "N
  // votes" both need to stay honest about what's an actual vote (AŞAMA 5:
  // starting scores are never presented as votes).
  const totalVotes = useMemo(() => entries.reduce((sum, entry) => sum + entry.voteCount, 0), [entries]);
  const voteCounts = useMemo(() => new Map(entries.map((entry) => [entry.isoCode, entry.voteCount])), [entries]);
  // Total power (starting score + votes) drives the map's color scale
  // instead — AŞAMA 5's whole point is that the map looks alive from day
  // one, not flat until real votes accumulate.
  const maxPower = useMemo(() => Math.max(1, ...entries.map((entry) => entry.totalPower)), [entries]);
  const powerByIso = useMemo(() => new Map(entries.map((entry) => [entry.isoCode, entry.totalPower])), [entries]);
  const resetTarget = useMemo(() => (now !== null ? nextUtcMidnight(now) : null), [now]);
  // `entries` is already sorted desc by total power (see toRankedEntries) —
  // rank is just its index. Shared by the hero ("Your country — ranked
  // #N") and the map's hover tooltip (see WorldMapInteractive).
  const rankByIso = useMemo(() => new Map(entries.map((entry, index) => [entry.isoCode, index + 1])), [entries]);

  const countryNameByIso = useMemo(() => new Map(entries.map((entry) => [entry.isoCode, entry.name])), [entries]);

  const tickerItems = useMemo<TickerItem[]>(() => {
    return thrones
      .filter((throne) => throne.currentValue !== null && throne.handle)
      .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))
      .slice(0, 24)
      .map((throne) => ({
        isoCode: throne.isoCode,
        countryName: countryNameByIso.get(throne.isoCode) ?? throne.isoCode,
        leaderXUrl: throne.leaderXUrl,
        leaderInstagramUrl: throne.leaderInstagramUrl,
        leaderTiktokUrl: throne.leaderTiktokUrl,
        leaderFacebookUrl: throne.leaderFacebookUrl,
        throneClaimId: throne.currentClaimId as number,
        amountPaid: throne.currentValue as number,
      }));
  }, [thrones, countryNameByIso]);

  const handleTickerSelect = useCallback((isoCode: string) => {
    setHighlightedIso(isoCode);
    document.getElementById(`country-${isoCode}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => setHighlightedIso((current) => (current === isoCode ? null : current)), HIGHLIGHT_DURATION_MS);
    mapRef.current?.focusCountry(isoCode);
  }, []);

  // "Go to this country on the map" — the leaderboard search box (Enter on
  // a match) and clicking a leaderboard row both funnel through this rather
  // than duplicating the highlight/scroll dance above: the row is already
  // visible/expanding itself in both cases, so this only needs to move the
  // map, not also re-scroll/ring the leaderboard.
  const handleSelectCountry = useCallback((isoCode: string) => {
    mapRef.current?.focusCountry(isoCode);
  }, []);

  // A shared-link visit (?country=XX, from the leaderboard row share
  // button) should land on and expand that country the same way clicking
  // its ticker entry does — reuses the same highlight/scroll logic, just
  // deferred until the leaderboard has actually loaded rows to scroll to,
  // and applied only once.
  const appliedInitialHighlight = useRef(false);
  useEffect(() => {
    if (!initialHighlightIso || appliedInitialHighlight.current || entries.length === 0) return;
    appliedInitialHighlight.current = true;
    handleTickerSelect(initialHighlightIso);
  }, [initialHighlightIso, entries, handleTickerSelect]);

  return (
    <div className="flex w-full flex-col gap-6 pb-16">
      {turnstileSiteKey && <TurnstileWidget ref={turnstileRef} siteKey={turnstileSiteKey} />}
      {/* Hero + map: stacked on mobile (hero first, so the vote CTA is above
          the fold with no scrolling — see gelistirme-plani-v2.md AŞAMA 1),
          side by side from the lg breakpoint up. */}
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-stretch">
        <Hero
          leader={entries[0]}
          runnerUp={entries[1]}
          rankByIso={rankByIso}
          entries={entries}
          serverGuessIso={guessCountryIso}
          voteStatus={voteStatus}
          submittingIso={submittingIso}
          onVote={castVoteWithResult}
          onSelectCountry={handleTickerSelect}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <TopBar totalVotes={totalVotes} onlineCount={onlineCount} resetTarget={resetTarget} now={now} />
          <div className="w-full rounded-2xl border border-border bg-surface p-4">
            <WorldMapInteractive
              ref={mapRef}
              countries={countries}
              width={width}
              height={height}
              voteCounts={voteCounts}
              powerByIso={powerByIso}
              maxPower={maxPower}
              rankByIso={rankByIso}
              voteStatus={voteStatus}
              submittingIso={submittingIso}
              voteError={voteError}
              onVote={castVoteWithResult}
              thrones={thrones}
              claimHistory={claimHistory}
              now={now}
              onThroneClaimed={handleThroneClaimed}
            />
          </div>
        </div>
      </div>
      <ClosestBattles
        entries={entries}
        submittingIso={submittingIso}
        onVote={castVoteWithResult}
        onSelectCountry={handleTickerSelect}
      />
      <Leaderboard
        countries={countries}
        entries={entries}
        allTimeEntries={allTimeEntries}
        totalVotes={totalVotes}
        now={now}
        voteStatus={voteStatus}
        submittingIso={submittingIso}
        voteError={voteError}
        onVote={castVoteWithResult}
        highlightedIso={highlightedIso}
        thrones={thrones}
        claimHistory={claimHistory}
        onThroneClaimed={handleThroneClaimed}
        onSelectCountry={handleSelectCountry}
        momentum={momentum}
      />
      <LeaderTicker items={tickerItems} onSelect={handleTickerSelect} />
      {voteResult && <VoteResultModal result={voteResult} onClose={() => setVoteResult(null)} />}
    </div>
  );
}
