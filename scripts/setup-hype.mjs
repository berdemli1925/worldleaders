// One-off admin script: adds the "Hype" feature — a single global
// spotlight slot, above the map, that a country's *current* throne holder
// can pay to put their country (and whatever their claim already shows —
// no separate content form, it's the same brand/description/logo/post
// already on the throne) into for 3 hours, regardless of vote rank.
// Confirmed in chat:
//   - Hype-eligible only for the country's current throne holder — not
//     open to random visitors. Beta mode enforces this by fingerprint
//     match against the throne's claim (the same identity signal
//     claim_throne_beta already uses elsewhere); paid mode can't do that
//     (paid throne claims never store a fingerprint — a pre-existing gap
//     in the claim flow, not introduced here), so paid-mode hype only
//     checks that the country currently has *some* active leader, same
//     "open market" posture the throne takeover mechanic itself already
//     has in paid mode.
//   - One global slot, not per-country — outbidding by +$1 takes it over
//     from whoever else is hyping (mirrors claim_throne's +$2 pattern,
//     scaled down); the current holder can pay again (flat $1, no bidding
//     against themselves) to stack 3 more hours on top of what's left.
//   - Free during the beta, same claim_throne_beta()/claim_throne() dual-
//     mode split as the throne system itself — this is the free path,
//     live now; hype_country() (paid) sits ready for when
//     NEXT_PUBLIC_PAYMENTS_ENABLED flips, same as claim_throne() already
//     does.
//
// Usage:
//   DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" node scripts/setup-hype.mjs

