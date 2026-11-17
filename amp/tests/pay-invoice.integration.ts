import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { migrate } from "../scripts/migrate.js";
import { registerFundingPurchaseRoutes } from "../src/funding-purchase/routes.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";

/*
 * The pay screen's "Create invoice" (src/web/features/pay/api.ts,
 * useCreateInvoice) is two idempotent requests: the invoice, then its claim
 * for the learner. Through the real routes, as the signed-in parent of a
 * child learning on the restricted basis (no consent recorded): the claim
 * gives the child access at once, the invoice email is queued with the
 * invoice, and the whole action retried gives the same invoice, one email
 * and one grant.
 */
const offer = {
  ...testFundingOffer,
  documentPolicy: "named-student-invoice" as const,
};
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };

async function fixture(run: (pool: Pool) => Promise<void>) {
  const url = process.env.AMP_TEST_DATABASE_URL!,
    schema = `amp_pay_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  const pool = new Pool({ connectionString: scoped.href, max: 8 });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    await pool.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES('owner','Parent','parent@example.com',true)`,
    );
    await pool.query(
      "INSERT INTO amp_learners(id,account_id,name,name_pending,birth_year,picture_identity,picture_number,identity_scope) VALUES('august','amp|owner','Fox',true,2018,'fox',1,'amp|owner')",
    );
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}

test(
  "creating an invoice on the pay screen starts the learner's access at once and queues its email, exactly once",
  enabled,
  () =>
    fixture(async (pool) => {
      const app = Fastify();
      await registerFundingPurchaseRoutes(app, {
        pool,
        offers: [offer],
        authenticate: async () => "amp|owner",
      });
      const fields = {
        offerId: offer.id,
        offerRevision: offer.revision,
        parentEmail: "parent@example.com",
        studentBillingName: "August Example",
        idempotencyKey: randomUUID(),
      };
      // The mutation: the invoice, then its claim for this learner.
      const createAndClaim = async () => {
        const created = await app.inject({
          method: "POST",
          url: "/api/v1/funding/invoices",
          payload: fields,
        });
        assert.equal(created.statusCode, 200, created.body);
        const { invoiceId, emailStatus } = created.json();
        assert.equal(emailStatus, "queued");
        const claimed = await app.inject({
          method: "POST",
          url: `/api/v1/funding/invoices/${invoiceId}/claim`,
          payload: { learnerId: "august" },
        });
        assert.equal(claimed.statusCode, 200, claimed.body);
        return { invoiceId, claim: claimed.json() };
      };
      try {
        const first = await createAndClaim();
        // Access now: an active grant for the learner, and the claim says so.
        assert.equal(first.claim.fundedPending?.status, "funded-pending");
        const grants = await pool.query(
          "SELECT status,starts_at,ends_at FROM amp_grants WHERE learner_id='august'",
        );
        assert.equal(grants.rowCount, 1);
        assert.equal(grants.rows[0].status, "active");
        assert.ok(grants.rows[0].starts_at.getTime() <= Date.now());
        assert.ok(grants.rows[0].ends_at.getTime() > Date.now());
        // The email: queued with the invoice, its PDF attached.
        const outbox = await pool.query(
          "SELECT invoice_id,pdf_base64 FROM amp_funding_invoice_outbox",
        );
        assert.equal(outbox.rowCount, 1);
        assert.equal(outbox.rows[0].invoice_id, first.invoiceId);
        assert.ok(
          Buffer.from(outbox.rows[0].pdf_base64, "base64")
            .toString()
            .startsWith("%PDF"),
        );
        // The invoice page reads its record: claimed, with its deadline.
        const record = await app.inject(
          `/api/v1/funding/requests/${first.invoiceId}`,
        );
        assert.equal(record.statusCode, 200);
        assert.equal(record.json().learnerId, "august");
        assert.equal(record.json().status, "prepared");
        assert.ok(record.json().fundedPending?.endsAt);
        assert.equal(record.json().offer.instructions, offer.instructions);

        // A retry of the whole action (a lost response): nothing new.
        const again = await createAndClaim();
        assert.equal(again.invoiceId, first.invoiceId);
        assert.equal(
          (await pool.query("SELECT count(*)::int AS n FROM amp_funding_invoice_outbox"))
            .rows[0].n,
          1,
        );
        assert.equal(
          (await pool.query("SELECT count(*)::int AS n FROM amp_grants WHERE learner_id='august'"))
            .rows[0].n,
          1,
        );
        assert.equal(
          (await pool.query("SELECT count(*)::int AS n FROM amp_funding_invoice_intents"))
            .rows[0].n,
          1,
        );

        // "I've submitted it" extends access through the processing window.
        const submitted = await app.inject({
          method: "POST",
          url: `/api/v1/funding/requests/${first.invoiceId}/status`,
          payload: { status: "parent-reported-submitted" },
        });
        assert.equal(submitted.statusCode, 200, submitted.body);
        assert.equal(submitted.json().status, "parent-reported-submitted");
      } finally {
        await app.close();
      }
    }),
);
