import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { fundedCohortSummary } from "../src/analytics/funded-cohort.js";
import { applyCommerceEvent } from "../src/commerce/postgres.js";
import type { CommerceEvent, OrderInput } from "../src/commerce/contracts.js";
import { testFundingOffer } from "./funding-purchase.fixture.js";

const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
const offer = { ...testFundingOffer, programId: "ar-efa", jurisdiction: "AR" };
const labels = {
  campaign: "ar-efa-launch",
  source: "google",
  medium: "cpc",
  creative: "efa-product-v1",
};
const ago = (hours: number) =>
  new Date(Date.now() - hours * 3600000).toISOString();
async function fixture(run: (pool: Pool) => Promise<void>) {
  const schema = `funded_cohort_${randomUUID().replaceAll("-", "")}`;
  const url = new URL(process.env.AMP_TEST_DATABASE_URL!);
  const admin = new Pool({ connectionString: url.href });
  url.searchParams.set(
    "options",
    `-c search_path=${schema} -c timezone=Pacific/Honolulu`,
  );
  const pool = new Pool({ connectionString: url.href });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(url.href);
    await pool.query(
      "INSERT INTO amp_learners(id,account_id,name) VALUES ('a','parent','Synthetic Alpha'),('b','parent','Synthetic Beta')",
    );
    await pool.query(
      "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES ('parent','fixture','verified','fixture')",
    );
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
async function request(
  pool: Pool,
  id: string,
  learner = "a",
  createdAt = ago(2),
  attributed = false,
) {
  await pool.query(
    `INSERT INTO amp_funding_requests
    (id,account_id,learner_id,idempotency_key,offer_id,offer_revision,offer_snapshot,created_at,expires_at,campaign_attribution)
    VALUES($1,'parent',$2,$3,'fixture-offer','v1',$4,$5,$5::timestamptz+interval '30 days',$6)`,
    [
      id,
      learner,
      randomUUID(),
      JSON.stringify(offer),
      createdAt,
      attributed ? JSON.stringify(labels) : null,
    ],
  );
}
async function intent(
  pool: Pool,
  id: string,
  options: {
    paid?: boolean;
    claimed?: boolean;
    cancelled?: boolean;
    az?: boolean;
    createdAt?: string;
  } = {},
) {
  await pool.query(
    `INSERT INTO amp_funding_invoice_intents
    (id,idempotency_key,parent_email,student_billing_name,offer_snapshot,created_at,expires_at,
      received_payment_at,claimed_account_id,claimed_request_id,state)
    VALUES($1,$2,'fixture@example.test','Synthetic Billing',$3,$4,$4::timestamptz+interval '30 days',
      CASE WHEN $5 THEN now() END,CASE WHEN $6 THEN 'parent' END,CASE WHEN $6 THEN $1 END,$7)`,
    [
      id,
      randomUUID(),
      JSON.stringify(options.az ? testFundingOffer : offer),
      options.createdAt ?? ago(2),
      !!options.paid,
      !!options.claimed,
      options.claimed
        ? "claimed"
        : options.cancelled
          ? "cancelled"
          : "prepared",
    ],
  );
}
async function order(pool: Pool, id: string, learner = "a", settled = true) {
  const input: OrderInput = {
    id: `order-${id}`,
    account: { id: "parent" },
    license: {
      accountId: "parent",
      learnerId: learner,
      sku: "fixture",
      startsAt: ago(1),
      endsAt: ago(-24),
    },
    channel: "esa",
    channelReference: "fixture",
    externalOrderId: `external-${id}`,
    currency: "USD",
    amountMinor: 12300,
    activationPolicy: "after-approval",
  };
  const envelope = {
    channel: input.channel,
    channelReference: input.channelReference,
    orderId: input.id,
    occurredAt: ago(1),
  };
  const events: CommerceEvent[] = [
    { ...envelope, id: `${id}-create`, type: "order.created", order: input },
    {
      ...envelope,
      id: `${id}-approve`,
      type: "order.approved",
      evidence: "fixture",
    },
    ...(settled
      ? [
          {
            ...envelope,
            id: `${id}-settle`,
            type: "order.settled" as const,
            evidence: "fixture",
            amountMinor: 12300,
            currency: "USD",
          },
        ]
      : []),
    {
      ...envelope,
      id: `${id}-fulfil`,
      type: "order.fulfilled",
      evidence: "fixture",
    },
    {
      ...envelope,
      id: `${id}-activate`,
      type: "license.activated",
      evidence: "fixture",
    },
  ];
  for (const event of events) await applyCommerceEvent(pool, event);
  await pool.query(
    "UPDATE amp_funding_requests SET order_id=$2,conversion_payload='{}' WHERE id=$1",
    [id, input.id],
  );
  return { input, events };
}
async function attempt(pool: Pool, learner: string, at?: string) {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,'{}')",
    [id, learner],
  );
  await pool.query(
    "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome,created_at) VALUES($1,$2,$1,$1,$4,COALESCE($3::timestamptz,clock_timestamp()))",
    [
      id,
      learner,
      at ?? null,
      JSON.stringify({
        id,
        problemId: id,
        requestId: id,
        skillId: "fixture-skill",
        templateId: "fixture",
        correct: true,
        assisted: false,
        createdAt: at ?? new Date().toISOString(),
      }),
    ],
  );
}
const report = (p: Pool, days = 30) =>
  fundedCohortSummary(p, days, "ar-efa-launch");

