import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  GoogleDataManager,
  GoogleConversionError,
  googleAdultEmailHash,
  googleConversionDestinationKey,
  googleDestinationSchema,
  type GooglePurchase,
} from "./google-data-manager.js";
import {
  confirmedAdvertisingEmail,
  purchaseMeasurementView,
} from "./permission.js";
import { currentMeasurementNotice } from "./permission-contracts.js";
import {
  measurementSourcesSchema,
  verifiedAdvertisingPayment,
} from "./verified-payment.js";
import {
  measurementPaymentPage,
  queueGooglePayment,
} from "./purchase-queue.js";
import { paymentClickEvidence } from "./payment-clicks.js";
import { googleClickIdentifiersSchema } from "./click-identifiers.js";
import { RETENTION } from "../privacy/retention-periods.js";

export const googleDeliveryConfigSchema = z.strictObject({
  enabled: z.boolean().default(false),
  matchingMode: z.enum(["click_only", "enhanced_email"]).optional(),
  destination: googleDestinationSchema,
  sources: measurementSourcesSchema,
});
export type GoogleDeliveryConfig = z.infer<typeof googleDeliveryConfigSchema>;
export interface DeliveryRuntime {
  accessToken: () => Promise<string>;
  /** Tests replace only the external HTTP boundary. Production uses native fetch. */
  fetcher?: typeof fetch;
}
const exportId = z.string().regex(/^amp_[a-f0-9]{64}$/);
const minute = 60_000;
const day = 86400_000;
async function token(runtime: DeliveryRuntime) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      runtime.accessToken(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error()), 10000);
      }),
    ]);
    if (
      typeof value !== "string" ||
      !/^[A-Za-z0-9._~+/=-]{1,8192}$/.test(value)
    )
      throw new Error();
    return value;
  } catch {
    throw new GoogleConversionError("credentials_unavailable", "not_sent");
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function begin(client: PoolClient, account?: string) {
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query("SET LOCAL statement_timeout='15s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout='20s'");
  if (account)
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      account,
    ]);
}
async function readQueue(client: PoolClient, id: string) {
  return (
    await client.query(
      "SELECT * FROM amp_google_purchase_queue WHERE transaction_id=$1 FOR UPDATE",
      [id],
    )
  ).rows[0];
}
/** Caller holds the exclusive account lock. Email row stays FOR SHARE until send
 * finishes. Commerce and Stripe evidence writers take this same account lock. */
async function candidate(
  client: PoolClient,
  row: any,
  config: GoogleDeliveryConfig,
  correction: boolean,
) {
  if (
    !row ||
    row.destination_key !== googleConversionDestinationKey(config.destination)
  )
    return null;
  if (
    row.state !== "ready" &&
    !(
      correction &&
      row.state === "cancelled" &&
      row.cancellation_reason === "payment_changed"
    )
  )
    return null;
  const now = (await client.query("SELECT clock_timestamp() AS now")).rows[0]
    .now as Date;
  if (+row.occurred_at <= +now - RETENTION.advertisingPaymentDays * day)
    return null;
  const permission = await purchaseMeasurementView(client, row.account_id);
  if (
    permission.status !== "active" ||
    permission.revision !== row.permission_revision ||
    currentMeasurementNotice(permission) !== row.permission_notice ||
    permission.grantedAt !== row.permission_granted_at.toISOString() ||
    permission.expiresAt !== row.permission_expires_at.toISOString()
  )
    return null;
  const payment = await verifiedAdvertisingPayment(
    client,
    config.sources,
    { kind: row.source_kind, id: row.source_id },
    now,
  );
  if (
    !payment ||
    payment.refundPending ||
    payment.accountId !== row.account_id ||
    payment.occurredAt !== row.occurred_at.toISOString() ||
    payment.originalMinor !== Number(row.original_minor) ||
    (!correction && payment.netMinor === 0)
  )
    return null;
  const click = await paymentClickEvidence(
    client,
    row.account_id,
    { kind: row.source_kind, id: row.source_id },
    "google",
  );
  const identifiers =
    click && Date.parse(click.observedAt) <= Date.parse(payment.occurredAt)
      ? googleClickIdentifiersSchema.parse(click.identifiers)
      : undefined;
  const clickOnly = config.matchingMode === "click_only";
  if (clickOnly && !identifiers) return { missingClick: true as const };
  const email = clickOnly
    ? undefined
    : await confirmedAdvertisingEmail(client, row.account_id);
  if (!clickOnly && !email) return null;
  const purchase: GooglePurchase = {
    matchingMode: config.matchingMode,
    ...(identifiers ? { adIdentifiers: identifiers } : {}),
    eventSource: row.source_kind === "stripe" ? "WEB" : "OTHER",
    transactionId: row.transaction_id,
    occurredAt: payment.occurredAt,
    amountMinor: payment.netMinor,
    currency: "USD",
    ...(email ? { adultEmailSha256: googleAdultEmailHash(email) } : {}),
    permission: {
      adultAttested: true,
      adUserData: true,
      adPersonalization: false,
      grantedAt: permission.grantedAt!,
      expiresAt: permission.expiresAt!,
    },
  };
  return { purchase, now };
}
export type DeliveryOutcome =
  | "disabled"
  | "ineligible"
  | "missing_click"
  | "blocked"
  | "unchanged"
  | "correction_blocked"
  | "accepted"
  | "not_sent"
  | "rejected"
  | "unknown";

