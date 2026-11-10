import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import type { StripeBillingConfig } from "../src/billing/stripe/config.js";
import { StripeRepository } from "../src/billing/stripe/repository.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { StripeBilling } from "../src/billing/stripe/service.js";
import { purchaseStatus } from "../src/billing/stripe/purchase.js";
import { config, payment } from "./stripe-fixtures.js";
import { syntheticDocumentProfile } from "./payment-evidence-fixtures.js";

// An adult buys for their own learner on their own terms: no parental consent
// (docs/families.md). Every other learner still needs the purchaser's consent.
const settings: StripeBillingConfig = {
  ...config,
  documentProfile: syntheticDocumentProfile,
};
const DAY = 86400;

test(
  "an adult buys their own learner without parental consent; children and other accounts still cannot",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const schema = `amp_adult_buy_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
      max: 1,
    });
    const pool = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
      max: 4,
      options: `-c search_path=${schema}`,
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      const dir = new URL("../migrations/", import.meta.url);
      for (const file of (await readdir(dir))
        .filter((file) => file.endsWith(".sql"))
        .sort())
        await pool.query(await readFile(new URL(file, dir), "utf8"));
      const learner = (id: string, account: string, adult = false) =>
        pool.query(
          "INSERT INTO amp_learners(id,account_id,name,adult) VALUES($1,$2,'Synthetic learner',$3)",
          [id, account, adult],
        );
      // "adult-a" has no consent row; "parent-o" has a current one.
      await learner("self", "adult-a", true);
      await learner("kid", "adult-a");
      await learner("o1", "parent-o");
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('parent-o',$1,'fixture','synthetic')",
        [config.consentPolicyVersion],
      );

      // Invoices are stubbed; checkout and settlement run against the database.
      const invoices = new Map<
        string,
        { checkoutId: string; periodStart: number }
      >();
      const completed = new Set<string>();
      const repository = new StripeRepository(pool, settings);
      const gateway = new StripeGateway(settings);
      gateway.verifyCatalog = async () => {};
      gateway.verifyMerchant = async () => {};
      gateway.createCustomer = async (reservation) => `cus_${reservation}`;
      gateway.createCheckout = async (id) => ({
        id: `cs_${id}`,
        url: "https://checkout.stripe.com/x",
      });
      gateway.checkoutStatus = async (sessionId) =>
        completed.has(sessionId.slice(3))
          ? {
              status: "complete",
              url: null,
              subscriptionId: `sub_${sessionId.slice(3)}`,
            }
          : { status: "open", url: "https://checkout.stripe.com/x" };
      gateway.annualPayment = async (invoiceId) => {
        const invoice = invoices.get(invoiceId)!;
        const customer = await pool.query(
          "SELECT customer_id FROM amp_stripe_checkouts WHERE id=$1",
          [invoice.checkoutId],
        );
        return {
          ...payment,
          invoiceId,
          chargeId: `ch_${invoiceId}`,
          checkoutId: invoice.checkoutId,
          subscriptionId: `sub_${invoice.checkoutId}`,
          customerId: customer.rows[0].customer_id,
          priceId: config.priceId,
          subtotal: 12000,
          paid: 12000,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodStart + 365 * DAY,
          paidAt: invoice.periodStart + 60,
          invoiceReason: "subscription_create",
          refunded: false,
          partialRefund: false,
          financial: {
            kind: "verified",
            observation: {
              invoiceReason: "subscription_create",
              preTaxMinor: 12000,
              tax: [],
              paidMinor: 12000,
              currency: "usd",
              refunds: [],
            },
          },
        };
      };
      const billing = new StripeBilling(repository, gateway);
      const now = Math.floor(Date.now() / 1000);

      // The adult's own learner: ready to buy, at the full price.
      assert.deepEqual(await purchaseStatus(billing, "adult-a", "self"), {
        learnerId: "self",
        phase: "ready",
        tier: "full",
      });
      const { url } = await billing.checkout(
        "adult-a",
        "self",
        randomUUID(),
        "year",
      );
      assert.equal(url, "https://checkout.stripe.com/x");
      const checkout = (
        await pool.query(
          "SELECT id,account_id,price_tier FROM amp_stripe_checkouts WHERE learner_id='self' AND NOT closed",
        )
      ).rows;
      assert.equal(checkout.length, 1);
      assert.equal(checkout[0].account_id, "adult-a");
      assert.equal(checkout[0].price_tier, "full");
      const checkoutId = checkout[0].id as string;
      assert.equal(
        (await purchaseStatus(billing, "adult-a", "self")).phase,
        "checkout-open",
      );

      // Paying settles an active grant for the adult's learner.
      invoices.set("in_self", { checkoutId, periodStart: now - DAY });
      completed.add(checkoutId);
      await repository.enqueue({
        eventId: "evt_in_self",
        type: "invoice.paid",
        objectId: "in_self",
        created: now - DAY + 60,
        hash: "in_self",
      });
      assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      assert.deepEqual(
        (
          await pool.query(
            "SELECT learner_id,channel,status FROM amp_grants WHERE learner_id='self' AND status='active' AND ends_at>now()",
          )
        ).rows,
        [{ learner_id: "self", channel: "stripe", status: "active" }],
      );
      assert.equal(
        (await purchaseStatus(billing, "adult-a", "self")).phase,
        "licensed",
      );

      // The same account's child still needs parental consent.
      assert.equal(
        (await purchaseStatus(billing, "adult-a", "kid")).phase,
        "consent-required",
      );
      await assert.rejects(
        billing.checkout("adult-a", "kid", randomUUID(), "year"),
        { code: "parent_consent_required", statusCode: 403 },
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_stripe_checkouts WHERE learner_id='kid'",
          )
        ).rows[0].n,
        0,
      );

      // Another account, consent or not, cannot buy for this adult's learner.
      await assert.rejects(purchaseStatus(billing, "parent-o", "self"), {
        code: "learner_not_found",
        statusCode: 404,
      });
      await assert.rejects(
        billing.checkout("parent-o", "self", randomUUID(), "year"),
        { code: "learner_not_found", statusCode: 404 },
      );
      await assert.rejects(
        billing.checkout("stranger", "self", randomUUID(), "year"),
        { code: "parent_consent_required", statusCode: 403 },
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_stripe_checkouts WHERE account_id<>'adult-a'",
          )
        ).rows[0].n,
        0,
      );
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
