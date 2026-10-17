import type { Pool } from "pg";
/** Expired unconverted requests only. Linked financial snapshots follow ledger retention. */
export async function purgeExpiredFundingRequests(
  pool: Pool,
  at = new Date(),
): Promise<number> {
  if (!Number.isFinite(at.getTime()))
    throw new Error("Invalid retention clock");
  const result = await pool.query(
    "DELETE FROM amp_funding_requests WHERE order_id IS NULL AND expires_at<=$1",
    [at.toISOString()],
  );
  return result.rowCount ?? 0;
}
