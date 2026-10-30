import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { openaiClickIdentifiersSchema } from "./click-identifiers.js";
import { paymentClickEvidence } from "./payment-clicks.js";
import { purchaseMeasurementView } from "./permission.js";
import {
  currentMeasurementNotice,
  OPENAI_PURCHASE_MEASUREMENT_NOTICE,
} from "./permission-contracts.js";
import {
  measurementSourcesSchema,
  paymentReferenceSchema,
  verifiedAdvertisingPayment,
  type PaymentReference,
} from "./verified-payment.js";

export const openaiDeliveryConfigSchema = z.strictObject({
  enabled: z.boolean().default(false),
  signupEnabled: z.boolean().optional(),
  pixelId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  sources: measurementSourcesSchema,
});
export type OpenAIDeliveryConfig = z.infer<typeof openaiDeliveryConfigSchema>;
export type OpenAIRuntime = {
  accessToken: () => Promise<string>;
  fetcher?: typeof fetch;
};
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const openaiDestinationKey = (c: OpenAIDeliveryConfig) =>
  hash(
    JSON.stringify([
      c.pixelId,
      c.sources.stripeNamespace ?? null,
      c.sources.efaChannelReference ?? null,
      c.sources.azEsaChannelReference ?? null,
    ]),
  );
const day = 86400000;
async function begin(c: PoolClient, account: string) {
  await c.query("BEGIN");
  await c.query("SET LOCAL lock_timeout='5s'");
  await c.query("SET LOCAL statement_timeout='15s'");
  await c.query("SET LOCAL idle_in_transaction_session_timeout='20s'");
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    account,
  ]);
}
/** Facts come from the payment ledger and exact owned order. No learner or
 * contact information is sent. Consent and attribution are rechecked at delivery. */
