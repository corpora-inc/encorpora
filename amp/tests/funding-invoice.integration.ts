import {
  createSignupIntent,
  completeSignup,
} from "../src/parent-followup/repository.js";
import { signupNotice } from "../src/parent-followup/contracts.js";
import test from "node:test";
import {
  retainAdClick,
  orderClickEvidence,
  purgeAdClickEvidence,
} from "../src/advertising/click-evidence.js";
import { ACQUISITION_COOKIE } from "../src/advertising/acquisition.js";
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
      const token = await marketingClick(pool, "Export_Private_Click");
      const own = await invoices.create(input(), new Date(), token);
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
      assert.ok(data.includes('"campaignAttribution"'));
      assert.ok(!data.includes(token));
      assert.ok(!data.includes("Export_Private_Click"));
      assert.ok(!data.includes("acquisition_journey_id"));
      assert.ok(!data.includes(other.id));
      await family.deleteLearning("amp|owner");
      assert.equal(await invoices.readInvoiceIntent(own.id), null);
      assert.ok(await invoices.readInvoiceIntent(paid.id));
      assert.ok(await invoices.readInvoiceIntent(other.id));
    }),
);

test(
  "only matching verified parent may discard unsubmitted unpaid invoice",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const own = await invoices.create(input());
      await assert.rejects(
        invoices.discard("amp|other", own.id),
        /invoice_cannot_discard/,
      );
      await invoices.discard("amp|owner", own.id);
      assert.equal((await invoices.list("amp|owner")).length, 0);
      assert.equal(
        (await invoices.readInvoiceIntent(own.id))?.state,
        "cancelled",
      );
      const paid = await invoices.create(input());
      await pool.query(
        "UPDATE amp_funding_invoice_intents SET received_payment_at=now() WHERE id=$1",
        [paid.id],
      );
      await assert.rejects(
        invoices.discard("amp|owner", paid.id),
        /invoice_cannot_discard/,
      );
    }),
);

async function marketingClick(
  pool: Pool,
  value: string,
  creative?:
    "az-funded-better-math-square-v5" | "az-funded-better-math-responsive-v5",
) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const click = await retainAdClick(
      c,
      { provider: "google", identifiers: { gclid: value } },
      undefined,
      {
        campaign: "az-esa-launch",
        source: "google",
        medium: "cpc",
        ...(creative ? { creative } : {}),
      },
      undefined,
      "https://corpora.inc/esa/arizona-esa/",
    );
    await c.query("COMMIT");
    return click.token;
  } finally {
    c.release();
  }
}
async function eligibleParent(pool: Pool) {
  await pool.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|owner','test','verified','test')",
  );
  await pool.query(
    "INSERT INTO amp_learners(id,account_id,name) VALUES('child','amp|owner','Child')",
  );
}
async function retainedClick(pool: Pool, id: string) {
  const c = await pool.connect();
  try {
    return await orderClickEvidence(
      c,
      "amp|owner",
      { kind: "funding-request", id },
      "google",
    );
  } finally {
    c.release();
  }
}
for (const creative of [
  undefined,
  "az-funded-better-math-square-v5",
  "az-funded-better-math-responsive-v5",
] as const)
  test(
    `guest invoice retains its original ad click and labels through retries and later account claim (${creative ?? "legacy"})`,
    enabled,
    () =>
      fixture(async (pool) => {
        const original = await marketingClick(
          pool,
          "Original_Guest_Click",
          creative,
        );
        const app = Fastify();
        await registerFundingPurchaseRoutes(app, {
          pool,
          offers: [offer],
          authenticate: async () => "amp|owner",
        });
        try {
          const payload = input();
          const create = await app.inject({
            method: "POST",
            url: "/api/v1/funding/invoices",
            payload,
            headers: { cookie: `${ACQUISITION_COOKIE}=${original}` },
          });
          assert.equal(create.statusCode, 200);
          const id = create.json().invoiceId;
          assert.equal(create.body.includes(original), false);
          assert.equal(create.body.includes("Original_Guest_Click"), false);
          assert.equal(create.body.includes("acquisition_journey_id"), false);
          const replacement = await marketingClick(pool, "Later_Browser_Click");
          const retry = await app.inject({
            method: "POST",
            url: "/api/v1/funding/invoices",
            payload,
            headers: { cookie: `${ACQUISITION_COOKIE}=${replacement}` },
          });
          assert.equal(retry.json().invoiceId, id);
          await eligibleParent(pool);
          for (let n = 0; n < 2; n++) {
            const claim = await app.inject({
              method: "POST",
              url: `/api/v1/funding/invoices/${id}/claim`,
              payload: { learnerId: "child" },
              headers: { cookie: `${ACQUISITION_COOKIE}=${replacement}` },
            });
            assert.equal(claim.statusCode, 200);
          }
          assert.deepEqual((await retainedClick(pool, id))?.identifiers, {
            gclid: "Original_Guest_Click",
          });
          const row = (
            await pool.query(
              "SELECT campaign_attribution FROM amp_funding_requests WHERE id=$1",
              [id],
            )
          ).rows[0];
          assert.deepEqual(row.campaign_attribution, {
            campaign: "az-esa-launch",
            source: "google",
            medium: "cpc",
            ...(creative ? { creative } : {}),
          });
          assert.equal(
            (
              await pool.query(
                "SELECT count::int AS count FROM amp_funded_campaign_daily WHERE action='request_prepared'",
              )
            ).rows[0].count,
            1,
          );
          assert.equal(
            (await pool.query("SELECT count(*) FROM amp_commerce_orders"))
              .rows[0].count,
            "0",
          );
        } finally {
          await app.close();
        }
      }),
  );

