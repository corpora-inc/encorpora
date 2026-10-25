import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { migrate } from "../scripts/migrate.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import { FundingInvoiceRepository } from "../src/funding-purchase/invoice-intents.js";
import { registerFundingPurchaseRoutes } from "../src/funding-purchase/routes.js";
import {
  stageClassWalletPayment,
  reconcileClassWalletPayments,
} from "../src/funding-purchase/classwallet-staging.js";
import { type ClassWalletConfig } from "../src/funding-purchase/classwallet.js";
import { applyCommerceEvent } from "../src/commerce/postgres.js";
import { recordEventBatch } from "../src/analytics/repository.js";
import { fundedJourneyReport } from "../src/analytics/funded-journey-report.js";
import { purgeFunnelEvents } from "../src/analytics/retention.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";

test(
  "guest invoice attribution survives payment before claim, provisioning, replay and refund",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const schema = `amp_funded_journey_${randomUUID().replaceAll("-", "")}`;
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href, max: 8 });
    const offer = {
      ...testFundingOffer,
      documentPolicy: "named-student-invoice" as const,
      activationPolicy: "after-settlement" as const,
    };
    const repository = new FundingPurchaseRepository(pool, [offer]);
    const invoices = new FundingInvoiceRepository(repository);
    const app = Fastify();
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await pool.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES('owner','Fixture Parent','parent@example.test',true)`,
      );
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('child','amp|owner','Fixture Child')",
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|owner','fixture','verified','private')",
      );
      await registerFundingPurchaseRoutes(app, {
        pool,
        offers: [offer],
        authenticate: async () => "amp|owner",
      });
      const visitorId = randomUUID();
      await recordEventBatch(pool, {
        visitorId,
        traffic: "external",
        context: {
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "funded-test",
          utmContent: "founder",
          referrer: "search",
          device: "phone",
        },
        events: [{ event: "try_click", props: {}, at: Date.now() }],
      });
      const payload = {
        offerId: offer.id,
        offerRevision: offer.revision,
        parentEmail: "parent@example.test",
        studentBillingName: "Fixture Student",
        idempotencyKey: randomUUID(),
      };
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/funding/invoices",
        headers: { "x-amp-visitor": visitorId },
        payload,
      });
      assert.equal(response.statusCode, 200, response.body);
      const invoiceId = response.json().invoiceId;
      const retry = await app.inject({
        method: "POST",
        url: "/api/v1/funding/invoices",
        headers: { "x-amp-visitor": randomUUID() },
        payload,
      });
      assert.equal(retry.json().invoiceId, invoiceId);
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_funnel_visitors"))
          .rows[0].n,
        1,
        "retry does not invent a second visitor",
      );
      const first = await fundedJourneyReport(pool, 7);
      assert.equal(first.sources[0].prepared, 1);
      assert.equal(first.sources[0].invoices, 1);
      assert.equal(first.sources[0].source, "google");
      assert.equal(first.sources[0].creative, "founder");
      assert.equal(first.sources[0].paid, 0);
      assert.equal(first.sources[0].gross_paid_minor, 0);
      const now = new Date().toISOString();
      const config: ClassWalletConfig = {
        verificationReference: "fixture",
        currency: "USD",
        grossColumn: "Payment Amount",
        netColumn: "Total",
        dateFormat: "canonical-utc-iso",
        settledStatus: "Settled",
        lastUpdateMeaning: "settlement-time-for-settled-rows",
        programs: [
          {
            organization: "Fixture",
            state: "XX",
            distribution: "Fixture",
            programId: offer.programId,
            channelReference: offer.channelReference,
          },
        ],
      };
      const row = {
        "Order ID": "fixture",
        "Transaction ID": randomUUID(),
        "Invoice/Quote": invoiceId,
        Organization: "Fixture",
        State: "XX",
        "Distribution Name": "Fixture",
        "Payment Amount": "123.00",
        Total: "120.00",
        Fee: "3.00",
        Status: "Settled",
        "Payment Approval Date": now,
        "Last Update": now,
      };
      await assert.rejects(
        stageClassWalletPayment(
          pool,
          { ...row, Status: "Approved" },
          config,
          "a".repeat(64),
          true,
        ),
      );
      assert.equal(
        (await fundedJourneyReport(pool, 7)).sources[0].paid,
        0,
        "approval is not a settled payment",
      );
      await stageClassWalletPayment(pool, row, config, "a".repeat(64), true);
      await stageClassWalletPayment(pool, row, config, "a".repeat(64), true);
      const paid = await fundedJourneyReport(pool, 7);
      assert.equal(paid.sources[0].paid, 1);
      assert.equal(paid.sources[0].gross_paid_minor, 12300);
      assert.equal(paid.sources[0].paid_awaiting_access, 1);
      assert.equal(paid.sources[0].account_claimed, 0);
      const claimed = await invoices.claim("amp|owner", invoiceId, "child");
      assert.equal(claimed.id, invoiceId);
      await repository.update(
        "amp|owner",
        invoiceId,
        "parent-reported-submitted",
      );
      assert.deepEqual(await reconcileClassWalletPayments(pool, [offer]), {
        provisioned: 1,
        deferred: 0,
        stopped: 0,
      });
      await reconcileClassWalletPayments(pool, [offer]);
      const active = await fundedJourneyReport(pool, 7);
      assert.equal(active.sources[0].prepared, 1);
      assert.equal(active.sources[0].paid, 1);
      assert.equal(active.sources[0].paid_with_active_access, 1);
      assert.equal(active.sources[0].paid_awaiting_access, 0);
      assert.equal(active.sources[0].parent_submitted, 1);
      assert.equal(active.sources[0].account_claimed, 1);
      assert.equal(active.unlinked[0].missing_journey_records, 0);
      const order = (await pool.query("SELECT id FROM amp_commerce_orders"))
        .rows[0];
      await applyCommerceEvent(pool, {
        id: randomUUID(),
        orderId: order.id,
        channel: "esa",
        channelReference: offer.channelReference,
        type: "refund.completed",
        occurredAt: new Date().toISOString(),
        amountMinor: 12300,
        currency: "USD",
        evidence: "fixture-refund",
      });
      const refunded = await fundedJourneyReport(pool, 7);
      assert.equal(refunded.sources[0].paid, 1);
      assert.equal(refunded.sources[0].refunded_minor, 12300);
      assert.equal(refunded.sources[0].net_after_refunds_minor, 0);
      for (const privateValue of [
        visitorId,
        invoiceId,
        "parent@example.test",
        "Fixture Student",
        "child",
        "amp|owner",
      ])
        assert.ok(!JSON.stringify(refunded).includes(privateValue));
      await recordEventBatch(pool, {
        visitorId,
        traffic: "internal",
        events: [{ event: "try_click", props: {}, at: Date.now() }],
      });
      assert.equal((await fundedJourneyReport(pool, 7)).sources.length, 0);
      const optedOut = await app.inject({
        method: "POST",
        url: "/api/v1/funding/invoices",
        headers: { "x-amp-visitor": randomUUID(), "sec-gpc": "1" },
        payload: { ...payload, idempotencyKey: randomUUID() },
      });
      assert.equal(optedOut.statusCode, 200);
      const link = (
        await pool.query(
          "SELECT visitor_id FROM amp_funded_visitor_links WHERE request_id=$1",
          [optedOut.json().invoiceId],
        )
      ).rows[0];
      assert.equal(link.visitor_id, null);
      // A later purchase campaign must not contaminate a direct first touch.
      await pool.query(
        "UPDATE amp_funnel_visitors SET traffic_kind='external',referrer='direct',utm_source=NULL,utm_medium=NULL,utm_campaign=NULL,utm_content=NULL WHERE visitor_id=$1",
        [visitorId],
      );
      await pool.query(
        "UPDATE amp_funding_invoice_intents SET campaign_attribution=$2 WHERE id=$1",
        [
          invoiceId,
          {
            source: "google",
            medium: "cpc",
            campaign: "later-click",
            creative: "later-ad",
          },
        ],
      );
      const direct = (await fundedJourneyReport(pool, 7)).sources.find(
        (row) => row.attribution_basis === "browser_first_touch",
      );
      assert.ok(direct);
      assert.deepEqual(
        [direct.source, direct.medium, direct.campaign, direct.creative],
        ["direct", "none", "none", "none"],
      );
      await purgeFunnelEvents(pool, new Date(Date.now() + 91 * 86400000));
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_funded_visitor_links",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_commerce_orders"))
          .rows[0].n,
        1,
        "financial records survive analytics expiry",
      );
    } finally {
      await app.close();
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
