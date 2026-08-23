// One-off admin script: separates "who the leader is" from "what content is
// shown" in a throne claim. Previously the claim's X post WAS the leader —
// the post's own author became the displayed handle. Now a claimer enters
// their own identity (at least one of X/Instagram/TikTok/Facebook profile
// URLs — see src/lib/social-links.ts for parsing/validation) separately
// from the X post being displayed, which can be *any* public post, not
// necessarily the leader's own. Builds on setup-image-crop.mjs — same
// append-columns / drop-then-recreate-function pattern.
//
// Usage:
//   DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" node scripts/setup-leader-identity.mjs

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
    alter table throne_claims
      add column if not exists leader_x_url text,
      add column if not exists leader_instagram_url text,
      add column if not exists leader_tiktok_url text,
      add column if not exists leader_facebook_url text;
  `);
  await client.query(`
    alter table payments
      add column if not exists leader_x_url text,
      add column if not exists leader_instagram_url text,
      add column if not exists leader_tiktok_url text,
      add column if not exists leader_facebook_url text;
  `);

  await client.query(`
    create or replace view thrones_with_leader as
    select
      tl.country_iso_code, tl.base_price, tl.current_value, tl.cycle_start, tl.cycle_end,
      tc.id as current_claim_id, tc.x_handle, tc.amount_paid, tc.post_text, tc.post_author_name,
      tc.post_author_avatar_url, tc.post_image_url, tc.post_created_at, tc.created_at as claimed_at,
      tc.brand_title, tc.description, tc.link_url, tc.logo_url,
      tc.post_image_width, tc.post_image_height, tc.post_image_scale, tc.post_image_offset_x, tc.post_image_offset_y,
      tc.leader_x_url, tc.leader_instagram_url, tc.leader_tiktok_url, tc.leader_facebook_url
    from thrones_live tl
    left join throne_claims tc on tc.id = tl.current_claim_id;
  `);
  await client.query(`
    create or replace view throne_claims_public as
    select
      id, country_iso_code, x_handle, amount_paid,
      post_text, post_author_name, post_author_avatar_url, post_image_url, post_created_at, created_at,
      brand_title, description, link_url, logo_url,
      post_image_width, post_image_height, post_image_scale, post_image_offset_x, post_image_offset_y,
      leader_x_url, leader_instagram_url, leader_tiktok_url, leader_facebook_url
    from throne_claims;
  `);
  await client.query(`grant select on thrones_live, thrones_with_leader, throne_claims_public to anon, authenticated;`);

  await client.query(`
    drop function if exists claim_throne(text, text, numeric, jsonb, text, text, text, text, timestamptz, inet, text, text, text, text, int, int, numeric, numeric, numeric);
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
      p_leader_tiktok_url text default null, p_leader_facebook_url text default null
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
        credit := 0;
      else
        required_min := row.current_value + 2;
        new_cycle_start := row.cycle_start;
        new_cycle_end := row.cycle_end;

        select coalesce(sum(amount_paid), 0) into credit
        from throne_claims
        where country_iso_code = p_country and x_handle = p_x_handle and created_at >= row.cycle_start;
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
        leader_x_url, leader_instagram_url, leader_tiktok_url, leader_facebook_url
      ) values (
        p_country, p_x_handle, net_paid, p_post_snapshot,
        p_post_text, p_post_author_name, p_post_author_avatar_url, p_post_image_url, p_post_created_at,
        p_claimer_ip, p_brand_title, p_description, p_link_url, p_logo_url,
        p_post_image_width, p_post_image_height, p_post_image_scale, p_post_image_offset_x, p_post_image_offset_y,
        p_leader_x_url, p_leader_instagram_url, p_leader_tiktok_url, p_leader_facebook_url
      ) returning id into new_claim_id;

      update thrones
      set current_value = p_offered, current_claim_id = new_claim_id,
          cycle_start = new_cycle_start, cycle_end = new_cycle_end, updated_at = now()
      where country_iso_code = p_country;

      return new_claim_id;
    end;
    $$;
  `);

  await client.query(`
    drop function if exists claim_throne_beta(text, text, jsonb, text, text, text, text, timestamptz, inet, text, text, text, text, text, int, int, numeric, numeric, numeric);
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
      p_leader_tiktok_url text default null, p_leader_facebook_url text default null
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
        leader_x_url, leader_instagram_url, leader_tiktok_url, leader_facebook_url
      ) values (
        p_country, p_x_handle, 0, p_post_snapshot,
        p_post_text, p_post_author_name, p_post_author_avatar_url, p_post_image_url, p_post_created_at,
        p_claimer_ip, p_fingerprint, p_brand_title, p_description, p_link_url, p_logo_url,
        p_post_image_width, p_post_image_height, p_post_image_scale, p_post_image_offset_x, p_post_image_offset_y,
        p_leader_x_url, p_leader_instagram_url, p_leader_tiktok_url, p_leader_facebook_url
      ) returning id into new_claim_id;

      update thrones
      set current_value = 0, current_claim_id = new_claim_id,
          cycle_start = now(), cycle_end = now() + interval '1 hour', updated_at = now()
      where country_iso_code = p_country;

      return new_claim_id;
    end;
    $$;
  `);

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
          pay.leader_x_url, pay.leader_instagram_url, pay.leader_tiktok_url, pay.leader_facebook_url
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

  console.log("Leader identity set up: throne_claims/payments columns, updated views, claim_throne(), claim_throne_beta(), finalize_payment().");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
