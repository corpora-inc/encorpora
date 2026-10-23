import type { Pool } from "pg";
import { RETENTION } from "../privacy/retention-periods.js";
/** Expired unconverted requests only. Linked financial snapshots follow ledger retention. */
export async function purgeExpiredFundingRequests(
  pool: Pool,
  at = new Date(),
): Promise<number> {
  if (!Number.isFinite(at.getTime()))
    throw new Error("Invalid retention clock");
  const payments = await pool.query(
    "DELETE FROM amp_classwallet_payments WHERE received_at<=$1::timestamptz-make_interval(years=>$2)",
    [at.toISOString(), RETENTION.financialRecordYears],
  );
  const intents = await pool.query(
    "DELETE FROM amp_funding_invoice_intents WHERE claimed_request_id IS NULL AND ((received_payment_at IS NULL AND expires_at<=$1) OR received_payment_at<=$1::timestamptz-make_interval(years=>$2))",
    [at.toISOString(), RETENTION.financialRecordYears],
  );
  const result = await pool.query(
    "DELETE FROM amp_funding_requests WHERE order_id IS NULL AND expires_at<=$1 AND NOT EXISTS (SELECT 1 FROM amp_funding_invoice_intents i WHERE i.claimed_request_id=amp_funding_requests.id AND i.received_payment_at IS NOT NULL) AND NOT EXISTS (SELECT 1 FROM amp_classwallet_payments p WHERE p.invoice_id=amp_funding_requests.id)",
    [at.toISOString()],
  );
  return (
    (result.rowCount ?? 0) + (intents.rowCount ?? 0) + (payments.rowCount ?? 0)
  );
}
