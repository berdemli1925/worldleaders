// One-off admin script: makes throne credit persistent and identity-keyed,
// replacing claim_throne()'s previous "only within the still-active cycle,
// keyed on the displayed post's author" rule (see setup-leader-identity.mjs)
// with "forever, keyed on the leader's own identity" — decided in chat:
//   - Credit no longer resets when a throne goes vacant. Money a leader has
//     ever put into a country stays theirs to reclaim with, indefinitely —
//     matches memleket.lol's "Tahtı Geri Al … 4 eski ağa" reclaim-with-
//     credit pattern, which is exactly what this enables client-side.
//   - Credit is now keyed on the *leader's own identity* (their linked X/
//     Instagram/TikTok/Facebook profile — src/lib/social-links.ts), not on
//     x_handle (the *displayed post's* author, which can be anyone's public
//     post and was never a reliable stand-in for "who's actually leading").
//
// A claim's canonical identity is computed app-side (src/lib/social-links.ts
// computeLeaderIdentityKey) as "<platform>:<handle>" from whichever of the
// four leader-identity fields is filled, in the same fixed priority order
// every time (x > instagram > tiktok > facebook) — so the same real person
// re-linking the same profile always produces the same key, without this
// script (or claim_throne itself) needing to know anything about social
// platforms.
//
// Builds on setup-leader-identity.mjs — same append-column /
// drop-then-recreate-function pattern.
//
// Usage:
//   DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" node scripts/setup-persistent-leader-credit.mjs

