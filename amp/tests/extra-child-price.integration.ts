import { applyFixtureMigration } from "./helpers/fixture-migration.js";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import type { StripeBillingConfig } from "../src/billing/stripe/config.js";
import { StripeRepository } from "../src/billing/stripe/repository.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { StripeBilling } from "../src/billing/stripe/service.js";
import { annualOffer, purchaseStatus } from "../src/billing/stripe/purchase.js";
import { ensureFamilyClass } from "../src/family/family-class.js";
import { generateHandle } from "../src/schools/repository.js";
import { config, payment } from "./stripe-fixtures.js";
import { syntheticDocumentProfile } from "./payment-evidence-fixtures.js";

// Each additional child in a family is sold the additional-child price
// (docs/stripe.md#each-additional-child). Fixture prices: full $120, extra $90.
const EXTRA = "price_extra_year";
const priced: StripeBillingConfig = {
  ...config,
  documentProfile: syntheticDocumentProfile,
  extraPriceId: EXTRA,
  extraAmountMinor: 9000,
  extraDocumentProfile: {
    ...syntheticDocumentProfile,
    priceId: EXTRA,
    unitAmountMinor: 9000,
  },
};
const unpriced: StripeBillingConfig = {
  ...config,
  documentProfile: syntheticDocumentProfile,
};
const DAY = 86400;