/** No external event values are accepted. Persist unknown BEFORE network I/O,
 * then reacquire the lock and rederive every fact. Unknown/rejected attempts are
 * never automatically retried. A DB/HTTP interruption remains conservatively
 * unknown; this cannot promise an atomic commit across two independent systems. */
export async function deliverGooglePayment(
  pool: Pool,
  rawConfig: GoogleDeliveryConfig,
  id: string,
  runtime: DeliveryRuntime,
): Promise<DeliveryOutcome> {
  const config = googleDeliveryConfigSchema.parse(rawConfig);
  exportId.parse(id);
  if (!config.enabled) return "disabled";
  const credential = await token(runtime); // bounded; no privacy lock held during OAuth
  const client = await pool.connect();
  let intent: string | undefined;
  let broken = false;
  const onError = () => {
    broken = true;
  };
  client.on("error", onError);
  try {
    const owner = (
      await client.query(
        "SELECT account_id FROM amp_google_purchase_queue WHERE transaction_id=$1",
        [id],
      )
    ).rows[0]?.account_id;
    if (!owner) return "ineligible";
    await begin(client, owner);
    const row = await readQueue(client, id);
    const attempts = (
      await client.query(
        "SELECT * FROM amp_google_delivery_attempts WHERE transaction_id=$1 AND state<>'not_sent' ORDER BY CASE WHEN state IN ('unknown','rejected') THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 1",
        [id],
      )
    ).rows;
    // Any unresolved/rejected submission needs operator reconciliation, not blind resubmission.
    if (attempts.some((a) => a.state === "unknown" || a.state === "rejected")) {
      await client.query("COMMIT");
      return "blocked";
    }
    const prior = attempts.find((a) => a.state === "accepted");
    if (prior && prior.processing !== "success") {
      await client.query("COMMIT");
      return "blocked";
    }
    const ready = await candidate(client, row, config, !!prior);
    if (!ready || "missingClick" in ready) {
      await client.query("COMMIT");
      return prior
        ? "correction_blocked"
        : ready
          ? "missing_click"
          : "ineligible";
    }
    if (prior && Number(prior.amount_minor) === ready.purchase.amountMinor) {
      await client.query("COMMIT");
      return "unchanged";
    }
    intent = randomUUID();
    await client.query(
      "INSERT INTO amp_google_delivery_attempts(id,transaction_id,kind,amount_minor,state) VALUES($1,$2,$3,$4,'unknown')",
      [intent, id, prior ? "restate" : "purchase", ready.purchase.amountMinor],
    );
    await client.query("COMMIT"); // durable even if this process disappears before the next statement

    await begin(client, owner);
    const current = await readQueue(client, id);
    const checked = await candidate(client, current, config, !!prior);
    if (
      !checked ||
      "missingClick" in checked ||
      JSON.stringify(checked.purchase) !== JSON.stringify(ready.purchase)
    ) {
      await client.query(
        "UPDATE amp_google_delivery_attempts SET state='not_sent',error_code='evidence_changed',completed_at=clock_timestamp() WHERE id=$1",
        [intent],
      );
      await client.query("COMMIT");
      return "not_sent";
    }
    // Original destination includes its immutable manager access path.
    const transport = new GoogleDataManager(
      current.destination,
      async () => credential,
      runtime.fetcher,
    );
    let outcome: DeliveryOutcome;
    try {
      const receipt = prior
        ? await transport.restate(checked.purchase, "ingest", checked.now)
        : await transport.purchase(checked.purchase, "ingest", checked.now);
      if (receipt.kind !== "accepted")
        throw new GoogleConversionError("invalid_provider_response", "unknown");
      await client.query(
        `UPDATE amp_google_delivery_attempts SET state='accepted',receipt=$2,processing='pending',
        completed_at=clock_timestamp(),next_poll_at=clock_timestamp()+interval '30 minutes' WHERE id=$1`,
        [intent, receipt],
      );
      outcome = "accepted";
    } catch (error) {
      if (broken) throw error;
      const safe =
        error instanceof GoogleConversionError
          ? error
          : new GoogleConversionError("delivery_interrupted", "unknown");
      await client.query(
        "UPDATE amp_google_delivery_attempts SET state=$2,error_code=$3,completed_at=clock_timestamp() WHERE id=$1",
        [intent, safe.outcome, safe.code],
      );
      outcome = safe.outcome;
    }
    await client.query("COMMIT");
    return outcome;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (intent) return "unknown"; // even commit acknowledgement may have been lost
    throw error;
  } finally {
    client.removeListener("error", onError);
    client.release(broken);
  }
}