for (const mode of [
  "create-opt-out",
  "claim-opt-out",
  "expired",
  "different-owner",
  "withdrawn",
] as const)
  test(
    `guest invoice attribution respects ${mode} without borrowing a later browser click`,
    enabled,
    () =>
      fixture(async (pool) => {
        const token = await marketingClick(pool, "Original_Private_Click");
        const app = Fastify();
        await registerFundingPurchaseRoutes(app, {
          pool,
          offers: [offer],
          authenticate: async () => "amp|owner",
        });
        try {
          const create = await app.inject({
            method: "POST",
            url: "/api/v1/funding/invoices",
            payload: input(),
            headers: {
              cookie: `${ACQUISITION_COOKIE}=${token}`,
              ...(mode === "create-opt-out" ? { "sec-gpc": "1" } : {}),
            },
          });
          assert.equal(create.statusCode, 200);
          const id = create.json().invoiceId;
          if (mode === "expired") {
            await pool.query(
              "UPDATE amp_ad_click_journeys SET created_at=created_at-interval '91 days',expires_at=expires_at-interval '91 days'",
            );
            const c = await pool.connect();
            try {
              await purgeAdClickEvidence(c);
            } finally {
              c.release();
            }
          }
          if (mode === "different-owner")
            await pool.query(
              "UPDATE amp_ad_click_journeys SET account_id='amp|other'",
            );
          if (mode === "withdrawn")
            await pool.query(
              "INSERT INTO amp_ad_collection_withdrawals(account_id,provider) VALUES('amp|owner','google')",
            );
          const later = await marketingClick(pool, "Replacement_Private_Click");
          await eligibleParent(pool);
          const claim = await app.inject({
            method: "POST",
            url: `/api/v1/funding/invoices/${id}/claim`,
            payload: { learnerId: "child" },
            headers: {
              cookie: `${ACQUISITION_COOKIE}=${later}`,
              ...(mode === "claim-opt-out" ? { dnt: "1" } : {}),
            },
          });
          assert.equal(claim.statusCode, 200);
          // A later retry without an opt-out header must not backfill the original opt-out.
          assert.equal(
            (
              await app.inject({
                method: "POST",
                url: `/api/v1/funding/invoices/${id}/claim`,
                payload: { learnerId: "child" },
                headers: { cookie: `${ACQUISITION_COOKIE}=${later}` },
              })
            ).statusCode,
            200,
          );
          assert.equal(await retainedClick(pool, id), null);
          assert.equal(
            (
              await pool.query(
                "SELECT campaign_attribution FROM amp_funding_requests WHERE id=$1",
                [id],
              )
            ).rows[0].campaign_attribution,
            null,
          );
        } finally {
          await app.close();
        }
      }),
  );

test(
  "acquisition lookup failure does not prevent invoice preparation",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const token = await marketingClick(pool, "Synthetic_Failure_Click");
      await pool.query("DROP TABLE amp_ad_click_evidence CASCADE");
      const invoice = await invoices.create(input(), new Date(), token);
      assert.ok(invoice.id);
      assert.equal(
        (
          await pool.query(
            "SELECT acquisition_journey_id FROM amp_funding_invoice_intents WHERE id=$1",
            [invoice.id],
          )
        ).rows[0].acquisition_journey_id,
        null,
      );
    }),
);

