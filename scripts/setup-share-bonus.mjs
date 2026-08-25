// One-off admin script: creates the `share_bonuses` table and its public
// view backing the "+5 votes for sharing on X, once per person" feature —
// see src/lib/share-bonus.ts and src/app/api/share/bonus/route.ts.
//
// Usage:
//   DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" node scripts/setup-share-bonus.mjs
//
// Same DATABASE_URL-on-the-command-line-only pattern as the other
// scripts/setup-*.mjs files — see setup-database.mjs for why. Safe to
// re-run: every statement here is create-or-replace / if-not-exists.

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

  // Primary key on (voter_ip, fingerprint) is the actual enforcement of
  // "once ever per person" — the API route (POST /api/share/bonus) relies
  // on the resulting unique-violation (Postgres error 23505) to detect a
  // repeat claim, rather than checking-then-inserting (which would race).
  await client.query(`
    create table if not exists share_bonuses (
      voter_ip inet not null,
      fingerprint text not null,
      country_iso_code text not null references countries (iso_code),
      created_at timestamptz not null default now(),
      primary key (voter_ip, fingerprint)
    );
  `);
  await client.query(`create index if not exists share_bonuses_country_iso_code_idx on share_bonuses (country_iso_code);`);
  await client.query(`create index if not exists share_bonuses_created_at_idx on share_bonuses (created_at);`);

  // Locked down like `votes` — no public policies at all; inserts only via
  // the service_role key (the API route), which bypasses RLS entirely.
  await client.query(`alter table share_bonuses enable row level security;`);

  // Public view: country + timestamp only, never voter_ip/fingerprint —
  // same reasoning/shape as throne_claims_public (see setup-throne-system.mjs).
  await client.query(`
    create or replace view share_bonuses_public as
    select country_iso_code, created_at
    from share_bonuses;
  `);
  await client.query(`grant select on share_bonuses_public to anon, authenticated;`);

  const { rows } = await client.query(`select count(*)::int as count from share_bonuses;`);
  console.log(`share_bonuses ready. Table currently has ${rows[0].count} row(s).`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
