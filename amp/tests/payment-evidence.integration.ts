import { StripeBilling } from "../src/billing/stripe/service.js";
import { StripeRepository } from "../src/billing/stripe/repository.js";
import { registerPaymentEvidenceRoutes } from "../src/billing/evidence/routes.js";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import Fastify from "fastify";
import Stripe from "stripe";
import { Pool } from "pg";
import { StripeGateway } from "../src/billing/stripe/gateway.js";
import { registerStripeRoutes } from "../src/billing/stripe/routes.js";
import { paymentHistory } from "../src/billing/evidence/repository.js";
import { config, remoteFixtures } from "./stripe-fixtures.js";
import { syntheticDocumentProfile } from "./payment-evidence-fixtures.js";

test(
  "signed synthetic payments preserve immutable facts, refund corrections, ownership and withdrawn-consent evidence",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const schema = `amp_payments_${randomUUID().replaceAll("-", "")}`;
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
      const settings = {
        ...config,
        documentProfile: structuredClone(syntheticDocumentProfile),
      };
      const f = remoteFixtures();
      const invoice = {
        ...f.invoice,
        billing_reason: "subscription_create",
        amount_overpaid: 0,
        amount_shipping: 0,
        starting_balance: 0,
        ending_balance: 0,
        pre_payment_credit_notes_amount: 0,
        post_payment_credit_notes_amount: 0,
        latest_revision: null,
        from_invoice: null,
        total_excluding_tax: 12000,
        subtotal_excluding_tax: 12000,
        total_taxes: [],
      };
      let refunds: {
        id: string;
        charge: string;
        currency: string;
        amount: number;
        created: number;
        status: string;
      }[] = [];
      let failInvoiceFetch = false;
      const real = new Stripe(config.secretKey);
      const client = {
        webhooks: real.webhooks,
        accounts: { retrieve: async () => f.account },
        invoices: {
          retrieve: async () => {
            if (failInvoiceFetch) throw new Error("synthetic fetch failure");
            return invoice;
          },
          listLineItems: async () => f.lines,
        },
        subscriptions: { retrieve: async () => f.subscription },
        invoicePayments: { list: async () => f.payments },
        paymentIntents: { retrieve: async () => f.intent },
        charges: { retrieve: async () => f.charge },
        refunds: {
          list: async () => ({ has_more: false, data: refunds }),
          retrieve: async (id: string) =>
            refunds.find((item) => item.id === id),
        },
        creditNotes: {
          retrieve: async () => ({ invoice: invoice.id, livemode: false }),
        },
      } as unknown as Stripe;
      const gateway = new StripeGateway(settings, client);
      gateway.checkoutStatus = async () => ({
        status: "complete",
        url: null,
        subscriptionId: f.invoice.parent.subscription_details.subscription,
      });
      const billing = await registerStripeRoutes(app, {
        pool,
        authenticate: async () => "parent",
        config: settings,
        gateway,
      });
      await registerPaymentEvidenceRoutes(app, {
        pool,
        authenticate: async (request) => {
          const token = request.headers.authorization;
          if (!token)
            throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
          return token.replace("Bearer ", "");
        },
      });
      const checkoutId = await billing.repository.reserve(
        "parent",
        "child",
        randomUUID(),
      );
      f.subscription.metadata.amp_checkout_id = checkoutId;
      await pool.query(
        "UPDATE amp_stripe_checkouts SET customer_id='cus_fixture',session_id='cs_fixture' WHERE id=$1",
        [checkoutId],
      );
      settings.documentProfile.seller.legalName =
        "Changed current configuration";
      const send = async (
        type: string,
        id: string,
        eventId = `evt_${randomUUID()}`,
      ) => {
        const payload = JSON.stringify({
          id: eventId,
          object: "event",
          type,
          created: Math.floor(Date.now() / 1000),
          livemode: false,
          data: { object: { id } },
        });
        const signature = real.webhooks.generateTestHeaderString({
          payload,
          secret: config.webhookSecret,
        });
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/billing/stripe/webhook",
          headers: {
            "content-type": "application/json",
            "stripe-signature": signature,
          },
          payload,
        });
        assert.equal(response.statusCode, 200, response.body);
        return { payload, signature, eventId };
      };
      const first = await send("invoice.paid", invoice.id);
      assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      let history = await paymentHistory(pool, "parent");
      assert.equal(history.length, 1);
      assert.equal(
        history[0]!.baseline!.profile.seller.legalName,
        syntheticDocumentProfile.seller.legalName,
      );
      assert.equal(history[0]!.netPaidMinor, 12000);
      settings.documentProfile = structuredClone(syntheticDocumentProfile);
      assert.deepEqual(await paymentHistory(pool, "foreign"), []);
      const receiptUrl = `/api/v1/payments/${history[0]!.id}/record.pdf`;
      assert.equal((await app.inject({ url: receiptUrl })).statusCode, 401);
      assert.equal(
        (
          await app.inject({
            url: receiptUrl,
            headers: { authorization: "Bearer foreign" },
          })
        ).statusCode,
        404,
      );
      const receipt = await app.inject({
        url: receiptUrl,
        headers: { authorization: "Bearer parent" },
      });
      assert.equal(receipt.statusCode, 200, receipt.body);
      assert.match(
        receipt.headers["content-type"] as string,
        /application\/pdf/,
      );
      assert.equal(receipt.headers["cache-control"], "no-store");
      assert.equal(receipt.rawPayload.subarray(0, 5).toString(), "%PDF-");

      await app.inject({
        method: "POST",
        url: "/api/v1/billing/stripe/webhook",
        headers: {
          "content-type": "application/json",
          "stripe-signature": first.signature,
        },
        payload: first.payload,
      });
      assert.deepEqual(await billing.runBatch(), { processed: 0, failed: 0 });
      assert.equal(
        (await paymentHistory(pool, "parent"))[0]!.observations.length,
        1,
      );
      refunds = [
        {
          id: "re_partial",
          charge: "ch_fixture",
          currency: "usd",
          amount: 3000,
          created: invoice.status_transitions.paid_at + 100,
          status: "pending",
        },
      ];
      await send("refund.created", "re_partial");
      assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      assert.equal(
        (await paymentHistory(pool, "parent"))[0]!.netPaidMinor,
        12000,
      );
      refunds[0]!.status = "succeeded";
      await send("refund.updated", "re_partial");
      assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      assert.equal(
        (await paymentHistory(pool, "parent"))[0]!.netPaidMinor,
        9000,
      );
      refunds.push({
        id: "re_rest",
        charge: "ch_fixture",
        currency: "usd",
        amount: 9000,
        created: invoice.status_transitions.paid_at + 200,
        status: "succeeded",
      });
      await send("charge.refunded", "ch_fixture");
      assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      assert.equal((await paymentHistory(pool, "parent"))[0]!.netPaidMinor, 0);
      assert.equal(
        (
          await pool.query(
            "SELECT status FROM amp_grants WHERE learner_id='child'",
          )
        ).rows[0].status,
        "revoked",
      );
      refunds[1]!.status = "failed";
      await send("refund.failed", "re_rest");
      assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      history = await paymentHistory(pool, "parent");
      assert.equal(history[0]!.netPaidMinor, 9000);
      assert.equal(history[0]!.observations.length, 5);
      assert.equal(
        (
          await pool.query(
            "SELECT status FROM amp_grants WHERE learner_id='child'",
          )
        ).rows[0].status,
        "revoked",
      );
      await assert.rejects(
        pool.query("UPDATE amp_payment_records SET baseline='{}' WHERE id=$1", [
          history[0]!.id,
        ]),
        /immutable/,
      );
      await assert.rejects(
        pool.query(
          "UPDATE amp_stripe_checkouts SET document_profile='{}' WHERE id=$1",
          [checkoutId],
        ),
        /immutable/,
      );
      await assert.rejects(
        pool.query("DELETE FROM amp_payment_observations WHERE record_id=$1", [
          history[0]!.id,
        ]),
        /append-only/,
      );
      // Two independent worker pools: the first worker's pre-lock discovery is stale.
      // A newer refund commits while it waits; its locked refresh must not revert history.
      const secondPool = new Pool({
        connectionString: process.env.AMP_TEST_DATABASE_URL,
        max: 4,
        options: `-c search_path=${schema}`,
      });
      const secondGateway = new StripeGateway(settings, client);
      secondGateway.checkoutStatus = gateway.checkoutStatus;
      const secondBilling = new StripeBilling(
        new StripeRepository(secondPool, settings),
        secondGateway,
      );
      const originalRefresh = gateway.annualPayment.bind(gateway);
      let releaseDiscovery!: () => void, discovered!: () => void;
      const waitDiscovery = new Promise<void>((resolve) => {
        discovered = resolve;
      });
      const holdDiscovery = new Promise<void>((resolve) => {
        releaseDiscovery = resolve;
      });
      let firstDiscovery = true;
      gateway.annualPayment = async (id) => {
        const value = await originalRefresh(id);
        if (firstDiscovery) {
          firstDiscovery = false;
          discovered();
          await holdDiscovery;
        }
        return value;
      };
      let stalePass: Promise<{ processed: number; failed: number }> | undefined;
      try {
        await send("invoice.paid", invoice.id);
        stalePass = billing.runBatch();
        await waitDiscovery;
        refunds.push({
          id: "re_additional",
          charge: "ch_fixture",
          currency: "usd",
          amount: 9000,
          created: invoice.status_transitions.paid_at + 300,
          status: "succeeded",
        });
        await send("refund.created", "re_additional");
        assert.deepEqual(await secondBilling.runBatch(), {
          processed: 1,
          failed: 0,
        });
        releaseDiscovery();
        assert.deepEqual(await stalePass, { processed: 1, failed: 0 });
        assert.equal(
          (await paymentHistory(pool, "parent"))[0]!.netPaidMinor,
          0,
        );
      } finally {
        releaseDiscovery();
        await stalePass;
        gateway.annualPayment = originalRefresh;
        await secondPool.end();
      }
      // A second, genuine annual invoice arrives after consent withdrawal. Financial facts commit; access cannot activate.
      invoice.id = "in_second";
      invoice.billing_reason = "subscription_cycle";
      invoice.status_transitions.paid_at = f.lines.data[0]!.period.end;
      f.lines.data[0]!.period = {
        start: invoice.status_transitions.paid_at,
        end: invoice.status_transitions.paid_at + 365 * 86400,
      };
      f.payments.data[0]!.invoice = invoice.id;
      f.charge.id = "ch_second";
      f.intent.latest_charge = "ch_second";
      refunds = [];
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id='parent'",
      );
      await send("invoice.paid", invoice.id);
      assert.deepEqual(await billing.runBatch(), { processed: 0, failed: 1 });
      history = await paymentHistory(pool, "parent");
      assert.equal(history.length, 2);
      assert.equal(
        history.find((item) => item.baseline?.invoiceId === "in_second")!
          .netPaidMinor,
        12000,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM amp_grants WHERE learner_id='child' AND status='active'",
          )
        ).rows[0].count,
        0,
      );
      await send("credit_note.created", "cn_fixture");
      await billing.runBatch();
      assert.equal(
        (await paymentHistory(pool, "parent")).find(
          (item) => item.baseline?.invoiceId === "in_second",
        )!.status,
        "review",
      );
      // Deletion wins an account-lock race; paid evidence survives, activation does not.
      invoice.id = "in_deleted_learner";
      f.charge.id = "ch_deleted";
      f.intent.latest_charge = "ch_deleted";
      f.payments.data[0]!.invoice = invoice.id;
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=NULL WHERE account_id='parent'",
      );
      const deletion = await pool.connect();
      let deletePass:
        Promise<{ processed: number; failed: number }> | undefined;
      try {
        await deletion.query("BEGIN");
        await deletion.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('parent',0))",
        );
        const blocker = (await deletion.query("SELECT pg_backend_pid() AS pid"))
          .rows[0].pid;
        await deletion.query(
          "UPDATE amp_learners SET deleted_at=now(),name='Deleted learner' WHERE id='child'",
        );
        await send("invoice.paid", invoice.id);
        deletePass = billing.runBatch();
        const deadline = Date.now() + 4000;
        let observedWait = false;
        while (Date.now() < deadline) {
          const blocked = await pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))",
            [blocker],
          );
          if (blocked.rowCount) {
            observedWait = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.ok(
          observedWait,
          "Worker must wait behind the deletion account lock",
        );
        await deletion.query("COMMIT");
        assert.equal((await deletePass).failed, 1);
        assert.equal(
          (
            await pool.query(
              "SELECT status FROM amp_payment_records WHERE invoice_id='in_deleted_learner'",
            )
          ).rows[0].status,
          "verified",
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int AS count FROM amp_grants WHERE learner_id='child' AND status='active'",
            )
          ).rows[0].count,
          0,
        );
      } finally {
        await deletion.query("ROLLBACK");
        deletion.release();
        await deletePass;
      }
      // Pagination retains owned older records; cursors never substitute account authorization.
      for (let index = 0; index < 101; index++)
        await pool.query(
          "INSERT INTO amp_payment_records(id,namespace,invoice_id,checkout_id,account_id,learner_id,status) VALUES($1,$2,$3,$4,'parent','child','review')",
          [
            randomUUID(),
            billing.repository.namespace,
            `in_page_${index}`,
            checkoutId,
          ],
        );
      const page1 = (
        await app.inject({
          url: "/api/v1/payments",
          headers: { authorization: "Bearer parent" },
        })
      ).json();
      assert.equal(page1.records.length, 100);
      assert.ok(page1.nextCursor);
      const page2 = (
        await app.inject({
          url: `/api/v1/payments?cursor=${encodeURIComponent(page1.nextCursor)}`,
          headers: { authorization: "Bearer parent" },
        })
      ).json();
      assert.equal(page2.records.length, 4);
      assert.equal(page2.nextCursor, null);
      assert.equal(
        new Set(
          [...page1.records, ...page2.records].map(
            (item: { id: string }) => item.id,
          ),
        ).size,
        104,
      );
      assert.deepEqual(
        (
          await app.inject({
            url: `/api/v1/payments?cursor=${encodeURIComponent(page1.nextCursor)}`,
            headers: { authorization: "Bearer foreign" },
          })
        ).json().records,
        [],
      );
      // A changed reviewed identity cannot silently become the seller on a renewal.
      invoice.id = "in_changed_profile";
      f.charge.id = "ch_profile";
      f.intent.latest_charge = "ch_profile";
      f.payments.data[0]!.invoice = invoice.id;
      settings.documentProfile.product.title =
        "A different reviewed product description";
      await send("invoice.paid", invoice.id);
      await billing.runBatch();
      const changed = (
        await pool.query(
          "SELECT status,review_reason,baseline FROM amp_payment_records WHERE invoice_id='in_changed_profile'",
        )
      ).rows[0];
      assert.equal(changed.status, "review");
      assert.equal(changed.review_reason, "renewal_profile_requires_review");
      assert.equal(changed.baseline.paidMinor, 12000);
      // Transient unavailable tax evidence cannot erase the durable renewal hold.
      const originalTaxes = invoice.total_taxes;
      Object.assign(invoice, { total_taxes: undefined });
      await send("invoice.paid", invoice.id);
      await billing.runBatch();
      settings.documentProfile = structuredClone(syntheticDocumentProfile);
      invoice.total_taxes = originalTaxes;
      await send("invoice.paid", invoice.id);
      await billing.runBatch();
      assert.equal(
        (
          await pool.query(
            "SELECT review_reason FROM amp_payment_records WHERE invoice_id=$1",
            [invoice.id],
          )
        ).rows[0].review_reason,
        "renewal_profile_requires_review",
      );
      // A credit note preceding the invoice persists through a failed fetch and later void.
      invoice.id = "in_credit_first";
      f.charge.id = "ch_credit";
      f.intent.latest_charge = "ch_credit";
      f.payments.data[0]!.invoice = invoice.id;
      failInvoiceFetch = true;
      await send("credit_note.created", "cn_before_payment");
      assert.equal((await billing.runBatch()).failed, 1);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM amp_payment_holds WHERE invoice_id='in_credit_first'",
          )
        ).rows[0].count,
        1,
      );
      failInvoiceFetch = false;
      await send("credit_note.voided", "cn_before_payment");
      await billing.runBatch();
      await send("invoice.paid", invoice.id);
      await billing.runBatch();
      assert.equal(
        (
          await pool.query(
            "SELECT status FROM amp_payment_records WHERE invoice_id='in_credit_first'",
          )
        ).rows[0].status,
        "review",
      );
      // Refund-first delivery produces a paid baseline and a downloadable first observation.
      invoice.id = "in_refund_first";
      f.payments.data[0]!.invoice = invoice.id;
      f.charge.id = "ch_refund_first";
      f.intent.latest_charge = "ch_refund_first";
      refunds = [
        {
          id: "re_first",
          charge: "ch_refund_first",
          currency: "usd",
          amount: 12000,
          created: invoice.status_transitions.paid_at + 10,
          status: "succeeded",
        },
      ];
      await send("refund.created", "re_first");
      assert.deepEqual(await billing.runBatch(), { processed: 1, failed: 0 });
      const refundRecord = (
        await pool.query(
          "SELECT id FROM amp_payment_records WHERE invoice_id='in_refund_first'",
        )
      ).rows[0].id;
      const refundHistory = (
        await paymentHistory(pool, "parent", refundRecord)
      )[0]!;
      assert.equal(refundHistory.netPaidMinor, 0);
      assert.equal(refundHistory.observations.length, 1);
      const firstAdjustment = await app.inject({
        url: `/api/v1/payments/${refundRecord}/adjustments/${refundHistory.observations[0]!.id}.pdf`,
        headers: { authorization: "Bearer parent" },
      });
      assert.equal(firstAdjustment.statusCode, 200, firstAdjustment.body);
      // Collision → transient missing evidence → original facts must stay held.
      const originalPaidAt = invoice.status_transitions.paid_at;
      invoice.status_transitions.paid_at += 1;
      await send("invoice.paid", invoice.id);
      await billing.runBatch();
      assert.equal(
        (
          await pool.query(
            "SELECT review_reason FROM amp_payment_records WHERE invoice_id=$1",
            [invoice.id],
          )
        ).rows[0].review_reason,
        "financial_baseline_collision",
      );
      Object.assign(invoice, { total_taxes: undefined });
      await send("invoice.paid", invoice.id);
      await billing.runBatch();
      invoice.status_transitions.paid_at = originalPaidAt;
      invoice.total_taxes = originalTaxes;
      await send("invoice.paid", invoice.id);
      await billing.runBatch();
      assert.equal(
        (
          await pool.query(
            "SELECT review_reason FROM amp_payment_records WHERE invoice_id=$1",
            [invoice.id],
          )
        ).rows[0].review_reason,
        "financial_baseline_collision",
      );
      assert.equal(
        (
          await app.inject({
            url: `/api/v1/payments/${refundRecord}/record.pdf`,
            headers: { authorization: "Bearer parent" },
          })
        ).statusCode,
        409,
      );
      // A single captured charge cannot become a second paid entitlement.
      invoice.id = "in_duplicate_charge";
      f.payments.data[0]!.invoice = invoice.id;
      refunds = [];
      await send("invoice.paid", invoice.id);
      assert.equal((await billing.runBatch()).failed, 1);
      assert.equal(
        (
          await pool.query(
            "SELECT review_reason FROM amp_payment_records WHERE invoice_id='in_duplicate_charge'",
          )
        ).rows[0].review_reason,
        "financial_charge_collision",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM amp_commerce_orders WHERE external_order_id='in_duplicate_charge'",
          )
        ).rows[0].count,
        0,
      );
      // A later credit-note label cannot hide an irreversible identity collision.
      await send("credit_note.created", "cn_after_collision");
      await billing.runBatch();
      assert.equal(
        (
          await pool.query(
            "SELECT review_reason FROM amp_payment_records WHERE invoice_id=$1",
            [invoice.id],
          )
        ).rows[0].review_reason,
        "provider_credit_note_requires_review",
      );
      // Restore fixture eligibility to prove the collision itself blocks access.
      await pool.query(
        "UPDATE amp_learners SET deleted_at=NULL WHERE id='child'",
      );
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=NULL WHERE account_id='parent'",
      );
      f.charge.id = "ch_corrected_after_collision";
      f.intent.latest_charge = f.charge.id;
      const correctedRetry = await send("invoice.paid", invoice.id);
      assert.equal((await billing.runBatch()).failed, 1);
      assert.equal(
        (
          await pool.query(
            "SELECT error_code FROM amp_stripe_inbox WHERE event_id=$1",
            [correctedRetry.eventId],
          )
        ).rows[0].error_code,
        "payment_identity_requires_reconciliation",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS count FROM amp_commerce_orders WHERE external_order_id='in_duplicate_charge'",
          )
        ).rows[0].count,
        0,
      );
    } finally {
      await app.close();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
