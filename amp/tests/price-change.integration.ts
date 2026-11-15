import { applyFixtureMigration } from "./helpers/fixture-migration.js";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import Stripe from "stripe";
import type { StripeBillingConfig } from "../src/billing/stripe/config.js";
import { StripeRepository } from "../src/billing/stripe/repository.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { StripeBilling } from "../src/billing/stripe/service.js";
import { config, payment } from "./stripe-fixtures.js";
import { syntheticDocumentProfile } from "./payment-evidence-fixtures.js";

// A subscriber who bought at the old list price keeps renewing at it after the
// catalog moves to a new price; nobody pays, or is granted, anything else.
test(
  "a subscriber bought at the retired price keeps renewing after the list price changes",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const schema = `amp_price_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
      max: 1,
    });
    const pool = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
      max: 4,
      options: `-c search_path=${schema}`,
    });
    const before: StripeBillingConfig = {
      ...config,
      documentProfile: syntheticDocumentProfile,
    };
    const after: StripeBillingConfig = {
      ...config,
      priceId: "price_annual_new",
      amountMinor: 15000,
      documentProfile: {
        ...syntheticDocumentProfile,
        priceId: "price_annual_new",
        unitAmountMinor: 15000,
      },
      retiredPrices: [
        {
          priceId: config.priceId,
          interval: "year",
          amountMinor: 12000,
          livemode: false,
        },
      ],
    };
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      const dir = new URL("../migrations/", import.meta.url);
      for (const file of (await readdir(dir))
        .filter((file) => file.endsWith(".sql"))
        .sort())
        await applyFixtureMigration(
          pool,
          await readFile(new URL(file, dir), "utf8"),
        );
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('child','parent','Synthetic learner')",
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('parent',$1,'fixture','synthetic')",
        [config.consentPolicyVersion],
      );
      let checkoutId = "";
      let subscriptionPrice = config.priceId;
      const subscription = () => ({
        id: payment.subscriptionId,
        livemode: false,
        customer: payment.customerId,
        metadata: { amp_checkout_id: checkoutId },
        status: "active",
        cancel_at_period_end: false,
        items: {
          has_more: false,
          data: [
            {
              quantity: 1,
              price: { id: subscriptionPrice },
              current_period_start: 1609459200,
              current_period_end: 1640995200,
            },
          ],
        },
      });
      function billingFor(settings: StripeBillingConfig) {
        const repository = new StripeRepository(pool, settings);
        const gateway = new StripeGateway(settings, {
          subscriptions: { retrieve: async () => subscription() },
        } as unknown as Stripe);
        gateway.verifyCatalog = async () => {};
        gateway.verifyMerchant = async () => {};
        gateway.createCustomer = async () => payment.customerId;
        gateway.createCheckout = async (id) => {
          checkoutId = id;
          return { id: `cs_${id}`, url: "https://checkout.stripe.com/x" };
        };
        gateway.checkoutStatus = async () => ({
          status: "open",
          url: "https://checkout.stripe.com/x",
        });
        return {
          repository,
          gateway,
          billing: new StripeBilling(repository, gateway),
        };
      }
      let invoice = { ...payment } as typeof payment & {
        reason?: "subscription_create" | "subscription_cycle";
        paidMinor?: number;
      };
      function stubInvoice(gateway: StripeGateway) {
        gateway.annualPayment = async () => ({
          ...invoice,
          checkoutId,
          refunded: false,
          partialRefund: false,
          financial: {
            kind: "verified",
            observation: {
              invoiceReason: invoice.reason ?? "subscription_create",
              preTaxMinor: invoice.subtotal,
              tax: [],
              paidMinor: invoice.paid,
              currency: "usd",
              refunds: [],
            },
          },
        });
      }
      async function deliver(
        { repository, billing }: ReturnType<typeof billingFor>,
        id: string,
        type = "invoice.paid",
        objectId = invoice.invoiceId,
      ) {
        await repository.enqueue({
          eventId: id,
          type,
          objectId,
          created: invoice.paidAt,
          hash: id,
        });
        return billing.runBatch();
      }
      const count = async (sql: string) =>
        (await pool.query(sql)).rows[0].n as number;

      // Day one, at the old price.
      const old = billingFor(before);
      stubInvoice(old.gateway);
      old.gateway.checkoutStatus = async () => ({
        status: "complete",
        url: null,
        subscriptionId: payment.subscriptionId,
      });
      await old.billing.checkout("parent", "child", randomUUID(), "year");
      old.gateway.checkoutStatus = async () => ({
        status: "complete",
        url: null,
        subscriptionId: payment.subscriptionId,
      });
      assert.deepEqual(await deliver(old, "evt_first"), {
        processed: 1,
        failed: 0,
      });
      assert.equal(await count("SELECT count(*)::int AS n FROM amp_grants"), 1);

      // The catalog moves to the new price. The API now sells $150.
      const now = billingFor(after);
      stubInvoice(now.gateway);
      now.gateway.checkoutStatus = async () => ({
        status: "complete",
        url: null,
        subscriptionId: payment.subscriptionId,
      });

      // The year-two renewal is still the old price at the old amount.
      invoice = {
        ...payment,
        invoiceId: "in_renewal",
        chargeId: "ch_renewal",
        periodStart: 1609459200,
        periodEnd: 1640995200,
        paidAt: 1609459200,
        reason: "subscription_cycle" as const,
      };
      assert.deepEqual(await deliver(now, "evt_renewal"), {
        processed: 1,
        failed: 0,
      });
      assert.equal(
        await count(
          "SELECT count(*)::int AS n FROM amp_grants WHERE status='active'",
        ),
        2,
      );
      // The receipt is issued, not held for a profile change.
      assert.deepEqual(
        (
          await pool.query(
            "SELECT status,review_reason FROM amp_payment_records WHERE invoice_id='in_renewal'",
          )
        ).rows,
        [{ status: "verified", review_reason: null }],
      );
      // Its subscription still maps to the checkout.
      assert.deepEqual(
        await deliver(
          now,
          "evt_sub",
          "customer.subscription.updated",
          payment.subscriptionId,
        ),
        { processed: 1, failed: 0 },
      );

      // The old price at the new amount, or any unknown price, grants nothing.
      for (const [name, bad] of [
        ["amount", { subtotal: 15000, paid: 15000 }],
        ["price", { priceId: "price_unknown" }],
      ] as const) {
        invoice = {
          ...invoice,
          invoiceId: `in_bad_${name}`,
          chargeId: `ch_bad_${name}`,
          periodStart: 1640995200,
          periodEnd: 1672531200,
          paidAt: 1640995200,
          ...bad,
        };
        assert.deepEqual(await deliver(now, `evt_bad_${name}`), {
          processed: 0,
          failed: 1,
        });
      }
      assert.equal(
        await count(
          "SELECT count(*)::int AS n FROM amp_grants WHERE status='active'",
        ),
        2,
      );

      // A subscription moved to an unknown price is refused too.
      subscriptionPrice = "price_unknown";
      assert.deepEqual(
        await deliver(
          now,
          "evt_sub_bad",
          "customer.subscription.updated",
          payment.subscriptionId,
        ),
        { processed: 0, failed: 1 },
      );
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
