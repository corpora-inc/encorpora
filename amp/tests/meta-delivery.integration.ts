import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  fixture,
  enabled,
  stripe,
  sources,
  observation,
  refund,
} from "./helpers/advertising.js";
import { changeAdvertisingPermission } from "../src/advertising/permission.js";
import { META_PURCHASE_MEASUREMENT_NOTICE as notice } from "../src/advertising/permission-contracts.js";
import { recordMetaPurchaseContext } from "../src/advertising/meta-context.js";
import { META_ENROLLMENT_CONFIRMATION_URL as page } from "../src/advertising/meta-context-contracts.js";
import {
  queueMetaPayment,
  deliverMetaPayment,
  metaMeasurementBatch,
  purgeMetaPurchaseQueue,
} from "../src/advertising/meta-delivery.js";
import { FamilyRepository } from "../src/family/repository.js";
const account = "amp|parent";
const config = {
  enabled: true,
  destination: { datasetId: "1234567890" },
  sources: { stripeNamespace: sources.stripeNamespace },
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const receipt = () =>
  json({ events_received: 1, messages: [], fbtrace_id: "synthetic-receipt" });
function runtime(handler?: () => Promise<Response>) {
  const calls: any[] = [];
  return {
    calls,
    accessToken: async () => "synthetic-token",
    fetcher: (async (_url, init) => {
      calls.push(JSON.parse(String(init!.body)));
      return handler ? handler() : receipt();
    }) as typeof fetch,
  };
}
async function grant(pool: Pool, revision: string | null = null) {
  const view = await changeAdvertisingPermission(
    pool,
    account,
    {
      action: "allow",
      revision,
      noticeVersion: notice.version,
      adultAttestation: true,
    },
    false,
    "meta",
  );
  await pool.query(
    "UPDATE amp_meta_advertising_permissions SET granted_at=clock_timestamp()-interval '2 days' WHERE account_id=$1",
    [account],
  );
  return view;
}
async function captured(pool: Pool) {
  const p = await stripe(pool);
  const checkout = (
    await pool.query(
      "SELECT checkout_id FROM amp_payment_records WHERE id=$1",
      [p.reference.id],
    )
  ).rows[0].checkout_id;
  await pool.query(
    "UPDATE amp_stripe_checkouts SET learner_id=NULL WHERE id=$1",
    [checkout],
  );
  assert.equal(
    (
      await recordMetaPurchaseContext(
        pool,
        account,
        sources.stripeNamespace,
        { checkoutId: checkout },
        {
          referer: `${page}?billing=processing&purchase=${checkout}`,
          "user-agent": "Synthetic adult browser/1.0",
        },
      )
    ).recorded,
    true,
  );
  return { ...p, checkout };
}
async function queued(pool: Pool) {
  const p = await captured(pool);
  const q = await queueMetaPayment(pool, config, p.reference.id);
  assert.equal(q.outcome, "queued");
  assert.ok(q.eventId);
  return { ...p, id: q.eventId };
}
const withdraw = (pool: Pool) =>
  changeAdvertisingPermission(
    pool,
    account,
    { action: "withdraw" },
    false,
    "meta",
  );

test("disabled Meta commands do not read credentials, use a database or send HTTP", async () => {
  const never = {
    connect: () => {
      throw new Error("database called");
    },
  } as unknown as Pool;
  const rt = runtime();
  rt.accessToken = async () => {
    throw new Error("credential called");
  };
  assert.equal(
    await deliverMetaPayment(
      never,
      { ...config, enabled: false },
      `amp_meta_${"a".repeat(64)}`,
      rt,
    ),
    "disabled",
  );
  assert.equal(
    (await queueMetaPayment(never, { ...config, enabled: false }, randomUUID()))
      .outcome,
    "disabled",
  );
  assert.deepEqual(
    await metaMeasurementBatch(never, { ...config, enabled: false }, "collect"),
    { disabled: 1 },
  );
});

test(
  "concurrent preparation and delivery retain one identity, one submission, redacted durable records and export",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await captured(pool);
      const all = await Promise.all(
        Array.from({ length: 5 }, () =>
          queueMetaPayment(pool, config, p.reference.id),
        ),
      );
      assert.equal(all.filter((x) => x.outcome === "queued").length, 1);
      assert.equal(new Set(all.map((x) => x.eventId)).size, 1);
      const id = all[0].eventId!;
      assert.match(id, /^amp_meta_[a-f0-9]{64}$/);
      const rt = runtime();
      const sent = await Promise.all(
        Array.from({ length: 5 }, () =>
          deliverMetaPayment(pool, config, id, rt),
        ),
      );
      assert.equal(sent.filter((x) => x === "accepted").length, 1);
      assert.equal(rt.calls.length, 1);
      const event = rt.calls[0].data[0];
      assert.equal(event.event_id, id);
      assert.equal(event.event_source_url, page);
      assert.equal(event.custom_data.value, 499);
      assert.equal(
        event.event_time,
        Math.floor(Date.parse(p.occurredAt) / 1000),
      );
      assert.deepEqual(Object.keys(event.user_data).sort(), [
        "client_user_agent",
        "em",
      ]);
      assert.doesNotMatch(
        JSON.stringify(rt.calls),
        /parent@example|Do not export|child|4242|amp\|parent|billing=|purchase=/,
      );
      const rows = (
        await pool.query("SELECT * FROM amp_meta_delivery_attempts")
      ).rows;
      assert.equal(rows[0].state, "accepted");
      assert.equal(rows[0].receipt.messageCount, 0);
      assert.doesNotMatch(
        JSON.stringify(rows),
        /email|user_agent|@|child|synthetic-token/,
      );
      const exported = [];
      for await (const item of new FamilyRepository(pool).export(account))
        if (JSON.parse(item).type.startsWith("meta-purchase-measurement-"))
          exported.push(JSON.parse(item));
      assert.equal(exported.length, 3); // preference, preparation and delivery
      assert.doesNotMatch(
        JSON.stringify(exported),
        /event_id|payment_id|dataset_id|1234567890|synthetic-receipt|client_user_agent|email_digest/,
      );
      await assert.rejects(
        pool.query("UPDATE amp_meta_purchase_queue SET dataset_id='999999'"),
        /immutable/,
      );
      await assert.rejects(
        pool.query(
          "UPDATE amp_meta_delivery_attempts SET state='unknown',receipt=NULL",
        ),
        /immutable/,
      );
    }),
);

