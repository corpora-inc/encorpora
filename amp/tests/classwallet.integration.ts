import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import { provisionFundingRequest } from "../src/funding-purchase/provision.js";
import {
  prepareClassWalletProvision,
  type ClassWalletConfig,
} from "../src/funding-purchase/classwallet.js";
import { testFundingOffer as offer } from "./funding-purchase.fixture.js";
test(
  "ClassWallet reports provision once, preserve dates on re-export and reject cross-invoice transaction reuse",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!,
      schema = `amp_cw_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('first','owner','Fixture'),('second','other','Fixture')",
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('owner','fixture','verified','private'),('other','fixture','verified','private')",
      );
      const repo = new FundingPurchaseRepository(pool, [offer]);
      const first = await repo.create("owner", {
        offerId: offer.id,
        offerRevision: offer.revision,
        learnerId: "first",
        idempotencyKey: randomUUID(),
      });
      const second = await repo.create("other", {
        offerId: offer.id,
        offerRevision: offer.revision,
        learnerId: "second",
        idempotencyKey: randomUUID(),
      });
      const config: ClassWalletConfig = {
        verificationReference: "fixture-only",
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
      const now = new Date().toISOString();
      const row = {
        "Order ID": "test-order",
        "Transaction ID": randomUUID(),
        "Invoice/Quote": first.id,
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
      const original = prepareClassWalletProvision(row, first, config, now);
      await Promise.all([
        provisionFundingRequest(pool, original, [offer]),
        provisionFundingRequest(pool, original, [offer]),
      ]);
      const stored = (
        await pool.query(
          "SELECT conversion_payload FROM amp_funding_requests WHERE id=$1",
          [first.id],
        )
      ).rows[0].conversion_payload;
      const later = new Date(Date.now() + 1000).toISOString();
      const replay = prepareClassWalletProvision(
        { ...row, "Last Update": later },
        first,
        config,
        later,
        stored,
      );
      await provisionFundingRequest(pool, replay, [offer]);
      assert.deepEqual(replay, original);
      assert.deepEqual(
        (
          await pool.query(
            "SELECT request_id FROM amp_funded_activation_outbox",
          )
        ).rows,
        [{ request_id: first.id }],
      );
      const reused = prepareClassWalletProvision(
        { ...row, "Invoice/Quote": second.id },
        second,
        config,
        now,
      );
      await assert.rejects(provisionFundingRequest(pool, reused, [offer]));
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0].n,
        1,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_commerce_events"))
          .rows[0].n,
        5,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT order_id FROM amp_funding_requests WHERE id=$1",
            [second.id],
          )
        ).rows[0].order_id,
        null,
      );
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
