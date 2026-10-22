import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  MetaConversions,
  MetaConversionError,
  metaAdultEmailHash,
  metaDestinationSchema,
  metaPurchaseRequest,
  metaMatchingIdentifiersSchema,
  type MetaPurchase,
} from "./meta-conversions.js";
import {
  confirmedAdvertisingEmail,
  purchaseMeasurementView,
} from "./permission.js";
import {
  currentMeasurementNotice,
  META_PURCHASE_MEASUREMENT_NOTICE,
} from "./permission-contracts.js";
import {
  measurementSourcesSchema,
  verifiedAdvertisingPayment,
  paymentReferenceSchema,
  type PaymentReference,
} from "./verified-payment.js";
import { paymentClickEvidence } from "./payment-clicks.js";
import { RETENTION } from "../privacy/retention-periods.js";

export const metaDeliveryConfigSchema = z.strictObject({
  enabled: z.boolean().default(false),
  destination: metaDestinationSchema.omit({ enabled: true }),
  sources: measurementSourcesSchema,
});
export type MetaDeliveryConfig = z.infer<typeof metaDeliveryConfigSchema>;
export interface MetaDeliveryRuntime {
  accessToken: () => Promise<string>;
  fetcher?: typeof fetch;
}
const eventIdSchema = z.string().regex(/^amp_meta_[a-f0-9]{64}$/);
async function begin(client: PoolClient, account: string) {
  await client.query("BEGIN");
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query("SET LOCAL statement_timeout='15s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout='20s'");
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    account,
  ]);
}
/** The account lock and confirmed-email FOR SHARE lock stay held through I/O.
 * Browser context is re-read, never copied into the durable delivery ledger. */
async function evidence(
  client: PoolClient,
  config: MetaDeliveryConfig,
  reference: PaymentReference,
  account: string,
) {
  const now = (await client.query("SELECT clock_timestamp() AS now")).rows[0]
    .now as Date;
  const context =
    reference.kind === "stripe"
      ? (
          await client.query(
            "SELECT * FROM amp_meta_purchase_contexts WHERE payment_id=$1 AND account_id=$2 AND namespace=$3 AND expires_at>$4",
            [reference.id, account, config.sources.stripeNamespace, now],
          )
        ).rows[0]
      : null;
  if (reference.kind === "stripe" && !context) return null;
  const permission = await purchaseMeasurementView(client, account, "meta");
  if (
    permission.status !== "active" ||
    !permission.grantedAt ||
    !permission.expiresAt ||
    (context &&
      (permission.revision !== context.permission_revision ||
        currentMeasurementNotice(permission) !== context.permission_notice)) ||
    currentMeasurementNotice(permission) !==
      META_PURCHASE_MEASUREMENT_NOTICE.version
  )
    return null;
  const payment = await verifiedAdvertisingPayment(
    client,
    config.sources,
    reference,
    now,
  );
  if (
    !payment ||
    payment.accountId !== account ||
    payment.netMinor <= 0 ||
    payment.refundPending ||
    (context && payment.occurredAt !== context.occurred_at.toISOString())
  )
    return null;
  const email = await confirmedAdvertisingEmail(client, account);
  if (!email) return null;
  const click = await paymentClickEvidence(client, account, reference, "meta");
  const purchase: Omit<MetaPurchase, "eventId"> = {
    ...(click && Date.parse(click.observedAt) <= Date.parse(payment.occurredAt)
      ? {
          clickIdentifiers: metaMatchingIdentifiersSchema.parse(
            click.identifiers,
          ),
        }
      : {}),
    occurredAt: payment.occurredAt,
    amountMinor: payment.netMinor,
    currency: "USD",
    adultEmailSha256: metaAdultEmailHash(email),
    source: context
      ? {
          actionSource: "website",
          eventSourceUrl: context.event_source_url,
          clientUserAgent: context.client_user_agent,
        }
      : { actionSource: "other" },
    permission: {
      noticeVersion: META_PURCHASE_MEASUREMENT_NOTICE.version,
      adultAttested: true,
      purpose: "measurement-and-ad-delivery",
      grantedAt: permission.grantedAt,
      expiresAt: permission.expiresAt,
    },
  };
  try {
    metaPurchaseRequest(
      { ...purchase, eventId: `amp_meta_${"0".repeat(64)}` },
      { kind: "preview" },
      now,
    );
  } catch {
    return null;
  }
  return {
    purchase,
    originalMinor: payment.originalMinor,
    revision: permission.revision,
    notice: currentMeasurementNotice(permission),
  };
}