test(
  "the additional-child price: who pays it, what never counts, and renewals keep their price",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const schema = `amp_extra_${randomUUID().replaceAll("-", "")}`;
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
        await applyFixtureMigration(
          pool,
          await readFile(new URL(file, dir), "utf8"),
        );
      const learner = (id: string, account: string, adult = false) =>
        pool.query(
          "INSERT INTO amp_learners(id,account_id,name,adult) VALUES($1,$2,'Synthetic learner',$3)",
          [id, account, adult],
        );
      for (const account of ["parent-a", "parent-f", "teacher-t", "parent-o"])
        await pool.query(
          "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,$2,'fixture','synthetic')",
          [account, config.consentPolicyVersion],
        );
      for (const id of ["a1", "a2", "a3"]) await learner(id, "parent-a");

      // Invoices are stubbed; everything else is the real checkout and
      // settlement path against the database.
      const invoices = new Map<
        string,
        {
          checkoutId: string;
          priceId: string;
          subtotal: number;
          periodStart: number;
          reason: "subscription_create" | "subscription_cycle";
        }
      >();
      const tiers = new Map<string, string>();
      const completed = new Set<string>();
      function billingFor(settings: StripeBillingConfig) {
        const repository = new StripeRepository(pool, settings);
        const gateway = new StripeGateway(settings);
        gateway.verifyCatalog = async () => {};
        gateway.verifyMerchant = async () => {};
        gateway.createCustomer = async (reservation) => `cus_${reservation}`;
        gateway.createCheckout = async (id, _c, _i, _e, _x, tier = "full") => {
          tiers.set(id, tier);
          return { id: `cs_${id}`, url: "https://checkout.stripe.com/x" };
        };
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
            priceId: invoice.priceId,
            subtotal: invoice.subtotal,
            paid: invoice.subtotal,
            periodStart: invoice.periodStart,
            periodEnd: invoice.periodStart + 365 * DAY,
            paidAt: invoice.periodStart + 60,
            invoiceReason: invoice.reason,
            refunded: false,
            partialRefund: false,
            financial: {
              kind: "verified",
              observation: {
                invoiceReason: invoice.reason,
                preTaxMinor: invoice.subtotal,
                tax: [],
                paidMinor: invoice.subtotal,
                currency: "usd",
                refunds: [],
              },
            },
          };
        };
        return { repository, billing: new StripeBilling(repository, gateway) };
      }
      const now = Math.floor(Date.now() / 1000);
      async function pay(
        { repository, billing }: ReturnType<typeof billingFor>,
        invoiceId: string,
        invoice: Parameters<typeof invoices.set>[1],
      ) {
        invoices.set(invoiceId, invoice);
        completed.add(invoice.checkoutId);
        await repository.enqueue({
          eventId: `evt_${invoiceId}`,
          type: "invoice.paid",
          objectId: invoiceId,
          created: invoice.periodStart + 60,
          hash: invoiceId,
        });
        return billing.runBatch();
      }
      const tierOf = async (checkoutId: string) =>
        (
          await pool.query(
            "SELECT price_tier FROM amp_stripe_checkouts WHERE id=$1",
            [checkoutId],
          )
        ).rows[0].price_tier;
      const checkoutOf = async (learnerId: string) =>
        (
          await pool.query(
            "SELECT id FROM amp_stripe_checkouts WHERE learner_id=$1 AND NOT closed",
            [learnerId],
          )
        ).rows[0].id as string;
      const activeGrants = async (learnerId: string) =>
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_grants WHERE learner_id=$1 AND status='active' AND ends_at>now()",
            [learnerId],
          )
        ).rows[0].n as number;
      const sells = billingFor(priced);
      const extraOffer = annualOffer(priced, "year", "extra");
      const fullOffer = annualOffer(priced, "year");

      // The first child: full price.
      assert.equal(
        (await purchaseStatus(sells.billing, "parent-a", "a1")).tier,
        "full",
      );
      await sells.billing.checkout("parent-a", "a1", randomUUID(), "year");
      const a1 = await checkoutOf("a1");
      assert.equal(tiers.get(a1), "full");
      assert.equal(await tierOf(a1), "full");
      assert.deepEqual(
        await pay(sells, "in_a1", {
          checkoutId: a1,
          priceId: config.priceId,
          subtotal: 12000,
          periodStart: now - DAY,
          reason: "subscription_create",
        }),
        { processed: 1, failed: 0 },
      );
      assert.equal(await activeGrants("a1"), 1);

      // The second child: the additional-child price. The offer the parent
      // saw must be that price; the full one is refused before anything is kept.
      assert.equal(
        (await purchaseStatus(sells.billing, "parent-a", "a2")).tier,
        "extra",
      );
      await assert.rejects(
        sells.billing.checkout(
          "parent-a",
          "a2",
          randomUUID(),
          "year",
          undefined,
          undefined,
          undefined,
          fullOffer.id,
        ),
        /offer_changed/,
      );
      await sells.billing.checkout(
        "parent-a",
        "a2",
        randomUUID(),
        "year",
        undefined,
        undefined,
        undefined,
        extraOffer.id,
      );
      const a2 = await checkoutOf("a2");
      assert.equal(tiers.get(a2), "extra");
      assert.equal(await tierOf(a2), "extra");
      // Its first year has already ended; the subscription is still open.
      assert.deepEqual(
        await pay(sells, "in_a2", {
          checkoutId: a2,
          priceId: EXTRA,
          subtotal: 9000,
          periodStart: now - 400 * DAY,
          reason: "subscription_create",
        }),
        { processed: 1, failed: 0 },
      );
      assert.deepEqual(
        (
          await pool.query(
            "SELECT account_id,learner_id FROM amp_commerce_orders WHERE external_order_id='in_a2'",
          )
        ).rows,
        [{ account_id: "parent-a", learner_id: "a2" }],
      );

      // Without the additional-child settings, every child is full price.
      const before = billingFor(unpriced);
      assert.equal(
        (await purchaseStatus(before.billing, "parent-a", "a3")).tier,
        "full",
      );
      await before.billing.checkout(
        "parent-a",
        "a3",
        randomUUID(),
        "year",
        undefined,
        undefined,
        undefined,
        annualOffer(unpriced).id,
      );
      const a3 = await checkoutOf("a3");
      assert.equal(tiers.get(a3), "full");
      assert.equal(await tierOf(a3), "full");
      // A reopened checkout keeps its price once the settings switch over.
      await sells.billing.checkout("parent-a", "a3", randomUUID(), "year");
      assert.equal(await checkoutOf("a3"), a3);
      assert.equal(await tierOf(a3), "full");

      // The first child's license ends and its subscription closes. The second
      // child renews on the price its subscription has.
      await pool.query(
        "UPDATE amp_grants SET ends_at=now()-interval '1 hour' WHERE learner_id='a1'",
      );
      await pool.query(
        "UPDATE amp_stripe_checkouts SET closed=true WHERE id=$1",
        [a1],
      );
      assert.deepEqual(
        await pay(sells, "in_a2_renewal", {
          checkoutId: a2,
          priceId: EXTRA,
          subtotal: 9000,
          periodStart: now - 35 * DAY,
          reason: "subscription_cycle",
        }),
        { processed: 1, failed: 0 },
      );
      assert.equal(await activeGrants("a2"), 1);
      assert.deepEqual(
        (
          await pool.query(
            "SELECT status FROM amp_payment_records WHERE invoice_id='in_a2_renewal'",
          )
        ).rows,
        [{ status: "verified" }],
      );
      // The renewal at the full price is not this subscription's price.
      assert.deepEqual(
        await pay(sells, "in_a2_bad", {
          checkoutId: a2,
          priceId: EXTRA,
          subtotal: 12000,
          periodStart: now - 34 * DAY,
          reason: "subscription_cycle",
        }),
        { processed: 0, failed: 1 },
      );

      // Funded, gift, pilot and adult access never make a child "additional".
      for (const id of ["f1", "f2", "f3", "f4"]) await learner(id, "parent-f");
      await learner("f-adult", "parent-f", true);
      for (const [id, learnerId, channel, order] of [
        ["g-esa", "f1", "esa", "classwallet:order"],
        ["g-gift", "f2", "pilot", "gift:synthetic"],
        ["g-pilot", "f3", "pilot", "pilot:synthetic"],
        ["g-adult", "f-adult", "stripe", "in_adult"],
      ])
        await pool.query(
          "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,$3,$4,'active',now()-interval '1 day',now()+interval '300 days')",
          [id, learnerId, channel, order],
        );
      assert.equal(
        (await purchaseStatus(sells.billing, "parent-f", "f4")).tier,
        "full",
      );
      await sells.billing.checkout("parent-f", "f4", randomUUID(), "year");
      assert.equal(tiers.get(await checkoutOf("f4")), "full");

      // A teacher buys a seat for another family's child in their family
      // class: the additional-child price, though the teacher pays for nobody.
      await learner("t1", "teacher-t");
      await learner("o1", "parent-o");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await ensureFamilyClass(client, pool, "teacher-t", {
          converting: false,
        });
        await client.query("COMMIT");
      } finally {
        client.release();
      }
      // Anyone else, including that teacher before the child is enrolled,
      // cannot buy for a child that isn't theirs.
      await assert.rejects(
        sells.billing.checkout("teacher-t", "o1", randomUUID(), "year"),
        /learner_not_found/,
      );
      const person = randomUUID();
      await pool.query(
        `INSERT INTO amp_people(id,tenant_id,given_name,handle,learner_id,timezone)
         SELECT $1,org_id,'Synthetic',$2,'o1','America/New_York' FROM amp_families WHERE account_id='teacher-t'`,
        [person, generateHandle()],
      );
      await pool.query(
        `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on)
         SELECT $1,$2,org_id,'student',(now() AT TIME ZONE 'America/New_York')::date FROM amp_families WHERE account_id='teacher-t'`,
        [randomUUID(), person],
      );
      await pool.query(
        `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
         SELECT $1,class_id,$2,'student',(now() AT TIME ZONE 'America/New_York')::date FROM amp_families WHERE account_id='teacher-t'`,
        [randomUUID(), person],
      );
      await assert.rejects(
        sells.billing.checkout("parent-a", "o1", randomUUID(), "year"),
        /learner_not_found/,
      );
      await sells.billing.checkout(
        "teacher-t",
        "o1",
        randomUUID(),
        "year",
        undefined,
        undefined,
        undefined,
        extraOffer.id,
      );
      const seat = await checkoutOf("o1");
      assert.equal(tiers.get(seat), "extra");
      assert.equal(await tierOf(seat), "extra");
      assert.deepEqual(
        await pay(sells, "in_seat", {
          checkoutId: seat,
          priceId: EXTRA,
          subtotal: 9000,
          periodStart: now - DAY,
          reason: "subscription_create",
        }),
        { processed: 1, failed: 0 },
      );
      // The child practices on the seat; the teacher's order pays for it.
      assert.equal(await activeGrants("o1"), 1);
      assert.deepEqual(
        (
          await pool.query(
            "SELECT o.account_id,l.account_id AS owner FROM amp_commerce_orders o JOIN amp_learners l ON l.id=o.learner_id WHERE o.external_order_id='in_seat'",
          )
        ).rows,
        [{ account_id: "teacher-t", owner: "parent-o" }],
      );
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