test(
  "uncertain, rejected and interrupted attempts are durable and never automatically retried",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      for (const mode of ["network", "rejected", "crash"]) {
        const p = await queued(pool);
        const rt = runtime(async () => {
          if (mode === "network") throw new Error("private network details");
          return json({ error: "private rejection" }, 400);
        });
        if (mode === "crash")
          await pool.query(
            "INSERT INTO amp_meta_delivery_attempts(id,event_id,amount_minor,state) VALUES($1,$2,49900,'unknown')",
            [randomUUID(), p.id],
          );
        assert.equal(
          await deliverMetaPayment(pool, config, p.id, rt),
          mode === "crash"
            ? "blocked"
            : mode === "network"
              ? "unknown"
              : "rejected",
        );
        const count = rt.calls.length;
        assert.equal(
          await deliverMetaPayment(pool, config, p.id, rt),
          "blocked",
        );
        assert.equal(rt.calls.length, count);
        assert.equal(
          (await queueMetaPayment(pool, config, p.reference.id)).eventId,
          p.id,
        );
      }
      assert.doesNotMatch(
        JSON.stringify(
          (await pool.query("SELECT * FROM amp_meta_delivery_attempts")).rows,
        ),
        /private network|private rejection/,
      );
    }),
);

test(
  "changed financial facts, pending/full refunds, email or context prevent disclosure; Google withdrawal is independent",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await queued(pool);
      const rt = runtime();
      await pool.query(
        "UPDATE amp_payment_records SET status='review' WHERE id=$1",
        [p.reference.id],
      );
      assert.equal(
        await deliverMetaPayment(pool, config, p.id, rt),
        "ineligible",
      );
      await pool.query(
        "UPDATE amp_payment_records SET status='verified' WHERE id=$1",
        [p.reference.id],
      );
      for (const refunds of [
        [refund(p.chargeId, 100, "pending")],
        [refund(p.chargeId, 49900)],
      ]) {
        await observation(pool, p.reference.id, refunds);
        assert.equal(
          await deliverMetaPayment(pool, config, p.id, rt),
          "ineligible",
        );
      }
      await observation(pool, p.reference.id, []);
      await pool.query(
        "UPDATE amp_auth_users SET email='changed@example.invalid' WHERE id='parent'",
      );
      assert.equal(
        await deliverMetaPayment(pool, config, p.id, rt),
        "ineligible",
      );
      await pool.query(
        "UPDATE amp_auth_users SET email='parent@example.invalid',\"emailVerified\"=false WHERE id='parent'",
      );
      assert.equal(
        await deliverMetaPayment(pool, config, p.id, rt),
        "ineligible",
      );
      await pool.query(
        "UPDATE amp_auth_users SET \"emailVerified\"=true WHERE id='parent'",
      );
      assert.equal(rt.calls.length, 0);
      await changeAdvertisingPermission(
        pool,
        account,
        { action: "withdraw" },
        false,
        "google",
      );
      assert.equal(
        await deliverMetaPayment(pool, config, p.id, rt),
        "accepted",
      );
      const expired = await queued(pool);
      await pool.query(
        "UPDATE amp_meta_purchase_contexts SET observed_at=occurred_at,expires_at=clock_timestamp()-interval '1 minute' WHERE payment_id=$1",
        [expired.reference.id],
      );
      assert.equal(
        await deliverMetaPayment(pool, config, expired.id, rt),
        "ineligible",
      );
      assert.equal(rt.calls.length, 1);
    }),
);