/** Read-only provider diagnostics can continue after withdrawal: they disclose
 * the retained request receipt, never another adult email/event payload. */
export async function diagnoseGooglePayment(
  pool: Pool,
  rawConfig: GoogleDeliveryConfig,
  runtime: DeliveryRuntime,
) {
  const config = googleDeliveryConfigSchema.parse(rawConfig);
  if (!config.enabled) return "disabled";
  const credential = await token(runtime);
  const client = await pool.connect();
  let broken = false;
  const onError = () => {
    broken = true;
  };
  client.on("error", onError);
  try {
    await begin(client);
    const row = (
      await client.query(
        `SELECT a.*,q.destination FROM amp_google_delivery_attempts a
      JOIN amp_google_purchase_queue q USING(transaction_id)
      WHERE q.destination_key=$1 AND a.processing='pending' AND a.next_poll_at<=clock_timestamp()
      ORDER BY a.next_poll_at,a.id LIMIT 1 FOR UPDATE OF a SKIP LOCKED`,
        [googleConversionDestinationKey(config.destination)],
      )
    ).rows[0];
    if (!row) {
      await client.query("COMMIT");
      return "idle";
    }
    const now = (await client.query("SELECT clock_timestamp() AS now")).rows[0]
      .now as Date;
    if (+now >= +row.completed_at + day || row.poll_count >= 100) {
      await client.query(
        "UPDATE amp_google_delivery_attempts SET processing='timeout',next_poll_at=NULL WHERE id=$1",
        [row.id],
      );
      await client.query("COMMIT");
      return "timeout";
    }
    let diagnostics: unknown = null;
    let processing = "pending";
    let errorCode: string | null = null;
    try {
      const result = await new GoogleDataManager(
        row.destination,
        async () => credential,
        runtime.fetcher,
      ).status(row.receipt);
      diagnostics = result;
      if (result.status === "FAILED") processing = "failed";
      else if (
        result.status === "PARTIAL_SUCCESS" ||
        result.errors.length ||
        result.warnings.length ||
        result.fieldWarningCount
      )
        processing = "issues";
      else if (result.status === "SUCCESS") processing = "success";
    } catch (error) {
      if (broken) throw error;
      errorCode =
        error instanceof GoogleConversionError
          ? error.code
          : "diagnostics_unavailable";
    }
    const delay = Math.min(60, 30 * 1.3 ** (row.poll_count + 1)) * minute;
    // Positive jitter stays within the 60-minute cap. Clamp to the 24-hour deadline.
    const next = new Date(
      Math.min(
        +row.completed_at + day,
        +now + Math.min(60 * minute, delay * (1 + Math.random() * 0.05)),
      ),
    );
    await client.query(
      `UPDATE amp_google_delivery_attempts SET processing=$2,diagnostics=$3,error_code=$4,
      poll_count=poll_count+1,next_poll_at=$5 WHERE id=$1`,
      [
        row.id,
        processing,
        diagnostics,
        errorCode,
        processing === "pending" ? next : null,
      ],
    );
    await client.query("COMMIT");
    return processing;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.removeListener("error", onError);
    client.release(broken);
  }
}

