import { annualOffer, purchaseStatus } from "./purchase.js";
import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import type { Authenticator } from "../../server/auth.js";
import { BillingError, type StripeBillingConfig } from "./config.js";
import { StripeGateway } from "./gateway.js";
import { StripeRepository } from "./repository.js";
import { StripeBilling } from "./service.js";
export interface StripeRouteOptions {
  pool: Pool;
  authenticate: Authenticator;
  config: StripeBillingConfig;
  gateway?: StripeGateway;
}
/** Authenticate identities here; do not pass a consent-gated authenticator (portal permits cancellation after withdrawal). */
export async function registerStripeRoutes(
  app: FastifyInstance,
  options: StripeRouteOptions,
): Promise<StripeBilling> {
  const gateway = options.gateway ?? new StripeGateway(options.config);
  const billing = new StripeBilling(
    new StripeRepository(options.pool, options.config),
    gateway,
  );
  app.register(async (scope) => {
    scope.setErrorHandler((error, _request, reply) => {
      if (error instanceof BillingError)
        return reply.code(error.statusCode).send({ error: error.code });
      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : 500;
      return reply.code(status >= 400 && status <= 499 ? status : 503).send({
        error: status === 401 ? "sign_in_required" : "billing_unavailable",
      });
    });
    scope.get("/api/v1/billing/offer", async (request, reply) => {
      await options.authenticate(request);
      reply.header("Cache-Control", "no-store");
      const offer = annualOffer(options.config);
      await gateway.verifyCatalog();
      return {
        available: true,
        offer,
        offers: options.config.monthlyPriceId
          ? [offer, annualOffer(options.config, "month")]
          : [offer],
      };
    });
    scope.get<{ Params: { purchaseId: string } }>(
      "/api/v1/billing/purchase/:purchaseId",
      async (request, reply) => {
        const accountId = await options.authenticate(request);
        reply.header("Cache-Control", "no-store");
        if (!z.uuid().safeParse(request.params.purchaseId).success)
          return reply.code(400).send({ error: "invalid_purchase" });
        const result = await options.pool.query(
          "SELECT learner_id FROM amp_stripe_checkouts WHERE namespace=$1 AND account_id=$2 AND id=$3",
          [billing.repository.namespace, accountId, request.params.purchaseId],
        );
        if (!result.rowCount)
          return reply.code(404).send({ error: "purchase_not_found" });
        return { learnerId: result.rows[0].learner_id };
      },
    );
    scope.get<{ Params: { learnerId: string } }>(
      "/api/v1/billing/status/:learnerId",
      async (request, reply) => {
        const accountId = await options.authenticate(request);
        reply.header("Cache-Control", "no-store");
        if (!request.params.learnerId || request.params.learnerId.length > 200)
          return reply.code(400).send({ error: "invalid_learner" });
        return purchaseStatus(billing, accountId, request.params.learnerId);
      },
    );
    scope.post("/api/v1/billing/checkout", async (request, reply) => {
      const accountId = await options.authenticate(request);
      const body = z
        .strictObject({
          learnerId: z.string().min(1).max(200),
          requestId: z.uuid(),
          offerId: z.string().length(64).optional(),
          interval: z.enum(["year", "month"]).default("year"),
        })
        .safeParse(request.body);
      if (!body.success)
        return reply.code(400).send({ error: "invalid_checkout_request" });
      reply.header("Cache-Control", "no-store");
      if (
        body.data.offerId &&
        body.data.offerId !== annualOffer(options.config, body.data.interval).id
      )
        return reply.code(409).send({ error: "offer_changed" });
      return billing.checkout(
        accountId,
        body.data.learnerId,
        body.data.requestId,
        body.data.interval,
      );
    });
    scope.post("/api/v1/billing/portal", async (request, reply) => {
      const accountId = await options.authenticate(request);
      if (
        request.body !== undefined &&
        !z.strictObject({}).safeParse(request.body).success
      )
        return reply.code(400).send({ error: "invalid_portal_request" });
      reply.header("Cache-Control", "no-store");
      return billing.portal(accountId);
    });
    await scope.register(async (webhook) => {
      webhook.removeContentTypeParser("application/json");
      webhook.addContentTypeParser(
        "application/json",
        { parseAs: "buffer" },
        (_request, body, done) => done(null, body),
      );
      webhook.post(
        "/api/v1/billing/stripe/webhook",
        { bodyLimit: 262144, config: { rateLimit: false } },
        async (request, reply) => {
          const signature = request.headers["stripe-signature"];
          if (typeof signature !== "string" || !Buffer.isBuffer(request.body))
            return reply.code(400).send({ error: "invalid_webhook" });
          let event;
          try {
            event = gateway.verifyWebhook(request.body, signature);
          } catch {
            return reply.code(400).send({ error: "invalid_webhook_signature" });
          }
          const object = event.data.object;
          if (!("id" in object) || typeof object.id !== "string")
            return reply.code(400).send({ error: "invalid_webhook_object" });
          await billing.repository.enqueue({
            eventId: event.id,
            type: event.type,
            objectId: object.id,
            created: event.created,
            hash: createHash("sha256")
              .update(JSON.stringify(event))
              .digest("hex"),
          });
          return { received: true };
        },
      );
    });
  });
  return billing;
}

/** Absence of merchant configuration is an explicit parent-facing state. */
export async function registerUnavailableBilling(
  app: FastifyInstance,
  authenticate: Authenticator,
): Promise<void> {
  app.get("/api/v1/billing/offer", async (request, reply) => {
    await authenticate(request);
    reply.header("Cache-Control", "no-store");
    return { available: false };
  });
}