test(
  "withdrawal during credential acquisition prevents any HTTP and regrant cannot revive a prior queue",
  enabled,
  () =>
    fixture(async (pool) => {
      const view = await grant(pool);
      const p = await queued(pool);
      const rt = runtime();
      rt.accessToken = async () => {
        await withdraw(pool);
        return "synthetic-token";
      };
      assert.equal(
        await deliverMetaPayment(pool, config, p.id, rt),
        "ineligible",
      );
      assert.equal(rt.calls.length, 0);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_meta_purchase_contexts",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await pool.query("SELECT state FROM amp_meta_purchase_queue")).rows[0]
          .state,
        "cancelled",
      );
      await assert.rejects(
        pool.query("UPDATE amp_meta_purchase_queue SET state='ready'"),
        /cannot be restored/,
      );
      const revision = (
        await pool.query(
          "SELECT revision FROM amp_meta_advertising_permissions",
        )
      ).rows[0].revision;
      assert.notEqual(revision, view.revision);
      await grant(pool, revision);
      const other = runtime();
      assert.equal(
        await deliverMetaPayment(pool, config, p.id, other),
        "ineligible",
      );
      assert.equal(other.calls.length, 0);
    }),
);

test(
  "withdrawal waits for in-flight disclosure, erases context and preserves an accepted receipt",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await queued(pool);
      const next = await queued(pool);
      let release!: () => void, started!: () => void;
      const hold = new Promise<void>((r) => (release = r)),
        start = new Promise<void>((r) => (started = r));
      const rt = runtime(async () => {
        started();
        await hold;
        return receipt();
      });
      const sending = deliverMetaPayment(pool, config, p.id, rt);
      await start;
      assert.equal(
        (await pool.query("SELECT state FROM amp_meta_delivery_attempts"))
          .rows[0].state,
        "unknown",
      );
      let done = false;
      const withdrawing = withdraw(pool).then(() => {
        done = true;
      });
      await new Promise((r) => setTimeout(r, 60));
      assert.equal(done, false);
      release();
      assert.equal(await sending, "accepted");
      await withdrawing;
      assert.equal(
        await deliverMetaPayment(pool, config, next.id, rt),
        "ineligible",
      );
      assert.equal(
        await deliverMetaPayment(pool, config, p.id, rt),
        "unchanged",
      );
      assert.equal(rt.calls.length, 1);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_meta_purchase_contexts",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await pool.query("SELECT state FROM amp_meta_delivery_attempts"))
          .rows[0].state,
        "accepted",
      );
    }),
);

