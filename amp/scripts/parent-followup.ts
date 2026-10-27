import { createDatabasePool } from "../src/server/database.js";
import { followupConfiguration } from "../src/parent-followup/mail.js";
import {
  deliverParentFollowup,
  resendTransport,
} from "../src/parent-followup/worker.js";
const config = followupConfiguration(process.env);
if (!config || !process.env.AMP_DATABASE_URL)
  throw new Error("Parent follow-up delivery is not configured");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
});
try {
  await pool.query(
    "DELETE FROM amp_parent_signup_intents WHERE expires_at<now()",
  );
  let processed = 0;
  const transport = resendTransport(config);
  while (
    processed < 20 &&
    (await deliverParentFollowup(pool, config, transport))
  )
    processed++;
  console.log(JSON.stringify({ event: "parent-followup-delivery", processed }));
} catch {
  console.error(
    "Parent follow-up delivery failed. Check private delivery configuration and queue status.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
