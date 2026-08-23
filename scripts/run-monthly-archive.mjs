// Manually trigger the monthly archive step — this is the "how do I test the
// reset without waiting for a real month to end" method. It calls the exact
// same `archive_and_reset_month()` function the pg_cron job calls
// automatically (see scripts/setup-monthly-archive.mjs), so it's a faithful
// test of the real thing, not a separate code path.
//
// It never touches the `votes` table — only (re)writes `monthly_champions`
// rows for the target month — so it's safe to run repeatedly, including
// against the current, still-in-progress month.
//
// Usage:
//   DATABASE_URL="postgresql://...:5432/postgres" node scripts/run-monthly-archive.mjs           # archives last UTC month
//   DATABASE_URL="postgresql://...:5432/postgres" node scripts/run-monthly-archive.mjs 2026-08   # archives a specific month (e.g. the current one, for testing)

import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL to your Supabase Postgres connection string first.");
  process.exit(1);
}

const monthArg = process.argv[2];
if (monthArg && !/^\d{4}-\d{2}$/.test(monthArg)) {
  console.error("Month argument must look like YYYY-MM, e.g. 2026-08.");
  process.exit(1);
}
const targetMonth = monthArg ? `${monthArg}-01` : null;

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  if (targetMonth) {
    await client.query(`select archive_and_reset_month($1::date);`, [targetMonth]);
  } else {
    await client.query(`select archive_and_reset_month();`);
  }

  // month::text avoids node-postgres parsing the `date` column into a JS
  // Date anchored at local midnight — formatting that via toISOString()
  // (UTC) can roll the displayed month back a day depending on the local
  // timezone offset, even though the stored value itself is correct.
  const { rows } = await client.query(
    targetMonth
      ? `select month::text as month, rank, country_iso_code, vote_count, leader_x_handle from monthly_champions where month = $1::date order by rank;`
      : `select month::text as month, rank, country_iso_code, vote_count, leader_x_handle from monthly_champions order by month desc, rank asc limit 3;`,
    targetMonth ? [targetMonth] : [],
  );

  if (rows.length === 0) {
    console.log(
      `No votes found for ${targetMonth ?? "last month"} — nothing archived (this is expected if that month had zero votes).`,
    );
  } else {
    console.log(`Archived champions for ${rows[0].month.slice(0, 7)}:`);
    for (const row of rows) {
      const leader = row.leader_x_handle ? `, led by @${row.leader_x_handle}` : "";
      console.log(`  #${row.rank}  ${row.country_iso_code}  ${row.vote_count} votes${leader}`);
    }
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
