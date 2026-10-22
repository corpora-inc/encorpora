import type { Pool } from "pg";
import { z } from "zod";
import { canonicalCommercePayload } from "../commerce/ledger.js";
import {
  fundingOfferSchema,
  FundingPurchaseError,
  type FundingOffer,
} from "./contracts.js";
import { fundingRequestRow } from "./repository.js";
import { provisionFundingRequest } from "./provision.js";
import {
  ClassWalletError,
  classWalletConfigSchema,
  prepareClassWalletProvision,
  validateClassWalletPayment,
  type ClassWalletRow,
  type ClassWalletConfig,
} from "./classwallet.js";

// Explicit allowlist excludes report names, school names, email and free-form fields.
const economicFields = [
  "Order ID",
  "Transaction ID",
  "Invoice/Quote",
  "Organization",
  "State",
  "Distribution Name",
  "Payment Amount",
  "Total",
  "Fee",
  "Status",
  "Payment Approval Date",
  "Last Update",
];
const iso = (v: Date | string) => new Date(v).toISOString();
/** Operator-sourced report only. A public invoice or claimed payment is not payment evidence. */
export async function stageClassWalletPayment(
  pool: Pool,
  row: ClassWalletRow,
  input: ClassWalletConfig,
  reportSha256: string,
  apply: boolean,
  at = new Date(),
) {
  const config = classWalletConfigSchema.parse(input);
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(reportSha256);
  z.string().uuid().parse(row["Invoice/Quote"]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,5))", [
      row["Invoice/Quote"],
    ]);
    const requestResult = await client.query(
      "SELECT * FROM amp_funding_requests WHERE id=$1",
      [row["Invoice/Quote"]],
    );
    const intentResult = await client.query(
      "SELECT id, offer_snapshot, created_at, expires_at, state FROM amp_funding_invoice_intents WHERE id=$1 FOR UPDATE",
      [row["Invoice/Quote"]],
    );
    const stored = requestResult.rows[0] ?? intentResult.rows[0];
    if (!stored) throw new ClassWalletError("unknown_invoice");
    if (stored.status === "cancelled" || stored.state === "cancelled")
      throw new ClassWalletError("cancelled_invoice");
    const quote = {
      id: stored.id,
      offer: fundingOfferSchema.parse(stored.offer_snapshot),
      createdAt: iso(stored.created_at),
    };
    const verified = validateClassWalletPayment(
      row,
      quote,
      config,
      at.toISOString(),
    );
    const existing = await client.query(
      "SELECT * FROM amp_classwallet_payments WHERE order_id=$1 OR invoice_id=$2 FOR UPDATE",
      [verified.orderId, quote.id],
    );
    if (existing.rowCount) {
      const old = existing.rows[0];
      if (
        existing.rowCount !== 1 ||
        old.order_id !== verified.orderId ||
        old.invoice_id !== quote.id ||
        validateClassWalletPayment(
          old.payment_row,
          quote,
          old.verified_config,
          at.toISOString(),
        ).evidence !== verified.evidence
      )
        throw new ClassWalletError("previous_payment_mismatch");
    } else if (verified.updated > iso(stored.expires_at))
      throw new ClassWalletError("payment_after_invoice_expiry");
    const safeRow = Object.fromEntries(
      economicFields.map((key) => [key, row[key]]),
    );
    if (apply && !existing.rowCount) {
      await client.query(
        "INSERT INTO amp_classwallet_payments(order_id,invoice_id,report_sha256,payment_row,verified_config) VALUES($1,$2,$3,$4,$5)",
        [
          verified.orderId,
          quote.id,
          reportSha256,
          JSON.stringify(safeRow),
          JSON.stringify(config),
        ],
      );
      if (intentResult.rowCount)
        await client.query(
          "UPDATE amp_funding_invoice_intents SET received_payment_at=COALESCE(received_payment_at,$2) WHERE id=$1",
          [quote.id, at.toISOString()],
        );
    }
    await client.query("COMMIT");
    return { claimed: !!requestResult.rowCount, replay: !!existing.rowCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Persist one stable conversion before provisioning; concurrent workers replay that exact payload. */
export async function reconcileClassWalletPayments(
  pool: Pool,
  offers: readonly FundingOffer[],
) {
  // Deleting a learner may remove an unconverted claim. Preserve the financial
  // evidence and expose the orphan for refund/rebinding review, never grant it.
  const orphaned = await pool.query(
    "UPDATE amp_classwallet_payments SET stopped_at=now(),error_code='invoice_record_unavailable' WHERE order_id IN (SELECT p.order_id FROM amp_classwallet_payments p WHERE p.completed_at IS NULL AND p.stopped_at IS NULL AND NOT EXISTS (SELECT 1 FROM amp_funding_requests r WHERE r.id=p.invoice_id) AND NOT EXISTS (SELECT 1 FROM amp_funding_invoice_intents i WHERE i.id=p.invoice_id) LIMIT 8)",
  );
  const pending = await pool.query(
    "SELECT p.order_id FROM amp_classwallet_payments p JOIN amp_funding_requests r ON r.id=p.invoice_id WHERE p.completed_at IS NULL AND p.stopped_at IS NULL AND p.next_attempt_at<=now() ORDER BY p.received_at LIMIT 8",
  );
  let provisioned = 0,
    deferred = 0,
    stopped = orphaned.rowCount ?? 0;
  for (const { order_id: orderId } of pending.rows) {
    const client = await pool.connect();
    let payload: unknown;
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout='5s'");
      const found = await client.query(
        "SELECT * FROM amp_classwallet_payments WHERE order_id=$1 AND completed_at IS NULL AND stopped_at IS NULL FOR UPDATE",
        [orderId],
      );
      if (!found.rowCount) {
        await client.query("COMMIT");
        continue;
      }
      const payment = found.rows[0];
      const requests = await client.query(
        "SELECT * FROM amp_funding_requests WHERE id=$1",
        [payment.invoice_id],
      );
      if (!requests.rowCount) {
        await client.query("COMMIT");
        continue;
      }
      const stored = requests.rows[0],
        request = fundingRequestRow(stored);
      payload =
        payment.conversion_payload ??
        prepareClassWalletProvision(
          payment.payment_row,
          request,
          payment.verified_config,
          new Date().toISOString(),
          stored.conversion_payload ?? undefined,
        );
      if (
        request.orderId &&
        (request.orderId !== orderId ||
          canonicalCommercePayload(payload) !==
            canonicalCommercePayload(stored.conversion_payload))
      )
        throw new ClassWalletError("previous_payment_mismatch");
      await client.query(
        "UPDATE amp_classwallet_payments SET conversion_payload=$2 WHERE order_id=$1",
        [orderId, JSON.stringify(payload)],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof ClassWalletError || error instanceof z.ZodError) {
        await pool.query(
          "UPDATE amp_classwallet_payments SET stopped_at=now(),error_code='invalid_conversion' WHERE order_id=$1 AND completed_at IS NULL",
          [orderId],
        );
        stopped++;
      } else {
        await pool.query(
          "UPDATE amp_classwallet_payments SET next_attempt_at=now()+interval '5 minutes',error_code='conversion_unavailable' WHERE order_id=$1 AND completed_at IS NULL AND stopped_at IS NULL",
          [orderId],
        );
        deferred++;
      }
      continue;
    } finally {
      client.release();
    }
    try {
      await provisionFundingRequest(pool, payload, offers);
      await pool.query(
        "UPDATE amp_classwallet_payments SET completed_at=now(),error_code=NULL WHERE order_id=$1",
        [orderId],
      );
      provisioned++;
    } catch (error) {
      const code =
        error instanceof FundingPurchaseError
          ? error.code
          : "provisioning_unavailable";
      const result = await pool.query(
        "UPDATE amp_classwallet_payments SET attempts=attempts+1,error_code=$2,next_attempt_at=now()+interval '5 minutes',stopped_at=CASE WHEN attempts+1>=8 THEN now() ELSE stopped_at END WHERE order_id=$1 AND completed_at IS NULL RETURNING stopped_at",
        [orderId, code],
      );
      if (result.rows[0]?.stopped_at) stopped++;
      else deferred++;
    }
  }
  return { provisioned, deferred, stopped };
}
