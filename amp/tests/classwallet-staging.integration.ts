import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { purgeExpiredFundingRequests } from "../src/funding-purchase/retention.js";
import { migrate } from "../scripts/migrate.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import {
  stageClassWalletPayment,
  reconcileClassWalletPayments,
} from "../src/funding-purchase/classwallet-staging.js";
import { type ClassWalletConfig } from "../src/funding-purchase/classwallet.js";
import { testFundingOffer as baseOffer } from "./funding-purchase.fixture.js";

test(
  "verified payment survives guest claim, rejects fraud, and activates once with stable replay",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!,
      schema = `amp_cw_stage_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href });
    const offer = {
      ...baseOffer,
      activationPolicy: "after-settlement" as const,
    };
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      // The invoice-intent migration is supplied by the guest invoice feature.
      assert.ok(
        (
          await pool.query(
            "SELECT to_regclass('amp_funding_invoice_intents') name",
          )
        ).rows[0].name,
      );
      const invoice = randomUUID(),
        now = new Date().toISOString(),
        created = new Date(Date.now() - 10000).toISOString(),
        expires = new Date(Date.now() + 86400000).toISOString();
      await pool.query(
        "INSERT INTO amp_funding_invoice_intents(id,idempotency_key,parent_email,student_billing_name,offer_snapshot,created_at,expires_at) VALUES($1,$2,'parent@example.com','Fixture Student',$3,$4,$5)",
        [invoice, randomUUID(), JSON.stringify(offer), created, expires],
      );
      const config: ClassWalletConfig = {
        verificationReference: "synthetic-only",
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
        "Invoice/Quote": invoice,
        Organization: "Fixture",
        State: "XX",
        "Distribution Name": "Fixture",
        "Payment Amount": "123.00",
        Total: "120.00",
        Fee: "3.00",
        Status: "Settled",
        "Payment Approval Date": now,
        "Last Update": now,
        "User Name": "SECRET NAME",
        School: "PRIVATE SCHOOL",
      };
      const hash = "a".repeat(64);
      assert.equal(
        (await stageClassWalletPayment(pool, row, config, hash, false)).claimed,
        false,
      );
      assert.equal(
        (await pool.query("SELECT * FROM amp_classwallet_payments")).rowCount,
        0,
      );
      await assert.rejects(
        stageClassWalletPayment(
          pool,
          { ...row, Status: "Approved" },
          config,
          hash,
          true,
        ),
      );
      await assert.rejects(
        stageClassWalletPayment(
          pool,
          { ...row, "Payment Amount": "124.00" },
          config,
          hash,
          true,
        ),
      );
      await assert.rejects(
        stageClassWalletPayment(
          pool,
          { ...row, "Invoice/Quote": randomUUID() },
          config,
          hash,
          true,
        ),
      );
      await Promise.all([
        stageClassWalletPayment(pool, row, config, hash, true),
        stageClassWalletPayment(pool, row, config, hash, true),
      ]);
      const stored = (
        await pool.query("SELECT * FROM amp_classwallet_payments")
      ).rows;
      assert.equal(stored.length, 1);
      assert.equal(JSON.stringify(stored).includes("SECRET NAME"), false);
      assert.equal(JSON.stringify(stored).includes("PRIVATE SCHOOL"), false);
      assert.ok(
        (
          await pool.query(
            "SELECT received_payment_at FROM amp_funding_invoice_intents WHERE id=$1",
            [invoice],
          )
        ).rows[0].received_payment_at,
      );
      assert.deepEqual(await reconcileClassWalletPayments(pool, [offer]), {
        provisioned: 0,
        deferred: 0,
        stopped: 0,
      });
      assert.equal((await pool.query("SELECT * FROM amp_grants")).rowCount, 0);
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('student','owner','Fixture')",
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('owner','fixture','verified','private')",
      );
      // Claim identity/consent is covered by guest endpoint tests. Its contract preserves UUID and issued snapshot.
      await pool.query(
        "INSERT INTO amp_funding_requests(id,account_id,learner_id,idempotency_key,offer_id,offer_revision,offer_snapshot,created_at,expires_at) VALUES($1,'owner','student',$2,$3,$4,$5,$6,$7)",
        [
          invoice,
          randomUUID(),
          offer.id,
          offer.revision,
          JSON.stringify(offer),
          created,
          expires,
        ],
      );
      await Promise.all([
        reconcileClassWalletPayments(pool, [offer]),
        reconcileClassWalletPayments(pool, [offer]),
      ]);
      assert.equal((await pool.query("SELECT * FROM amp_grants")).rowCount, 1);
      assert.equal(
        (await pool.query("SELECT * FROM amp_funded_activation_outbox"))
          .rowCount,
        1,
      );
      const payload = (
        await pool.query(
          "SELECT conversion_payload FROM amp_classwallet_payments",
        )
      ).rows[0].conversion_payload;
      const later = new Date(Date.now() + 1000);
      assert.equal(
        (
          await stageClassWalletPayment(
            pool,
            { ...row, "Last Update": later.toISOString() },
            config,
            hash,
            true,
            later,
          )
        ).replay,
        true,
      );
      assert.deepEqual(
        (
          await pool.query(
            "SELECT conversion_payload FROM amp_classwallet_payments",
          )
        ).rows[0].conversion_payload,
        payload,
      );
      const other = await new FundingPurchaseRepository(pool, [offer]).create(
        "owner",
        {
          offerId: offer.id,
          offerRevision: offer.revision,
          learnerId: "student",
          idempotencyKey: randomUUID(),
        },
      );
      await assert.rejects(
        stageClassWalletPayment(
          pool,
          {
            ...row,
            "Invoice/Quote": other.id,
            "Payment Approval Date": later.toISOString(),
            "Last Update": later.toISOString(),
          },
          config,
          hash,
          true,
          later,
        ),
        /previous_payment_mismatch/,
      );
      const orphan = randomUUID();
      await pool.query(
        "INSERT INTO amp_funding_invoice_intents(id,idempotency_key,parent_email,student_billing_name,offer_snapshot,created_at,expires_at) VALUES($1,$2,'parent@example.com','Fixture Student',$3,$4,$5)",
        [orphan, randomUUID(), JSON.stringify(offer), created, expires],
      );
      await stageClassWalletPayment(
        pool,
        { ...row, "Invoice/Quote": orphan, "Transaction ID": randomUUID() },
        config,
        hash,
        true,
      );
      await pool.query("DELETE FROM amp_funding_invoice_intents WHERE id=$1", [
        orphan,
      ]);
      assert.equal(
        (await reconcileClassWalletPayments(pool, [offer])).stopped,
        1,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT error_code FROM amp_classwallet_payments WHERE invoice_id=$1",
            [orphan],
          )
        ).rows[0].error_code,
        "invoice_record_unavailable",
      );
      assert.equal((await pool.query("SELECT * FROM amp_grants")).rowCount, 1);
      const paidAt = new Date().toISOString();
      await stageClassWalletPayment(
        pool,
        {
          ...row,
          "Invoice/Quote": other.id,
          "Transaction ID": randomUUID(),
          "Payment Approval Date": paidAt,
          "Last Update": paidAt,
        },
        config,
        hash,
        true,
      );
      await purgeExpiredFundingRequests(
        pool,
        new Date(Date.now() + 31 * 86400000),
      );
      assert.equal(
        (
          await pool.query("SELECT id FROM amp_funding_requests WHERE id=$1", [
            other.id,
          ])
        ).rowCount,
        1,
      );
      await purgeExpiredFundingRequests(
        pool,
        new Date(Date.now() + 8 * 366 * 86400000),
      );
      assert.equal(
        (await pool.query("SELECT * FROM amp_classwallet_payments")).rowCount,
        0,
      );
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
