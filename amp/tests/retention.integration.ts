import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import type { CommerceEvent, OrderInput } from "../src/commerce/contracts.js";
import { applyCommerceEvent } from "../src/commerce/postgres.js";
import {
  purgeFinancialRecords,
  purgeInactiveLearners,
  purgeTrialRecords,
} from "../src/privacy/retention.js";
import { RETENTION } from "../src/privacy/retention-periods.js";

const options = { skip: !process.env.AMP_TEST_DATABASE_URL };
const DAY = 86_400_000;
const months = (from: Date, n: number) => {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
};
const years = (from: Date, n: number) => months(from, 12 * n);

async function fixture(run: (pool: Pool) => Promise<void>) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `amp_retention_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  const pool = new Pool({ connectionString: scoped.href, max: 4 });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}

async function learner(pool: Pool, id: string, account: string, at: Date) {
  await pool.query(
    `INSERT INTO amp_learners(id,account_id,name,birth_year,starting_band,starting_policy,starting_excluded_strands,created_at)
    VALUES($1,$2,'Private name',2016,'3–5',1,'{}',$3)`,
    [id, account, at],
  );
}
async function practice(pool: Pool, learnerId: string, at: Date) {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO amp_instances(id,learner_id,content,created_at) VALUES($1,$2,'{}',$3)",
    [`problem-${id}`, learnerId, at],
  );
  await pool.query(
    "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome,created_at) VALUES($1,$2,$3,$1,$4,$5)",
    [
      id,
      learnerId,
      `problem-${id}`,
      JSON.stringify({
        id,
        skillId: "skill",
        templateId: "template",
        correct: true,
        assisted: false,
        createdAt: at.toISOString(),
      }),
      at,
    ],
  );
}
const consent = (pool: Pool, account: string) =>
  pool.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'test','manual','synthetic')",
    [account],
  );
const count = async (pool: Pool, sql: string, values: unknown[] = []) =>
  Number((await pool.query(sql, values)).rows[0].n);

function order(id: string, account: string, learnerId: string, endsAt: Date) {
  const o: OrderInput = {
    id,
    account: { id: account },
    license: {
      accountId: account,
      learnerId,
      sku: "annual",
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: endsAt.toISOString(),
    },
    channel: "stripe",
    channelReference: "fixture-merchant",
    externalOrderId: `invoice-${id}`,
    amountMinor: 10000,
    currency: "USD",
    activationPolicy: "after-settlement",
  };
  const common = {
    channel: o.channel,
    channelReference: o.channelReference,
    orderId: id,
    occurredAt: "2026-01-01T00:00:00.000Z",
  };
  const events: CommerceEvent[] = [
    { ...common, id: `${id}:created`, type: "order.created", order: o },
    {
      ...common,
      id: `${id}:settled`,
      type: "order.settled",
      evidence: "private-financial-reference",
      amountMinor: o.amountMinor,
      currency: o.currency,
    },
    ...(
      ["order.approved", "order.fulfilled", "license.activated"] as const
    ).map((type) => ({
      ...common,
      id: `${id}:${type}`,
      type,
      evidence: "private-financial-reference",
    })),
  ];
  return events;
}

test("the retention periods are the published defaults", () => {
  assert.equal(RETENTION.learnerInactivityMonths, 24);
  assert.equal(RETENTION.trialRecordDays, 90);
  assert.equal(RETENTION.financialRecordYears, 7);
});

test(
  "learning data is deleted 24 months after the later of last practice and the family's latest licence end",
  options,
  async () =>
    fixture(async (pool) => {
      const now = new Date();
      const old = months(now, -30);
      // Idle 30 months: due now. Practised last month: kept.
      await learner(pool, "idle", "family-a", old);
      await practice(pool, "idle", old);
      await learner(pool, "active", "family-a", old);
      await practice(pool, "active", old);
      await practice(pool, "active", new Date(now.getTime() - 30 * DAY));
      // Inactive, but the family's licence runs to 2030 and has a financial link.
      await learner(pool, "paid", "family-b", old);
      await practice(pool, "paid", old);
      const licenceEnd = new Date("2030-01-01T00:00:00.000Z");
      await consent(pool, "family-b");
      for (const e of order("order-b", "family-b", "paid", licenceEnd))
        await applyCommerceEvent(pool, e);

      // Idle 30 months, but the parent started a new purchase today.
      await learner(pool, "returning", "family-c", old);
      await practice(pool, "returning", old);
      await pool.query(
        "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,request_id) VALUES($1,'test','family-c',$2)",
        [randomUUID(), randomUUID()],
      );
      assert.deepEqual(await purgeInactiveLearners(pool, now), {
        expiredLearners: 1,
      });
      assert.equal(
        await count(
          pool,
          "SELECT count(*) n FROM amp_learners WHERE id='returning' AND deleted_at IS NULL",
        ),
        1,
      );
      assert.equal(
        await count(
          pool,
          "SELECT count(*) n FROM amp_learners WHERE id='idle'",
        ),
        0,
      );
      for (const table of [
        "amp_attempts",
        "amp_instances",
        "amp_skill_evidence",
      ])
        assert.equal(
          await count(
            pool,
            `SELECT count(*) n FROM ${table} WHERE learner_id='idle'`,
          ),
          0,
          table,
        );
      assert.equal(
        await count(
          pool,
          "SELECT count(*) n FROM amp_attempts WHERE learner_id='active'",
        ),
        2,
      );
      assert.equal(
        await count(
          pool,
          "SELECT count(*) n FROM amp_privacy_events WHERE action='learner.retention-deleted' AND learner_id='idle'",
        ),
        1,
      );
      // Idempotent.
      assert.deepEqual(await purgeInactiveLearners(pool, now), {
        expiredLearners: 0,
      });

      // The active learner expires 24 months after their last practice.
      const lastActive = new Date(now.getTime() - 30 * DAY);
      assert.equal(
        (await purgeInactiveLearners(pool, months(lastActive, 24)))
          .expiredLearners,
        1,
      );
      // The licensed learner is kept until 24 months after the licence ends;
      // by then the returning family's purchase activity has also aged out.
      assert.equal(
        (
          await purgeInactiveLearners(
            pool,
            new Date(months(licenceEnd, 24).getTime() - DAY),
          )
        ).expiredLearners,
        1,
      );
      assert.equal(
        await count(
          pool,
          "SELECT count(*) n FROM amp_learners WHERE id='paid' AND deleted_at IS NULL",
        ),
        1,
      );
      assert.equal(
        (await purgeInactiveLearners(pool, months(licenceEnd, 24)))
          .expiredLearners,
        1,
      );
      // Same semantics as parent deletion: only an opaque billing reference stays.
      const tombstone = (
        await pool.query(
          "SELECT name,birth_year,starting_band,starting_policy,starting_excluded_strands,deleted_at FROM amp_learners WHERE id='paid'",
        )
      ).rows[0];
      assert.equal(tombstone.name, "Deleted learner");
      assert.equal(tombstone.birth_year, null);
      assert.equal(tombstone.starting_band, null);
      assert.equal(tombstone.starting_policy, null);
      assert.equal(tombstone.starting_excluded_strands, null);
      assert.ok(tombstone.deleted_at);
      assert.equal(
        await count(
          pool,
          "SELECT count(*) n FROM amp_attempts WHERE learner_id='paid'",
        ),
        0,
      );
      assert.equal(
        await count(
          pool,
          "SELECT count(*) n FROM amp_commerce_orders WHERE learner_id='paid'",
        ),
        1,
      );
      assert.equal(
        (await purgeInactiveLearners(pool, years(licenceEnd, 5)))
          .expiredLearners,
        0,
      );
    }),
);

test(
  "trial events and trial records are deleted 90 days after creation",
  options,
  async () =>
    fixture(async (pool) => {
      const now = new Date();
      const old = new Date(now.getTime() - 91 * DAY);
      const fresh = new Date(now.getTime() - 89 * DAY);
      const trial = async (created: Date, adoptedBy?: string) => {
        const id = randomUUID();
        const learnerId = `trial-learner-${id}`;
        await learner(
          pool,
          learnerId,
          adoptedBy ?? `trial:${id}`,
          new Date(created),
        );
        await practice(pool, learnerId, created);
        const analytics = (
          await pool.query(
            `INSERT INTO amp_trials(id,token_hash,learner_id,created_at,expires_at,adopted_at,adopted_by)
            VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING analytics_id`,
            [
              id,
              randomUUID().replaceAll("-", "").padEnd(64, "0"),
              learnerId,
              created,
              new Date(created.getTime() + 14 * DAY),
              adoptedBy ? created : null,
              adoptedBy ?? null,
            ],
          )
        ).rows[0].analytics_id;
        await pool.query(
          "INSERT INTO amp_trial_events(trial_id,event,occurred_at) VALUES($1,'trial_started',$2),($1,'placement_done',$2)",
          [analytics, created],
        );
        return learnerId;
      };
      const oldUnsaved = await trial(old);
      const oldSaved = await trial(old, "parent");
      const recent = await trial(fresh);

      assert.deepEqual(await purgeTrialRecords(pool, now), {
        expiredTrialEvents: 4,
        expiredTrialRecords: 2,
      });
      assert.equal(
        await count(pool, "SELECT count(*) n FROM amp_trial_events"),
        2,
      );
      assert.equal(
        await count(
          pool,
          "SELECT count(*) n FROM amp_trials WHERE learner_id=$1",
          [recent],
        ),
        1,
      );
      // Unsaved trial learner and answers are gone; the saved learner is the family's.
      assert.equal(
        await count(pool, "SELECT count(*) n FROM amp_learners WHERE id=$1", [
          oldUnsaved,
        ]),
        0,
      );
      assert.equal(
        await count(
          pool,
          "SELECT count(*) n FROM amp_attempts WHERE learner_id=$1",
          [oldSaved],
        ),
        1,
      );
      assert.deepEqual(await purgeTrialRecords(pool, now), {
        expiredTrialEvents: 0,
        expiredTrialRecords: 0,
      });
    }),
);

test(
  "financial records are deleted 7 years after the last transaction and licence end",
  options,
  async () =>
    fixture(async (pool) => {
      const licenceEnd = new Date("2030-01-01T00:00:00.000Z");
      await learner(pool, "child", "family", new Date());
      await consent(pool, "family");
      for (const e of order("order-1", "family", "child", licenceEnd))
        await applyCommerceEvent(pool, e);
      // Stripe purchase records for the same family.
      const checkout = randomUUID();
      await pool.query(
        `INSERT INTO amp_stripe_customers(namespace,account_id,reservation_id,customer_id) VALUES('test','family',$1,'cus_fixture')`,
        [randomUUID()],
      );
      await pool.query(
        `INSERT INTO amp_stripe_checkouts(id,namespace,account_id,learner_id,request_id,closed) VALUES($1,'test','family','child',$2,true)`,
        [checkout, randomUUID()],
      );
      const record = randomUUID();
      await pool.query(
        `INSERT INTO amp_payment_records(id,namespace,invoice_id,checkout_id,account_id,learner_id,status) VALUES($1,'test','in_1',$2,'family','child','verified')`,
        [record, checkout],
      );
      await pool.query(
        `INSERT INTO amp_payment_observations(id,record_id,observation,observation_sha256,source_event_id) VALUES($1,$2,'{}','x','evt_1')`,
        [randomUUID(), record],
      );
      await pool.query(
        `INSERT INTO amp_payment_holds(namespace,invoice_id,credit_note_id,source_event_id) VALUES('test','in_1','cn_1','evt_2')`,
      );
      await pool.query(
        `INSERT INTO amp_stripe_invoice_evidence(namespace,invoice_id,partial_refund) VALUES('test','in_1',true)`,
      );
      await pool.query(
        `INSERT INTO amp_account_entitlements(namespace,invoice_id,checkout_id,payment,status,ends_at) VALUES('test','in_1',$1,'{}','active',$2)`,
        [checkout, licenceEnd],
      );
      await pool.query(
        `INSERT INTO amp_stripe_inbox(namespace,event_id,event_type,object_id,event_created,payload_hash) VALUES('test','evt_1','invoice.paid','in_1',0,'x')`,
      );
      // A checkout that is still a purchase consent's evidence follows consent retention.
      const consented = randomUUID();
      await pool.query(
        `INSERT INTO amp_stripe_checkouts(id,namespace,account_id,request_id,closed) VALUES($1,'test','family',$2,true)`,
        [consented, randomUUID()],
      );
      await pool.query(
        `INSERT INTO amp_purchase_consents(checkout_id,account_id,policy_generation,policy_digest,notice_digest,notice) VALUES($1,'family',$2,'d','n','{}')`,
        [consented, randomUUID()],
      );
      // The learner's learning data was deleted; an opaque reference remains.
      await pool.query(
        "UPDATE amp_learners SET name='Deleted learner',birth_year=NULL,starting_band=NULL,starting_policy=NULL,starting_excluded_strands=NULL,deleted_at=now() WHERE id='child'",
      );

      // Application writers still cannot erase financial evidence.
      await assert.rejects(
        pool.query("DELETE FROM amp_commerce_events"),
        /append-only/,
      );
      await assert.rejects(
        pool.query("DELETE FROM amp_payment_observations"),
        /append-only/,
      );

      const before = new Date(years(licenceEnd, 7).getTime() - DAY);
      // Only the webhook inbox row (received now) is past 7 years by then.
      assert.deepEqual(await purgeFinancialRecords(pool, before), {
        expiredOrders: 0,
        expiredCheckouts: 0,
        expiredFinancialRecords: 1,
        expiredLearnerReferences: 0,
      });
      assert.equal(
        await count(pool, "SELECT count(*) n FROM amp_commerce_events"),
        5,
      );

      const due = years(
        new Date(Math.max(Date.now(), licenceEnd.getTime())),
        7,
      );
      assert.deepEqual(await purgeFinancialRecords(pool, due), {
        expiredOrders: 1,
        expiredCheckouts: 1,
        expiredFinancialRecords: 0,
        expiredLearnerReferences: 1,
      });
      for (const table of [
        "amp_commerce_orders",
        "amp_commerce_events",
        "amp_grants",
        "amp_payment_records",
        "amp_payment_observations",
        "amp_payment_holds",
        "amp_stripe_invoice_evidence",
        "amp_account_entitlements",
        "amp_stripe_inbox",
        "amp_learners",
      ])
        assert.equal(
          await count(pool, `SELECT count(*) n FROM ${table}`),
          0,
          table,
        );
      assert.equal(
        await count(
          pool,
          "SELECT count(*) n FROM amp_stripe_checkouts WHERE id=$1",
          [consented],
        ),
        1,
      );
      // The customer reservation stays while any checkout for the family remains.
      assert.equal(
        await count(pool, "SELECT count(*) n FROM amp_stripe_customers"),
        1,
      );
      assert.deepEqual(await purgeFinancialRecords(pool, due), {
        expiredOrders: 0,
        expiredCheckouts: 0,
        expiredFinancialRecords: 0,
        expiredLearnerReferences: 0,
      });
    }),
);