test(
  "partial refunds before send use verified net cash; later refunds never become a second or negative Purchase",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await queued(pool);
      const rt = runtime();
      await observation(pool, p.reference.id, [refund(p.chargeId, 10000)]);
      assert.equal(
        await deliverMetaPayment(pool, config, p.id, rt),
        "accepted",
      );
      assert.equal(rt.calls[0].data[0].custom_data.value, 399);
      await observation(pool, p.reference.id, [refund(p.chargeId, 49900)]);
      assert.equal(
        await deliverMetaPayment(pool, config, p.id, rt),
        "unchanged",
      );
      assert.equal(rt.calls.length, 1);
    }),
);

test(
  "database connection loss during external I/O retains unknown and blocks retry",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await queued(pool);
      let deliveryPid = 0;
      const monitored = {
        connect: async () => {
          const client = await pool.connect();
          deliveryPid = (await client.query("SELECT pg_backend_pid() AS pid"))
            .rows[0].pid;
          return client;
        },
      } as unknown as Pool;
      const rt = runtime(async () => {
        assert.ok(deliveryPid > 0);
        assert.equal(
          (
            await pool.query("SELECT pg_terminate_backend($1) AS terminated", [
              deliveryPid,
            ])
          ).rows[0].terminated,
          true,
        );
        await new Promise((r) => setTimeout(r, 30));
        return receipt();
      });
      assert.equal(
        await deliverMetaPayment(monitored, config, p.id, rt),
        "unknown",
      );
      assert.equal(rt.calls.length, 1);
      assert.equal(
        (await pool.query("SELECT state FROM amp_meta_delivery_attempts"))
          .rows[0].state,
        "unknown",
      );
      assert.equal(
        await deliverMetaPayment(pool, config, p.id, runtime()),
        "blocked",
      );
    }),
);

test(
  "bounded concurrent sweeps wrap without starving payments and preserve destination identity",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const payments = await Promise.all(
        Array.from({ length: 5 }, () => captured(pool)),
      );
      for (let i = 0; i < 5; i++)
        await Promise.all([
          metaMeasurementBatch(pool, config, "collect", 2),
          metaMeasurementBatch(pool, config, "collect", 2),
        ]);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_meta_purchase_queue",
          )
        ).rows[0].n,
        5,
      );
      const other = { ...config, destination: { datasetId: "9876543210" } };
      const original = (
        await pool.query(
          "SELECT event_id FROM amp_meta_purchase_queue WHERE payment_id=$1",
          [payments[0].reference.id],
        )
      ).rows[0].event_id;
      assert.equal(
        (await queueMetaPayment(pool, other, payments[0].reference.id)).eventId,
        original,
      );
      const rt = runtime();
      assert.equal(
        await deliverMetaPayment(pool, other, original, rt),
        "ineligible",
      );
      for (let i = 0; i < 4; i++)
        await metaMeasurementBatch(pool, config, "deliver", 2, rt);
      assert.equal(rt.calls.length, 5);
      assert.equal(new Set(rt.calls.map((x) => x.data[0].event_id)).size, 5);
      await assert.rejects(metaMeasurementBatch(pool, config, "collect", 201));
    }),
);

test(
  "delivery history outlives seven-day context but is purged after ninety days without reopening eligibility",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await queued(pool);
      await deliverMetaPayment(pool, config, p.id, runtime());
      await pool.query("DELETE FROM amp_meta_purchase_contexts");
      assert.equal(await purgeMetaPurchaseQueue(pool), 0);
      // Separate old fixture proves retention without disabling immutable-identity triggers.
      const old = await stripe(pool, {
        paidAt: Math.floor(Date.now() / 1000) - 91 * 86400,
      });
      await pool.query(
        `INSERT INTO amp_meta_purchase_queue(event_id,payment_id,account_id,namespace,dataset_id,occurred_at,original_minor,permission_revision,permission_notice)
    VALUES($1,$2,$3,$4,$5,$6,49900,$7,$8)`,
        [
          `amp_meta_${"b".repeat(64)}`,
          old.reference.id,
          account,
          sources.stripeNamespace,
          config.destination.datasetId,
          old.occurredAt,
          randomUUID(),
          notice.version,
        ],
      );
      await pool.query(
        "INSERT INTO amp_meta_delivery_attempts(id,event_id,amount_minor,state) VALUES($1,$2,49900,'unknown')",
        [randomUUID(), `amp_meta_${"b".repeat(64)}`],
      );
      assert.equal(await purgeMetaPurchaseQueue(pool), 1);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_meta_delivery_attempts",
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (await queueMetaPayment(pool, config, old.reference.id)).outcome,
        "ineligible",
      );
    }),
);