import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL to your Supabase Postgres connection string first.");
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();

  // Singleton row (id is always 1) — there is exactly one spotlight, not
  // one per country, so this isn't keyed by country_iso_code the way
  // `thrones` is.
  await client.query(`
    create table if not exists hype_slot (
      id int primary key default 1,
      country_iso_code text references thrones(country_iso_code),
      throne_claim_id bigint references throne_claims(id),
      current_value numeric(10,2),
      cycle_start timestamptz,
      cycle_end timestamptz,
      updated_at timestamptz not null default now(),
      constraint hype_slot_singleton check (id = 1)
    );
  `);
  await client.query(`insert into hype_slot (id) values (1) on conflict (id) do nothing;`);

  // History, same relationship to hype_slot that throne_claims has to
  // thrones — every successful hype purchase, win or eventually lose the
  // slot to someone else.
  await client.query(`
    create table if not exists hype_purchases (
      id bigserial primary key,
      country_iso_code text not null,
      throne_claim_id bigint not null references throne_claims(id),
      amount_paid numeric(10,2) not null default 0,
      claimer_ip inet,
      fingerprint text,
      created_at timestamptz not null default now()
    );
  `);

  // Paid-mode payment records — deliberately a separate table from the
  // throne system's `payments`, not a shared one with a "kind" column:
  // the two have different required fields (hype has no post/image/leader-
  // identity payload at all, it just points at an existing throne_claim)
  // and finalize_hype_payment() below only ever needs to drive
  // hype_country(), never claim_throne().
  await client.query(`
    create table if not exists hype_payments (
      id bigserial primary key,
      country_iso_code text not null,
      amount numeric(10,2) not null,
      provider text not null,
      provider_reference text,
      status text not null default 'pending',
      failure_reason text,
      hype_purchase_id bigint references hype_purchases(id),
      claimer_ip inet,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await client.query(`alter table hype_slot enable row level security;`);
  await client.query(`alter table hype_purchases enable row level security;`);
  await client.query(`alter table hype_payments enable row level security;`);

  // Public read: the current hype (if any, and not expired/kill-switched)
  // joined straight to the throne claim it points at, so the client gets
  // everything HypeBanner needs — brand/description/logo/post/leader
  // identity — in one query, the same shape thrones_with_leader gives for
  // an individual country's own panel.
  await client.query(`
    create or replace view hype_slot_public as
    select
      hs.country_iso_code,
      hs.current_value,
      hs.cycle_start,
      hs.cycle_end,
      tc.x_handle,
      tc.brand_title,
      tc.description,
      tc.logo_url,
      tc.link_url,
      tc.post_text,
      tc.post_image_url,
      tc.post_image_width,
      tc.post_image_height,
      tc.post_image_scale,
      tc.post_image_offset_x,
      tc.post_image_offset_y,
      tc.leader_x_url,
      tc.leader_instagram_url,
      tc.leader_tiktok_url,
      tc.leader_facebook_url
    from hype_slot hs
    join throne_claims tc on tc.id = hs.throne_claim_id
    where hs.id = 1
      and hs.cycle_end is not null and hs.cycle_end > now()
      and not coalesce(
        (select (value #>> '{}')::boolean from site_settings where key = 'leadership_hidden'),
        false
      );
  `);
  await client.query(`grant select on hype_slot_public to anon, authenticated;`);

  await client.query(`
    create or replace function hype_country_beta(
      p_country text, p_claimer_ip inet, p_fingerprint text
    ) returns bigint
    language plpgsql
    as $$
    declare
      throne_row record;
      slot hype_slot%rowtype;
      is_vacant boolean;
      new_purchase_id bigint;
      leadership_hidden boolean;
      claim_fingerprint text;
    begin
      select coalesce((value #>> '{}')::boolean, false) into leadership_hidden
      from site_settings where key = 'leadership_hidden';
      if leadership_hidden then
        raise exception 'Leadership claims are temporarily paused.';
      end if;

      select * into throne_row from thrones_live where country_iso_code = p_country;
      if not found or throne_row.current_claim_id is null then
        raise exception 'This country has no active leader to hype.';
      end if;

      select fingerprint into claim_fingerprint from throne_claims where id = throne_row.current_claim_id;
      if claim_fingerprint is distinct from p_fingerprint then
        raise exception 'Only the current throne holder can hype this country.';
      end if;

      select * into slot from hype_slot where id = 1 for update;
      is_vacant := slot.cycle_end is null or slot.cycle_end <= now();
      if not is_vacant then
        raise exception 'The hype spotlight is already taken — no takeovers during the free beta. Try again once it expires.';
      end if;

      insert into hype_purchases (country_iso_code, throne_claim_id, amount_paid, claimer_ip, fingerprint)
      values (p_country, throne_row.current_claim_id, 0, p_claimer_ip, p_fingerprint)
      returning id into new_purchase_id;

      update hype_slot
      set country_iso_code = p_country,
          throne_claim_id = throne_row.current_claim_id,
          current_value = 0,
          cycle_start = now(),
          cycle_end = now() + interval '3 hours',
          updated_at = now()
      where id = 1;

      return new_purchase_id;
    end;
    $$;
  `);

  await client.query(`
    create or replace function hype_country(
      p_country text, p_offered numeric, p_claimer_ip inet default null
    ) returns bigint
    language plpgsql
    as $$
    declare
      throne_row record;
      slot hype_slot%rowtype;
      is_vacant boolean;
      required_min numeric(10,2);
      new_cycle_start timestamptz;
      new_cycle_end timestamptz;
      new_purchase_id bigint;
      leadership_hidden boolean;
    begin
      select coalesce((value #>> '{}')::boolean, false) into leadership_hidden
      from site_settings where key = 'leadership_hidden';
      if leadership_hidden then
        raise exception 'Leadership claims are temporarily paused.';
      end if;

      select * into throne_row from thrones_live where country_iso_code = p_country;
      if not found or throne_row.current_claim_id is null then
        raise exception 'This country has no active leader to hype.';
      end if;

      select * into slot from hype_slot where id = 1 for update;
      is_vacant := slot.cycle_end is null or slot.cycle_end <= now();

      if not is_vacant and slot.throne_claim_id = throne_row.current_claim_id then
        -- Self-extend: the same claim already holds the spotlight, so
        -- there's no one to outbid — flat base price, and stack the new
        -- 3 hours on top of whatever time is left rather than resetting
        -- the clock to exactly 3h from now (which would be a *worse* deal
        -- than doing nothing if they still had, say, 2h50m left).
        required_min := 1;
        new_cycle_start := slot.cycle_start;
        new_cycle_end := slot.cycle_end + interval '3 hours';
      elsif is_vacant then
        required_min := 1;
        new_cycle_start := now();
        new_cycle_end := now() + interval '3 hours';
      else
        required_min := slot.current_value + 1;
        new_cycle_start := now();
        new_cycle_end := now() + interval '3 hours';
      end if;

      if p_offered < required_min then
        raise exception 'Offer of % is below the required minimum of %', p_offered, required_min;
      end if;

      insert into hype_purchases (country_iso_code, throne_claim_id, amount_paid, claimer_ip)
      values (p_country, throne_row.current_claim_id, p_offered, p_claimer_ip)
      returning id into new_purchase_id;

      update hype_slot
      set country_iso_code = p_country,
          throne_claim_id = throne_row.current_claim_id,
          current_value = p_offered,
          cycle_start = new_cycle_start,
          cycle_end = new_cycle_end,
          updated_at = now()
      where id = 1;

      return new_purchase_id;
    end;
    $$;
  `);

  await client.query(`
    create or replace function finalize_hype_payment(p_payment_id bigint, p_provider_success boolean default true)
    returns jsonb
    language plpgsql
    as $$
    declare
      pay hype_payments%rowtype;
      new_purchase_id bigint;
    begin
      select * into pay from hype_payments where id = p_payment_id for update;
      if not found then
        raise exception 'Unknown hype payment: %', p_payment_id;
      end if;

      if pay.status != 'pending' then
        return jsonb_build_object('status', pay.status, 'alreadyProcessed', true);
      end if;

      if not p_provider_success then
        update hype_payments set status = 'failed', failure_reason = 'Declined by payment provider.', updated_at = now()
        where id = p_payment_id;
        return jsonb_build_object('status', 'failed', 'reason', 'Declined by payment provider.');
      end if;

      begin
        new_purchase_id := hype_country(pay.country_iso_code, pay.amount, pay.claimer_ip);
        update hype_payments
        set status = 'completed', hype_purchase_id = new_purchase_id, updated_at = now()
        where id = p_payment_id;
        return jsonb_build_object('status', 'completed', 'purchaseId', new_purchase_id);
      exception when others then
        update hype_payments set status = 'failed', failure_reason = SQLERRM, updated_at = now() where id = p_payment_id;
        return jsonb_build_object('status', 'failed', 'reason', SQLERRM);
      end;
    end;
    $$;
  `);

  // Admin lever, same posture as reset_throne() — a blunt "clear it"
  // rather than needing to wait out the 3 hours.
  await client.query(`
    create or replace function reset_hype() returns void
    language sql
    as $$
      update hype_slot
      set country_iso_code = null, throne_claim_id = null, current_value = null,
          cycle_start = null, cycle_end = null, updated_at = now()
      where id = 1;
    $$;
  `);

  console.log("Hype set up: hype_slot/hype_purchases/hype_payments, hype_slot_public, hype_country_beta(), hype_country(), finalize_hype_payment(), reset_hype().");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
