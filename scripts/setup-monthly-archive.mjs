// One-off admin script: sets up UTC-month-scoped ranking + a non-destructive
// monthly archive of the top 3 countries ("Champions"), and schedules it to
// run automatically via Supabase's pg_cron extension.
//
// Usage:
//   DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" node scripts/setup-monthly-archive.mjs
//
// Same DATABASE_URL-on-the-command-line-only pattern as setup-database.mjs —
// see that file for why. Safe to re-run: every statement here is
// create-or-replace / if-not-exists / unschedule-then-reschedule.

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

  // pg_cron requires a superuser-ish role to enable. On Supabase this is
  // normally fine over the direct DATABASE_URL connection, but if the
  // project's plan/policy blocks it, don't abort the rest of the setup —
  // the views/table/function are still useful on their own, and the cron
  // schedule step below can be retried later after enabling it manually via
  // Database -> Extensions -> pg_cron in the Supabase dashboard.
  try {
    await client.query(`create extension if not exists pg_cron;`);
  } catch (err) {
    console.warn(
      "Couldn't enable pg_cron automatically (this is common on some Supabase " +
        "plans). Enable it manually: Supabase dashboard -> Database -> " +
        "Extensions -> pg_cron, then re-run this script. Continuing without " +
        `it for now.\nReason: ${err instanceof Error ? err.message : err}`,
    );
  }

  // Archive table: top 3 countries per UTC month. Never touches `votes` —
  // old votes are never deleted, only summarized in here.
  await client.query(`
    create table if not exists monthly_champions (
      month date not null,
      rank smallint not null check (rank between 1 and 3),
      country_iso_code text not null references countries (iso_code),
      vote_count int not null,
      archived_at timestamptz not null default now(),
      primary key (month, rank)
    );
  `);

  // Snapshot of whoever held the winning country's throne at the moment it
  // was archived — throne cycles (1 week) and this vote-ranking reset (1
  // month) are independent, unaligned systems, so this is deliberately a
  // point-in-time snapshot, not a live link to the leader. Null if the
  // country was vacant at archive time.
  await client.query(`
    alter table monthly_champions
      add column if not exists leader_x_handle text,
      add column if not exists leader_brand_title text,
      add column if not exists leader_amount_paid numeric(10,2);
  `);

  // Main ranking: same 4 output columns as before (iso_code, name,
  // continent, vote_count), but vote_count is now scoped to the current UTC
  // calendar month. This *is* the monthly reset — nothing is deleted, a new
  // month's window just naturally starts every country back at 0.
  await client.query(`
    create or replace view leaderboard as
    select
      c.iso_code,
      c.name,
      c.continent,
      count(v.id)::int as vote_count
    from countries c
    left join votes v
      on v.country_iso_code = c.iso_code
      and v.created_at >= date_trunc('month', now() at time zone 'utc')
      and v.created_at < date_trunc('month', now() at time zone 'utc') + interval '1 month'
    group by c.iso_code, c.name, c.continent;
  `);

  // All-time ranking: same shape, unscoped. Backs the new "All time" tab.
  await client.query(`
    create or replace view leaderboard_all_time as
    select
      c.iso_code,
      c.name,
      c.continent,
      count(v.id)::int as vote_count
    from countries c
    left join votes v on v.country_iso_code = c.iso_code
    group by c.iso_code, c.name, c.continent;
  `);

  // Champions: monthly_champions joined with country name, most recent
  // month first. Backs the /champions page.
  await client.query(`
    create or replace view champions as
    select
      mc.month,
      mc.rank,
      c.iso_code,
      c.name,
      mc.vote_count,
      mc.leader_x_handle,
      mc.leader_brand_title,
      mc.leader_amount_paid
    from monthly_champions mc
    join countries c on c.iso_code = mc.country_iso_code
    order by mc.month desc, mc.rank asc;
  `);

  await client.query(`grant select on leaderboard, leaderboard_all_time, champions to anon, authenticated;`);

  // Computes and archives the top 3 countries for `target_month` (first day
  // of the month). Defaults to last UTC month — what the real monthly cron
  // job calls with no argument. Deletes then re-inserts that month's rows,
  // so it's idempotent and safe to re-run (e.g. for manual testing via
  // scripts/run-monthly-archive.mjs) without creating duplicates or ever
  // touching the `votes` table itself.
  // NOTE: references `thrones`/`throne_claims` (created by
  // scripts/setup-throne-system.mjs) for the leader snapshot below.
  // plpgsql function bodies aren't validated against schema at creation
  // time — only when actually called — so this is fine as long as
  // setup-throne-system.mjs has been run before this function is ever
  // invoked, regardless of which setup script ran first.
  await client.query(`
    create or replace function archive_and_reset_month(
      target_month date default date_trunc('month', (now() at time zone 'utc') - interval '1 month')::date
    ) returns void
    language plpgsql
    as $$
    declare
      month_start timestamptz := target_month::timestamptz;
      month_end timestamptz := (target_month + interval '1 month')::timestamptz;
    begin
      delete from monthly_champions where month = target_month;

      insert into monthly_champions (
        month, rank, country_iso_code, vote_count,
        leader_x_handle, leader_brand_title, leader_amount_paid
      )
      select
        target_month,
        row_number() over (order by top3.vote_count desc, top3.country_iso_code asc),
        top3.country_iso_code,
        top3.vote_count,
        tc.x_handle,
        tc.brand_title,
        t.current_value
      from (
        select country_iso_code, count(*) as vote_count
        from votes
        where created_at >= month_start and created_at < month_end
        group by country_iso_code
        order by vote_count desc, country_iso_code asc
        limit 3
      ) top3
      -- Only an actually-active throne counts as "the leader at archive
      -- time" — cycle_end > now() excludes a row that's expired but not
      -- yet swept, same vacancy rule thrones_live uses.
      left join thrones t on t.country_iso_code = top3.country_iso_code and t.cycle_end > now()
      left join throne_claims tc on tc.id = t.current_claim_id;
    end;
    $$;
  `);

  // Schedule the automatic run: 00:00 UTC on the 1st of every month.
  // Supabase Postgres defaults to UTC, so this fires at UTC midnight. Named
  // job + unschedule-first makes re-running this script idempotent instead
  // of piling up duplicate schedules.
  try {
    await client.query(`
      do $$
      begin
        if exists (select 1 from cron.job where jobname = 'worldleaders-monthly-archive') then
          perform cron.unschedule('worldleaders-monthly-archive');
        end if;
      end $$;
    `);
    await client.query(`
      select cron.schedule(
        'worldleaders-monthly-archive',
        '0 0 1 * *',
        $$select public.archive_and_reset_month();$$
      );
    `);
    console.log("Scheduled 'worldleaders-monthly-archive' to run at 00:00 UTC on the 1st of every month.");
  } catch (err) {
    console.warn(
      "Couldn't schedule the pg_cron job (pg_cron likely isn't enabled yet — " +
        "see the warning above, if any). Once enabled, re-run this script to " +
        `schedule it.\nReason: ${err instanceof Error ? err.message : err}`,
    );
  }

  const { rows: jobs } = await client.query(`select jobname, schedule, active from cron.job;`).catch(() => ({
    rows: [],
  }));
  console.log("Current pg_cron jobs:", jobs);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
