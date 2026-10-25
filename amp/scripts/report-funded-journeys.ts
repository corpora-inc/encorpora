import { createDatabasePool } from "../src/server/database.js";
import { fundedJourneyReport } from "../src/analytics/funded-journey-report.js";

if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  console.log(
    JSON.stringify(
      await fundedJourneyReport(pool, Number(process.argv[2] ?? 7)),
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
