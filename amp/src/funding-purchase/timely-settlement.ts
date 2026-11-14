import type { PoolClient } from "pg";
import type { FundingRequest } from "./contracts.js";
import { validateClassWalletPayment } from "./classwallet.js";

/** Only persisted, verified operator imports can preserve a paid invoice beyond
 * its deadline. A received-at marker or a caller's event timestamps cannot. */
export async function timelyClassWalletPayment(
  db: PoolClient,
  quote: Pick<FundingRequest, "id" | "offer" | "createdAt" | "expiresAt">,
) {
  const payment = (
    await db.query(
      "SELECT * FROM amp_classwallet_payments WHERE invoice_id=$1 AND stopped_at IS NULL FOR UPDATE",
      [quote.id],
    )
  ).rows[0];
  if (!payment) return null;
  const verified = validateClassWalletPayment(
    payment.payment_row,
    quote,
    payment.verified_config,
    new Date().toISOString(),
  );
  if (
    verified.orderId !== payment.order_id ||
    verified.updated > quote.expiresAt
  )
    return null;
  return { ...payment, settledAt: verified.updated as string };
}
