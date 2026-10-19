import { learningConsentActive } from "../../server/account-access.js";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { claimEnrollment, purchaseAcknowledgement } from "./enrollment.js";
import { currentPolicy } from "../../parent-consent/policy.js";
import { noticeDigest } from "../../parent-consent/crypto.js";
import { ConsentError } from "../../parent-consent/contracts.js";
import { BillingError } from "./config.js";
import { annualOffer } from "./purchase.js";
import type { StripeBilling } from "./service.js";
import type { StripeRouteOptions } from "./routes.js";

export function registerEnrollmentRoutes(
  app: FastifyInstance,
  options: StripeRouteOptions,
  billing: StripeBilling,
) {
  const gateway = billing.gateway;
  app.get("/api/v1/billing/enrollment", async (request, reply) => {
    const account = await options.authenticate(request);
    reply.header("Cache-Control", "no-store");
    const local = await billing.repository.transaction(
      account,
      async (client) => {
        let notice = null;
        let hash = null;
        try {
          const policy = await currentPolicy(
            client,
            options.consentPolicy ?? null,
          );
          if (
            policy.review.paymentNotificationsReviewed &&
            policy.notice.version === options.config.consentPolicyVersion
          ) {
            notice = policy.notice;
            hash = noticeDigest(policy);
          }
        } catch (error) {
          if (!(error instanceof ConsentError)) throw error;
        }
        const purchase = (
          await client.query(
            `SELECT c.id,c.session_id,c.billing_interval,c.closed,p.revoked_at,p.consent_at,p.expires_at,p.checkout_id AS consent_id,
          EXISTS(SELECT 1 FROM amp_consent_policy policy WHERE policy.singleton AND policy.enabled AND policy.reviewed_until>clock_timestamp() AND policy.digest=p.policy_digest AND policy.generation=p.policy_generation) AS policy_valid,c.assigned_learner_id,EXISTS(SELECT 1 FROM amp_enrollment_cancellations cancelled WHERE cancelled.checkout_id=c.id) AS rejected,
          EXISTS(SELECT 1 FROM amp_account_entitlements e WHERE e.checkout_id=c.id AND e.status='active' AND e.ends_at>now()) AS paid
          FROM amp_stripe_checkouts c LEFT JOIN amp_purchase_consents p ON p.checkout_id=c.id WHERE c.namespace=$1 AND c.account_id=$2 AND c.learner_id IS NULL ORDER BY c.created_at DESC,c.id DESC LIMIT 1`,
            [billing.repository.namespace, account],
          )
        ).rows[0];
        const accepted = await client.query(
          "SELECT 1 FROM amp_parent_consents WHERE account_id=$1 AND policy_version=$2 AND withdrawn_at IS NULL",
          [account, options.config.consentPolicyVersion],
        );
        const claimAllowed =
          !!accepted.rowCount && (await learningConsentActive(client, account));
        return { notice, noticeDigest: hash, purchase, claimAllowed };
      },
    );
    const p = local.purchase;
    const session = p?.session_id
      ? await gateway.checkoutStatus(p.session_id)
      : null;
    const phase = !p
      ? "ready"
      : p.paid && local.claimAllowed
        ? p.assigned_learner_id
          ? "assigned"
          : "paid"
        : !p.session_id && p.expires_at?.getTime() <= Date.now()
          ? "expired"
          : (p.paid && !local.claimAllowed) ||
              p.rejected ||
              p.revoked_at ||
              !p.consent_id ||
              !p.policy_valid ||
              !local.notice
            ? "requires-review"
            : p.assigned_learner_id
              ? "assigned"
              : p.paid
                ? "paid"
                : p.consent_at
                  ? "payment-inactive"
                  : session?.status === "complete"
                    ? "processing"
                    : session?.status === "expired" || p.closed
                      ? "expired"
                      : "checkout-open";
    return {
      available: !!local.notice,
      notice: local.notice,
      noticeDigest: local.noticeDigest,
      purchase: p
        ? {
            id: p.id,
            interval: p.billing_interval,
            phase,
            learnerId: p.assigned_learner_id,
            url: phase === "checkout-open" ? (session?.url ?? null) : null,
          }
        : null,
    };
  });
  app.post("/api/v1/billing/enrollment/checkout", async (request, reply) => {
    const account = await options.authenticate(request);
    reply.header("Cache-Control", "no-store");
    const parsed = z
      .strictObject({
        requestId: z.uuid(),
        offerId: z.string().length(64),
        interval: z.enum(["year", "month"]),
        acknowledgement: purchaseAcknowledgement,
      })
      .safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid_checkout_request" });
    const body = parsed.data;
    if (body.offerId !== annualOffer(options.config, body.interval).id)
      throw new BillingError("offer_changed");
    return billing.checkout(
      account,
      null,
      body.requestId,
      body.interval,
      body.acknowledgement,
    );
  });
  app.post("/api/v1/billing/enrollment/claim", async (request, reply) => {
    const account = await options.authenticate(request);
    reply.header("Cache-Control", "no-store");
    const parsed = z
      .strictObject({
        purchaseId: z.uuid(),
        learnerId: z.string().min(1).max(200),
      })
      .safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "invalid_license_assignment" });
    await claimEnrollment(
      billing,
      account,
      parsed.data.purchaseId,
      parsed.data.learnerId,
    );
    return { assigned: true };
  });
}
