import type { PoolClient } from "pg";
import { orderClickEvidence } from "./click-evidence.js";
import {
  paymentReferenceSchema,
  type PaymentReference,
} from "./verified-payment.js";

/** Resolve a verified payment to its exact owned checkout/request. The caller
 * holds the account privacy lock and separately verifies payment and permission. */
export async function paymentClickEvidence(
  client: PoolClient,
  account: string,
  rawReference: PaymentReference,
  provider: "google" | "meta" | "openai",
) {
  const reference = paymentReferenceSchema.parse(rawReference);
  const stripe = reference.kind === "stripe";
  const row = (
    await client.query(
      stripe
        ? "SELECT c.id FROM amp_payment_records p JOIN amp_stripe_checkouts c ON c.id=p.checkout_id AND c.account_id=p.account_id AND c.namespace=p.namespace WHERE p.id=$1 AND p.account_id=$2"
        : "SELECT r.id FROM amp_commerce_orders o JOIN amp_funding_requests r ON r.order_id=o.id AND r.account_id=o.account_id WHERE o.id=$1 AND o.account_id=$2",
      [reference.id, account],
    )
  ).rows[0];
  return row
    ? orderClickEvidence(
        client,
        account,
        { kind: stripe ? "stripe-checkout" : "funding-request", id: row.id },
        provider,
      )
    : null;
}
