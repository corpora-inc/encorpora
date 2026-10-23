import type { Pool } from "pg";
import { applyCommerceEventInTransaction } from "../commerce/postgres.js";
import { canonicalCommercePayload } from "../commerce/ledger.js";
import { FundingPurchaseRepository, fundingRequestRow } from "./repository.js";
import { fundedProvisionSchema } from "./provision.js";
import {
  ClassWalletError,
  classWalletConfigSchema,
  validateClassWalletPayment,
  type ClassWalletConfig,
  type ClassWalletRow,
} from "./classwallet.js";

export function verifyPayByReportBinding(
  row: ClassWalletRow,
  config: ClassWalletConfig,
  checkout: {
    purchase_order_id: string | null;
    callback_status: string | null;
    stopped_at: unknown;
    exception_code: string | null;
  },
) {
  if (!config.payByPurchaseOrderColumn)
    throw new ClassWalletError("payby_report_mapping_unverified");
  if (
    checkout.callback_status !== "complete" ||
    checkout.stopped_at ||
    checkout.exception_code ||
    !checkout.purchase_order_id ||
    row[config.payByPurchaseOrderColumn] !== checkout.purchase_order_id
  )
    throw new ClassWalletError("payby_report_order_mismatch");
}

/** A later payment updates the approved order; it never provisions another term.
 * No HTTP endpoint. Only the authenticated-report importer can stage this evidence.
 */
export async function reconcilePayBySettlement(
  pool: Pool,
  paymentId: string,
): Promise<"unhandled" | "completed" | "waiting"> {
  const initial = (
    await pool.query(
      `SELECT r.account_id FROM amp_classwallet_payments p
       JOIN amp_funding_requests r ON r.id=p.invoice_id
       JOIN amp_classwallet_checkouts c ON c.request_id=r.id
       WHERE p.order_id=$1 AND r.offer_snapshot->>'activationPolicy'='after-approval'`,
      [paymentId],
    )
  ).rows[0];
  if (!initial) return "unhandled";
  const repository = new FundingPurchaseRepository(pool, []);
  return repository.transaction(
    initial.account_id,
    async (client) => {
      // Account -> request/checkout -> payment -> commerce, shared with callback recovery.
      const stored = (
        await client.query(
          `SELECT r.*,c.purchase_order_id,c.callback_status,c.stopped_at,c.exception_code,c.provisioning_payload
         FROM amp_funding_requests r JOIN amp_classwallet_checkouts c ON c.request_id=r.id
         JOIN amp_classwallet_payments p ON p.invoice_id=r.id
         WHERE p.order_id=$1 AND r.account_id=$2 FOR UPDATE OF r,c`,
          [paymentId, initial.account_id],
        )
      ).rows[0];
      if (!stored) throw new ClassWalletError("invoice_record_unavailable");
      const payment = (
        await client.query(
          "SELECT * FROM amp_classwallet_payments WHERE order_id=$1 FOR UPDATE",
          [paymentId],
        )
      ).rows[0];
      if (payment.completed_at) return "completed";
      if (payment.stopped_at) return "waiting";
      const request = fundingRequestRow(stored);
      const config = classWalletConfigSchema.parse(payment.verified_config);
      verifyPayByReportBinding(payment.payment_row, config, stored);
      const verified = validateClassWalletPayment(
        payment.payment_row,
        request,
        config,
        new Date().toISOString(),
      );
      if (verified.orderId !== paymentId)
        throw new ClassWalletError("previous_payment_mismatch");
      if (!request.orderId) {
        // Approval recovery must finish its consent/ownership checks first.
        await client.query(
          "UPDATE amp_classwallet_payments SET next_attempt_at=now()+interval '5 minutes',error_code='awaiting_approval_activation' WHERE order_id=$1",
          [paymentId],
        );
        return "waiting";
      }
      const bundle = fundedProvisionSchema.parse(stored.provisioning_payload);
      const created = bundle.events[0];
      if (
        bundle.requestId !== request.id ||
        created.type !== "order.created" ||
        created.orderId !== request.orderId ||
        created.order.account.id !== request.accountId ||
        created.order.license.learnerId !== request.learnerId ||
        bundle.events.some((event) => event.type === "order.settled") ||
        canonicalCommercePayload(bundle) !==
          canonicalCommercePayload(stored.conversion_payload)
      )
        throw new ClassWalletError("payby_provisioning_mismatch");
      const event = {
        id: `${request.orderId}:settled`,
        orderId: request.orderId,
        channel: "esa" as const,
        channelReference: request.offer.channelReference,
        type: "order.settled" as const,
        occurredAt: verified.updated,
        evidence: verified.evidence,
        amountMinor: verified.gross,
        currency: config.currency,
      };
      // This records financial truth even after consent withdrawal. It does not
      // acknowledge consent, extend access or enqueue another activation email.
      await applyCommerceEventInTransaction(client, event);
      await client.query(
        "UPDATE amp_classwallet_payments SET completed_at=now(),error_code=NULL,conversion_payload=$2 WHERE order_id=$1",
        [paymentId, JSON.stringify({ requestId: request.id, events: [event] })],
      );
      return "completed";
    },
    true,
  );
}
