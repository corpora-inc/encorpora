import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { migrate } from "../scripts/migrate.js";
import { FamilyRepository } from "../src/family/repository.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import { FundingInvoiceRepository } from "../src/funding-purchase/invoice-intents.js";
import { registerFundingPurchaseRoutes } from "../src/funding-purchase/routes.js";
import { purgeExpiredFundingRequests } from "../src/funding-purchase/retention.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";
const offer = {
  ...testFundingOffer,
  documentPolicy: "named-student-invoice" as const,
};
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
async function fixture(
  run: (pool: Pool, invoices: FundingInvoiceRepository) => Promise<void>,
) {
  const url = process.env.AMP_TEST_DATABASE_URL!,
    schema = `amp_invoice_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  const pool = new Pool({ connectionString: scoped.href, max: 8 });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    await pool.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES('owner','Parent','parent@example.com',true),('other','Other','other@example.com',true),('pending','Pending','pending@example.com',false)`,
    );
    await run(
      pool,
      new FundingInvoiceRepository(
        new FundingPurchaseRepository(pool, [offer]),
      ),
    );
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
const input = () => ({
  offerId: offer.id,
  offerRevision: offer.revision,
  parentEmail: "parent@example.com",
  studentBillingName: "Test Student",
  idempotencyKey: randomUUID(),
});

test(
  "guest prepares PDF without account, consent, learner or grant; private fields never returned",
  enabled,
  () =>
    fixture(async (pool) => {
      const app = Fastify();
      await registerFundingPurchaseRoutes(app, {
        pool,
        offers: [offer],
        authenticate: async () => {
          throw Object.assign(new Error(), { statusCode: 401 });
        },
      });
      try {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/funding/invoices",
          payload: input(),
        });
        assert.equal(response.statusCode, 200);
        const result = response.json();
        assert.ok(
          Buffer.from(result.pdfBase64, "base64").toString().startsWith("%PDF"),
        );
        assert.equal(result.parentEmail, undefined);
        assert.equal(result.studentBillingName, undefined);
        assert.equal(
          (await pool.query("SELECT count(*) FROM amp_learners")).rows[0].count,
          "0",
        );
        assert.equal(
          (await pool.query("SELECT count(*) FROM amp_funding_requests"))
            .rows[0].count,
          "0",
        );
        assert.equal(
          (await pool.query("SELECT count(*) FROM amp_commerce_orders")).rows[0]
            .count,
          "0",
        );
        assert.equal(
          (await app.inject(`/api/v1/funding/invoices/${result.invoiceId}/pdf`))
            .statusCode,
          401,
        );
        const offers = (
          await app.inject("/api/v1/funding/invoice-offers?program=az-esa")
        ).json();
        assert.equal(offers.offers[0].approvals, undefined);
      } finally {
        await app.close();
      }
    }),
);

test(
  "concurrent retries retain one invoice; changed billing fields cannot retrieve another PDF",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const data = input();
      const results = await Promise.all([
        invoices.create(data),
        invoices.create(data),
      ]);
      assert.equal(results[0].id, results[1].id);
      await assert.rejects(
        invoices.create({ ...data, parentEmail: "attacker@example.com" }),
        /idempotency_payload_mismatch/,
      );
      await assert.rejects(
        invoices.create({ ...data, studentBillingName: "Different" }),
        /idempotency_payload_mismatch/,
      );
      assert.equal(
        (await pool.query("SELECT count(*) FROM amp_funding_invoice_intents"))
          .rows[0].count,
        "1",
      );
      const safe = await invoices.readInvoiceIntent(results[0].id);
      assert.ok(safe);
      assert.equal("parentEmail" in safe, false);
    }),
);

test(
  "only verified matching parent with consent and owned learner can claim exact original UUID",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const intent = await invoices.create(input());
      assert.equal((await invoices.list("amp|other")).length, 0);
      await assert.rejects(
        invoices.list("amp|pending"),
        /confirmed_parent_email_required/,
      );
      assert.equal((await invoices.list("amp|owner"))[0].id, intent.id);
      await assert.rejects(
        invoices.claim("amp|owner", intent.id, "child"),
        /verified_consent_required/,
      );
      await pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|owner','test','verified','test'),('amp|other','test','verified','test')",
      );
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('child','amp|owner','Child'),('other-child','amp|other','Other')",
      );
      await assert.rejects(
        invoices.claim("amp|owner", intent.id, "other-child"),
        /learner_not_found/,
      );
      await assert.rejects(
        invoices.claim("amp|other", intent.id, "other-child"),
        /invoice_not_found/,
      );
      const claimed = await invoices.claim("amp|owner", intent.id, "child");
      assert.equal(claimed.id, intent.id);
      assert.equal(claimed.createdAt, intent.createdAt);
      assert.equal(claimed.studentBillingName, "Test Student");
      assert.equal(
        (await invoices.claim("amp|owner", intent.id, "child")).id,
        intent.id,
      );
      assert.equal(
        (await pool.query("SELECT count(*) FROM amp_commerce_orders")).rows[0]
          .count,
        "0",
      );
    }),
);

test(
  "expired unpaid financial data purges; verified payment intent is retained",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const at = new Date("2025-01-01T00:00:00.000Z");
      const unpaid = await invoices.create(input(), at),
        paid = await invoices.create(input(), at);
      await pool.query(
        "UPDATE amp_funding_invoice_intents SET received_payment_at=$2 WHERE id=$1",
        [paid.id, at],
      );
      assert.equal(
        await purgeExpiredFundingRequests(
          pool,
          new Date("2025-03-01T00:00:00.000Z"),
        ),
        1,
      );
      assert.equal(await invoices.readInvoiceIntent(unpaid.id), null);
      assert.ok(await invoices.readInvoiceIntent(paid.id));
    }),
);

test(
  "verified parent exports financial drafts and deletes unpaid guest billing data only",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const own = await invoices.create(input());
      const paid = await invoices.create(input());
      const other = await invoices.create({
        ...input(),
        parentEmail: "other@example.com",
      });
      await pool.query(
        "UPDATE amp_funding_invoice_intents SET received_payment_at=now() WHERE id=$1",
        [paid.id],
      );
      const family = new FamilyRepository(pool);
      const lines: string[] = [];
      for await (const line of family.export("amp|owner")) lines.push(line);
      const data = lines.join("");
      assert.ok(data.includes(own.id));
      assert.ok(!data.includes(other.id));
      await family.deleteLearning("amp|owner");
      assert.equal(await invoices.readInvoiceIntent(own.id), null);
      assert.ok(await invoices.readInvoiceIntent(paid.id));
      assert.ok(await invoices.readInvoiceIntent(other.id));
    }),
);
