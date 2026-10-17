import { Pool } from "pg";
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = new Pool({
  connectionString: process.env.AMP_DATABASE_URL,
  max: 1,
});
try {
  const tickets = await pool.query(
    "DELETE FROM amp_export_tickets WHERE expires_at<=now()",
  );
  const events = await pool.query(
    "DELETE FROM amp_privacy_events WHERE expires_at<=now()",
  );
  console.log(
    JSON.stringify({
      expiredExportTickets: tickets.rowCount,
      expiredPrivacyEvents: events.rowCount,
    }),
  );
} finally {
  await pool.end();
}
