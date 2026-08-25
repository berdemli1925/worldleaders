"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { mapHypeRow, type HypeEntry, type HypeRow } from "@/lib/hype";
import type { SerializedMomentum } from "@/lib/momentum";
import { toRankedEntries, type CountryRow } from "@/lib/rank";
import { SHARE_VOTE_BONUS } from "@/lib/share-bonus";
import { supabaseBrowser } from "@/lib/supabase/client";
import { mapThroneRow, type ThroneClaimHistoryEntry, type ThroneEntry, type ThroneRow } from "@/lib/throne";
import { bonusByIso, mergeBonusMaps, THRONE_CLAIM_BONUS } from "@/lib/throne-bonus";
import { currentMonthStartMs } from "@/lib/time";
import { useVote } from "@/lib/use-vote";
import ClosestBattles from "./ClosestBattles";
import Hero from "./Hero";
import HypeBanner from "./HypeBanner";
import LiveFeed from "./LiveFeed";
import Leaderboard from "./Leaderboard";
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
const HYPE_CHANNEL = "hype-updates";
const HIGHLIGHT_DURATION_MS = 2200;

// Bug fix: this used to compute next UTC *midnight* (the daily vote-limit
// reset) while the TopBar box it feeds is labeled "Ranking resets in" —
// the monthly ranking reset (1st of the month, UTC — see rules/page.tsx
// and scripts/setup-monthly-archive.mjs's archive_and_reset_month cron).
// Two different resets were being conflated under one label. This now
// actually counts down to the next UTC month start; Date.UTC overflows
// month 12 into next January on its own, so no explicit year-rollover
// handling is needed.
function nextUtcMonthStart(from: number): number {
  const d = new Date(from);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

export default function Dashboard({ countries, width, height, initialHighlightIso, guessCountryIso }: DashboardProps) {
  // Raw DB rows — ranking (starting baseline + throne/share bonuses folded
  // in, see src/lib/rank.ts) is derived from these below, not stored
  // directly, so it always reflects the latest claimHistory/shareBonuses
  // without needing a re-fetch of the vote counts themselves.
  const [rawEntries, setRawEntries] = useState<CountryRow[]>([]);
  const [rawAllTimeEntries, setRawAllTimeEntries] = useState<CountryRow[]>([]);
  const [thrones, setThrones] = useState<ThroneEntry[]>([]);
  const [claimHistory, setClaimHistory] = useState<ThroneClaimHistoryEntry[]>([]);
  // Who has ever claimed their one-time X-share bonus, and for which
  // country — see src/lib/share-bonus.ts. Country + timestamp only
  // (share_bonuses_public hides voter identity, same pattern as
  // throne_claims_public); may simply stay empty if the migration in
  // scripts/setup-share-bonus.mjs hasn't been run yet.
  const [shareBonuses, setShareBonuses] = useState<{ isoCode: string; createdAt: number }[]>([]);
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
  // Returns raw rows — ranking (starting baseline + bonuses) is applied
  // downstream, see the entries/allTimeEntries useMemos below.
  const fetchRanking = useCallback(async (view: "leaderboard" | "leaderboard_all_time") => {
    const { data, error } = await supabaseBrowser.from(view).select("iso_code, name, continent, vote_count");
    if (error || !data) return null;

    return (data as { iso_code: string; name: string; continent: string; vote_count: number }[]).map((row) => ({
      isoCode: row.iso_code,
      name: row.name,
      continent: row.continent,
      voteCount: row.vote_count,
    }));
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    const [month, allTime] = await Promise.all([
      fetchRanking("leaderboard"),
      fetchRanking("leaderboard_all_time"),
    ]);
    if (month) setRawEntries(month);
    if (allTime) setRawAllTimeEntries(allTime);
    // Returned (not just set as state) so callers that need the *freshly
    // fetched* rows right away — see handleVoteCast below — don't have
    // to wait an extra render for state to catch up.
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

  // hype_slot_public — see src/lib/hype.ts / scripts/setup-hype.mjs. A
  // single row (or none, if nobody's hyping right now) rather than one per
  // country, since there's only one global spotlight. Same
  // fetch-on-mount + realtime-broadcast-on-change shape as thrones above;
  // silently stays null if the migration hasn't been run yet.
  const [hype, setHype] = useState<HypeEntry | null>(null);
  const hypeChannelRef = useRef<RealtimeChannel | null>(null);

  const fetchHype = useCallback(async () => {
    const { data, error } = await supabaseBrowser.from("hype_slot_public").select("*").maybeSingle();
    if (error) return;
    setHype(data ? mapHypeRow(data as HypeRow) : null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHype();
  }, [fetchHype]);

  useEffect(() => {
    const channel = supabaseBrowser.channel(HYPE_CHANNEL);
    channel.on("broadcast", { event: "hype-changed" }, () => fetchHype()).subscribe();
    hypeChannelRef.current = channel;
    return () => {
      supabaseBrowser.removeChannel(channel);
      hypeChannelRef.current = null;
    };
  }, [fetchHype]);

  const handleHyped = useCallback(() => {
    fetchHype();
    hypeChannelRef.current?.send({ type: "broadcast", event: "hype-changed", payload: {} });
  }, [fetchHype]);

  // share_bonuses_public — see src/lib/share-bonus.ts. Fetched once on
  // mount (bonuses only ever change one country/one person at a time, and
  // whoever just claimed one gets an immediate local refetch — see
  // handleShareBonusGranted below — so there's no need for a realtime
  // channel like votes/thrones have). Silently stays empty if the table
  // doesn't exist yet (migration not run) — same error-tolerant pattern as
  // every other fetch here.
  const fetchShareBonuses = useCallback(async () => {
    const { data, error } = await supabaseBrowser.from("share_bonuses_public").select("country_iso_code, created_at");
    if (error || !data) return;
    setShareBonuses(
      (data as { country_iso_code: string; created_at: string }[]).map((row) => ({
        isoCode: row.country_iso_code,
        createdAt: new Date(row.created_at).getTime(),
      })),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchShareBonuses();
  }, [fetchShareBonuses]);

  const handleShareBonusGranted = useCallback(() => {
    fetchShareBonuses();
  }, [fetchShareBonuses]);

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

  // Snapshot of the vote in flight — rank/votes *before* it lands — so
  // handleVoteCast below can diff against the freshly-fetched ranking and
  // build the AŞAMA 2 result screen ("Turkey moved up to #4", nearest
  // rival, …). A ref, not state: it's write-then-read-once bookkeeping for
  // a single async round trip, not something that should trigger a render.
  const pendingVoteRef = useRef<{ isoCode: string; prevRank: number | undefined; prevVoteCount: number } | null>(
    null,
  );
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null);

  // Throne-claim + share bonuses (src/lib/throne-bonus.ts, share-bonus.ts),
  // merged into one map so src/lib/rank.ts's toRankedEntries has a single
  // number to add per country. "This month" only counts events from the
  // current UTC month (same reset as votes); "all time" counts every event
  // ever.
  const monthlyBonusByIso = useMemo(() => {
    const monthStart = currentMonthStartMs();
    return mergeBonusMaps(
      bonusByIso(claimHistory, monthStart, THRONE_CLAIM_BONUS),
      bonusByIso(shareBonuses, monthStart, SHARE_VOTE_BONUS),
    );
  }, [claimHistory, shareBonuses]);
  const allTimeBonusByIso = useMemo(
    () =>
      mergeBonusMaps(
        bonusByIso(claimHistory, 0, THRONE_CLAIM_BONUS),
        bonusByIso(shareBonuses, 0, SHARE_VOTE_BONUS),
      ),
    [claimHistory, shareBonuses],
  );

  // The actual, ranked "votes" list every other part of the page reads —
  // raw DB rows (rawEntries/rawAllTimeEntries) plus the bonus maps above,
  // recombined whenever either changes. See src/lib/rank.ts.
  const entries = useMemo(
    () => toRankedEntries(rawEntries, monthlyBonusByIso),
    [rawEntries, monthlyBonusByIso],
  );
  const allTimeEntries = useMemo(
    () => toRankedEntries(rawAllTimeEntries, allTimeBonusByIso),
    [rawAllTimeEntries, allTimeBonusByIso],
  );

  const handleVoteCast = useCallback(async () => {
    const freshRaw = await fetchLeaderboard();
    votesChannelRef.current?.send({ type: "broadcast", event: "vote-cast", payload: {} });

    const pending = pendingVoteRef.current;
    pendingVoteRef.current = null;
    if (!pending || !freshRaw) return;
    const fresh = toRankedEntries(freshRaw, monthlyBonusByIso);

    const newIndex = fresh.findIndex((entry) => entry.isoCode === pending.isoCode);
    const newEntry = newIndex >= 0 ? fresh[newIndex] : undefined;
    if (!newEntry) return;
    const newRank = newIndex + 1;

    // Nearest rival: whoever's immediately above in rank (the one worth
    // catching), or — if this country is already #1 — whoever's immediately
    // below (the one worth watching).
    const rivalEntry = newIndex > 0 ? fresh[newIndex - 1] : fresh[newIndex + 1];
    const rival = rivalEntry
      ? {
          isoCode: rivalEntry.isoCode,
          name: rivalEntry.name,
          voteCount: rivalEntry.voteCount,
          direction: (newIndex > 0 ? "ahead" : "behind") as "ahead" | "behind",
        }
      : null;

    setVoteResult({
      isoCode: pending.isoCode,
      countryName: newEntry.name,
      newRank,
      newVoteCount: newEntry.voteCount,
      prevRank: pending.prevRank,
      voteDelta: newEntry.voteCount - pending.prevVoteCount,
      rival,
    });
  }, [fetchLeaderboard, monthlyBonusByIso]);

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

  // One unified "votes" figure (starting baseline + real votes + bonuses,
  // see src/lib/rank.ts) drives the top stat bar, the map's color scale,
  // and its hover tooltip alike — there's no more separate "real votes
  // only" number shown anywhere (direct request).
  const totalVotes = useMemo(() => entries.reduce((sum, entry) => sum + entry.voteCount, 0), [entries]);
  const voteCounts = useMemo(() => new Map(entries.map((entry) => [entry.isoCode, entry.voteCount])), [entries]);
  const maxVotes = useMemo(() => Math.max(1, ...entries.map((entry) => entry.voteCount)), [entries]);
  const resetTarget = useMemo(() => (now !== null ? nextUtcMonthStart(now) : null), [now]);
  // `entries` is already sorted desc by vote count (see toRankedEntries) —
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

  // Auto-zoom to the visitor's own (detected or picked) country — direct
  // request, fired from Hero once it knows guessIso (see Hero.tsx). Skipped
  // when a shared link (?country=XX) is already driving the initial view
  // below: that's an explicit destination someone sent them to and should
  // win over a passive IP/browser guess, not get overridden by it.
  const handleGuessedCountry = useCallback(
    (isoCode: string) => {
      if (initialHighlightIso) return;
      mapRef.current?.focusCountry(isoCode);
    },
    [initialHighlightIso],
  );

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
      {/* Hero on top (compact, full width — the "who's winning" + "claim its
          throne" banner), map filling almost the rest of the screen right
          below it — direct request, and how memleket.lol (this site's
          stated inspiration) does it too: title bar, then a map that
          dominates. See gelistirme-plani-v2.md AŞAMA 1/1.5 for the
          original sizing, since raised further. */}
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
        countries={countries}
        thrones={thrones}
        claimHistory={claimHistory}
        now={now}
        onThroneClaimed={handleThroneClaimed}
        onGuessedCountry={handleGuessedCountry}
        hype={hype}
        onHyped={handleHyped}
      />
      {/* Direct request: a "hype" spotlight above the map — a throne
          holder can pay to put their country here for a few hours
          regardless of vote rank, not just the #1 country by votes. */}
      <HypeBanner hype={hype} now={now} onSelectCountry={handleTickerSelect} />
      <TopBar totalVotes={totalVotes} resetTarget={resetTarget} now={now} />
      <div className="w-full rounded-md border border-border bg-surface p-4">
        <WorldMapInteractive
          ref={mapRef}
          countries={countries}
          width={width}
          height={height}
          voteCounts={voteCounts}
          maxVotes={maxVotes}
          rankByIso={rankByIso}
          leaderIso={entries[0]?.isoCode}
          voteStatus={voteStatus}
          submittingIso={submittingIso}
          voteError={voteError}
          onVote={castVoteWithResult}
          thrones={thrones}
          claimHistory={claimHistory}
          now={now}
          onThroneClaimed={handleThroneClaimed}
          hype={hype}
          onHyped={handleHyped}
        />
      </div>
      <ClosestBattles
        entries={entries}
        thrones={thrones}
        submittingIso={submittingIso}
        onVote={castVoteWithResult}
        onSelectCountry={handleTickerSelect}
      />
      <LiveFeed
        recentVotes={momentum?.recentVotes ?? []}
        claimHistory={claimHistory}
        countryNameByIso={countryNameByIso}
        now={now}
      />
      <Leaderboard
        entries={entries}
        allTimeEntries={allTimeEntries}
        voteStatus={voteStatus}
        submittingIso={submittingIso}
        voteError={voteError}
        onVote={castVoteWithResult}
        highlightedIso={highlightedIso}
        thrones={thrones}
        onSelectCountry={handleSelectCountry}
        momentum={momentum}
        onShareBonusGranted={handleShareBonusGranted}
        countries={countries}
        onThroneClaimed={handleThroneClaimed}
      />
      <LeaderTicker items={tickerItems} onSelect={handleTickerSelect} />
      {voteResult && (
        <VoteResultModal
          result={voteResult}
          onClose={() => setVoteResult(null)}
          onShareBonusGranted={handleShareBonusGranted}
        />
      )}
    </div>
  );
}