test(
  "retained invoice cohort includes guests and unattributed records without double-counting claims",
  enabled,
  () =>
    fixture(async (pool) => {
      await request(pool, "claimed", "a", ago(2), true);
      await intent(pool, "claimed", { claimed: true });
      await request(pool, "direct");
      await pool.query(
        "UPDATE amp_funding_requests SET status='parent-reported-submitted' WHERE id='direct'",
      );
      await intent(pool, "guest");
      await intent(pool, "payment-first", { paid: true });
      await intent(pool, "cancelled", { cancelled: true });
      await intent(pool, "arizona", { az: true });
      const r = await report(pool);
      assert.equal(r.counts.retained_invoices, 5);
      assert.equal(r.counts.unclaimed_invoices, 3);
      assert.equal(r.counts.account_bound_requests, 2);
      assert.equal(r.counts.unattributed_invoices, 4);
      assert.equal(r.counts.parent_reported_submitted, 1);
      assert.equal(r.counts.cancelled_invoices, 1);
      assert.equal(r.counts.provider_evidence_waiting_for_claim, 1);
      assert.equal(r.counts.settled_orders, 0);
      assert.equal(r.counts.current_usable_access, 0);
      assert.ok(r.waiting.oldest_unclaimed_hours! >= 2);
      const az = await fundedCohortSummary(pool, 30, "az-esa-launch");
      assert.equal(az.counts.retained_invoices, 1);
      for (const forbidden of [
        "fixture@example.test",
        "Synthetic",
        "parent",
        "external-",
        "learnerId",
        "campaign_attribution",
      ])
        assert.ok(
          !JSON.stringify({
            ...r,
            counts: { ...r.counts, parent_reported_submitted: undefined },
          }).includes(forbidden),
          forbidden,
        );
    }),
);

test(
  "exact learner use follows imported access, not approval date or sibling practice; replay is inert",
  enabled,
  () =>
    fixture(async (pool) => {
      await request(pool, "first", "a");
      await request(pool, "second", "b");
      await attempt(pool, "a", ago(0.5));
      await order(pool, "first", "a", false);
      const second = await order(pool, "second", "b");
      await attempt(pool, "b");
      await attempt(pool, "b");
      let r = await report(pool);
      assert.equal(r.counts.current_usable_access, 2);
      assert.equal(r.counts.observed_use_during_grant, 1);
      assert.equal(r.counts.settled_with_observed_use, 1);
      assert.equal(r.counts.current_access_without_observed_use, 1);
      assert.equal(r.counts.approved_awaiting_settlement, 1);
      assert.ok(r.waiting.oldest_approved_unsettled_hours! >= 1);
      for (const event of second.events) await applyCommerceEvent(pool, event);
      const replay = await report(pool);
      assert.deepEqual(replay.counts, r.counts);
      await attempt(pool, "a");
      r = await report(pool);
      assert.equal(r.counts.observed_use_during_grant, 2);
      assert.equal(r.counts.settled_with_observed_use, 1);
      await applyCommerceEvent(pool, {
        id: "late-payment",
        type: "order.settled",
        channel: "esa",
        channelReference: "fixture",
        orderId: "order-first",
        occurredAt: new Date().toISOString(),
        amountMinor: 12300,
        currency: "USD",
        evidence: "fixture",
      });
      r = await report(pool);
      assert.equal(r.counts.issued_grants, 2);
      assert.equal(r.counts.settled_with_observed_use, 2);
      assert.equal(r.counts.approved_awaiting_settlement, 0);
    }),
);

