import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  googleConversionDestinationKey,
  type GoogleConversionDestination,
} from "./google-data-manager.js";
import { currentMeasurementNotice } from "./permission-contracts.js";
import { purchaseMeasurementView } from "./permission.js";
import { RETENTION } from "../privacy/retention-periods.js";
import {
  measurementSourcesSchema,
  paymentReferenceSchema,
  verifiedAdvertisingPayment,
  type MeasurementSources,
  type PaymentReference,
} from "./verified-payment.js";

type QueueResult =
  | {
      outcome: "queued" | "retained" | "held" | "cancelled";
      transactionId: string;
    }
  | { outcome: "ineligible" | "permission_unavailable" };

/** Local queue preparation, never an external upload. Each source is a retained
 * financial record selected from this database. No browser endpoint calls this.
 * A cancelled entry is terminal: permission regrant cannot resurrect old payments.
 */
export async function queueGooglePayment(
  pool: Pool,
  destination: GoogleConversionDestination,
  rawSources: MeasurementSources,
  rawReference: PaymentReference,
): Promise<QueueResult> {
  const destinationKey = googleConversionDestinationKey(destination);
  const sources = measurementSourcesSchema.parse(rawSources);
  const reference = paymentReferenceSchema.parse(rawReference);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    const prior = (
      await client.query(
        "SELECT account_id FROM amp_google_purchase_queue WHERE destination_key=$1 AND source_kind=$2 AND source_id=$3",
        [destinationKey, reference.kind, reference.id],
      )
    ).rows[0];
    // Ownership discovery does not lock financial rows ahead of the account.
    const discovered = prior
      ? null
      : await verifiedAdvertisingPayment(client, sources, reference);
    const account = prior?.account_id ?? discovered?.accountId;
    if (!account) {
      await client.query("COMMIT");
      return { outcome: "ineligible" };
    }
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      account,
    ]);
    const now = (await client.query("SELECT clock_timestamp() AS now")).rows[0]
      .now as Date;
    const existing = (
      await client.query(
        "SELECT * FROM amp_google_purchase_queue WHERE destination_key=$1 AND source_kind=$2 AND source_id=$3 FOR UPDATE",
        [destinationKey, reference.kind, reference.id],
      )
    ).rows[0];
    if (existing?.state === "cancelled") {
      await client.query("COMMIT");
      return { outcome: "cancelled", transactionId: existing.transaction_id };
    }
    const payment = await verifiedAdvertisingPayment(
      client,
      sources,
      reference,
      now,
    );
    const permission = await purchaseMeasurementView(client, account);
    let reason:
      "expired" | "payment_changed" | "permission_changed" | undefined;
    const occurredAt =
      existing?.occurred_at.toISOString() ?? payment?.occurredAt;
    if (
      occurredAt &&
      Date.parse(occurredAt) <=
        +now - RETENTION.advertisingPaymentDays * 86400000
    )
      reason = "expired";
    else if (
      permission.status !== "active" ||
      !permission.revision ||
      !permission.grantedAt ||
      !permission.expiresAt ||
      (occurredAt &&
        Date.parse(permission.grantedAt) > Date.parse(occurredAt)) ||
      (existing &&
        (existing.permission_revision !== permission.revision ||
          existing.permission_notice !== currentMeasurementNotice(permission)))
    )
      reason = "permission_changed";
    else if (
      payment &&
      (payment.accountId !== account ||
        payment.netMinor === 0 ||
        (existing &&
          (existing.account_id !== account ||
            Number(existing.original_minor) !== payment.originalMinor ||
            existing.occurred_at.toISOString() !== payment.occurredAt)))
    )
      reason = "payment_changed";
    if (reason) {
      if (existing) {
        await cancel(client, existing.transaction_id, reason);
        await client.query("COMMIT");
        return { outcome: "cancelled", transactionId: existing.transaction_id };
      }
      await client.query("COMMIT");
      return {
        outcome:
          reason === "permission_changed"
            ? "permission_unavailable"
            : "ineligible",
      };
    }
    if (!payment || payment.refundPending) {
      if (!existing) {
        await client.query("COMMIT");
        return { outcome: "ineligible" };
      }
      await client.query(
        "UPDATE amp_google_purchase_queue SET state='held',hold_reason=$2,updated_at=clock_timestamp() WHERE transaction_id=$1",
        [
          existing.transaction_id,
          payment ? "refund_pending" : "payment_unavailable",
        ],
      );
      await client.query("COMMIT");
      return { outcome: "held", transactionId: existing.transaction_id };
    }
    if (existing) {
      await client.query(
        "UPDATE amp_google_purchase_queue SET net_minor=$2,state='ready',hold_reason=NULL,updated_at=clock_timestamp() WHERE transaction_id=$1",
        [existing.transaction_id, payment!.netMinor],
      );
      await client.query("COMMIT");
      return { outcome: "retained", transactionId: existing.transaction_id };
    }
    const transactionId = `amp_${randomBytes(32).toString("hex")}`;
    await client.query(
      `INSERT INTO amp_google_purchase_queue(transaction_id,destination_key,destination,source_kind,source_id,account_id,
        occurred_at,original_minor,net_minor,currency,permission_revision,permission_notice,permission_granted_at,permission_expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'USD',$10,$11,$12,$13)`,
      [
        transactionId,
        destinationKey,
        JSON.stringify(destination),
        reference.kind,
        reference.id,
        account,
        payment!.occurredAt,
        payment!.originalMinor,
        payment!.netMinor,
        permission.revision,
        currentMeasurementNotice(permission),
        permission.grantedAt,
        permission.expiresAt,
      ],
    );
    await client.query("COMMIT");
    return { outcome: "queued", transactionId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function cancel(client: PoolClient, id: string, reason: string) {
  await client.query(
    "UPDATE amp_google_purchase_queue SET state='cancelled',cancellation_reason=$2,hold_reason=NULL,updated_at=clock_timestamp() WHERE transaction_id=$1 AND state IN ('ready','held')",
    [id, reason],
  );
}

/** Deterministic keyset pages for a private worker. Keep the returned cursor in
 * private operator state, never public logs. Start another full sweep after the
 * last page: concurrent inserts behind a cursor are visited on that next sweep.
 * Selection is only discovery; queueGooglePayment rechecks every financial and
 * permission fact under the account lock. No source value is an ad payload.
 */
export async function measurementPaymentPage(
  pool: Pool,
  rawSources: MeasurementSources,
  kind: PaymentReference["kind"],
  after: string | null = null,
  limit = 100,
): Promise<{ references: PaymentReference[]; next: string | null }> {
  const sources = measurementSourcesSchema.parse(rawSources);
  z.enum(["stripe", "arkansas-efa"]).parse(kind);
  z.number().int().min(1).max(200).parse(limit);
  if (after !== null) paymentReferenceSchema.parse({ kind, id: after });
  let result;
  if (kind === "stripe") {
    if (!sources.stripeNamespace) return { references: [], next: null };
    result = await pool.query(
      `SELECT id::text AS id FROM amp_payment_records WHERE namespace=$1
       AND ($2::uuid IS NULL OR id>$2::uuid) ORDER BY id LIMIT $3`,
      [sources.stripeNamespace, after, limit + 1],
    );
  } else {
    if (!sources.efaChannelReference) return { references: [], next: null };
    result = await pool.query(
      `SELECT o.id FROM amp_commerce_orders o JOIN amp_funding_requests r ON r.order_id=o.id AND r.account_id=o.account_id
       WHERE o.channel='esa' AND o.channel_reference=$1 AND ($2::text IS NULL OR o.id>$2)
       AND r.offer_snapshot->>'programId'='ar-efa' AND r.offer_snapshot->>'jurisdiction'='AR'
       ORDER BY o.id LIMIT $3`,
      [sources.efaChannelReference, after, limit + 1],
    );
  }
  const references = result.rows
    .slice(0, limit)
    .map((row) => ({ kind, id: row.id as string }));
  return {
    references,
    next: result.rows.length > limit ? references.at(-1)!.id : null,
  };
}
/** Delete only after the selection/delivery window has closed, preventing a
 * later sweep from allocating a new export ID for a retained old payment. */
export async function purgeGooglePurchaseQueue(pool: Pool) {
  const result = await pool.query(
    "DELETE FROM amp_google_purchase_queue WHERE occurred_at<=clock_timestamp()-($1::int * interval '1 day')",
    [RETENTION.advertisingPaymentDays],
  );
  return result.rowCount ?? 0;
}