import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL to your Supabase Postgres connection string first.");
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  await client.query(`
    alter table throne_claims add column if not exists leader_identity_key text;
    alter table payments add column if not exists leader_identity_key text;
  `);
  // Every credit lookup below filters by (country_iso_code, leader_identity_key)
  // with no time bound — this is now the query's whole selectivity, so it
  // needs its own index rather than relying on one built for the old
  // cycle-scoped (country_iso_code, x_handle, created_at) lookup.
  await client.query(`
    create index if not exists throne_claims_leader_identity_idx
      on throne_claims (country_iso_code, leader_identity_key)
      where leader_identity_key is not null;
  `);

  await client.query(`
    drop function if exists claim_throne(text, text, numeric, jsonb, text, text, text, text, timestamptz, inet, text, text, text, text, int, int, numeric, numeric, numeric, text, text, text, text);
  `);
  await client.query(`
    create or replace function claim_throne(
      p_country text, p_x_handle text, p_offered numeric, p_post_snapshot jsonb,
      p_post_text text, p_post_author_name text, p_post_author_avatar_url text, p_post_image_url text, p_post_created_at timestamptz,
      p_claimer_ip inet default null, p_brand_title text default null, p_description text default null,
      p_link_url text default null, p_logo_url text default null,
      p_post_image_width int default null, p_post_image_height int default null, p_post_image_scale numeric default null,
      p_post_image_offset_x numeric default null, p_post_image_offset_y numeric default null,
      p_leader_x_url text default null, p_leader_instagram_url text default null,
      p_leader_tiktok_url text default null, p_leader_facebook_url text default null,
      p_leader_identity_key text default null
    ) returns bigint
    language plpgsql
    as $$
    declare
      row thrones%rowtype;
      is_vacant boolean;
      required_min numeric(10,2);
      credit numeric(10,2) := 0;
      credit_applied numeric(10,2);
      net_paid numeric(10,2);
      new_cycle_start timestamptz;
      new_cycle_end timestamptz;
      new_claim_id bigint;
      leadership_hidden boolean;
    begin
      if exists (select 1 from blocked_handles where x_handle = p_x_handle) then
        raise exception 'This X account is blocked from claiming a throne.';
      end if;

      select coalesce((value #>> '{}')::boolean, false) into leadership_hidden
      from site_settings where key = 'leadership_hidden';
      if leadership_hidden then
        raise exception 'Leadership claims are temporarily paused.';
      end if;

      select * into row from thrones where country_iso_code = p_country for update;
      if not found then
        raise exception 'Unknown country: %', p_country;
      end if;

      is_vacant := row.current_claim_id is null or row.cycle_end is null or row.cycle_end <= now();

      if is_vacant then
        required_min := row.base_price;
        new_cycle_start := now();
        new_cycle_end := now() + interval '7 days';
      else
        required_min := row.current_value + 2;
        new_cycle_start := row.cycle_start;
        new_cycle_end := row.cycle_end;
      end if;

      -- Unconditional now (used to be inside the "not is_vacant" branch
      -- only, and time-bounded to "created_at >= row.cycle_start") — a
      -- leader's credit for this country is every net dollar they've ever
      -- put into it, whether that was this cycle, a past cycle, or while
      -- it sat vacant in between. Requires a real identity key; a claim
      -- made anonymously (no leader identity resolved) never accrues or
      -- draws credit.
      if p_leader_identity_key is not null then
        select coalesce(sum(amount_paid), 0) into credit
        from throne_claims
        where country_iso_code = p_country and leader_identity_key = p_leader_identity_key;
      end if;

      if p_offered < required_min then
        raise exception 'Offer of % is below the required minimum of % for %', p_offered, required_min, p_country;
      end if;

      credit_applied := least(credit, p_offered);
      net_paid := p_offered - credit_applied;

      insert into throne_claims (
        country_iso_code, x_handle, amount_paid, post_snapshot,
        post_text, post_author_name, post_author_avatar_url, post_image_url, post_created_at,
        claimer_ip, brand_title, description, link_url, logo_url,
        post_image_width, post_image_height, post_image_scale, post_image_offset_x, post_image_offset_y,
        leader_x_url, leader_instagram_url, leader_tiktok_url, leader_facebook_url, leader_identity_key
      ) values (
        p_country, p_x_handle, net_paid, p_post_snapshot,
        p_post_text, p_post_author_name, p_post_author_avatar_url, p_post_image_url, p_post_created_at,
        p_claimer_ip, p_brand_title, p_description, p_link_url, p_logo_url,
        p_post_image_width, p_post_image_height, p_post_image_scale, p_post_image_offset_x, p_post_image_offset_y,
        p_leader_x_url, p_leader_instagram_url, p_leader_tiktok_url, p_leader_facebook_url, p_leader_identity_key
      ) returning id into new_claim_id;

      update thrones
      set current_value = p_offered, current_claim_id = new_claim_id,
          cycle_start = new_cycle_start, cycle_end = new_cycle_end, updated_at = now()
      where country_iso_code = p_country;

      return new_claim_id;
    end;
    $$;
  `);

  // --- claim_throne_beta(): no credit math (free during beta — see
  // setup-beta-mode.mjs), just stores leader_identity_key for the same
  // reason every other leader-identity field is stored during beta: so a
  // beta-era claim's history looks the same shape as a paid one once
  // beta mode ends, with nothing to backfill.
  await client.query(`
    drop function if exists claim_throne_beta(text, text, jsonb, text, text, text, text, timestamptz, inet, text, text, text, text, text, int, int, numeric, numeric, numeric, text, text, text, text);
  `);
  await client.query(`
    create or replace function claim_throne_beta(
      p_country text, p_x_handle text, p_post_snapshot jsonb,
      p_post_text text, p_post_author_name text, p_post_author_avatar_url text, p_post_image_url text, p_post_created_at timestamptz,
      p_claimer_ip inet, p_fingerprint text,
      p_brand_title text default null, p_description text default null, p_link_url text default null, p_logo_url text default null,
      p_post_image_width int default null, p_post_image_height int default null, p_post_image_scale numeric default null,
      p_post_image_offset_x numeric default null, p_post_image_offset_y numeric default null,
      p_leader_x_url text default null, p_leader_instagram_url text default null,
      p_leader_tiktok_url text default null, p_leader_facebook_url text default null,
      p_leader_identity_key text default null
    ) returns bigint
    language plpgsql
    as $$
    declare
      row thrones%rowtype;
      is_vacant boolean;
      held_count int;
      new_claim_id bigint;
      leadership_hidden boolean;
    begin
      if exists (select 1 from blocked_handles where x_handle = p_x_handle) then
        raise exception 'This X account is blocked from claiming a throne.';
      end if;

      select coalesce((value #>> '{}')::boolean, false) into leadership_hidden
      from site_settings where key = 'leadership_hidden';
      if leadership_hidden then
        raise exception 'Leadership claims are temporarily paused.';
      end if;

      select * into row from thrones where country_iso_code = p_country for update;
      if not found then
        raise exception 'Unknown country: %', p_country;
      end if;

      is_vacant := row.current_claim_id is null or row.cycle_end is null or row.cycle_end <= now();
      if not is_vacant then
        raise exception 'This country''s throne is already held — no takeovers during the free beta. Try again once it expires.';
      end if;

      select count(*) into held_count
      from thrones t
      join throne_claims tc on tc.id = t.current_claim_id
      where t.cycle_end is not null and t.cycle_end > now()
        and tc.claimer_ip = p_claimer_ip and tc.fingerprint = p_fingerprint;
      if held_count >= 5 then
        raise exception 'You already lead 5 countries — that''s the beta limit. Wait for one to expire first.';
      end if;

      insert into throne_claims (
        country_iso_code, x_handle, amount_paid, post_snapshot,
        post_text, post_author_name, post_author_avatar_url, post_image_url, post_created_at,
        claimer_ip, fingerprint, brand_title, description, link_url, logo_url,
        post_image_width, post_image_height, post_image_scale, post_image_offset_x, post_image_offset_y,
        leader_x_url, leader_instagram_url, leader_tiktok_url, leader_facebook_url, leader_identity_key
      ) values (
        p_country, p_x_handle, 0, p_post_snapshot,
        p_post_text, p_post_author_name, p_post_author_avatar_url, p_post_image_url, p_post_created_at,
        p_claimer_ip, p_fingerprint, p_brand_title, p_description, p_link_url, p_logo_url,
        p_post_image_width, p_post_image_height, p_post_image_scale, p_post_image_offset_x, p_post_image_offset_y,
        p_leader_x_url, p_leader_instagram_url, p_leader_tiktok_url, p_leader_facebook_url, p_leader_identity_key
      ) returning id into new_claim_id;

      update thrones
      set current_value = 0, current_claim_id = new_claim_id,
          cycle_start = now(), cycle_end = now() + interval '1 hour', updated_at = now()
      where country_iso_code = p_country;

      return new_claim_id;
    end;
    $$;
  `);

  // --- finalize_payment(): forward the new column through to claim_throne(),
  // same as every other payments.* column it already passes through.
  await client.query(`
    create or replace function finalize_payment(p_payment_id bigint, p_provider_success boolean default true)
    returns jsonb
    language plpgsql
    as $$
    declare
      pay payments%rowtype;
      new_claim_id bigint;
    begin
      select * into pay from payments where id = p_payment_id for update;
      if not found then
        raise exception 'Unknown payment: %', p_payment_id;
      end if;

      if pay.status != 'pending' then
        return jsonb_build_object('status', pay.status, 'alreadyProcessed', true);
      end if;

      if not p_provider_success then
        update payments set status = 'failed', failure_reason = 'Declined by payment provider.', updated_at = now()
        where id = p_payment_id;
        return jsonb_build_object('status', 'failed', 'reason', 'Declined by payment provider.');
      end if;

      begin
        new_claim_id := claim_throne(
          pay.country_iso_code, pay.x_handle, pay.amount, pay.post_snapshot,
          pay.post_text, pay.post_author_name, pay.post_author_avatar_url, pay.post_image_url, pay.post_created_at,
          pay.claimer_ip, pay.brand_title, pay.description, pay.link_url, pay.logo_url,
          pay.post_image_width, pay.post_image_height, pay.post_image_scale, pay.post_image_offset_x, pay.post_image_offset_y,
          pay.leader_x_url, pay.leader_instagram_url, pay.leader_tiktok_url, pay.leader_facebook_url, pay.leader_identity_key
        );

        update payments
        set status = 'completed', throne_claim_id = new_claim_id,
            net_amount = (select amount_paid from throne_claims where id = new_claim_id),
            credit_applied = pay.amount - (select amount_paid from throne_claims where id = new_claim_id),
            updated_at = now()
        where id = p_payment_id;

        return jsonb_build_object('status', 'completed', 'claimId', new_claim_id);
      exception when others then
        update payments set status = 'failed', failure_reason = SQLERRM, updated_at = now() where id = p_payment_id;
        return jsonb_build_object('status', 'failed', 'reason', SQLERRM);
      end;
    end;
    $$;
  `);

  console.log("Persistent leader credit set up: leader_identity_key column + index, claim_throne(), claim_throne_beta(), finalize_payment().");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
