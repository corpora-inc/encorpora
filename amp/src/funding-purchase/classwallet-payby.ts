import { createHash, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Authenticator } from "../server/auth.js";
import { learningConsentActive } from "../server/account-access.js";
import { canonicalCommercePayload } from "../commerce/ledger.js";
import {
  availableOffers,
  FundingPurchaseError,
  type FundingOffer,
  type FundingRequest,
} from "./contracts.js";
import { FundingPurchaseRepository, fundingRequestRow } from "./repository.js";
import {
  annualTermEnd,
  fundedProvisionSchema,
  provisionFundingRequest,
} from "./provision.js";

const hash = (value: string) => createHash("sha256").update(value).digest();
const fingerprint = (value: string) => hash(value).toString("hex");
const configSchema = z.strictObject({
  enabled: z.literal(true),
  vendorId: z.string().regex(/^[a-f0-9]{24}$/),
  publicOrigin: z.url().refine((value) => {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      u.pathname === "/"
    );
  }),
  setupReference: z.string().min(1).max(200),
  offerIds: z.array(z.string().min(1)).min(1).max(100),
});
export type ClassWalletPayByConfig = z.infer<typeof configSchema> & {
  basicUser: string;
  basicPassword: string;
};
export async function loadClassWalletPayByConfig(
  env: NodeJS.ProcessEnv,
): Promise<ClassWalletPayByConfig | null> {
  if (!env.AMP_CLASSWALLET_PAYBY_FILE) return null;
  const bytes = await readFile(env.AMP_CLASSWALLET_PAYBY_FILE);
  if (bytes.length > 65536) throw new Error("ClassWallet config exceeds limit");
  const config = configSchema.parse(JSON.parse(bytes.toString("utf8")));
  const basicUser = z
    .string()
    .min(1)
    .max(200)
    .regex(/^[^:\r\n]+$/)
    .parse(env.AMP_CLASSWALLET_BASIC_USER);
  const basicPassword = z
    .string()
    .min(16)
    .max(500)
    .regex(/^[^\r\n]+$/)
    .parse(env.AMP_CLASSWALLET_BASIC_PASSWORD);
  return { ...config, basicUser, basicPassword };
}
function requireBasic(
  header: string | undefined,
  config: ClassWalletPayByConfig,
) {
  const expected = `Basic ${Buffer.from(`${config.basicUser}:${config.basicPassword}`).toString("base64")}`;
  if (!header || !timingSafeEqual(hash(header), hash(expected)))
    throw new FundingPurchaseError(401, "provider_auth_required");
}
function approvalPayload(
  request: FundingRequest,
  purchaseOrder: string,
  at: string,
) {
  const o = request.offer,
    orderId = `classwallet-payby:${fingerprint(purchaseOrder)}`;
  const envelope = {
    channel: "esa",
    channelReference: o.channelReference,
    orderId,
    occurredAt: at,
  };
  const evidence = `classwallet-payby-approval:${fingerprint(purchaseOrder)}`;
  return fundedProvisionSchema.parse({
    requestId: request.id,
    events: [
      {
        ...envelope,
        id: `${orderId}:created`,
        type: "order.created",
        order: {
          id: orderId,
          account: { id: request.accountId },
          license: {
            accountId: request.accountId,
            learnerId: request.learnerId,
            sku: o.sku,
            startsAt: at,
            endsAt: annualTermEnd(at),
          },
          channel: "esa",
          channelReference: o.channelReference,
          externalOrderId: orderId,
          currency: o.currency,
          amountMinor: o.subtotalMinor + o.taxMinor,
          activationPolicy: o.activationPolicy,
        },
      },
      {
        ...envelope,
        id: `${orderId}:approved`,
        type: "order.approved",
        evidence,
      },
      {
        ...envelope,
        id: `${orderId}:fulfilled`,
        type: "order.fulfilled",
        evidence,
      },
      {
        ...envelope,
        id: `${orderId}:activated`,
        type: "license.activated",
        evidence,
      },
    ],
  });
}

/** Recover committed approvals after a callback crash, without a provider poll.
 * Exact stored bundles make concurrent recovery safe through provisioning's locks. */
export async function reconcileClassWalletApprovals(
  pool: Pool,
  offers: readonly FundingOffer[],
) {
  const pending =
    await pool.query(`SELECT c.request_id,c.provisioning_payload FROM amp_classwallet_checkouts c
    JOIN amp_funding_requests r ON r.id=c.request_id WHERE c.callback_status='complete'
    AND c.provisioning_payload IS NOT NULL AND r.order_id IS NULL AND c.stopped_at IS NULL
    AND c.retry_at<=now() ORDER BY c.retry_at,c.request_id LIMIT 8`);
  let provisioned = 0,
    deferred = 0;
  for (const row of pending.rows) {
    try {
      await provisionFundingRequest(pool, row.provisioning_payload, offers);
      provisioned++;
    } catch {
      deferred++;
      await pool.query(
        `UPDATE amp_classwallet_checkouts SET retry_attempts=retry_attempts+1,
        retry_at=now()+interval '5 minutes', stopped_at=CASE WHEN retry_attempts>=7 THEN now() ELSE NULL END
        WHERE request_id=$1`,
        [row.request_id],
      );
    }
  }
  const stopped = (
    await pool.query(
      "SELECT count(*)::int n FROM amp_classwallet_checkouts WHERE stopped_at IS NOT NULL",
    )
  ).rows[0].n;
  return { provisioned, deferred, stopped };
}

