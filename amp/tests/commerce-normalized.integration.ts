import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import type {
  CommerceEvent,
  CommerceState,
  OrderInput,
} from "../src/commerce/contracts.js";
import {
  canonicalCommercePayload,
  emptyCommerceState,
  reduceCommerce,
} from "../src/commerce/ledger.js";
import {
  applyCommerceEvent,
  applyCommerceEventInTransaction,
  commerceSourceId,
  readCommerceOrder,
} from "../src/commerce/postgres.js";
import { FamilyRepository } from "../src/family/repository.js";
const options = { skip: !process.env.AMP_TEST_DATABASE_URL };
const at = "2020-01-01T00:00:00.000Z";
const endsAt = "2030-01-01T00:00:00.000Z";
const sql = (name: string) =>
  readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8");
function order(
  id: string,
  accountId = "normalized-parent",
  learnerId = "child",
): OrderInput {
  return {
    id,
    account: { id: accountId },
    license: { accountId, learnerId, sku: "annual", startsAt: at, endsAt },
    channel: "stripe",
    channelReference: "fixture-merchant",
    externalOrderId: `invoice-${id}`,
    amountMinor: 10000,
    currency: "USD",
    activationPolicy: "after-settlement",
  };
}
function event(o: OrderInput, type: CommerceEvent["type"]): CommerceEvent {
  const common = {
    id: `${o.id}:${type}`,
    channel: o.channel,
    channelReference: o.channelReference,
    orderId: o.id,
    occurredAt: at,
  };
  if (type === "order.created") return { ...common, type, order: o };
  if (
    type === "order.settled" ||
    type === "refund.completed" ||
    type === "refund.requested"
  )
    return {
      ...common,
      type,
      evidence: "private-financial-reference",
      amountMinor: o.amountMinor,
      currency: o.currency,
    };
  return { ...common, type, evidence: "private-financial-reference" };
}
async function fixture(run: (pool: Pool) => Promise<void>) {
  const schema = `amp_normalized_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({
    connectionString: process.env.AMP_TEST_DATABASE_URL,
    max: 1,
  });
  const pool = new Pool({
    connectionString: process.env.AMP_TEST_DATABASE_URL,
    max: 8,
    options: `-c search_path=${schema}`,
  });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    for (const name of [
      "0001.sql",
      "0002-commerce.sql",
      "0003-parent-consent.sql",
      "0004-parent-lifecycle.sql",
      "0015-trials.sql",
      "0018-trial-teaching.sql",
    ])
      await pool.query(await sql(name));
    await pool.query(
      "INSERT INTO amp_learners(id,account_id,name) VALUES('child','normalized-parent','Private name'),('other-child','normalized-other','Other private name')",
    );
    await run(pool);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}
async function installLegacy(
  pool: Pool,
  events: CommerceEvent[],
): Promise<CommerceState> {
  let state = emptyCommerceState();
  for (const e of events) {
    state = reduceCommerce(state, e);
    await pool.query(
      "INSERT INTO amp_commerce_events(channel,channel_reference,event_id,order_id,payload) VALUES($1,$2,$3,$4,$5)",
      [e.channel, e.channelReference, e.id, e.orderId, JSON.stringify(e)],
    );
  }
  for (const g of state.grants) {
    const o = state.orders.find((o) => o.id === g.orderId)!;
    await pool.query(
      "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        `commerce:${g.id}`,
        g.learnerId,
        g.channel,
        commerceSourceId(o.channelReference, o.externalOrderId),
        g.status,
        g.startsAt > g.issuedAt ? g.startsAt : g.issuedAt,
        g.endsAt,
      ],
    );
  }
  await pool.query("UPDATE amp_commerce_ledger SET state=$1", [
    JSON.stringify(state),
  ]);
  return state;
}
const paid = (o: OrderInput) =>
  (
    [
      "order.created",
      "order.approved",
      "order.fulfilled",
      "order.settled",
      "license.activated",
    ] as const
  ).map((type) => event(o, type));

test(
  "cutover preserves exact orders, immutable events, grants and parent financial export",
  options,
  async () =>
    fixture(async (pool) => {
      const a = order("a"),
        b = order("b", "normalized-other", "other-child");
      const events = [...paid(a), event(a, "refund.completed"), ...paid(b)];
      const before = await installLegacy(pool, events);
      const history = (
        await pool.query("SELECT * FROM amp_commerce_events ORDER BY sequence")
      ).rows;
      await pool.query(await sql("0006-commerce-orders.sql"));
      await pool.query(await sql("0008-skill-evidence.sql"));
      await pool.query(await sql("0010-starting-point.sql"));
      assert.equal(
        (await pool.query("SELECT to_regclass('amp_commerce_ledger') AS old"))
          .rows[0].old,
        null,
      );
      for (const o of before.orders)
        assert.deepEqual(await readCommerceOrder(pool, o.account.id, o.id), {
          order: o,
          grant: before.grants.find((g) => g.orderId === o.id),
        });
      assert.deepEqual(
        (
          await pool.query(
            "SELECT * FROM amp_commerce_events ORDER BY sequence",
          )
        ).rows,
        history,
      );
      assert.equal(
        await readCommerceOrder(pool, "normalized-other", "a"),
        null,
      );
      assert.equal(
        await readCommerceOrder(pool, "normalized-parent", "missing"),
        null,
      );
      const replay = await applyCommerceEvent(pool, events[0]);
      assert.deepEqual(replay.orders, [before.orders[0]]);
      assert.equal(replay.grants[0]!.status, "revoked");
      await assert.rejects(
        applyCommerceEvent(pool, {
          ...events[0]!,
          occurredAt: "2020-01-02T00:00:00.000Z",
        }),
        /different payload/,
      );
      const family = new FamilyRepository(pool);
      const receipt = await family.deleteLearning("normalized-parent", "child");
      assert.equal(receipt.retainedBillingReferences, 1);
      assert.equal(
        (await pool.query("SELECT name FROM amp_learners WHERE id='child'"))
          .rows[0].name,
        "Deleted learner",
      );
      assert.equal(
        (await applyCommerceEvent(pool, events[0])).grants[0]!.status,
        "revoked",
      );
      const exported = [];
      for await (const line of family.export("normalized-parent"))
        exported.push(JSON.parse(line));
      const orders = exported.filter((r) => r.type === "order");
      assert.equal(orders.length, 1);
      assert.ok(!JSON.stringify(exported).includes("Other private name"));
      assert.ok(!JSON.stringify(exported).includes("invoice-b"));
      assert.equal(
        exported.filter((r) => r.type === "commerce-event").length,
        6,
      );
    }),
);

test(
  "migration aborts atomically on event or grant parity mismatch",
  options,
  async () => {
    for (const mismatch of ["event", "grant"] as const)
      await fixture(async (pool) => {
        const state = await installLegacy(pool, paid(order("a")));
        if (mismatch === "event") {
          const wrong = structuredClone(state);
          wrong.events[0]!.canonicalPayload = canonicalCommercePayload({
            ...event(order("a"), "order.created"),
            id: "different",
          });
          await pool.query("UPDATE amp_commerce_ledger SET state=$1", [
            JSON.stringify(wrong),
          ]);
        } else await pool.query("UPDATE amp_grants SET status='revoked'");
        await assert.rejects(
          pool.query(await sql("0006-commerce-orders.sql")),
          /parity failed/,
        );
        assert.notEqual(
          (await pool.query("SELECT to_regclass('amp_commerce_ledger') AS old"))
            .rows[0].old,
          null,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT to_regclass('amp_commerce_orders') AS next",
            )
          ).rows[0].next,
          null,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int AS n FROM amp_commerce_events",
            )
          ).rows[0].n,
          5,
        );
      });
  },
);

test(
  "unrelated orders proceed while another order is locked; source/replay collisions roll back",
  options,
  async () =>
    fixture(async (pool) => {
      await pool.query(await sql("0006-commerce-orders.sql"));
      await pool.query(await sql("0008-skill-evidence.sql"));
      await pool.query(await sql("0010-starting-point.sql"));
      const a = order("a"),
        b = order("b", "normalized-other", "other-child");
      await applyCommerceEvent(pool, event(a, "order.created"));
      await applyCommerceEvent(pool, event(b, "order.created"));
      const blocker = await pool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          "SELECT id FROM amp_commerce_orders WHERE id='a' FOR UPDATE",
        );
        let aFinished = false;
        const waiting = applyCommerceEvent(
          pool,
          event(a, "order.approved"),
        ).then(() => {
          aFinished = true;
        });
        await applyCommerceEvent(pool, event(b, "order.approved"));
        assert.equal(
          aFinished,
          false,
          "unrelated account does not wait for order a",
        );
        await blocker.query("COMMIT");
        await waiting;
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
      const clash = { ...order("c"), externalOrderId: a.externalOrderId };
      await assert.rejects(
        applyCommerceEvent(pool, event(clash, "order.created")),
        /External order already exists/,
      );
      await assert.rejects(
        applyCommerceEvent(pool, {
          ...event(order("d"), "order.created"),
          id: "a:order.created",
        }),
        /different payload/,
      );
      assert.equal(
        await readCommerceOrder(pool, "normalized-parent", "c"),
        null,
      );
      assert.equal(
        await readCommerceOrder(pool, "normalized-parent", "d"),
        null,
      );
      const duplicates = await Promise.all(
        Array.from({ length: 8 }, () =>
          applyCommerceEvent(pool, event(a, "order.fulfilled")),
        ),
      );
      assert.equal(duplicates.length, 8);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_commerce_events WHERE event_id='a:order.fulfilled'",
          )
        ).rows[0].n,
        1,
      );
    }),
);

test(
  "privacy deletion wins before a new financial reference; reconciliation preserves a tombstone",
  options,
  async () =>
    fixture(async (pool) => {
      await pool.query(await sql("0006-commerce-orders.sql"));
      await pool.query(await sql("0008-skill-evidence.sql"));
      await pool.query(await sql("0010-starting-point.sql"));
      const blocker = await pool.connect();
      try {
        await blocker.query("BEGIN");
        await blocker.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('normalized-parent',0))",
        );
        const creating = applyCommerceEvent(
          pool,
          event(order("a"), "order.created"),
        );
        // Attach rejection handling immediately; the losing writer must not leave an order/event.
        const denied = assert.rejects(creating, /Learner does not belong/);
        await blocker.query("DELETE FROM amp_learners WHERE id='child'");
        await blocker.query("COMMIT");
        await denied;
        assert.equal(
          await readCommerceOrder(pool, "normalized-parent", "a"),
          null,
        );
      } finally {
        await blocker.query("ROLLBACK");
        blocker.release();
      }
      const b = order("b", "normalized-other", "other-child");
      for (const e of paid(b)) await applyCommerceEvent(pool, e);
      await new FamilyRepository(pool).deleteLearning(
        "normalized-other",
        "other-child",
      );
      await applyCommerceEvent(pool, event(b, "refund.completed"));
      assert.equal(
        (await readCommerceOrder(pool, "normalized-other", "b"))!.grant!.status,
        "revoked",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT name FROM amp_learners WHERE id='other-child'",
          )
        ).rows[0].name,
        "Deleted learner",
      );
    }),
);

test(
  "nested Stripe imports reuse the account-lock owner even with a privacy writer queued",
  options,
  async () =>
    fixture(async (pool) => {
      await pool.query(await sql("0006-commerce-orders.sql"));
      await pool.query(await sql("0008-skill-evidence.sql"));
      await pool.query(await sql("0010-starting-point.sql"));
      const reconciliation = await pool.connect(),
        privacy = await pool.connect();
      let waiting: Promise<unknown> | undefined;
      try {
        await reconciliation.query("BEGIN");
        await reconciliation.query(
          "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",
          ["normalized-parent"],
        );
        await privacy.query("BEGIN");
        const pid = (await privacy.query("SELECT pg_backend_pid() AS pid"))
          .rows[0].pid;
        waiting = privacy.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
          ["normalized-parent"],
        );
        // Synchronize on PostgreSQL's actual queued lock, not an arbitrary delay.
        let queued = false;
        for (let i = 0; i < 100; i++) {
          queued = (
            await pool.query(
              "SELECT wait_event='advisory' AS waiting FROM pg_stat_activity WHERE pid=$1",
              [pid],
            )
          ).rows[0]?.waiting;
          if (queued) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.ok(
          queued,
          "privacy writer must be waiting behind reconciliation",
        );
        await applyCommerceEventInTransaction(
          reconciliation,
          event(order("nested"), "order.created"),
        );
        await reconciliation.query("COMMIT");
        await waiting;
        waiting = undefined;
        await privacy.query("COMMIT");
        assert.equal(
          (await readCommerceOrder(pool, "normalized-parent", "nested"))!.order
            .id,
          "nested",
        );
      } finally {
        await reconciliation.query("ROLLBACK");
        if (waiting) await waiting;
        await privacy.query("ROLLBACK");
        reconciliation.release();
        privacy.release();
      }
    }),
);

test(
  "concurrent source collisions keep one order and caller rollback preserves invoice atomicity",
  options,
  async () =>
    fixture(async (pool) => {
      await pool.query(await sql("0006-commerce-orders.sql"));
      await pool.query(await sql("0008-skill-evidence.sql"));
      await pool.query(await sql("0010-starting-point.sql"));
      const a = order("source-a"),
        b = { ...order("source-b"), externalOrderId: a.externalOrderId };
      const results = await Promise.allSettled(
        [a, b].map((o) => applyCommerceEvent(pool, event(o, "order.created"))),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(results.filter((r) => r.status === "rejected").length, 1);
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM amp_commerce_orders"))
          .rows[0].n,
        1,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM amp_commerce_events"))
          .rows[0].n,
        1,
      );
      const client = await pool.connect();
      const c = order("atomic");
      try {
        await client.query("BEGIN");
        await applyCommerceEventInTransaction(
          client,
          event(c, "order.created"),
        );
        await applyCommerceEventInTransaction(
          client,
          event(c, "order.approved"),
        );
        await assert.rejects(
          applyCommerceEventInTransaction(
            client,
            event(c, "license.activated"),
          ),
          /not eligible/,
        );
        await client.query("ROLLBACK");
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
      assert.equal(
        await readCommerceOrder(pool, "normalized-parent", "atomic"),
        null,
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_commerce_events WHERE order_id='atomic'",
          )
        ).rows[0].n,
        0,
      );
      await applyCommerceEvent(pool, event(c, "order.created"));
      assert.equal(
        (await readCommerceOrder(pool, "normalized-parent", "atomic"))!.order
          .approval,
        "pending",
      );
    }),
);

test(
  "an invoice transaction can finish its next event while a concurrent replay waits",
  options,
  async () =>
    fixture(async (pool) => {
      await pool.query(await sql("0006-commerce-orders.sql"));
      await pool.query(await sql("0008-skill-evidence.sql"));
      await pool.query(await sql("0010-starting-point.sql"));
      const invoice = await pool.connect(),
        replay = await pool.connect();
      let waiting: Promise<unknown> | undefined;
      const o = order("multi-event");
      await applyCommerceEvent(pool, event(o, "order.created"));
      try {
        await invoice.query("BEGIN");
        await replay.query("BEGIN");
        await applyCommerceEventInTransaction(
          invoice,
          event(o, "order.approved"),
        );
        const pid = (await replay.query("SELECT pg_backend_pid() AS pid"))
          .rows[0].pid;
        waiting = applyCommerceEventInTransaction(
          replay,
          event(o, "order.fulfilled"),
        );
        let queued = false;
        for (let i = 0; i < 100; i++) {
          queued = (
            await pool.query(
              "SELECT wait_event='advisory' AS waiting FROM pg_stat_activity WHERE pid=$1",
              [pid],
            )
          ).rows[0]?.waiting;
          if (queued) break;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.ok(queued);
        // A queued replay must not hold the next event lock ahead of this order.
        await applyCommerceEventInTransaction(
          invoice,
          event(o, "order.fulfilled"),
        );
        await invoice.query("COMMIT");
        await waiting;
        waiting = undefined;
        await replay.query("COMMIT");
        assert.equal(
          (await readCommerceOrder(pool, "normalized-parent", o.id))!.order
            .fulfillment,
          "delivered",
        );
      } finally {
        await invoice.query("ROLLBACK");
        if (waiting) await waiting;
        await replay.query("ROLLBACK");
        invoice.release();
        replay.release();
      }
    }),
);
