import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { StripeRepository } from "../src/billing/stripe/repository.js";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { StripeBilling } from "../src/billing/stripe/service.js";
import { config, payment } from "./stripe-fixtures.js";
test(
  "Stripe PostgreSQL: concurrent checkout, consent, durable retries, paid grants and refund ordering",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const schema = `amp_stripe_test_${randomUUID().replaceAll("-", "")}`;
    const connectionString = process.env.AMP_TEST_DATABASE_URL!;
    const admin = new Pool({ connectionString, max: 1 });
    const pool = new Pool({
      connectionString,
      max: 8,
      options: `-c search_path=${schema}`,
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      for (const file of [
        "0001.sql",
        "0002-commerce.sql",
        "0003-parent-consent.sql",
        "0004-parent-lifecycle.sql",
        "0005-stripe.sql",
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
        "INSERT INTO amp_learners(id,account_id,name) VALUES('child','parent','Fixture'),('other','another-parent','Other fixture')",
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('parent',$1,'fixture','fixture')",
        [config.consentPolicyVersion],
      );
      const repository = new StripeRepository(pool, config);
      const gateway = new StripeGateway(config);
      const billing = new StripeBilling(repository, gateway);
      let customerCalls = 0,
        checkoutCalls = 0;
      let checkoutId = "";
      let refunded = false;
      let remoteFail = false;
      let catalogCalls = 0;
      gateway.verifyCatalog = async () => {
        catalogCalls++;
      };
      gateway.verifyMerchant = async () => {};
      gateway.verifyPortal = async () => {};
      gateway.createCustomer = async () => {
        customerCalls++;
        return "cus_fixture";
      };
      gateway.createCheckout = async (id) => {
        checkoutCalls++;
        checkoutId = id;
        return {
          id: "cs_fixture",
          url: "https://checkout.stripe.test/fixture",
        };
      };
      gateway.checkoutStatus = async () => ({
        status: "open",
        url: "https://checkout.stripe.test/fixture",
      });
      const requests = await Promise.all(
        Array.from({ length: 5 }, () =>
          billing.checkout("parent", "child", randomUUID()),
        ),
      );
      assert.equal(new Set(requests.map((x) => x.url)).size, 1);
      assert.equal(checkoutCalls, 1);
      assert.equal(customerCalls, 1);
      const beforeUnauthorized = catalogCalls;
      await assert.rejects(
        billing.checkout("parent", "other", randomUUID()),
        /learner_not_found/,
      );
      assert.equal(catalogCalls, beforeUnauthorized);
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id='parent'",
      );
      await assert.rejects(
        billing.checkout("parent", "child", randomUUID()),
        /parent_consent_required/,
      );
      gateway.portal = async () => "https://billing.stripe.test/fixture";
      assert.equal(
        (await billing.portal("parent")).url,
        "https://billing.stripe.test/fixture",
      );
      gateway.checkoutStatus = async () => ({
        status: "complete",
        url: null,
        subscriptionId: payment.subscriptionId,
      });
      gateway.annualPayment = async () => {
        if (remoteFail) throw new Error("secret provider error body");
        return {
          ...payment,
          checkoutId,
          refunded,
          fullRefundAt: refunded ? payment.paidAt + 86400 : undefined,
          partialRefund: false,
        };
      };
      gateway.invoiceFromCharge = async () => payment.invoiceId;
      const event = {
        eventId: "evt_paid",
        type: "invoice.paid",
        objectId: payment.invoiceId,
        created: payment.paidAt,
        hash: "fixture-hash",
      };
      await Promise.all([repository.enqueue(event), repository.enqueue(event)]);
      assert.equal(
        (await pool.query("SELECT count(*) FROM amp_stripe_inbox")).rows[0]
          .count,
        "1",
      );
      await assert.rejects(
        repository.enqueue({ ...event, hash: "different" }),
        /webhook_identity_conflict/,
      );
      remoteFail = true;
      assert.deepEqual(await billing.runBatch(), { processed: 0, failed: 1 });
      const failure = (
        await pool.query("SELECT error_code,status FROM amp_stripe_inbox")
      ).rows[0];
      assert.equal(failure.error_code, "processing_failed");
      assert.equal(failure.status, "pending");
      remoteFail = false;
      await pool.query("UPDATE amp_stripe_inbox SET available_at=now()");
      assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      assert.equal(
        (await pool.query("SELECT status FROM amp_grants")).rows[0].status,
        "active",
      );
      await repository.enqueue({ ...event, eventId: "evt_paid_duplicate" });
      await billing.runBatch();
      assert.equal(
        (await pool.query("SELECT count(*) FROM amp_grants")).rows[0].count,
        "1",
      );
      refunded = true;
      await repository.enqueue({
        ...event,
        eventId: "evt_refund",
        type: "charge.refunded",
        objectId: payment.chargeId,
        created: payment.paidAt + 86400,
      });
      assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      assert.equal(
        (await pool.query("SELECT status FROM amp_grants")).rows[0].status,
        "revoked",
      );
      await repository.enqueue({ ...event, eventId: "evt_late_paid" });
      assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      assert.equal(
        (await pool.query("SELECT status FROM amp_grants")).rows[0].status,
        "revoked",
      );
      assert.equal(
        (await pool.query("SELECT count(*) FROM amp_commerce_events")).rows[0]
          .count,
        "6",
      );
      // A second invoice already refunded before delivery never projects active access.
      gateway.annualPayment = async () => ({
        ...payment,
        invoiceId: "in_refund_first",
        checkoutId,
        refunded: true,
        fullRefundAt: payment.paidAt + 172800,
        partialRefund: false,
      });
      await repository.enqueue({
        ...event,
        eventId: "evt_refund_first",
        objectId: "in_refund_first",
      });
      assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      assert.equal(
        (await pool.query("SELECT count(*) FROM amp_grants")).rows[0].count,
        "1",
      );
      const refundEvidence = await pool.query(
        "SELECT full_refund_at FROM amp_stripe_invoice_evidence WHERE invoice_id='in_refund_first'",
      );
      assert.equal(
        Number(refundEvidence.rows[0].full_refund_at),
        payment.paidAt + 172800,
      );
      // Exclusive privacy lock serializes a subsequent purchase and forces consent recheck.
      const lock = await pool.connect();
      await lock.query("BEGIN");
      await lock.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('parent',0))",
      );
      let finished = false;
      const blocked = repository
        .reserve("parent", "child", randomUUID())
        .catch((error) => error)
        .finally(() => {
          finished = true;
        });
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(finished, false);
      await lock.query("COMMIT");
      lock.release();
      assert.match(String(await blocked), /parent_consent_required/);
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
