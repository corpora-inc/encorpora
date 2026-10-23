import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import { FamilyRepository } from "../src/family/repository.js";
import { learningConsentActive } from "../src/server/account-access.js";
import { verifiedAdvertisingPayment } from "../src/advertising/verified-payment.js";
import {
  registerClassWalletPayByRoutes,
  reconcileClassWalletApprovals,
} from "../src/funding-purchase/classwallet-payby.js";
import {
  stageClassWalletPayment,
  reconcileClassWalletPayments,
} from "../src/funding-purchase/classwallet-staging.js";
import { type ClassWalletConfig } from "../src/funding-purchase/classwallet.js";
import { testFundingOffer as offer } from "./funding-purchase.fixture.js";

test(
  "approved ClassWallet access receives exactly one later paid settlement",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_cw_settlement_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href });
    const app = Fastify();
    const config: ClassWalletConfig = {
      verificationReference: "synthetic-report-mapping-only",
      currency: "USD",
      grossColumn: "Payment Amount",
      netColumn: "Total",
      dateFormat: "canonical-utc-iso",
      settledStatus: "Settled",
      lastUpdateMeaning: "settlement-time-for-settled-rows",
      payByPurchaseOrderColumn: "Order ID",
      programs: [
        {
          organization: "Fixture",
          state: "AZ",
          distribution: "Fixture",
          programId: offer.programId,
          channelReference: offer.channelReference,
        },
      ],
    };
    const provider = {
      authorization: `Basic ${Buffer.from("fixture:synthetic-test-password").toString("base64")}`,
    };
    const repo = new FundingPurchaseRepository(pool, [offer]);
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await registerClassWalletPayByRoutes(app, {
        pool,
        offers: [offer],
        config: {
          enabled: true,
          vendorId: "a".repeat(24),
          publicOrigin: "https://example.test",
          setupReference: "fixture",
          offerIds: [offer.id],
          basicUser: "fixture",
          basicPassword: "synthetic-test-password",
        },
        authenticate: async (request) =>
          String(request.headers["x-test-account"]),
      });
      async function prepare(delayActivation = false) {
        const account = randomUUID(),
          learner = randomUUID(),
          po = randomUUID();
        await pool.query(
          "INSERT INTO amp_learners(id,account_id,name) VALUES($1,$2,'Fixture')",
          [learner, account],
        );
        await pool.query(
          "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','private')",
          [account],
        );
        const invoice = await repo.create(account, {
          offerId: offer.id,
          offerRevision: offer.revision,
          learnerId: learner,
          idempotencyKey: randomUUID(),
          campaignAttribution: {
            campaign: "az-esa-launch",
            source: "google",
            medium: "cpc",
            creative: "az-funded-better-math-portrait-v3",
          },
        });
        const start = await app.inject({
          method: "POST",
          url: `/api/v1/funding/requests/${invoice.id}/classwallet-checkout`,
          headers: { "x-test-account": account },
          payload: {},
        });
        assert.equal(start.statusCode, 200, start.body);
        const callback = `/api/v1/classwallet/orders/${invoice.id}`;
        assert.equal(
          (await app.inject({ url: callback, headers: provider })).statusCode,
          200,
        );
        if (delayActivation)
          await pool.query(
            "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id=$1",
            [account],
          );
        const approve = () =>
          app.inject({
            method: "PUT",
            url: callback,
            headers: provider,
            payload: { PurchaseOrderId: po, status: "complete" },
          });
        const approval = await approve();
        assert.equal(
          approval.statusCode,
          delayActivation ? 403 : 200,
          approval.body,
        );
        const date = new Date().toISOString();
        const row = {
          "Order ID": po,
          "Transaction ID": randomUUID(),
          "Invoice/Quote": invoice.id,
          Organization: "Fixture",
          State: "AZ",
          "Distribution Name": "Fixture",
          "Payment Amount": "123.00",
          Total: "120.00",
          Fee: "3.00",
          Status: "Settled",
          "Payment Approval Date": date,
          "Last Update": date,
        };
        return { account, learner, invoice, row, approve };
      }
      async function evidence(invoice: string) {
        return (
          await pool.query(
            `SELECT r.order_id,r.conversion_payload,c.provisioning_payload,o.order_state,o.grant_state,
        (SELECT count(*)::int FROM amp_grants WHERE learner_id=r.learner_id) grants,
        (SELECT count(*)::int FROM amp_funded_activation_outbox WHERE request_id=r.id) mail,
        (SELECT count(*)::int FROM amp_commerce_events WHERE order_id=r.order_id AND payload->>'type'='order.settled') settlements
        FROM amp_funding_requests r JOIN amp_classwallet_checkouts c ON c.request_id=r.id
        LEFT JOIN amp_commerce_orders o ON o.id=r.order_id WHERE r.id=$1`,
            [invoice],
          )
        ).rows[0];
      }
      await t.test(
        "verified identity, concurrent replay and unchanged license term",
        async () => {
          const f = await prepare();
          const before = await evidence(f.invoice.id);
          assert.equal(before.order_state.settlement, "pending");
          const readPaid = () =>
            repo.transaction(
              f.account,
              (client) =>
                verifiedAdvertisingPayment(
                  client,
                  { azEsaChannelReference: offer.channelReference },
                  { kind: "arizona-esa", id: before.order_id },
                ),
              true,
            );
          assert.equal(await readPaid(), null);
          const { payByPurchaseOrderColumn: _, ...unverified } = config;
          await assert.rejects(
            stageClassWalletPayment(
              pool,
              f.row,
              unverified,
              "a".repeat(64),
              true,
            ),
            /payby_report_mapping_unverified/,
          );
          for (const invalid of [
            { "Order ID": randomUUID() },
            { "Payment Amount": "124.00" },
            { State: "AR" },
            { "Invoice/Quote": randomUUID() },
            { Status: "Processing" },
          ])
            await assert.rejects(
              stageClassWalletPayment(
                pool,
                { ...f.row, ...invalid },
                config,
                "a".repeat(64),
                true,
              ),
            );
          // The approved purchase exists; later bank settlement may outlive its quote.
          await pool.query(
            "UPDATE amp_funding_requests SET created_at=created_at-interval '2 seconds',expires_at=created_at+interval '1 millisecond' WHERE id=$1",
            [f.invoice.id],
          );
          await Promise.all([
            stageClassWalletPayment(pool, f.row, config, "a".repeat(64), true),
            stageClassWalletPayment(pool, f.row, config, "a".repeat(64), true),
          ]);
          await Promise.all([
            reconcileClassWalletPayments(pool, [offer]),
            reconcileClassWalletPayments(pool, [offer]),
          ]);
          const after = await evidence(f.invoice.id);
          assert.equal(after.order_id, before.order_id);
          assert.deepEqual(after.conversion_payload, before.conversion_payload);
          assert.deepEqual(
            after.provisioning_payload,
            before.provisioning_payload,
          );
          assert.deepEqual(after.grant_state, before.grant_state);
          assert.equal(after.order_state.settlement, "settled");
          assert.equal(after.grants, 1);
          assert.equal(after.mail, 1);
          assert.equal(after.settlements, 1);
          assert.deepEqual(
            (
              await pool.query(
                "SELECT campaign_counted FROM amp_funding_requests WHERE id=$1",
                [f.invoice.id],
              )
            ).rows[0].campaign_counted,
            ["order_created", "order_settled"],
          );
          assert.equal(
            (
              await pool.query(
                "SELECT count::int FROM amp_campaign_creative_daily WHERE creative='az-funded-better-math-portrait-v3' AND action='order_settled'",
              )
            ).rows[0].count,
            1,
          );
          const event = (
            await pool.query(
              "SELECT payload FROM amp_commerce_events WHERE order_id=$1 AND payload->>'type'='order.settled'",
              [after.order_id],
            )
          ).rows[0].payload;
          assert.equal(event.occurredAt, f.row["Last Update"]);
          assert.equal(event.amountMinor, 12300);
          assert.deepEqual(await readPaid(), {
            accountId: f.account,
            occurredAt: f.row["Last Update"],
            originalMinor: 12300,
            netMinor: 12300,
            currency: "USD",
            refundPending: false,
          });
          assert.equal((await f.approve()).statusCode, 200);
          assert.equal(
            (
              await stageClassWalletPayment(
                pool,
                { ...f.row, "Last Update": new Date().toISOString() },
                config,
                "b".repeat(64),
                true,
              )
            ).replay,
            true,
          );
          assert.deepEqual(await reconcileClassWalletPayments(pool, [offer]), {
            provisioned: 0,
            deferred: 0,
            stopped: 0,
          });
          await assert.rejects(
            stageClassWalletPayment(
              pool,
              { ...f.row, "Transaction ID": randomUUID() },
              config,
              "a".repeat(64),
              true,
            ),
            /previous_payment_mismatch/,
          );
        },
      );
      await t.test(
        "withdrawn consent stays withdrawn while financial settlement completes",
        async () => {
          const f = await prepare();
          const before = await evidence(f.invoice.id);
          await new FamilyRepository(pool).withdraw(f.account);
          await stageClassWalletPayment(
            pool,
            f.row,
            config,
            "a".repeat(64),
            true,
          );
          await reconcileClassWalletPayments(pool, [offer]);
          const after = await evidence(f.invoice.id);
          assert.equal(after.settlements, 1);
          assert.equal(after.mail, 1);
          assert.deepEqual(after.grant_state, before.grant_state);
          const client = await pool.connect();
          try {
            assert.equal(await learningConsentActive(client, f.account), false);
          } finally {
            client.release();
          }
        },
      );
      await t.test(
        "staged payment waits for approval recovery then settles once",
        async () => {
          const f = await prepare(true);
          await stageClassWalletPayment(
            pool,
            f.row,
            config,
            "a".repeat(64),
            true,
          );
          assert.equal(
            (await reconcileClassWalletPayments(pool, [offer])).deferred,
            1,
          );
          assert.equal((await evidence(f.invoice.id)).grants, 0);
          // Controlled synthetic eligibility restoration; no production consent changes.
          await pool.query(
            "UPDATE amp_parent_consents SET withdrawn_at=NULL WHERE account_id=$1",
            [f.account],
          );
          await reconcileClassWalletApprovals(pool, [offer]);
          await pool.query(
            "UPDATE amp_classwallet_payments SET next_attempt_at=now() WHERE invoice_id=$1",
            [f.invoice.id],
          );
          await reconcileClassWalletPayments(pool, [offer]);
          const after = await evidence(f.invoice.id);
          assert.equal(after.settlements, 1);
          assert.equal(after.grants, 1);
          assert.equal(after.mail, 1);
        },
      );
      await t.test(
        "conflicting callback after staging quarantines settlement",
        async () => {
          const f = await prepare();
          await stageClassWalletPayment(
            pool,
            f.row,
            config,
            "a".repeat(64),
            true,
          );
          const conflict = await app.inject({
            method: "PUT",
            url: `/api/v1/classwallet/orders/${f.invoice.id}`,
            headers: provider,
            payload: { PurchaseOrderId: "wrong-order", status: "complete" },
          });
          assert.equal(conflict.statusCode, 409);
          assert.equal(
            (await reconcileClassWalletPayments(pool, [offer])).stopped,
            1,
          );
          assert.equal((await evidence(f.invoice.id)).settlements, 0);
        },
      );
    } finally {
      await app.close();
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