test(
  "journey deletion and invoice claim use compatible lock order",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const token = await marketingClick(pool, "Deletion_Race_Click");
      const invoice = await invoices.create(input(), new Date(), token);
      await eligibleParent(pool);
      const cleanup = await pool.connect();
      let claim: Promise<unknown> | undefined;
      try {
        await cleanup.query("BEGIN");
        await cleanup.query("SELECT id FROM amp_ad_click_journeys FOR UPDATE");
        claim = invoices.claim("amp|owner", invoice.id, "child");
        let waiting = false;
        for (let i = 0; i < 100; i++) {
          const row = await pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE OF j%' LIMIT 1",
          );
          if (row.rowCount) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.equal(
          waiting,
          true,
          "claim must actually wait for the held journey lock",
        );
        await cleanup.query("DELETE FROM amp_ad_click_journeys");
        await cleanup.query("COMMIT");
        const result = (await claim) as { id: string };
        assert.equal(result.id, invoice.id);
        assert.equal(
          (
            await pool.query(
              "SELECT campaign_attribution FROM amp_funding_requests WHERE id=$1",
              [invoice.id],
            )
          ).rows[0].campaign_attribution,
          null,
        );
      } finally {
        await cleanup.query("ROLLBACK");
        cleanup.release();
        await claim?.catch(() => {});
      }
    }),
);

test(
  "campaign counter failure does not prevent a verified parent claiming an invoice",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const token = await marketingClick(pool, "Counter_Failure_Click");
      const invoice = await invoices.create(input(), new Date(), token);
      await eligibleParent(pool);
      await pool.query("DROP TABLE amp_funded_campaign_daily CASCADE");
      const claimed = await invoices.claim("amp|owner", invoice.id, "child");
      assert.equal(claimed.id, invoice.id);
      assert.equal(
        (
          await pool.query(
            "SELECT campaign_attribution FROM amp_funding_requests WHERE id=$1",
            [invoice.id],
          )
        ).rows[0].campaign_attribution,
        null,
      );
    }),
);

test(
  "claim erases withdrawn evidence before any post-claim linking runs",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const token = await marketingClick(pool, "Withdrawn_Private_Click");
      const invoice = await invoices.create(input(), new Date(), token);
      await eligibleParent(pool);
      await pool.query(
        "INSERT INTO amp_ad_collection_withdrawals(account_id,provider) VALUES('amp|owner','google')",
      );
      // Deliberately omit the optional post-claim linker, as on process interruption.
      await invoices.claim("amp|owner", invoice.id, "child");
      const evidence = await pool.query(
        "SELECT count(*)::int AS count FROM amp_ad_click_evidence WHERE provider='google'",
      );
      assert.equal(evidence.rows[0].count, 0);
    }),
);

test(
  "signup attribution survives a later no-cookie invoice and claim",
  enabled,
  () =>
    fixture(async (pool, invoices) => {
      const click = await marketingClick(
        pool,
        "Signup_Click",
        "az-funded-better-math-square-v5",
      );
      const labels = {
        campaign: "az-esa-launch" as const,
        source: "google" as const,
        medium: "cpc" as const,
        creative: "az-funded-better-math-square-v5" as const,
      };
      const signup = await createSignupIntent(
        pool,
        {
          program: "az-esa",
          campaign: labels,
          newsletter: false,
          notice: signupNotice,
        },
        `${ACQUISITION_COOKIE}=${click}`,
      );
      await completeSignup(pool, `amp.parent-signup=${signup}`, "owner");
      const invoice = await invoices.create(input());
      await eligibleParent(pool);
      const app = Fastify();
      await registerFundingPurchaseRoutes(app, {
        pool,
        offers: [offer],
        authenticate: async () => "amp|owner",
        development: true,
      });
      try {
        const result = await app.inject({
          method: "POST",
          url: `/api/v1/funding/invoices/${invoice.id}/claim`,
          payload: { learnerId: "child" },
        });
        assert.equal(result.statusCode, 200, result.body);
        const request = (
          await pool.query(
            "SELECT id,campaign_attribution FROM amp_funding_requests WHERE account_id='amp|owner'",
          )
        ).rows[0];
        assert.deepEqual(request.campaign_attribution, labels);
        const evidence = await retainedClick(pool, request.id);
        assert.ok(JSON.stringify(evidence).includes("Signup_Click"));
      } finally {
        await app.close();
      }
    }),
);
