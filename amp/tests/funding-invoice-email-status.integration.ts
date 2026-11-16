import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerFundingPurchaseRoutes } from "../src/funding-purchase/routes.js";
import { FundingInvoiceRepository } from "../src/funding-purchase/invoice-intents.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import { legacyInvoiceOffer } from "./funding-offer-terms.fixture.js";

test(
  "authenticated invoice lists report provider acceptance for prepared and claimed invoices without exposing delivery records",
  {
    skip: !process.env.AMP_TEST_DATABASE_URL,
  },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_invoice_mail_status_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href });
    const app = Fastify();
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await pool.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES
       ('owner','Synthetic','parent@example.test',true),
       ('other','Synthetic','other@example.test',true),
       ('unverified','Synthetic','unverified@example.test',false)`,
      );
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('child','amp|owner','Synthetic')",
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|owner','fixture','verified','fixture')",
      );
      const invoices = new FundingInvoiceRepository(
        new FundingPurchaseRepository(pool, [legacyInvoiceOffer]),
      );
      const invoice = await invoices.create({
        offerId: legacyInvoiceOffer.id,
        offerRevision: legacyInvoiceOffer.revision,
        parentEmail: "parent@example.test",
        studentBillingName: "Synthetic Student",
        idempotencyKey: randomUUID(),
      });
      await registerFundingPurchaseRoutes(app, {
        pool,
        offers: [legacyInvoiceOffer],
        authenticate: async (request) => {
          const account = request.headers["x-test-account"];
          if (typeof account !== "string")
            throw Object.assign(new Error(), { statusCode: 401 });
          return account;
        },
      });
      const list = (account?: string) =>
        app.inject({
          method: "GET",
          url: "/api/v1/funding/invoices",
          headers: account ? { "x-test-account": account } : {},
        });
      assert.equal((await list()).statusCode, 401);
      assert.equal((await list("amp|unverified")).statusCode, 403);
      assert.deepEqual((await list("amp|other")).json(), { invoices: [] });
      const own = async () => {
        const response = await list("amp|owner");
        assert.equal(response.statusCode, 200);
        assert.equal(response.headers["cache-control"], "no-store");
        const [row] = response.json().invoices;
        assert.equal(row.id, invoice.id);
        for (const privateField of [
          "parentEmail",
          "idempotencyKey",
          "receipt",
          "pdf_base64",
          "accepted_at",
          "stopped_at",
          "stopped_reason",
          "email_accepted_at",
          "email_stopped_at",
          "email_invoice_id",
        ])
          assert.equal(privateField in row, false, privateField);
        return row;
      };
      assert.equal((await own()).emailStatus, "queued");
      await pool.query(
        "UPDATE amp_funding_invoice_outbox SET stopped_at=now(),stopped_reason='provider-rejected' WHERE invoice_id=$1",
        [invoice.id],
      );
      assert.equal((await own()).emailStatus, "failed");
      // The durable provider acceptance is the source of truth; no transport is
      // called by this read endpoint or by the test.
      await pool.query(
        "UPDATE amp_funding_invoice_outbox SET accepted_at=now(),receipt='synthetic-private-receipt',stopped_at=NULL,stopped_reason=NULL WHERE invoice_id=$1",
        [invoice.id],
      );
      assert.equal((await own()).emailStatus, "sent");
      await invoices.claim("amp|owner", invoice.id, "child");
      const claimed = await own();
      assert.equal(claimed.state, "claimed");
      assert.equal(claimed.claimedRequestId, invoice.id);
      assert.equal(claimed.emailStatus, "sent");
      assert.deepEqual((await list("amp|other")).json(), { invoices: [] });
      await pool.query(
        "DELETE FROM amp_funding_invoice_outbox WHERE invoice_id=$1",
        [invoice.id],
      );
      assert.equal(
        "emailStatus" in (await own()),
        false,
        "missing delivery records must not imply queued or sent",
      );
    } finally {
      await app.close();
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
