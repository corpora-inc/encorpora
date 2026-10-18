import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import Fastify from "fastify";
import { Pool } from "pg";
import { registerStripeRoutes } from "../src/billing/stripe/routes.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { config, payment } from "./stripe-fixtures.js";

test(
  "annual parent flow: ownership, idempotence, expiry, webhook-only grant and duplicate protection",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const schema = `amp_annual_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
      max: 1,
    });
    const pool = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
      max: 8,
      options: `-c search_path=${schema}`,
    });
    const app = Fastify();
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      for (const file of [
        "0001.sql",
        "0002-commerce.sql",
        "0003-parent-consent.sql",
        "0004-parent-lifecycle.sql",
        "0005-stripe.sql",
        "0011-paid-evidence.sql",
        "0017-monthly-billing.sql",
        "0006-commerce-orders.sql",
        "0008-skill-evidence.sql",
      ])
        await pool.query(
          await readFile(
            new URL(`../migrations/${file}`, import.meta.url),
            "utf8",
          ),
        );
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('child','parent','Fixture'),('foreign','other','Foreign fixture')",
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('parent',$1,'fixture','fixture')",
        [config.consentPolicyVersion],
      );
      const gateway = new StripeGateway(config);
      let catalogCalls = 0,
        statusCalls = 0,
        creations = 0,
        checkoutId = "",
        remoteState = "open";
      gateway.verifyCatalog = async () => {
        catalogCalls++;
      };
      gateway.verifyMerchant = async () => {};
      gateway.createCustomer = async () => "cus_fixture";
      gateway.createCheckout = async (id) => {
        creations++;
        checkoutId = id;
        remoteState = "open";
        return {
          id: `cs_fixture_${creations}`,
          url: "https://checkout.stripe.com/fixture",
        };
      };
      gateway.checkoutStatus = async () => {
        statusCalls++;
        return {
          status: remoteState,
          url:
            remoteState === "open"
              ? "https://checkout.stripe.com/fixture"
              : null,
          subscriptionId:
            remoteState === "complete" ? payment.subscriptionId : undefined,
        };
      };
      const billing = await registerStripeRoutes(app, {
        pool,
        config,
        gateway,
        authenticate: async (request) => {
          if (request.headers.authorization !== "Bearer parent")
            throw Object.assign(new Error("sign_in_required"), {
              statusCode: 401,
            });
          return "parent";
        },
      });
      const headers = { authorization: "Bearer parent" };
      const get = (url: string) => app.inject({ url, headers });
      const post = (requestId: string, learnerId = "child", offerId?: string) =>
        app.inject({
          method: "POST",
          url: "/api/v1/billing/checkout",
          headers,
          payload: { requestId, learnerId, ...(offerId ? { offerId } : {}) },
        });
      assert.equal(
        (await app.inject({ url: "/api/v1/billing/offer" })).statusCode,
        401,
      );
      const offer = (await get("/api/v1/billing/offer")).json().offer;
      assert.equal(offer.formattedAmount, "$120.00");
      assert.equal(catalogCalls, 1);
      assert.equal(
        (await get("/api/v1/billing/status/foreign")).statusCode,
        404,
      );
      assert.equal(statusCalls, 0);
      assert.equal((await post(randomUUID(), "foreign")).statusCode, 404);
      assert.equal(catalogCalls, 1);
      assert.equal(
        (await post(randomUUID(), "child", "0".repeat(64))).json().error,
        "offer_changed",
      );
      assert.equal(creations, 0);
      assert.equal(
        (await get("/api/v1/billing/status/child")).json().phase,
        "ready",
      );
      const requestId = randomUUID();
      const results = await Promise.all([
        post(requestId, "child", offer.id),
        post(requestId, "child", offer.id),
      ]);
      assert.ok(results.every((result) => result.statusCode === 200));
      assert.equal(creations, 1);
      assert.equal(
        (await get(`/api/v1/billing/purchase/${checkoutId}`)).json().learnerId,
        "child",
      );
      assert.equal(
        (await get(`/api/v1/billing/purchase/${randomUUID()}`)).statusCode,
        404,
      );
      const foreignPurchase = randomUUID();
      await pool.query(
        "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,learner_id,request_id) VALUES($1,$2,'other','foreign',$3)",
        [foreignPurchase, billing.repository.namespace, randomUUID()],
      );
      assert.equal(
        (await get(`/api/v1/billing/purchase/${foreignPurchase}`)).statusCode,
        404,
      );

      assert.equal(
        (await get("/api/v1/billing/status/child")).json().phase,
        "checkout-open",
      );
      remoteState = "expired";
      assert.equal(
        (await get("/api/v1/billing/status/child")).json().phase,
        "checkout-expired",
      );
      assert.equal(
        (await post(requestId)).json().error,
        "checkout_expired_retry_with_new_request",
      );
      assert.equal((await post(randomUUID())).statusCode, 200);
      assert.equal(creations, 2);
      remoteState = "complete";
      assert.equal(
        (await get("/api/v1/billing/status/child")).json().phase,
        "payment-processing",
      );
      assert.equal(
        (await post(randomUUID())).json().error,
        "subscription_already_started",
      );
      assert.equal(
        (await pool.query("SELECT count(*) FROM amp_grants")).rows[0].count,
        "0",
      );
      const start = Math.floor(Date.now() / 1000) - 3600;
      gateway.annualPayment = async () => ({
        ...payment,
        checkoutId,
        periodStart: start,
        periodEnd: start + 365 * 86400,
        paidAt: start,
        refunded: false,
        partialRefund: false,
      });
      await billing.repository.enqueue({
        eventId: "evt_fixture_paid",
        type: "invoice.paid",
        objectId: payment.invoiceId,
        created: start,
        hash: "fixture",
      });
      assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      assert.equal(
        (await get("/api/v1/billing/status/child")).json().phase,
        "licensed",
      );
      const beforeCalls = statusCalls;
      assert.equal(
        (await post(randomUUID())).json().error,
        "learner_already_licensed",
      );
      assert.equal(statusCalls, beforeCalls); // An open binding cannot return a second payment link after access is granted.
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id='parent'",
      );
      assert.equal(
        (await get("/api/v1/billing/status/child")).json().phase,
        "licensed",
      ); // Billing remains readable after withdrawal.
      assert.equal(
        (await post(randomUUID())).json().error,
        "parent_consent_required",
      );
      await pool.query("UPDATE amp_grants SET status='revoked'");
      assert.equal(
        (await get("/api/v1/billing/status/child")).json().phase,
        "consent-required",
      );
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=NULL WHERE account_id='parent'",
      );
      assert.equal(
        (await get("/api/v1/billing/status/child")).json().phase,
        "awaiting-payment",
      ); // Completed subscription is not silently replaced after refund/expiry.
      let release!: () => void;
      let started!: () => void;
      const entered = new Promise<void>((resolve) => {
        started = resolve;
      });
      gateway.checkoutStatus = async () => {
        started();
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { status: "open", url: "https://checkout.stripe.com/fixture" };
      };
      const held = get("/api/v1/billing/status/child").then(
        (response) => response,
      );
      await entered;
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id='parent'",
      );
      release();
      assert.equal((await held).json().phase, "consent-required");
    } finally {
      await app.close();
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
