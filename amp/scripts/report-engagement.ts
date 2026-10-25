import { createDatabasePool } from "../src/server/database.js";
import { engagementReport } from "../src/analytics/engagement-report.js";

const days = Number(process.argv[2] ?? 7);
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  console.log(JSON.stringify(await engagementReport(pool, days), null, 2));
} finally {
  await pool.end();
}