/** One immutable event identity per retained payment, even after destination
 * changes or permission regrant. No external I/O; no browser-supplied facts. */
export async function queueMetaPayment(
  pool: Pool,
  rawConfig: MetaDeliveryConfig,
  paymentId: string | PaymentReference,
) {
  const config = metaDeliveryConfigSchema.parse(rawConfig);
  const reference = paymentReferenceSchema.parse(
    typeof paymentId === "string"
      ? { kind: "stripe", id: paymentId }
      : paymentId,
  );
  // Arizona delivery requires its own retained source identity and collector.
  if (reference.kind === "arizona-esa")
    return { outcome: "ineligible" as const };
  const namespace =
    reference.kind === "stripe"
      ? config.sources.stripeNamespace
      : config.sources.efaChannelReference &&
        `esa:${config.sources.efaChannelReference}`;
  if (!namespace) return { outcome: "ineligible" as const };
  if (!config.enabled) return { outcome: "disabled" as const };
  const client = await pool.connect();
  try {
    const owner = (
      await client.query(
        reference.kind === "stripe"
          ? "SELECT account_id FROM amp_meta_purchase_contexts WHERE payment_id=$1"
          : "SELECT account_id FROM amp_commerce_orders WHERE id=$1 AND channel='esa' AND channel_reference=$2",
        reference.kind === "stripe"
          ? [reference.id]
          : [reference.id, config.sources.efaChannelReference],
      )
    ).rows[0]?.account_id;
    if (!owner) return { outcome: "ineligible" as const };
    await begin(client, owner);
    const prior = (
      await client.query(
        reference.kind === "stripe"
          ? "SELECT * FROM amp_meta_purchase_queue WHERE payment_id=$1 FOR UPDATE"
          : "SELECT * FROM amp_meta_purchase_queue WHERE efa_order_id=$1 FOR UPDATE",
        [reference.id],
      )
    ).rows[0];
    if (prior) {
      await client.query("COMMIT");
      return {
        outcome: "retained" as const,
        eventId: prior.event_id as string,
      };
    }
    const ready = await evidence(client, config, reference, owner);
    if (!ready) {
      await client.query("COMMIT");
      return { outcome: "ineligible" as const };
    }
    const eventId = `amp_meta_${randomBytes(32).toString("hex")}`;
    await client.query(
      `INSERT INTO amp_meta_purchase_queue(event_id,payment_id,account_id,namespace,dataset_id,occurred_at,original_minor,permission_revision,permission_notice,efa_order_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        eventId,
        reference.kind === "stripe" ? reference.id : null,
        owner,
        namespace,
        config.destination.datasetId,
        ready.purchase.occurredAt,
        ready.originalMinor,
        ready.revision,
        ready.notice,
        reference.kind === "arkansas-efa" ? reference.id : null,
      ],
    );
    await client.query("COMMIT");
    return { outcome: "queued" as const, eventId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
async function candidate(
  client: PoolClient,
  config: MetaDeliveryConfig,
  id: string,
) {
  const row = (
    await client.query(
      "SELECT * FROM amp_meta_purchase_queue WHERE event_id=$1 FOR UPDATE",
      [id],
    )
  ).rows[0];
  if (
    !row ||
    row.state !== "ready" ||
    row.dataset_id !== config.destination.datasetId ||
    row.namespace !==
      (row.efa_order_id
        ? `esa:${config.sources.efaChannelReference}`
        : config.sources.stripeNamespace)
  )
    return null;
  const checked = await evidence(
    client,
    config,
    row.efa_order_id
      ? { kind: "arkansas-efa", id: row.efa_order_id }
      : { kind: "stripe", id: row.payment_id },
    row.account_id,
  );
  if (
    !checked ||
    checked.revision !== row.permission_revision ||
    checked.notice !== row.permission_notice ||
    checked.purchase.occurredAt !== row.occurred_at.toISOString() ||
    checked.originalMinor !== Number(row.original_minor)
  )
    return null;
  return { ...checked.purchase, eventId: id };
}
async function credential(runtime: MetaDeliveryRuntime) {
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
    throw new MetaConversionError("credentials_unavailable", "not_sent");
  } finally {
    clearTimeout(timer);
  }
}
export type MetaDeliveryOutcome =
  | "disabled"
  | "ineligible"
  | "blocked"
  | "unchanged"
  | "accepted"
  | "not_sent"
  | "rejected"
  | "unknown";
/** Commit unknown intent before I/O; reacquire the shared privacy lock and
 * rederive all facts. Uncertain/rejected/accepted events never auto-resubmit.
 * There is no atomic transaction spanning PostgreSQL and Meta. */
export async function deliverMetaPayment(
  pool: Pool,
  rawConfig: MetaDeliveryConfig,
  id: string,
  runtime: MetaDeliveryRuntime,
): Promise<MetaDeliveryOutcome> {
  const config = metaDeliveryConfigSchema.parse(rawConfig);
  eventIdSchema.parse(id);
  if (!config.enabled) return "disabled";
  const token = await credential(runtime);
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
        "SELECT account_id FROM amp_meta_purchase_queue WHERE event_id=$1",
        [id],
      )
    ).rows[0]?.account_id;
    if (!owner) return "ineligible";
    await begin(client, owner);
    const attempts = (
      await client.query(
        "SELECT state FROM amp_meta_delivery_attempts WHERE event_id=$1 AND state<>'not_sent'",
        [id],
      )
    ).rows;
    if (attempts.length) {
      await client.query("COMMIT");
      return attempts.some((a) => a.state !== "accepted")
        ? "blocked"
        : "unchanged";
    }
    const ready = await candidate(client, config, id);
    if (!ready) {
      await client.query("COMMIT");
      return "ineligible";
    }
    intent = randomUUID();
    await client.query(
      "INSERT INTO amp_meta_delivery_attempts(id,event_id,amount_minor,state) VALUES($1,$2,$3,'unknown')",
      [intent, id, ready.amountMinor],
    );
    await client.query("COMMIT");
    await begin(client, owner);
    const checked = await candidate(client, config, id);
    if (!checked || JSON.stringify(checked) !== JSON.stringify(ready)) {
      await client.query(
        "UPDATE amp_meta_delivery_attempts SET state='not_sent',error_code='evidence_changed',completed_at=clock_timestamp() WHERE id=$1",
        [intent],
      );
      await client.query("COMMIT");
      return "not_sent";
    }
    const guardedFetch: typeof fetch = async (url, init) => {
      if (broken)
        throw new MetaConversionError("database_interrupted", "not_sent");
      return (runtime.fetcher ?? fetch)(url, init);
    };
    const transport = new MetaConversions(
      { ...config.destination, enabled: true },
      async () => token,
      guardedFetch,
    );
    let outcome: MetaDeliveryOutcome;
    try {
      const receipt = await transport.purchase(checked, { kind: "live" });
      if (receipt.kind !== "accepted")
        throw new MetaConversionError("invalid_provider_response", "unknown");
      await client.query(
        "UPDATE amp_meta_delivery_attempts SET state='accepted',receipt=$2,completed_at=clock_timestamp() WHERE id=$1",
        [intent, receipt],
      );
      outcome = "accepted";
    } catch (error) {
      if (broken) throw error;
      const safe =
        error instanceof MetaConversionError
          ? error
          : new MetaConversionError("delivery_interrupted", "unknown");
      await client.query(
        "UPDATE amp_meta_delivery_attempts SET state=$2,error_code=$3,completed_at=clock_timestamp() WHERE id=$1",
        [intent, safe.outcome, safe.code],
      );
      outcome = safe.outcome;
    }
    await client.query("COMMIT");
    return outcome;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (intent) return "unknown";
    throw error;
  } finally {
    client.removeListener("error", onError);
    client.release(broken);
  }
}

/** Bounded keyset sweeps; CAS checkpoints prevent a competing worker moving
 * progress backwards. A crash replays the page with the same event identities. */
export async function metaMeasurementBatch(
  pool: Pool,
  rawConfig: MetaDeliveryConfig,
  operation: "collect" | "deliver",
  limit = 20,
  runtime?: MetaDeliveryRuntime,
) {
  const config = metaDeliveryConfigSchema.parse(rawConfig);
  z.enum(["collect", "deliver"]).parse(operation);
  z.number().int().min(1).max(200).parse(limit);
  if (!config.enabled) return { disabled: 1 };
  if (operation === "deliver" && !runtime)
    throw new Error("measurement_credentials_required");
  const key = createHash("sha256")
    .update(JSON.stringify([config.destination.datasetId, config.sources]))
    .digest("hex");
  await pool.query(
    "INSERT INTO amp_meta_collection_cursors(config_key,kind) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [key, operation],
  );
  const cursor = (
    await pool.query(
      "SELECT after_id,revision FROM amp_meta_collection_cursors WHERE config_key=$1 AND kind=$2",
      [key, operation],
    )
  ).rows[0];
  const page = (
    await pool.query(
      operation === "collect"
        ? `SELECT id FROM (
           SELECT 'stripe:'||payment_id::text AS id FROM amp_meta_purchase_contexts
             WHERE namespace=$1 AND expires_at>clock_timestamp()
           UNION ALL
           SELECT 'arkansas-efa:'||o.id AS id FROM amp_commerce_orders o
             JOIN amp_funding_requests r ON r.order_id=o.id AND r.account_id=o.account_id
             WHERE o.channel='esa' AND o.channel_reference=$4
               AND o.order_state->>'settlement'='settled'
           ) candidates WHERE ($2::text IS NULL OR id>$2) ORDER BY id LIMIT $3`
        : "SELECT event_id AS id FROM amp_meta_purchase_queue WHERE namespace=ANY($1::text[]) AND ($2::text IS NULL OR event_id>$2) AND dataset_id=$4 ORDER BY event_id LIMIT $3",
      operation === "collect"
        ? [
            config.sources.stripeNamespace ?? null,
            cursor.after_id,
            limit + 1,
            config.sources.efaChannelReference ?? null,
          ]
        : [
            [
              config.sources.stripeNamespace,
              config.sources.efaChannelReference
                ? `esa:${config.sources.efaChannelReference}`
                : null,
            ].filter(Boolean),
            cursor.after_id,
            limit + 1,
            config.destination.datasetId,
          ],
    )
  ).rows;
  const counts: Record<string, number> = {};
  for (const row of page.slice(0, limit)) {
    const outcome =
      operation === "collect"
        ? (
            await queueMetaPayment(
              pool,
              config,
              row.id.startsWith("stripe:")
                ? { kind: "stripe", id: row.id.slice(7) }
                : { kind: "arkansas-efa", id: row.id.slice(13) },
            )
          ).outcome
        : await deliverMetaPayment(pool, config, row.id, runtime!);
    counts[outcome] = (counts[outcome] ?? 0) + 1;
  }
  await pool.query(
    "UPDATE amp_meta_collection_cursors SET after_id=$3,revision=revision+1 WHERE config_key=$1 AND kind=$2 AND revision=$4::bigint",
    [
      key,
      operation,
      page.length > limit ? page[limit - 1].id : null,
      cursor.revision,
    ],
  );
  return counts;
}
/** Keep minimal delivery history after context deletion. After 90 days the
 * seven-day capture/send window is closed, so purging cannot revive a sale. */
export async function purgeMetaPurchaseQueue(pool: Pool) {
  if (
    !(
      await pool.query(
        "SELECT to_regclass('amp_meta_purchase_queue') AS relation",
      )
    ).rows[0]?.relation
  )
    return 0;
  return (
    (
      await pool.query(
        "DELETE FROM amp_meta_purchase_queue WHERE occurred_at<=clock_timestamp()-($1::int*interval '1 day')",
        [RETENTION.advertisingPaymentDays],
      )
    ).rowCount ?? 0
  );
}

/** Aggregate operational outcomes across every configured payment source. */
export async function metaMeasurementReport(
  pool: Pool,
  rawConfig: MetaDeliveryConfig,
) {
  const config = metaDeliveryConfigSchema.parse(rawConfig);
  const namespaces = [
    config.sources.stripeNamespace,
    config.sources.efaChannelReference
      ? `esa:${config.sources.efaChannelReference}`
      : null,
  ].filter(Boolean);
  const preparations = await pool.query(
    "SELECT state,count(*)::int AS count FROM amp_meta_purchase_queue WHERE dataset_id=$1 AND namespace=ANY($2::text[]) GROUP BY state ORDER BY state",
    [config.destination.datasetId, namespaces],
  );
  const attempts = await pool.query(
    `SELECT a.state,count(*)::int AS count,
 count(*) FILTER (WHERE (a.receipt->>'messageCount')::int>0)::int AS receipts_with_messages
 FROM amp_meta_delivery_attempts a JOIN amp_meta_purchase_queue q USING(event_id)
 WHERE q.dataset_id=$1 AND q.namespace=ANY($2::text[]) GROUP BY a.state ORDER BY a.state`,
    [config.destination.datasetId, namespaces],
  );
  return { preparations: preparations.rows, attempts: attempts.rows };
}