test(
  "permission withdrawal between durable intent and final recheck is recorded as not sent",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await queued(pool);
      let intercepted = false;
      const wrapped = {
        connect: async () => {
          const client = await pool.connect();
          return new Proxy(client, {
            get(target, key) {
              if (key === "query")
                return async (...args: any[]) => {
                  const result = await (target.query as any)(...args);
                  if (args[0] === "COMMIT" && !intercepted) {
                    intercepted = true;
                    await withdraw(pool);
                  }
                  return result;
                };
              const value = Reflect.get(target, key);
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
        },
      } as unknown as Pool;
      const rt = runtime();
      assert.equal(
        await deliverMetaPayment(wrapped, config, p.id, rt),
        "not_sent",
      );
      assert.equal(rt.calls.length, 0);
      assert.equal(
        (
          await pool.query(
            "SELECT state,error_code FROM amp_meta_delivery_attempts",
          )
        ).rows[0].error_code,
        "evidence_changed",
      );
      assert.equal(
        await deliverMetaPayment(pool, config, p.id, rt),
        "ineligible",
      );
      assert.equal(rt.calls.length, 0);
    }),
);

test(
  "confirmed-email edits wait for the delivery lock and invalidate later purchase eligibility",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await queued(pool);
      const next = await queued(pool);
      let started!: () => void, release!: () => void;
      const start = new Promise<void>((r) => (started = r)),
        hold = new Promise<void>((r) => (release = r));
      const rt = runtime(async () => {
        started();
        await hold;
        return receipt();
      });
      const sending = deliverMetaPayment(pool, config, p.id, rt);
      await start;
      let changed = false;
      const changing = pool
        .query(
          "UPDATE amp_auth_users SET email='changed@example.invalid' WHERE id='parent'",
        )
        .then(() => {
          changed = true;
        });
      await new Promise((r) => setTimeout(r, 60));
      assert.equal(changed, false);
      release();
      assert.equal(await sending, "accepted");
      await changing;
      assert.equal(
        await deliverMetaPayment(pool, config, next.id, rt),
        "ineligible",
      );
      assert.equal(rt.calls.length, 1);
    }),
);

test(
  "a refund committed after intent prevents the prepared amount reaching Meta",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await queued(pool);
      let intercepted = false;
      const wrapped = {
        connect: async () => {
          const client = await pool.connect();
          return new Proxy(client, {
            get(target, key) {
              if (key === "query")
                return async (...args: any[]) => {
                  const result = await (target.query as any)(...args);
                  if (args[0] === "COMMIT" && !intercepted) {
                    intercepted = true;
                    const writer = await pool.connect();
                    try {
                      await writer.query("BEGIN");
                      await writer.query(
                        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
                        [account],
                      );
                      // Synthetic financial observation, serialized like the payment evidence writer.
                      await writer.query(
                        "INSERT INTO amp_payment_observations(id,record_id,observation,observation_sha256,source_event_id) VALUES($1,$2,$3,'synthetic-digest',$4)",
                        [
                          randomUUID(),
                          p.reference.id,
                          {
                            kind: "verified",
                            observation: {
                              refunds: [refund(p.chargeId, 49900)],
                            },
                          },
                          randomUUID(),
                        ],
                      );
                      await writer.query("COMMIT");
                    } finally {
                      writer.release();
                    }
                  }
                  return result;
                };
              const value = Reflect.get(target, key);
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
        },
      } as unknown as Pool;
      const rt = runtime();
      assert.equal(
        await deliverMetaPayment(wrapped, config, p.id, rt),
        "not_sent",
      );
      assert.equal(rt.calls.length, 0);
      assert.equal(
        await deliverMetaPayment(pool, config, p.id, rt),
        "ineligible",
      );
    }),
);