function configKey(config: GoogleDeliveryConfig) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        googleConversionDestinationKey(config.destination),
        config.sources.stripeNamespace ?? null,
        config.sources.efaChannelReference ?? null,
        config.sources.azEsaChannelReference ?? null,
      ]),
    )
    .digest("hex");
}
/** Complete bounded pages and persist progress only after every item. Replaying
 * a page is safe; compare-and-set prevents concurrent collectors moving it back. */
export async function googleMeasurementBatch(
  pool: Pool,
  rawConfig: GoogleDeliveryConfig,
  operation: "collect" | "deliver",
  limit = 20,
  runtime?: DeliveryRuntime,
) {
  const config = googleDeliveryConfigSchema.parse(rawConfig);
  z.enum(["collect", "deliver"]).parse(operation);
  z.number().int().min(1).max(200).parse(limit);
  if (!config.enabled) return { disabled: 1 };
  if (operation === "deliver" && !runtime)
    throw new Error("measurement_credentials_required");
  const key = configKey(config);
  const counts: Record<string, number> = {};
  const kinds =
    operation === "collect"
      ? (["stripe", "arkansas-efa", "arizona-esa"] as const)
      : (["delivery"] as const);
  for (const kind of kinds) {
    await pool.query(
      "INSERT INTO amp_google_collection_cursors(config_key,kind) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [key, kind],
    );
    const cursor = (
      await pool.query(
        "SELECT after_id,revision FROM amp_google_collection_cursors WHERE config_key=$1 AND kind=$2",
        [key, kind],
      )
    ).rows[0];
    const after = cursor.after_id;
    let next: string | null;
    if (kind === "delivery") {
      const page = (
        await pool.query(
          `SELECT transaction_id FROM amp_google_purchase_queue WHERE destination_key=$1
        AND ($2::text IS NULL OR transaction_id>$2) ORDER BY transaction_id LIMIT $3`,
          [
            googleConversionDestinationKey(config.destination),
            after,
            limit + 1,
          ],
        )
      ).rows;
      for (const row of page.slice(0, limit)) {
        const outcome = await deliverGooglePayment(
          pool,
          config,
          row.transaction_id,
          runtime!,
        );
        counts[outcome] = (counts[outcome] ?? 0) + 1;
      }
      next = page.length > limit ? page[limit - 1].transaction_id : null;
    } else {
      const page = await measurementPaymentPage(
        pool,
        config.sources,
        kind,
        after,
        limit,
      );
      for (const ref of page.references) {
        const result = await queueGooglePayment(
          pool,
          config.destination,
          config.sources,
          ref,
        );
        counts[result.outcome] = (counts[result.outcome] ?? 0) + 1;
      }
      next = page.next;
    }
    await pool.query(
      "UPDATE amp_google_collection_cursors SET after_id=$3,revision=revision+1 WHERE config_key=$1 AND kind=$2 AND revision=$4::bigint",
      [key, kind, next, cursor.revision],
    );
  }
  return counts;
}
