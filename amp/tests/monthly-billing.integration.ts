import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import Stripe from "stripe";
import { StripeRepository } from "../src/billing/stripe/repository.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { StripeBilling } from "../src/billing/stripe/service.js";
import { config, payment } from "./stripe-fixtures.js";
import { syntheticDocumentProfile } from "./payment-evidence-fixtures.js";

test(
  "monthly subscription lifecycle: plan binding, paid receipts, renewal, cancellation, refund and replacement",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const schema = `amp_monthly_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
      max: 1,
    });
    const pool = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
      max: 4,
      options: `-c search_path=${schema}`,
    });
    const settings = {
      ...config,
      monthlyPriceId: "price_monthly_fixture",
      monthlyAmountMinor: 1400,
      monthlyDocumentProfile: {
        ...syntheticDocumentProfile,
        priceId: "price_monthly_fixture",
        unitAmountMinor: 1400,
      },
    };
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      const dir = new URL("../migrations/", import.meta.url);
      for (const file of (await readdir(dir))
        .filter((file) => file.endsWith(".sql"))
        .sort())
        await pool.query(await readFile(new URL(file, dir), "utf8"));
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('child','parent','Synthetic learner')",
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('parent',$1,'fixture','synthetic')",
        [settings.consentPolicyVersion],
      );
      const repository = new StripeRepository(pool, settings);
      let subscriptionStatus = "active",
        cancelAtEnd = false,
        checkoutId = "";
      const subscription = () => ({
        id: payment.subscriptionId,
        livemode: false,
        customer: payment.customerId,
        metadata: { amp_checkout_id: checkoutId },
        status: subscriptionStatus,
        cancel_at_period_end: cancelAtEnd,
        items: {
          has_more: false,
          data: [
            {
              quantity: 1,
              price: { id: settings.monthlyPriceId },
              current_period_start: 1577836800,
              current_period_end: 1580515200,
            },
          ],
        },
      });
      const gateway = new StripeGateway(settings, {
        subscriptions: { retrieve: async () => subscription() },
      } as unknown as Stripe);
      gateway.verifyCatalog = async () => {};
      gateway.verifyMerchant = async () => {};
      gateway.createCustomer = async () => payment.customerId;
      gateway.createCheckout = async (id, _customer, interval) => {
        assert.equal(interval, "month");
        checkoutId = id;
        return {
          id: `cs_monthly_${id}`,
          url: "https://checkout.stripe.com/fixture",
        };
      };
      gateway.checkoutStatus = async () => ({
        status: "open",
        url: "https://checkout.stripe.com/fixture",
      });
      const billing = new StripeBilling(repository, gateway);
      const requestId = randomUUID();
      await billing.checkout("parent", "child", requestId, "month");
      assert.equal((await repository.binding(checkoutId)).interval, "month");
      await assert.rejects(
        billing.checkout("parent", "child", requestId, "year"),
        /checkout_request_conflict/,
      );
      await assert.rejects(
        billing.checkout("parent", "child", randomUUID(), "year"),
        /checkout_plan_conflict/,
      );
      await assert.rejects(
        pool.query("UPDATE amp_stripe_checkouts SET billing_interval='year'"),
        /immutable/,
      );
      gateway.checkoutStatus = async () => ({
        status: "complete",
        url: null,
        subscriptionId: payment.subscriptionId,
      });
      let invoice = {
        ...payment,
        invoiceId: "in_monthly_first",
        priceId: settings.monthlyPriceId,
        subtotal: 1400,
        paid: 1400,
        periodEnd: 1580515200,
        checkoutId,
      };
      let refunded = false;
      gateway.annualPayment = async () => ({
        ...invoice,
        refunded,
        partialRefund: false,
        fullRefundAt: refunded ? invoice.paidAt + 86400 : undefined,
        financial: {
          kind: "verified",
          observation: {
            invoiceReason:
              invoice.invoiceId === "in_monthly_first"
                ? "subscription_create"
                : "subscription_cycle",
            preTaxMinor: 1400,
            tax: [],
            paidMinor: 1400,
            currency: "usd",
            refunds: refunded
              ? [
                  {
                    id: "re_monthly",
                    chargeId: invoice.chargeId,
                    amountMinor: 1400,
                    currency: "usd",
                    created: invoice.paidAt + 86400,
                    status: "succeeded",
                  },
                ]
              : [],
          },
        },
      });
      async function deliver(
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
        const batch = await billing.runBatch();
        assert.deepEqual(
          batch,
          { processed: 1, failed: 0 },
          JSON.stringify(
            (
              await pool.query(
                "SELECT error_code FROM amp_stripe_inbox WHERE event_id=$1",
                [id],
              )
            ).rows,
          ),
        );
      }
      await deliver("evt_monthly_first");
      await deliver("evt_monthly_duplicate");
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM amp_grants")).rows[0]
          .n,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_payment_records WHERE status='verified'",
          )
        ).rows[0].n,
        1,
      );
      invoice = {
        ...invoice,
        invoiceId: "in_monthly_renewal",
        chargeId: "ch_monthly_renewal",
        periodStart: 1580515200,
        paidAt: 1580515200,
        periodEnd: 1583020800,
      };
      await deliver("evt_monthly_renewal");
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_payment_records WHERE status='verified'",
          )
        ).rows[0].n,
        2,
      );
      cancelAtEnd = true;
      await deliver(
        "evt_cancel_scheduled",
        "customer.subscription.updated",
        payment.subscriptionId,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_grants WHERE status='active'",
          )
        ).rows[0].n,
        2,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT cancel_at_period_end FROM amp_stripe_subscription_events",
          )
        ).rows[0].cancel_at_period_end,
        true,
      );
      // Entitlements use exact paid periods; no renewal means no access after the last paid end.
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_grants WHERE status='active' AND starts_at<=to_timestamp($1) AND ends_at>to_timestamp($1)",
            [invoice.periodEnd - 1],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_grants WHERE status='active' AND starts_at<=to_timestamp($1) AND ends_at>to_timestamp($1)",
            [invoice.periodEnd],
          )
        ).rows[0].n,
        0,
      );
      refunded = true;
      gateway.invoiceFromCharge = async () => invoice.invoiceId;
      await deliver("evt_monthly_refund", "charge.refunded", invoice.chargeId);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_grants WHERE status='revoked'",
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_grants WHERE status='active'",
          )
        ).rows[0].n,
        1,
      );
      await deliver("evt_late_monthly_paid");
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_grants WHERE status='revoked'",
          )
        ).rows[0].n,
        1,
      );
      // A payment settling after its service period still gets a receipt, with no fresh access.
      refunded = false;
      invoice = {
        ...invoice,
        invoiceId: "in_monthly_late",
        chargeId: "ch_monthly_late",
        periodStart: 1583020800,
        periodEnd: 1585699200,
        paidAt: 1585785600,
      };
      await deliver("evt_monthly_late_settlement");
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_payment_records WHERE status='verified'",
          )
        ).rows[0].n,
        3,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_grants WHERE status='active' AND starts_at<=to_timestamp($1) AND ends_at>to_timestamp($1)",
            [invoice.paidAt],
          )
        ).rows[0].n,
        0,
      );
      subscriptionStatus = "canceled";
      await deliver(
        "evt_cancel_final",
        "customer.subscription.deleted",
        payment.subscriptionId,
      );
      assert.equal(
        (await pool.query("SELECT closed FROM amp_stripe_checkouts")).rows[0]
          .closed,
        true,
      );
      const replacement = await repository.reserve(
        "parent",
        "child",
        randomUUID(),
        "year",
      );
      assert.notEqual(replacement, checkoutId);
      await pool.query(
        "UPDATE amp_stripe_checkouts SET session_id='cs_expired' WHERE id=$1",
        [replacement],
      );
      gateway.checkoutStatus = async () => ({ status: "expired", url: null });
      await billing.checkout("parent", "child", randomUUID(), "month");
      assert.equal(
        (
          await pool.query(
            "SELECT closed FROM amp_stripe_checkouts WHERE id=$1",
            [replacement],
          )
        ).rows[0].closed,
        true,
      );
      assert.equal((await repository.binding(checkoutId)).interval, "month");
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
