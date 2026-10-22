import { RETENTION } from "../privacy/retention-periods.js";
import type { Pool } from "pg";
import type { FastifyInstance } from "fastify";
import type { Authenticator } from "../server/auth.js";
import {
  currentMeasurementNotice,
  META_PURCHASE_MEASUREMENT_NOTICE,
  advertisingOptOut,
} from "./permission-contracts.js";
import { purchaseMeasurementView } from "./permission.js";
import {
  verifiedAdvertisingPayment,
  measurementSourcesSchema,
} from "./verified-payment.js";
import {
  META_ENROLLMENT_CONFIRMATION_URL,
  metaContextRequestSchema,
} from "./meta-context-contracts.js";

/** Browser context is evidence of a request, never proof of a payment. */
function confirmationContext(
  headers: Record<string, unknown>,
  checkoutId: string,
) {
  if (advertisingOptOut(headers)) return null;
  const referrer = headers.referer;
  const userAgent = headers["user-agent"];
  if (
    typeof referrer !== "string" ||
    referrer.length > 4096 ||
    typeof userAgent !== "string" ||
    !/^[\x20-\x7e]{1,512}$/.test(userAgent) ||
    !userAgent.trim()
  )
    return null;
  try {
    const url = new URL(referrer);
    if (
      url.origin + url.pathname !== META_ENROLLMENT_CONFIRMATION_URL ||
      url.username ||
      url.password ||
      url.hash ||
      url.searchParams.getAll("purchase").length !== 1 ||
      url.searchParams.get("purchase") !== checkoutId ||
      url.searchParams.getAll("billing").length !== 1 ||
      url.searchParams.get("billing") !== "processing"
    )
      return null;
    return {
      eventSourceUrl: META_ENROLLMENT_CONFIRMATION_URL,
      clientUserAgent: userAgent,
    };
  } catch {
    return null;
  }
}

/** Local collection only. The account lock serializes capture with withdrawal
 * and financial changes. Existing context is never overwritten by a page reload.
 * The future dispatcher must recheck payment, permission and expiry before I/O. */
export async function recordMetaPurchaseContext(
  pool: Pool,
  account: string,
  namespace: string | null,
  body: unknown,
  headers: Record<string, unknown>,
) {
  const { checkoutId } = metaContextRequestSchema.parse(body);
  const context = confirmationContext(headers, checkoutId);
  const sources = measurementSourcesSchema.safeParse({
    stripeNamespace: namespace,
  });
  if (!context || !sources.success) return { recorded: false };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      account,
    ]);
    const now = (await client.query("SELECT clock_timestamp() AS now")).rows[0]
      .now as Date;
    const permission = await purchaseMeasurementView(client, account, "meta");
    if (
      permission.status !== "active" ||
      !permission.revision ||
      !permission.grantedAt ||
      !permission.expiresAt ||
      currentMeasurementNotice(permission) !==
        META_PURCHASE_MEASUREMENT_NOTICE.version
    ) {
      await client.query("COMMIT");
      return { recorded: false };
    }
    const matches = await client.query(
      `SELECT r.id FROM amp_payment_records r JOIN amp_stripe_checkouts c
      ON c.id=r.checkout_id AND c.account_id=r.account_id AND c.namespace=r.namespace
      WHERE r.checkout_id=$1 AND r.account_id=$2 AND r.namespace=$3 AND c.learner_id IS NULL
      AND r.baseline->>'invoiceReason'='subscription_create' LIMIT 2`,
      [checkoutId, account, namespace],
    );
    const paymentId =
      matches.rowCount === 1 ? (matches.rows[0].id as string) : null;
    const payment = paymentId
      ? await verifiedAdvertisingPayment(
          client,
          sources.data,
          { kind: "stripe", id: paymentId },
          now,
        )
      : null;
    if (
      !payment ||
      payment.accountId !== account ||
      payment.netMinor <= 0 ||
      payment.refundPending ||
      Date.parse(permission.grantedAt) > Date.parse(payment.occurredAt) ||
      Date.parse(payment.occurredAt) <=
        +now - RETENTION.advertisingContextDays * 86400000
    ) {
      await client.query("COMMIT");
      return { recorded: false };
    }
    const expiresAt = new Date(
      Math.min(
        Date.parse(payment.occurredAt) +
          RETENTION.advertisingContextDays * 86400000,
        Date.parse(permission.expiresAt),
      ),
    );
    await client.query(
      `INSERT INTO amp_meta_purchase_contexts(payment_id,account_id,checkout_id,namespace,occurred_at,observed_at,expires_at,permission_revision,permission_notice,event_source_url,client_user_agent)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
      [
        paymentId,
        account,
        checkoutId,
        namespace,
        payment.occurredAt,
        now,
        expiresAt,
        permission.revision,
        currentMeasurementNotice(permission),
        context.eventSourceUrl,
        context.clientUserAgent,
      ],
    );
    const retained = await client.query(
      `SELECT 1 FROM amp_meta_purchase_contexts WHERE payment_id=$1 AND account_id=$2 AND permission_revision=$3 AND permission_notice=$4 AND expires_at>clock_timestamp()`,
      [
        paymentId,
        account,
        permission.revision,
        currentMeasurementNotice(permission),
      ],
    );
    await client.query("COMMIT");
    return { recorded: !!retained.rowCount };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function registerMetaPurchaseContextRoutes(
  app: FastifyInstance,
  options: {
    pool: Pool;
    authenticate: Authenticator;
    stripeNamespace: string | null;
  },
) {
  app.register(async (scope) => {
    scope.setErrorHandler((error, _request, reply) => {
      const status =
        error && typeof error === "object" && "statusCode" in error
          ? Number(error.statusCode)
          : 503;
      const code = [400, 401, 413, 415].includes(status) ? status : 503;
      return reply.code(code).send({
        error:
          status === 401
            ? "sign_in_required"
            : code < 500
              ? "invalid_purchase_measurement_request"
              : "purchase_measurement_unavailable",
      });
    });
    scope.addHook("onRequest", async (_request, reply) => {
      reply
        .header("Cache-Control", "no-store")
        .header("X-Content-Type-Options", "nosniff");
    });
    scope.post(
      "/api/v1/advertising/meta/purchase-context",
      { bodyLimit: 1024 },
      async (request, reply) => {
        const account = await options.authenticate(request);
        const parsed = metaContextRequestSchema.safeParse(request.body);
        if (!parsed.success)
          return reply
            .code(400)
            .send({ error: "invalid_purchase_measurement_request" });
        return recordMetaPurchaseContext(
          options.pool,
          account,
          options.stripeNamespace,
          parsed.data,
          request.headers,
        );
      },
    );
  });
}
/** Closed delivery window: deleting context cannot make an old payment eligible. */
export async function purgeMetaPurchaseContexts(pool: Pool) {
  if (
    !(
      await pool.query(
        "SELECT to_regclass('amp_meta_purchase_contexts') AS relation",
      )
    ).rows[0]?.relation
  )
    return 0;
  const result = await pool.query(
    "DELETE FROM amp_meta_purchase_contexts WHERE expires_at<=clock_timestamp()",
  );
  return result.rowCount ?? 0;
}