async function evidence(
  c: PoolClient,
  config: OpenAIDeliveryConfig,
  ref: PaymentReference,
  account: string,
) {
  const now = (await c.query("SELECT clock_timestamp() AS now")).rows[0]
    .now as Date;
  const permission = await purchaseMeasurementView(c, account, "openai");
  if (
    permission.status !== "active" ||
    !permission.revision ||
    !permission.grantedAt ||
    currentMeasurementNotice(permission) !==
      OPENAI_PURCHASE_MEASUREMENT_NOTICE.version
  )
    return null;
  const payment = await verifiedAdvertisingPayment(c, config.sources, ref, now);
  if (!payment || payment.accountId !== account || payment.netMinor <= 0)
    return null;
  const time = Date.parse(payment.occurredAt);
  if (
    time > +now ||
    +now - time >= 7 * day ||
    Date.parse(permission.grantedAt) > time
  )
    return null;
  const click = await paymentClickEvidence(c, account, ref, "openai");
  if (
    !click ||
    Date.parse(click.observedAt) > time ||
    time - Date.parse(click.observedAt) > 30 * day
  )
    return null;
  const { oppref } = openaiClickIdentifiersSchema.parse(click.identifiers);
  return {
    payment,
    revision: permission.revision,
    event: {
      type: "order_created" as const,
      timestamp_ms: time,
      oppref,
      // DirectPay settlement is asynchronous; it is not a browser checkout event.
      action_source: ref.kind === "stripe" ? "web" : "other",
      ...(ref.kind === "stripe"
        ? { source_url: "https://amp.corpora.inc/" }
        : {}),
      opt_out: true,
      data: {
        type: "contents" as const,
        amount: payment.netMinor,
        currency: "USD" as const,
      },
    },
  };
}
export async function queueOpenAIPayment(
  pool: Pool,
  raw: OpenAIDeliveryConfig,
  input: PaymentReference,
) {
  const config = openaiDeliveryConfigSchema.parse(raw),
    ref = paymentReferenceSchema.parse(input);
  if (!config.enabled) return { outcome: "disabled" as const };
  const c = await pool.connect();
  try {
    const owner = (
      await c.query(
        ref.kind === "stripe"
          ? "SELECT account_id FROM amp_payment_records WHERE id=$1"
          : "SELECT account_id FROM amp_commerce_orders WHERE id=$1",
        [ref.id],
      )
    ).rows[0]?.account_id;
    if (!owner) return { outcome: "ineligible" as const };
    await begin(c, owner);
    const prior = (
      await c.query(
        "SELECT event_id FROM amp_openai_purchase_queue WHERE payment_kind=$1 AND payment_ref=$2 FOR UPDATE",
        [ref.kind, ref.id],
      )
    ).rows[0];
    if (prior) {
      await c.query("COMMIT");
      return {
        outcome: "retained" as const,
        eventId: prior.event_id as string,
      };
    }
    const facts = await evidence(c, config, ref, owner);
    if (!facts || facts.payment.refundPending) {
      await c.query("COMMIT");
      return { outcome: "ineligible" as const };
    }
    const id = randomUUID();
    await c.query(
      `INSERT INTO amp_openai_purchase_queue(event_id,payment_kind,payment_ref,account_id,destination_key,occurred_at,original_minor,amount_minor,permission_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        ref.kind,
        ref.id,
        owner,
        openaiDestinationKey(config),
        facts.payment.occurredAt,
        facts.payment.originalMinor,
        facts.payment.netMinor,
        facts.revision,
      ],
    );
    await c.query("COMMIT");
    return { outcome: "queued" as const, eventId: id };
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
async function candidate(
  c: PoolClient,
  config: OpenAIDeliveryConfig,
  id: string,
) {
  const row = (
    await c.query(
      "SELECT *,next_attempt_at<=clock_timestamp() AS due FROM amp_openai_purchase_queue WHERE event_id=$1 FOR UPDATE",
      [id],
    )
  ).rows[0];
  if (
    !row ||
    !["ready", "retry"].includes(row.state) ||
    row.destination_key !== openaiDestinationKey(config)
  )
    return null;
  return row;
}
async function payloadFor(
  c: PoolClient,
  config: OpenAIDeliveryConfig,
  row: any,
) {
  const facts = await evidence(
    c,
    config,
    { kind: row.payment_kind, id: row.payment_ref },
    row.account_id,
  );
  if (facts?.payment.refundPending) return "held" as const;
  if (
    !facts ||
    facts.revision !== row.permission_revision ||
    facts.payment.occurredAt !== row.occurred_at.toISOString() ||
    facts.payment.originalMinor !== row.original_minor ||
    facts.payment.netMinor !== row.amount_minor
  )
    return null;
  const payload = {
    integration_source: "corpora_amp",
    events: [{ id: `amp_openai_${row.event_id}`, ...facts.event }],
  };
  if (
    row.payload_digest &&
    row.payload_digest !== hash(JSON.stringify(payload))
  )
    return null;
  return payload;
}
/** Record an attempt before I/O. Retries reuse the exact payload and event ID;
 * OpenAI deduplicates by pixel, event type and ID. Re-check permission under the
 * shared account lock immediately before sending. No request bodies are logged. */
export async function deliverOpenAIPayment(
  pool: Pool,
  raw: OpenAIDeliveryConfig,
  id: string,
  runtime: OpenAIRuntime,
) {
  const config = openaiDeliveryConfigSchema.parse(raw);
  z.uuid().parse(id);
  if (!config.enabled) return "disabled";
  const token = await runtime.accessToken();
  if (!/^[A-Za-z0-9._~+/=-]{1,8192}$/.test(token))
    throw new Error("invalid_measurement_credential");
  const c = await pool.connect();
  let broken = false;
  const onError = () => {
    broken = true;
  };
  c.on("error", onError);
  try {
    const account = (
      await c.query(
        "SELECT account_id FROM amp_openai_purchase_queue WHERE event_id=$1",
        [id],
      )
    ).rows[0]?.account_id;
    if (!account) return "ineligible";
    await begin(c, account);
    let row = await candidate(c, config, id);
    if (!row?.due) {
      await c.query("COMMIT");
      return "unchanged";
    }
    let payload = await payloadFor(c, config, row);
    if (payload === "held") {
      await c.query(
        "UPDATE amp_openai_purchase_queue SET state='retry',next_attempt_at=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() WHERE event_id=$1",
        [id],
      );
      await c.query("COMMIT");
      return "held";
    }
    if (!payload) {
      await c.query(
        "UPDATE amp_openai_purchase_queue SET state=CASE WHEN occurred_at<clock_timestamp()-interval '7 days' THEN 'expired' ELSE 'cancelled' END,updated_at=clock_timestamp() WHERE event_id=$1",
        [id],
      );
      await c.query("COMMIT");
      return "ineligible";
    }
    // A durable five-minute lease prevents another worker from sending this
    // attempt while its owner re-acquires the account lock for I/O.
    const attempt = Number(row.attempt_count) + 1;
    await c.query(
      "UPDATE amp_openai_purchase_queue SET state='retry',attempt_count=$2,payload_digest=$3,next_attempt_at=clock_timestamp()+interval '5 minutes',updated_at=clock_timestamp() WHERE event_id=$1",
      [id, attempt, hash(JSON.stringify(payload))],
    );
    await c.query("COMMIT");
    await begin(c, account);
    row = await candidate(c, config, id);
    if (!row || Number(row.attempt_count) !== attempt) {
      await c.query("COMMIT");
      return "unchanged";
    }
    payload = await payloadFor(c, config, row);
    if (payload === "held") {
      await c.query("COMMIT");
      return "held";
    }
    if (!payload || broken) {
      await c.query(
        "UPDATE amp_openai_purchase_queue SET state='cancelled',updated_at=clock_timestamp() WHERE event_id=$1",
        [id],
      );
      await c.query("COMMIT");
      return "ineligible";
    }
    let status: number | null = null;
    let outcome = "retry";
    try {
      const response = await (runtime.fetcher ?? fetch)(
        `https://bzr.openai.com/v1/events?pid=${encodeURIComponent(config.pixelId)}`,
        {
          method: "POST",
          redirect: "error",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        },
      );
      status = response.status;
      if (response.ok) {
        const data = z
          .object({ accepted_events: z.literal(1) })
          .safeParse(await response.json());
        if (data.success) outcome = "accepted";
      } else if (
        status >= 400 &&
        status < 500 &&
        ![408, 425, 429].includes(status)
      )
        outcome = "rejected";
    } catch {
      /* An uncertain request retries with the same deduplication identity. */
    }
    await c.query(
      "UPDATE amp_openai_purchase_queue SET state=$2,last_http_status=$3,updated_at=clock_timestamp() WHERE event_id=$1",
      [id, outcome, status],
    );
    await c.query("COMMIT");
    return outcome;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.off("error", onError);
    c.release(broken);
  }
}
export async function openaiMeasurementBatch(
  pool: Pool,
  raw: OpenAIDeliveryConfig,
  operation: "collect" | "deliver",
  limit = 20,
  runtime?: OpenAIRuntime,
) {
  const config = openaiDeliveryConfigSchema.parse(raw);
  z.number().int().min(1).max(200).parse(limit);
  if (!config.enabled) return { disabled: 1 };
  const counts: Record<string, number> = {};
  if (operation === "collect") {
    // Bindings exist only for the exact parent-owned request or checkout. The
    // trusted payment projection below independently rejects unpaid/test/renewal rows.
    const rows = (
      await pool.query(
        `SELECT p.kind,p.id,p.expires_at FROM (
      SELECT 'stripe' AS kind,p.id::text AS id,p.created_at,j.expires_at FROM amp_payment_records p
      JOIN amp_ad_order_attribution a ON a.stripe_checkout_id=p.checkout_id AND a.account_id=p.account_id AND a.provider='openai' AND a.click_id IS NOT NULL
      JOIN amp_ad_click_evidence c ON c.id=a.click_id
      JOIN amp_ad_click_journeys j ON j.id=c.journey_id AND j.expires_at>clock_timestamp()
      WHERE p.namespace=$1
      UNION ALL
      SELECT CASE WHEN r.offer_snapshot->>'programId'='az-esa' THEN 'arizona-esa' ELSE 'arkansas-efa' END,o.id,o.updated_at,j.expires_at
      FROM amp_commerce_orders o JOIN amp_funding_requests r ON r.order_id=o.id AND r.account_id=o.account_id
      JOIN amp_ad_order_attribution a ON a.funding_request_id=r.id AND a.account_id=o.account_id AND a.provider='openai' AND a.click_id IS NOT NULL
      JOIN amp_ad_click_evidence c ON c.id=a.click_id
      JOIN amp_ad_click_journeys j ON j.id=c.journey_id AND j.expires_at>clock_timestamp()
      WHERE o.channel='esa' AND o.channel_reference IN ($2,$3)
    ) p LEFT JOIN amp_openai_purchase_scan s ON s.payment_kind=p.kind AND s.payment_ref=p.id
    WHERE NOT EXISTS(SELECT 1 FROM amp_openai_purchase_queue q WHERE q.payment_kind=p.kind AND q.payment_ref=p.id)
    ORDER BY s.checked_at ASC NULLS FIRST,p.created_at,p.kind,p.id LIMIT $4`,
        [
          config.sources.stripeNamespace ?? null,
          config.sources.efaChannelReference ?? null,
          config.sources.azEsaChannelReference ?? null,
          limit,
        ],
      )
    ).rows;
    for (const row of rows) {
      const result = await queueOpenAIPayment(
        pool,
        config,
        paymentReferenceSchema.parse({ kind: row.kind, id: row.id }),
      );
      await pool.query(
        `INSERT INTO amp_openai_purchase_scan(payment_kind,payment_ref,expires_at) VALUES($1,$2,$3)
         ON CONFLICT(payment_kind,payment_ref) DO UPDATE SET checked_at=clock_timestamp()`,
        [row.kind, row.id, row.expires_at],
      );
      counts[result.outcome] = (counts[result.outcome] ?? 0) + 1;
    }
  } else {
    if (!runtime) throw new Error("measurement_runtime_required");
    const rows = (
      await pool.query(
        "SELECT event_id FROM amp_openai_purchase_queue WHERE destination_key=$1 AND state IN ('ready','retry') AND next_attempt_at<=clock_timestamp() ORDER BY next_attempt_at LIMIT $2",
        [openaiDestinationKey(config), limit],
      )
    ).rows;
    for (const row of rows) {
      const result = await deliverOpenAIPayment(
        pool,
        config,
        row.event_id,
        runtime,
      );
      counts[result] = (counts[result] ?? 0) + 1;
    }
  }
  return counts;
}
export async function purgeOpenAIPurchases(pool: Pool) {
  await pool.query(
    "DELETE FROM amp_openai_purchase_scan WHERE expires_at<=clock_timestamp()",
  );
  return (
    (
      await pool.query(
        "DELETE FROM amp_openai_purchase_queue WHERE occurred_at<clock_timestamp()-interval '90 days'",
      )
    ).rowCount ?? 0
  );
}
