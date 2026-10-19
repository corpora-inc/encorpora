import { createDatabasePool } from "../src/server/database.js";
import { formatFunnelReport, funnelReport } from "../src/analytics/report.js";

/** npm run report:funnel [-- --days 30] [--json]. Aggregates only. */
const args = process.argv.slice(2);
const daysAt = args.indexOf("--days");
const days = daysAt >= 0 ? Number(args[daysAt + 1]) : 90;
if (!Number.isInteger(days) || days < 1 || days > 3650)
  throw new Error("--days must be a whole number from 1 to 3650");
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  // Whole UTC days, up to and including today.
  const to = new Date(Date.now() + 86_400_000);
  const from = new Date(to.getTime() - days * 86_400_000);
  const report = await funnelReport(pool, { from, to });
  console.log(
    args.includes("--json")
      ? JSON.stringify(report, null, 2)
      : formatFunnelReport(report),
  );
} finally {
  await pool.end();
}