test(
  "mail acceptance, pending, stopped and missing are distinct from usable access",
  enabled,
  () =>
    fixture(async (pool) => {
      for (const id of ["accepted", "pending", "stopped", "missing"]) {
        await request(pool, id);
        await order(pool, id);
      }
      await pool.query(
        "INSERT INTO amp_funded_activation_outbox(request_id,accepted_at) VALUES ('accepted',now())",
      );
      await pool.query(
        "INSERT INTO amp_funded_activation_outbox(request_id) VALUES ('pending')",
      );
      await pool.query(
        "INSERT INTO amp_funded_activation_outbox(request_id,stopped_at,stopped_reason) VALUES ('stopped',now(),'fixture')",
      );
      let r = await report(pool);
      assert.equal(r.counts.activation_mail_accepted, 1);
      assert.equal(r.counts.activation_mail_pending, 1);
      assert.equal(r.counts.activation_mail_stopped, 1);
      assert.equal(r.counts.issued_grant_without_mail_record, 1);
      assert.equal(r.counts.current_usable_access, 4);
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id='parent'",
      );
      r = await report(pool);
      assert.equal(r.counts.current_usable_access, 0);
      assert.equal(r.counts.current_access_without_observed_use, 0);
      assert.equal(r.counts.activation_mail_accepted, 1);
    }),
);

test(
  "refund preserves evidenced historical use but revokes current access; pre-revocation bound is enforced",
  enabled,
  () =>
    fixture(async (pool) => {
      await request(pool, "used");
      await order(pool, "used");
      await attempt(pool, "a");
      // Keep the server-written answer and refund in distinct millisecond instants.
      await pool.query("SELECT pg_sleep(0.01)");
      await applyCommerceEvent(pool, {
        id: "refund",
        type: "refund.completed",
        channel: "esa",
        channelReference: "fixture",
        orderId: "order-used",
        occurredAt: new Date().toISOString(),
        amountMinor: 12300,
        currency: "USD",
        evidence: "fixture",
      });
      let r = await report(pool);
      assert.equal(r.counts.refunded_orders, 1);
      assert.equal(r.counts.revoked_grants, 1);
      assert.equal(r.counts.current_usable_access, 0);
      assert.equal(r.counts.observed_use_during_grant, 1);
      await request(pool, "revoked", "b");
      await order(pool, "revoked", "b");
      await applyCommerceEvent(pool, {
        id: "revoke",
        type: "license.revoked",
        channel: "esa",
        channelReference: "fixture",
        orderId: "order-revoked",
        occurredAt: ago(0.25),
        evidence: "fixture",
      });
      await attempt(pool, "b");
      r = await report(pool);
      assert.equal(r.counts.observed_use_during_grant, 1);
      await pool.query("DELETE FROM amp_attempts WHERE learner_id='a'");
      r = await report(pool);
      assert.equal(r.counts.observed_use_during_grant, 0);
      assert.equal(r.counts.settled_orders, 2);
    }),
);

test(
  "cohort uses UTC invoice creation, excludes future/old invoices, and does not claim deleted-learner access",
  enabled,
  () =>
    fixture(async (pool) => {
      const midnight = new Date();
      midnight.setUTCHours(0, 0, 0, 0);
      await request(pool, "today", "a", midnight.toISOString());
      await order(pool, "today");
      await request(
        pool,
        "yesterday",
        "b",
        new Date(midnight.getTime() - 1).toISOString(),
      );
      await request(pool, "future", "b", ago(-1));
      let r = await report(pool, 1);
      assert.equal(r.counts.retained_invoices, 1);
      assert.equal(r.from, midnight.toISOString());
      assert.equal(r.counts.current_usable_access, 1);
      await pool.query("UPDATE amp_learners SET deleted_at=now() WHERE id='a'");
      r = await report(pool, 1);
      assert.equal(r.counts.current_usable_access, 0);
      assert.equal(r.counts.issued_grants, 1);
      await assert.rejects(report(pool, 0), /Days must/);
      await assert.rejects(report(pool, 91), /Days must/);
    }),
);

test(
  "issued grants do not imply usable access with uncompleted consent or a future term",
  enabled,
  () =>
    fixture(async (pool) => {
      await request(pool, "consent");
      await order(pool, "consent");
      await pool.query(
        "UPDATE amp_parent_consents SET verification_method='internal-email-plus-v1',evidence_reference=$1 WHERE account_id='parent'",
        [randomUUID()],
      );
      let r = await report(pool);
      assert.equal(r.counts.current_usable_access, 0);
      assert.equal(r.counts.issued_grants, 1);
      await pool.query(
        "UPDATE amp_parent_consents SET verification_method='verified' WHERE account_id='parent'",
      );
      await pool.query(
        "UPDATE amp_grants SET starts_at=now()+interval '1 hour' WHERE id='commerce:order-consent'",
      );
      r = await report(pool);
      assert.equal(r.counts.current_usable_access, 0);
    }),
);
