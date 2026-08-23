// One-off admin script: free beta-mode claiming, running alongside (not
// replacing) the paid system from scripts/setup-throne-system.mjs +
// setup-moderation.mjs + setup-payments.mjs. See src/lib/beta-mode.ts —
// NEXT_PUBLIC_PAYMENTS_ENABLED picks which of the two claim paths the app
// actually calls; both stay installed at all times.
//
// Beta rules (see this session's chat, not proje-spesifikasyonu.md — the
// spec describes the *paid* system, which comes back unchanged once
// PAYMENTS_ENABLED flips to true):
//   - Free. No payments table row, no credit math.
//   - A claim holds the country for 1 hour, starting at claim time.
//   - No takeovers — the throne simply isn't claimable again until it
//     expires (unlike claim_throne()'s "current value + $2" outbidding).
//   - One identity (IP + browser fingerprint, same pairing as /api/votes)
//     may hold at most 5 countries at once.
//   - Every existing moderation guard still applies unchanged: blocked
//     handles, the leadership_hidden kill switch, and — upstream of this,
//     in /api/throne/claim — the sensitive-post and banned-word checks,
//     since claim_throne_beta() is called from the exact same route as
//     claim_throne(), just a different branch.
//
// Usage:
//   DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" node scripts/setup-beta-mode.mjs
//
// Same DATABASE_URL-on-the-command-line-only pattern as the other setup
// scripts. Safe to re-run: add-column-if-not-exists / create-or-replace.

import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL to your Supabase Postgres connection string first.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  // Mirrors votes.fingerprint (scripts/setup-database.mjs) — same identity
  // pairing, different table. Nullable/backfill-safe for the same reason:
  // rows claimed before this column existed (i.e. every paid-mode claim)
  // simply have no fingerprint, and claim_throne_beta() is the only writer
  // that ever sets one.
  await client.query(`alter table throne_claims add column if not exists fingerprint text;`);
  await client.query(
    `create index if not exists throne_claims_ip_fingerprint_idx on throne_claims (claimer_ip, fingerprint);`,
  );

  // Read-side helper: every country a given identity currently holds an
  // unexpired claim on. Used by /api/throne/claim to enforce (and explain)
  // the 5-country cap *before* attempting a claim, and re-checked inside
  // claim_throne_beta() itself as a race-condition backstop. Deliberately
  // reads the raw `thrones` table, not the kill-switch-aware `thrones_live`
  // view — an identity still "holds" a country for cap-counting purposes
  // even while leadership display is globally paused.
  await client.query(`
    create or replace function beta_holdings(p_ip inet, p_fingerprint text)
    returns table(country_iso_code text, cycle_end timestamptz)
    language sql
    stable
    as $$
      select t.country_iso_code, t.cycle_end
      from thrones t
      join throne_claims tc on tc.id = t.current_claim_id
      where t.cycle_end is not null and t.cycle_end > now()
        and tc.claimer_ip = p_ip and tc.fingerprint = p_fingerprint
      order by t.cycle_end asc;
    $$;
  `);

  // Free-claim path — same blocked-handle / kill-switch guards as
  // claim_throne(), same throne_claims insert shape, but: no p_offered (the
  // amount is always 0), a 1-hour cycle instead of 7 days, "occupied" is a
  // hard stop instead of an outbid opportunity, and a per-identity 5-country
  // cap enforced under the same row lock that makes the vacancy check safe.
  await client.query(`
    create or replace function claim_throne_beta(
      p_country text,
      p_x_handle text,
      p_post_snapshot jsonb,
      p_post_text text,
      p_post_author_name text,
      p_post_author_avatar_url text,
      p_post_image_url text,
      p_post_created_at timestamptz,
      p_claimer_ip inet,
      p_fingerprint text,
      p_brand_title text default null,
      p_description text default null,
      p_link_url text default null,
      p_logo_url text default null
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
        claimer_ip, fingerprint, brand_title, description, link_url, logo_url
      ) values (
        p_country, p_x_handle, 0, p_post_snapshot,
        p_post_text, p_post_author_name, p_post_author_avatar_url, p_post_image_url, p_post_created_at,
        p_claimer_ip, p_fingerprint, p_brand_title, p_description, p_link_url, p_logo_url
      ) returning id into new_claim_id;

      update thrones
      set current_value = 0,
          current_claim_id = new_claim_id,
          cycle_start = now(),
          cycle_end = now() + interval '1 hour',
          updated_at = now()
      where country_iso_code = p_country;

      return new_claim_id;
    end;
    $$;
  `);

  console.log("Beta mode set up: throne_claims.fingerprint, beta_holdings(), claim_throne_beta().");
  console.log(
    "The existing paid-mode tables/functions (thrones, throne_claims, claim_throne, payments, " +
      "finalize_payment) are untouched — set NEXT_PUBLIC_PAYMENTS_ENABLED=true when ready to switch back.",
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
