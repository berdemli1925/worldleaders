// Manually trigger the throne system's two cron jobs — for testing hourly
// pricing and expiry sweeping without waiting for the schedule. Calls the
// exact same functions the cron jobs call (see scripts/setup-throne-system.mjs),
// so this is a faithful test of the real thing.
//
// Usage:
//   DATABASE_URL="postgresql://...:5432/postgres" node scripts/run-throne-maintenance.mjs --prices
//   DATABASE_URL="postgresql://...:5432/postgres" node scripts/run-throne-maintenance.mjs --sweep
//   DATABASE_URL="postgresql://...:5432/postgres" node scripts/run-throne-maintenance.mjs --prices --sweep

import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL to your Supabase Postgres connection string first.");
  process.exit(1);
}

const args = process.argv.slice(2);
const doPrices = args.includes("--prices");
const doSweep = args.includes("--sweep");
if (!doPrices && !doSweep) {
  console.error("Pass --prices and/or --sweep to say what to run.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();

  if (doPrices) {
    await client.query(`select refresh_throne_base_prices();`);
    const { rows } = await client.query(
      `select country_iso_code, base_price from thrones order by base_price desc, country_iso_code limit 10;`,
    );
    console.log("Base prices refreshed. Top 10 by price:", rows);
  }

  if (doSweep) {
    const { rows: before } = await client.query(
      `select country_iso_code, cycle_end from thrones where cycle_end is not null and cycle_end <= now();`,
    );
    await client.query(`select sweep_expired_thrones();`);
    console.log(
      before.length === 0
        ? "Expiry sweep ran — nothing was expired."
        : `Expiry sweep ran — vacated ${before.length} expired throne(s): ${before
            .map((r) => r.country_iso_code)
            .join(", ")}`,
    );
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
