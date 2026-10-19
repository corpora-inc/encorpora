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

test(
  "a delayed payment that never settles grants nothing and leaves the learner free to purchase again",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const schema = `amp_delayed_${randomUUID().replaceAll("-", "")}`;
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
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('child','parent','Synthetic learner')",
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('parent',$1,'fixture','synthetic')",
        [config.consentPolicyVersion],
      );
      const repository = new StripeRepository(pool, config);
      // A bank debit: Checkout completes while the first invoice is still processing.
      let subscriptionStatus = "incomplete";
      let checkoutId = "";
      const gateway = new StripeGateway(config, {
        subscriptions: {
          retrieve: async () => ({
            id: payment.subscriptionId,
            livemode: false,
            customer: payment.customerId,
            metadata: { amp_checkout_id: checkoutId },
            status: subscriptionStatus,
            cancel_at_period_end: false,
            items: {
              has_more: false,
              data: [
                {
                  quantity: 1,
                  price: { id: config.priceId },
                  current_period_start: payment.periodStart,
                  current_period_end: payment.periodEnd,
                },
              ],
            },
          }),
        },
      } as unknown as Stripe);
      gateway.verifyCatalog = async () => {};
      gateway.verifyMerchant = async () => {};
      gateway.createCustomer = async () => payment.customerId;
      const sessions: string[] = [];
      gateway.createCheckout = async (id) => {
        checkoutId = id;
        sessions.push(`cs_delayed_${id}`);
        return {
          id: `cs_delayed_${id}`,
          url: "https://checkout.stripe.com/fixture",
        };
      };
      gateway.checkoutStatus = async () => ({
        status: "complete",
        url: null,
        subscriptionId: payment.subscriptionId,
      });
      gateway.annualPayment = async () => {
        throw new Error("no invoice.paid is delivered for an unsettled debit");
      };
      const billing = new StripeBilling(repository, gateway);
      await billing.checkout("parent", "child", randomUUID());
      const first = checkoutId;
      async function deliver(id: string, type: string) {
        await repository.enqueue({
          eventId: id,
          type,
          objectId: payment.subscriptionId,
          created: payment.periodStart,
          hash: id,
        });
        assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      }
      const grants = async () =>
        (await pool.query("SELECT count(*)::int AS n FROM amp_grants")).rows[0]
          .n;
      const closed = async () =>
        (
          await pool.query(
            "SELECT closed FROM amp_stripe_checkouts WHERE id=$1",
            [first],
          )
        ).rows[0].closed;

      // Processing: no access, and the started subscription blocks a duplicate.
      await deliver("evt_processing", "customer.subscription.updated");
      assert.equal(await grants(), 0);
      assert.equal(await closed(), false);
      await assert.rejects(
        billing.checkout("parent", "child", randomUUID()),
        /subscription_already_started/,
      );

      // The debit fails and Stripe expires the subscription: the binding closes.
      subscriptionStatus = "incomplete_expired";
      await deliver("evt_expired", "customer.subscription.updated");
      assert.equal(await grants(), 0);
      assert.equal(await closed(), true);
      gateway.checkoutStatus = async () => ({
        status: "open",
        url: "https://checkout.stripe.com/fixture",
      });
      await billing.checkout("parent", "child", randomUUID());
      assert.notEqual(checkoutId, first);
      assert.equal(sessions.length, 2);
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
