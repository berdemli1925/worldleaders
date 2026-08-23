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
      mc.vote_count
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

      insert into monthly_champions (month, rank, country_iso_code, vote_count)
      select target_month, row_number() over (order by vote_count desc, country_iso_code asc), country_iso_code, vote_count
      from (
        select country_iso_code, count(*) as vote_count
        from votes
        where created_at >= month_start and created_at < month_end
        group by country_iso_code
        order by vote_count desc, country_iso_code asc
        limit 3
      ) top3;
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