export async function registerClassWalletPayByRoutes(
  app: FastifyInstance,
  options: {
    pool: Pool;
    authenticate: Authenticator;
    offers: readonly FundingOffer[];
    config: ClassWalletPayByConfig | null;
  },
) {
  const { pool, config, offers } = options;
  const repository = new FundingPurchaseRepository(pool, offers);
  const params = z.strictObject({ id: z.string().uuid() });
  const eligible = () =>
    config
      ? availableOffers(offers, new Date()).filter(
          (o) => config.offerIds.includes(o.id) && o.route === "marketplace",
        )
      : [];
  const ensureOffer = (request: FundingRequest) => {
    if (
      !eligible().some(
        (o) =>
          canonicalCommercePayload(o) ===
          canonicalCommercePayload(request.offer),
      )
    )
      throw new FundingPurchaseError(409, "offer_unavailable");
  };
  const ensurePending = (request: FundingRequest) => {
    if (
      request.orderId ||
      request.status === "cancelled" ||
      Date.parse(request.expiresAt) <= Date.now()
    )
      throw new FundingPurchaseError(409, "request_not_provisionable");
  };
  app.register(async (scope) => {
    scope.addHook("onRequest", async (_request, reply) => {
      reply.header("Cache-Control", "no-store");
      reply.header("Referrer-Policy", "no-referrer");
    });
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof FundingPurchaseError)
        return reply.code(error.statusCode).send({ error: error.code });
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: "invalid_classwallet_request" });
      if (
        error &&
        typeof error === "object" &&
        "statusCode" in error &&
        error.statusCode === 401
      )
        return reply.code(401).send({ error: "sign_in_required" });
      return reply.code(503).send({ error: "classwallet_unavailable" });
    });
    scope.get("/api/v1/funding/classwallet/capabilities", async (request) => {
      await options.authenticate(request);
      return { offerIds: eligible().map((o) => o.id) };
    });
    scope.post(
      "/api/v1/funding/requests/:id/classwallet-checkout",
      async (request) => {
        const account = await options.authenticate(request),
          id = params.parse(request.params).id;
        if (!config)
          throw new FundingPurchaseError(404, "classwallet_unavailable");
        z.strictObject({}).parse(request.body ?? {});
        await repository.transaction(
          account,
          async (client) => {
            if (!(await learningConsentActive(client, account)))
              throw new FundingPurchaseError(403, "verified_consent_required");
            const found = await client.query(
              "SELECT * FROM amp_funding_requests WHERE id=$1 AND account_id=$2 FOR UPDATE",
              [id, account],
            );
            if (!found.rowCount)
              throw new FundingPurchaseError(404, "request_not_found");
            const record = fundingRequestRow(found.rows[0]);
            ensureOffer(record);
            ensurePending(record);
            const learner = await client.query(
              "SELECT id FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL",
              [record.learnerId, account],
            );
            if (!learner.rowCount)
              throw new FundingPurchaseError(404, "learner_not_found");
            await client.query(
              "INSERT INTO amp_classwallet_checkouts(request_id,vendor_fingerprint) VALUES($1,$2) ON CONFLICT DO NOTHING",
              [id, fingerprint(config.vendorId)],
            );
            const existing = (
              await client.query(
                "SELECT vendor_fingerprint,callback_status FROM amp_classwallet_checkouts WHERE request_id=$1",
                [id],
              )
            ).rows[0];
            if (
              existing.vendor_fingerprint !== fingerprint(config.vendorId) ||
              existing.callback_status
            )
              throw new FundingPurchaseError(409, "checkout_not_pending");
          },
          true,
        );
        const url = new URL("https://app.classwallet.com/payby-checkout/");
        url.searchParams.set(
          "callback",
          new URL(`/api/v1/classwallet/orders/${id}`, config.publicOrigin).href,
        );
        url.searchParams.set("vendorId", config.vendorId);
        return { checkoutUrl: url.href };
      },
    );
    if (!config) return;
    // This is a navigation handoff only. The posted email and base64 vendor ID
    // cannot authenticate a parent or establish ownership of an AMP account.
    scope.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string", bodyLimit: 16384 },
      (_request, body, done) => done(null, body),
    );
    scope.post(
      "/api/v1/classwallet/start",
      { bodyLimit: 16384 },
      async (_request, reply) =>
        reply.code(303).redirect(new URL("/", config.publicOrigin).href),
    );
    const readBinding = async (id: string) => {
      const found = await pool.query(
        "SELECT r.*,c.vendor_fingerprint,c.fetched_at,c.purchase_order_id,c.callback_status,c.callback_at,c.provisioning_payload FROM amp_funding_requests r JOIN amp_classwallet_checkouts c ON c.request_id=r.id WHERE r.id=$1",
        [id],
      );
      if (
        !found.rowCount ||
        found.rows[0].vendor_fingerprint !== fingerprint(config.vendorId)
      )
        throw new FundingPurchaseError(404, "request_not_found");
      return found.rows[0];
    };
    scope.get("/api/v1/classwallet/orders/:id", async (request) => {
      requireBasic(request.headers.authorization, config);
      const id = params.parse(request.params).id,
        initial = await readBinding(id);
      return repository.transaction(initial.account_id, async (client) => {
        const stored = (
          await client.query(
            "SELECT r.*,c.callback_status FROM amp_funding_requests r JOIN amp_classwallet_checkouts c ON c.request_id=r.id WHERE r.id=$1 FOR UPDATE OF r,c",
            [id],
          )
        ).rows[0];
        const record = fundingRequestRow(stored);
        if (stored.callback_status === "cancelled")
          throw new FundingPurchaseError(409, "checkout_not_pending");
        if (stored.callback_status !== "complete") {
          ensureOffer(record);
          ensurePending(record);
          if (!(await learningConsentActive(client, record.accountId)))
            throw new FundingPurchaseError(403, "verified_consent_required");
        }
        await client.query(
          "UPDATE amp_classwallet_checkouts SET fetched_at=COALESCE(fetched_at,now()) WHERE request_id=$1",
          [id],
        );
        return {
          orderId: id,
          details: {
            items: [
              {
                itemId: record.offer.sku,
                description: record.offer.productTitle,
                quantity: 1,
                price: record.offer.subtotalMinor / 100,
              },
            ],
            shipping: 0,
            tax: record.offer.taxMinor / 100,
          },
        };
      });
    });
    scope.put(
      "/api/v1/classwallet/orders/:id",
      { bodyLimit: 4096 },
      async (request) => {
        requireBasic(request.headers.authorization, config);
        const id = params.parse(request.params).id;
        const body = z
          .strictObject({
            PurchaseOrderId: z
              .union([
                z
                  .string()
                  .min(1)
                  .max(200)
                  .regex(/^[A-Za-z0-9_-]+$/),
                z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
              ])
              .transform(String),
            status: z.enum(["complete", "cancelled", "canceled"]),
          })
          .parse(request.body);
        const status = body.status === "complete" ? "complete" : "cancelled",
          initial = await readBinding(id);
        const payload = await repository.transaction(
          initial.account_id,
          async (client) => {
            const stored = (
              await client.query(
                "SELECT r.*,c.purchase_order_id,c.callback_status,c.fetched_at,c.provisioning_payload,c.exception_code FROM amp_funding_requests r JOIN amp_classwallet_checkouts c ON c.request_id=r.id WHERE r.id=$1 FOR UPDATE OF r,c",
                [id],
              )
            ).rows[0];
            const record = fundingRequestRow(stored);
            if (stored.exception_code) return { conflict: true };
            if (stored.callback_status) {
              if (
                stored.callback_status !== status ||
                stored.purchase_order_id !== body.PurchaseOrderId
              ) {
                await client.query(
                  "UPDATE amp_classwallet_checkouts SET exception_code='callback-conflict',exception_at=now(),stopped_at=now() WHERE request_id=$1",
                  [id],
                );
                return { conflict: true };
              }
              return stored.provisioning_payload;
            }
            const reused = await client.query(
              "SELECT 1 FROM amp_classwallet_checkouts WHERE purchase_order_id=$1 AND request_id<>$2",
              [body.PurchaseOrderId, id],
            );
            if (reused.rowCount) {
              await client.query(
                "UPDATE amp_classwallet_checkouts SET exception_code='purchase-order-reused',exception_at=now(),stopped_at=now() WHERE request_id=$1",
                [id],
              );
              return { conflict: true };
            }
            ensureOffer(record);
            ensurePending(record);
            if (!stored.fetched_at)
              throw new FundingPurchaseError(409, "order_not_fetched");
            const payload =
              status === "complete" &&
              record.offer.activationPolicy === "after-approval" &&
              record.offer.creditAgreementReference
                ? approvalPayload(
                    record,
                    body.PurchaseOrderId,
                    new Date().toISOString(),
                  )
                : null;
            await client.query(
              "UPDATE amp_classwallet_checkouts SET purchase_order_id=$2,callback_status=$3,callback_at=now(),provisioning_payload=$4 WHERE request_id=$1",
              [
                id,
                body.PurchaseOrderId,
                status,
                payload ? JSON.stringify(payload) : null,
              ],
            );
            return payload;
          },
          true,
        );
        // The durable callback survives a failure here. Provider retry uses the
        // original exact bundle and provisioning's transaction/consent checks.
        if (payload?.conflict)
          throw new FundingPurchaseError(409, "callback_conflict");
        if (payload) await provisionFundingRequest(pool, payload, offers);
        return { status: status === "complete" ? "complete" : "cancelled" };
      },
    );
  });
}
