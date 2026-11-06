import { createDatabasePool } from "../src/server/database.js";
import { flowReport, formatFlowReport } from "../src/analytics/flow-report.js";

/** `report-flow.ts [--days N] [--since ISO-time] [--json]` */
const argument = (name: string) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
};
const since = argument("--since");
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  const report = await flowReport(pool, {
    days: Number(argument("--days") ?? 7),
    ...(since ? { since: new Date(since) } : {}),
  });
  console.log(
    process.argv.includes("--json")
      ? JSON.stringify(report, null, 2)
      : formatFlowReport(report),
  );
} finally {
  await pool.end();
}
