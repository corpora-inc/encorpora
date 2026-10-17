import type { Pool } from "pg";
/** Removes only expired export credentials and minimized privacy audit records. */
export async function purgeExpiredPrivacyRecords(
  pool: Pool,
): Promise<{ expiredExportTickets: number; expiredPrivacyEvents: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout='30s'");
    const tickets = await client.query(
      "DELETE FROM amp_export_tickets WHERE expires_at<=now()",
    );
    const events = await client.query(
      "DELETE FROM amp_privacy_events WHERE expires_at<=now()",
    );
    await client.query("COMMIT");
    return {
      expiredExportTickets: tickets.rowCount ?? 0,
      expiredPrivacyEvents: events.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
