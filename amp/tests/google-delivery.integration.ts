import test from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import {
  fixture,
  enabled,
  stripe,
  esa,
  observation,
  refund,
  destination,
  sources,
} from "./helpers/advertising.js";
import { queueGooglePayment } from "../src/advertising/purchase-queue.js";
import {
  deliverGooglePayment,
  diagnoseGooglePayment,
  googleMeasurementBatch,
} from "../src/advertising/google-delivery.js";
import { changeAdvertisingPermission } from "../src/advertising/permission.js";
import { PURCHASE_MEASUREMENT_NOTICE } from "../src/advertising/permission-contracts.js";
import { FamilyRepository } from "../src/family/repository.js";
import { applyCommerceEvent } from "../src/commerce/postgres.js";
const config = { enabled: true, destination, sources };
async function queued(pool: Pool) {
  const payment = await stripe(pool);
  const result = await queueGooglePayment(
    pool,
    destination,
    sources,
    payment.reference,
  );
  assert.ok("transactionId" in result);
  return { ...payment, id: result.transactionId };
}
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
function runtime(handler?: (body: any, method: string) => Promise<Response>) {
  const calls: Array<{ body: any; method: string }> = [];
  return {
    calls,
    accessToken: async () => "synthetic-token",
    fetcher: (async (_url, init) => {
      const method = init!.method!;
      const body = init!.body ? JSON.parse(String(init!.body)) : null;
      calls.push({ body, method });
      return handler
        ? handler(body, method)
        : json({ requestId: `synthetic-receipt-${calls.length}` });
    }) as typeof fetch,
  };
}
function status(value = "SUCCESS", warnings: unknown[] = [], count = "1") {
  return json({
    requestStatusPerDestination: [
      {
        destination: {
          operatingAccount: {
            accountType: "GOOGLE_ADS",
            accountId: destination.conversionCustomerId,
          },
          productDestinationId: destination.conversionActionId,
        },
        requestStatus: value,
        eventsIngestionStatus: { recordCount: count },
        warningInfo: { warningCounts: warnings },
      },
    ],
  });
}
async function due(pool: Pool) {
  await pool.query(
    "UPDATE amp_google_delivery_attempts SET next_poll_at=clock_timestamp()-interval '1 second' WHERE processing='pending'",
  );
}
async function withdraw(pool: Pool) {
  await changeAdvertisingPermission(pool, "amp|parent", { action: "withdraw" });
}
test("disabled commands make no credential, database or network calls", async () => {
  const never = {
    connect: () => {
      throw new Error("database called");
    },
  } as unknown as Pool;
  const rt = runtime();
  rt.accessToken = async () => {
    throw new Error("credentials called");
  };
  assert.equal(
    await deliverGooglePayment(
      never,
      { ...config, enabled: false },
      `amp_${"a".repeat(64)}`,
      rt,
    ),
    "disabled",
  );
  assert.deepEqual(
    await googleMeasurementBatch(
      never,
      { ...config, enabled: false },
      "collect",
    ),
    { disabled: 1 },
  );
});
test(
  "concurrent workers send once, preserve receipt and exclude identities from durable records and family export",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await queued(pool);
      const rt = runtime();
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          deliverGooglePayment(pool, config, p.id, rt),
        ),
      );
      assert.equal(results.filter((r) => r === "accepted").length, 1);
      assert.equal(rt.calls.length, 1);
      const event = rt.calls[0].body.events[0];
      assert.equal(event.transactionId, p.id);
      assert.equal(event.conversionValue, 499);
      assert.deepEqual(
        Object.keys(event).sort(),
        [
          "consent",
          "conversionValue",
          "currency",
          "eventSource",
          "eventTimestamp",
          "transactionId",
          "userData",
        ].sort(),
      );
      assert.doesNotMatch(
        JSON.stringify(rt.calls),
        /parent@example|Do not export|child|4242|amp\|parent/,
      );
      const row = (
        await pool.query("SELECT * FROM amp_google_delivery_attempts")
      ).rows[0];
      assert.equal(row.state, "accepted");
      assert.equal(row.processing, "pending");
      assert.ok(+row.next_poll_at - +row.completed_at >= 30 * 60000);
      assert.doesNotMatch(JSON.stringify(row), /email|@|child|synthetic-token/);
      const exported = [];
      for await (const item of new FamilyRepository(pool).export("amp|parent"))
        if (JSON.parse(item).type === "purchase-measurement-delivery")
          exported.push(JSON.parse(item));
      assert.equal(exported.length, 1);
      assert.doesNotMatch(
        JSON.stringify(exported),
        /requestId|transaction_id|synthetic-receipt|1234567890/,
      );
      await assert.rejects(
        pool.query("UPDATE amp_google_delivery_attempts SET amount_minor=1"),
        /immutable/,
      );
    }),
);
test(
  "unknown, rejected and preexisting crash intents block automatic retries",
  enabled,
  () =>
    fixture(async (pool) => {
      for (const mode of ["timeout", "rejected", "crash"]) {
        const p = await queued(pool);
        const rt = runtime(async () => {
          if (mode === "timeout") throw new Error("private network details");
          return json({ error: "private provider" }, 400);
        });
        if (mode === "crash")
          await pool.query(
            "INSERT INTO amp_google_delivery_attempts(id,transaction_id,kind,amount_minor,state) VALUES($1,$2,'purchase',49900,'unknown')",
            [randomUUID(), p.id],
          );
        assert.equal(
          await deliverGooglePayment(pool, config, p.id, rt),
          mode === "crash"
            ? "blocked"
            : mode === "timeout"
              ? "unknown"
              : "rejected",
        );
        const calls = rt.calls.length;
        assert.equal(
          await deliverGooglePayment(pool, config, p.id, rt),
          "blocked",
        );
        assert.equal(rt.calls.length, calls);
      }
    }),
);
test(
  "withdrawal waits for an in-flight send and prevents later disclosure; diagnostics send no new event",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await queued(pool);
      let release!: () => void;
      const hold = new Promise<void>((r) => (release = r));
      let started!: () => void;
      const start = new Promise<void>((r) => (started = r));
      const rt = runtime(async () => {
        started();
        await hold;
        return json({ requestId: "synthetic-inflight" });
      });
      const sending = deliverGooglePayment(pool, config, p.id, rt);
      await start;
      assert.equal(
        (await pool.query("SELECT state FROM amp_google_delivery_attempts"))
          .rows[0].state,
        "unknown",
      );
      let withdrawn = false;
      const withdrawing = withdraw(pool).then(() => {
        withdrawn = true;
      });
      await new Promise((r) => setTimeout(r, 60));
      assert.equal(withdrawn, false);
      release();
      assert.equal(await sending, "accepted");
      await withdrawing;
      await due(pool);
      const check = runtime(async () => status());
      assert.equal(await diagnoseGooglePayment(pool, config, check), "success");
      assert.equal(check.calls[0].method, "GET");
      assert.equal(check.calls[0].body, null);
      assert.equal(
        await deliverGooglePayment(pool, config, p.id, rt),
        "correction_blocked",
      );
      assert.equal(rt.calls.length, 1);
    }),
);
test(
  "source review, pending refunds and changed email never reach provider",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await queued(pool);
      const rt = runtime();
      await pool.query(
        "UPDATE amp_payment_records SET status='review' WHERE id=$1",
        [p.reference.id],
      );
      assert.equal(
        await deliverGooglePayment(pool, config, p.id, rt),
        "ineligible",
      );
      await pool.query(
        "UPDATE amp_payment_records SET status='verified' WHERE id=$1",
        [p.reference.id],
      );
      await observation(pool, p.reference.id, [
        refund(p.chargeId, 100, "pending"),
      ]);
      assert.equal(
        await deliverGooglePayment(pool, config, p.id, rt),
        "ineligible",
      );
      await observation(pool, p.reference.id, []);
      await pool.query(
        "UPDATE amp_auth_users SET email='changed@example.invalid' WHERE id='parent'",
      );
      assert.equal(
        await deliverGooglePayment(pool, config, p.id, rt),
        "ineligible",
      );
      assert.equal(rt.calls.length, 0);
    }),
);
test(
  "processed purchases restate partial and full refunds using original identity, without resending after withdrawal",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await queued(pool);
      const rt = runtime();
      assert.equal(
        await deliverGooglePayment(pool, config, p.id, rt),
        "accepted",
      );
      await due(pool);
      assert.equal(
        await diagnoseGooglePayment(
          pool,
          config,
          runtime(async () => status()),
        ),
        "success",
      );
      assert.equal(
        await deliverGooglePayment(pool, config, p.id, rt),
        "unchanged",
      );
      await observation(pool, p.reference.id, [refund(p.chargeId, 10000)]);
      assert.equal(
        await deliverGooglePayment(pool, config, p.id, rt),
        "accepted",
      );
      assert.equal(rt.calls[1].body.events[0].conversionValue, 399);
      assert.equal(rt.calls[1].body.events[0].transactionId, p.id);
      assert.deepEqual(
        rt.calls[1].body.events[0].userData,
        rt.calls[0].body.events[0].userData,
      );
      await due(pool);
      await diagnoseGooglePayment(
        pool,
        config,
        runtime(async () => status()),
      );
      await observation(pool, p.reference.id, [refund(p.chargeId, 49900)]);
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, p.reference))
          .outcome,
        "cancelled",
      );
      assert.equal(
        await deliverGooglePayment(pool, config, p.id, rt),
        "accepted",
      );
      assert.equal(rt.calls[2].body.events[0].conversionValue, 0);
      assert.equal(rt.calls[2].body.events[0].transactionId, p.id);
      await due(pool);
      await diagnoseGooglePayment(
        pool,
        config,
        runtime(async () => status()),
      );
      await withdraw(pool);
      assert.equal(
        await deliverGooglePayment(pool, config, p.id, rt),
        "correction_blocked",
      );
      assert.equal(rt.calls.length, 3);
    }),
);
test(
  "EFA settlement and full refund use trusted ledger facts and the original reference",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await esa(pool);
      const q = await queueGooglePayment(
        pool,
        destination,
        sources,
        p.reference,
      );
      assert.ok("transactionId" in q);
      const rt = runtime();
      assert.equal(
        await deliverGooglePayment(pool, config, q.transactionId, rt),
        "accepted",
      );
      await due(pool);
      await diagnoseGooglePayment(
        pool,
        config,
        runtime(async () => status()),
      );
      await applyCommerceEvent(pool, {
        ...p.base,
        id: randomUUID(),
        type: "refund.completed",
        occurredAt: new Date().toISOString(),
        amountMinor: 49900,
        currency: "USD",
        evidence: "synthetic completed refund",
      });
      await queueGooglePayment(pool, destination, sources, p.reference);
      assert.equal(
        await deliverGooglePayment(pool, config, q.transactionId, rt),
        "accepted",
      );
      assert.equal(rt.calls[1].body.events[0].conversionValue, 0);
      assert.equal(rt.calls[1].body.events[0].transactionId, q.transactionId);
    }),
);
test(
  "diagnostics wait, back off, retain warnings, reject wrong counts and stop at deadline",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await queued(pool);
      await deliverGooglePayment(pool, config, p.id, runtime());
      const rt = runtime(async () => status("PROCESSING"));
      assert.equal(await diagnoseGooglePayment(pool, config, rt), "idle");
      assert.equal(rt.calls.length, 0);
      await due(pool);
      assert.equal(await diagnoseGooglePayment(pool, config, rt), "pending");
      let row = (await pool.query("SELECT * FROM amp_google_delivery_attempts"))
        .rows[0];
      assert.equal(row.poll_count, 1);
      assert.ok(+row.next_poll_at > Date.now() + 38 * 60000);
      assert.ok(+row.next_poll_at <= Date.now() + 60 * 60000);
      await due(pool);
      assert.equal(
        await diagnoseGooglePayment(
          pool,
          config,
          runtime(async () => status("SUCCESS", [], "2")),
        ),
        "pending",
      );
      row = (await pool.query("SELECT * FROM amp_google_delivery_attempts"))
        .rows[0];
      assert.equal(row.error_code, "diagnostic_record_count_mismatch");
      await due(pool);
      assert.equal(
        await diagnoseGooglePayment(
          pool,
          config,
          runtime(async () =>
            status("SUCCESS", [
              { reason: "CLICK_NOT_FOUND", recordCount: "1" },
            ]),
          ),
        ),
        "issues",
      );
      assert.equal(
        await deliverGooglePayment(pool, config, p.id, runtime()),
        "blocked",
      );
      const other = await queued(pool);
      await deliverGooglePayment(pool, config, other.id, runtime());
      await pool.query(
        "UPDATE amp_google_delivery_attempts SET completed_at=clock_timestamp()-interval '25 hours',next_poll_at=clock_timestamp()-interval '1 second' WHERE processing='pending'",
      );
      const noCalls = runtime();
      assert.equal(
        await diagnoseGooglePayment(pool, config, noCalls),
        "timeout",
      );
      assert.equal(noCalls.calls.length, 0);
    }),
);
test(
  "bounded collection and delivery pages restart without starvation or duplicates across manager paths",
  enabled,
  () =>
    fixture(async (pool) => {
      for (let i = 0; i < 3; i++) await stripe(pool);
      assert.deepEqual(
        await googleMeasurementBatch(pool, config, "collect", 2),
        { queued: 2 },
      );
      assert.deepEqual(
        await googleMeasurementBatch(pool, config, "collect", 2),
        { queued: 1 },
      );
      const rt = runtime();
      assert.deepEqual(
        await googleMeasurementBatch(pool, config, "deliver", 2, rt),
        { accepted: 2 },
      );
      assert.deepEqual(
        await googleMeasurementBatch(pool, config, "deliver", 2, rt),
        { accepted: 1 },
      );
      await googleMeasurementBatch(pool, config, "collect", 2);
      await googleMeasurementBatch(pool, config, "deliver", 2, rt);
      const changed = {
        ...config,
        destination: { ...destination, loginCustomerId: "2345678901" },
      };
      await googleMeasurementBatch(pool, changed, "collect", 2);
      await googleMeasurementBatch(pool, changed, "deliver", 2, rt);
      assert.equal(rt.calls.length, 3);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_google_purchase_queue",
          )
        ).rows[0].n,
        3,
      );
    }),
);

/** Real database, deterministic interleaving immediately after the durable commit. */
function afterIntent(pool: Pool, effect: () => Promise<void>) {
  const connect = pool.connect.bind(pool);
  (pool as any).connect = async () => {
    const client = await connect();
    const query = client.query.bind(client);
    let written = false;
    (client as any).query = async (text: string, ...args: any[]) => {
      const result = await (query as any)(text, ...args);
      if (text.startsWith("INSERT INTO amp_google_delivery_attempts"))
        written = true;
      if (text === "COMMIT" && written) {
        (client as any).query = query;
        (pool as any).connect = connect;
        await effect();
      }
      return result;
    };
    return client;
  };
}
test(
  "phase-two recheck blocks withdrawal or changed financial evidence after the durable intent",
  enabled,
  async () => {
    for (const mode of ["withdraw", "refund", "crash"]) {
      await fixture(async (pool) => {
        const p = await queued(pool);
        const rt = runtime();
        afterIntent(pool, async () => {
          if (mode === "withdraw") await withdraw(pool);
          else if (mode === "refund")
            await observation(pool, p.reference.id, [refund(p.chargeId, 100)]);
          else throw new Error("synthetic interruption after committed intent");
        });
        assert.equal(
          await deliverGooglePayment(pool, config, p.id, rt),
          mode === "crash" ? "unknown" : "not_sent",
        );
        assert.equal(rt.calls.length, 0);
        const row = (
          await pool.query("SELECT state FROM amp_google_delivery_attempts")
        ).rows[0];
        assert.equal(row.state, mode === "crash" ? "unknown" : "not_sent");
        if (mode === "crash")
          assert.equal(
            await deliverGooglePayment(pool, config, p.id, rt),
            "blocked",
          );
      });
    }
  },
);

test(
  "retention deletes attempts with expired payments without recreating a conversion",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await queued(pool);
      await deliverGooglePayment(pool, config, p.id, runtime());
      const old = Math.floor((Date.now() - 91 * 86400000) / 1000);
      // Move this synthetic clock fixture past retention; production identity stays immutable.
      await pool.query(
        "ALTER TABLE amp_payment_records DISABLE TRIGGER amp_payment_baseline_immutable",
      );
      await pool.query(
        "UPDATE amp_payment_records SET baseline=jsonb_set(baseline,'{paidAt}',to_jsonb($2::bigint)) WHERE id=$1",
        [p.reference.id, old],
      );
      await pool.query(
        "ALTER TABLE amp_payment_records ENABLE TRIGGER amp_payment_baseline_immutable",
      );
      await pool.query(
        "ALTER TABLE amp_google_purchase_queue DISABLE TRIGGER amp_google_purchase_identity_immutable",
      );
      await pool.query(
        "UPDATE amp_google_purchase_queue SET occurred_at=to_timestamp($1),permission_granted_at=to_timestamp($1)-interval '1 day'",
        [old],
      );
      await pool.query(
        "ALTER TABLE amp_google_purchase_queue ENABLE TRIGGER amp_google_purchase_identity_immutable",
      );
      const { purgeGooglePurchaseQueue } =
        await import("../src/advertising/purchase-queue.js");
      assert.equal(await purgeGooglePurchaseQueue(pool), 1);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_google_delivery_attempts",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await queueGooglePayment(pool, destination, sources, p.reference))
          .outcome,
        "ineligible",
      );
    }),
);

test(
  "operator CLI defaults off, reports aggregates and suppresses private error details",
  enabled,
  () =>
    fixture(async (pool) => {
      const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const run = promisify(execFile);
      const dir = await mkdtemp(join(tmpdir(), "amp-cli-"));
      const path = join(dir, "operator.json");
      try {
        await writeFile(path, JSON.stringify({ ...config, enabled: false }), {
          mode: 0o600,
        });
        const cwd = new URL("../", import.meta.url);
        const env = {
          ...process.env,
          AMP_DATABASE_URL: "invalid-private-database",
          AMP_GOOGLE_MEASUREMENT_CONFIG: path,
        };
        const off = await run(
          process.execPath,
          ["--import", "tsx", "scripts/google-measurement.ts", "deliver"],
          { env, cwd },
        );
        assert.deepEqual(JSON.parse(off.stdout), { disabled: true });
        assert.equal(off.stderr, "");
        const p = await queued(pool);
        const report = await run(
          process.execPath,
          ["--import", "tsx", "scripts/google-measurement.ts", "report"],
          {
            cwd,
            env: {
              ...env,
              AMP_DATABASE_URL: (pool as any).options.connectionString,
            },
          },
        );
        const parsed = JSON.parse(report.stdout);
        assert.deepEqual(parsed.preparations, [{ state: "ready", count: 1 }]);
        assert.doesNotMatch(
          report.stdout,
          new RegExp(p.id + "|amp\\|parent|parent@example|1234567890"),
        );
        await assert.rejects(
          run(
            process.execPath,
            ["--import", "tsx", "scripts/google-measurement.ts", "report"],
            { env, cwd },
          ),
          (error) => {
            assert.doesNotMatch(
              (error as any).stderr,
              /invalid-private-database/,
            );
            assert.match((error as any).stderr, /command failed/);
            return true;
          },
        );
      } finally {
        await rm(dir, { recursive: true });
      }
    }),
);

test(
  "known-owner credit holds wait for delivery's account lock; early holds serialize with invoice creation",
  enabled,
  () =>
    fixture(async (pool) => {
      const { holdFinancialRecord } =
        await import("../src/billing/evidence/repository.js");
      const { StripeRepository } =
        await import("../src/billing/stripe/repository.js");
      const { config: stripeConfig } = await import("./stripe-fixtures.js");
      const repo = new StripeRepository(pool, {
        ...stripeConfig,
        accountId: "acct_fixture",
        livemode: true,
      });
      assert.equal(repo.namespace, sources.stripeNamespace);
      const p = await queued(pool);
      let release!: () => void;
      const waiting = new Promise<void>((r) => (release = r));
      let reached!: () => void;
      const started = new Promise<void>((r) => (reached = r));
      const rt = runtime(async () => {
        reached();
        await waiting;
        return json({ requestId: "synthetic-hold-race" });
      });
      const delivery = deliverGooglePayment(pool, config, p.id, rt);
      await started;
      let held = false;
      const hold = holdFinancialRecord(
        repo,
        p.invoiceId,
        "evt_synthetic",
        "cn_synthetic",
      ).then(() => {
        held = true;
      });
      await new Promise((r) => setTimeout(r, 60));
      assert.equal(held, false);
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_payment_holds WHERE invoice_id=$1",
            [p.invoiceId],
          )
        ).rows[0].n,
        0,
      );
      release();
      assert.equal(await delivery, "accepted");
      await hold;
      assert.equal(
        (
          await pool.query(
            "SELECT status FROM amp_payment_records WHERE id=$1",
            [p.reference.id],
          )
        ).rows[0].status,
        "review",
      );
      await due(pool);
      await diagnoseGooglePayment(
        pool,
        config,
        runtime(async () => status()),
      );
      assert.equal(
        await deliverGooglePayment(pool, config, p.id, rt),
        "correction_blocked",
      );
      assert.equal(rt.calls.length, 1);
      // A hold arriving before ownership remains durable; later financial import sees it.
      await holdFinancialRecord(
        repo,
        "in_early_synthetic",
        "evt_early",
        "cn_early",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_payment_holds WHERE invoice_id='in_early_synthetic'",
          )
        ).rows[0].n,
        1,
      );
    }),
);

test(
  "a slow collector cannot overwrite a newer cursor after a complete sweep returns to null",
  enabled,
  () =>
    fixture(async (pool) => {
      await stripe(pool);
      await stripe(pool);
      const query = pool.query.bind(pool);
      let intercepted = false;
      let release!: () => void;
      const hold = new Promise<void>((r) => (release = r));
      let reached!: () => void;
      const ready = new Promise<void>((r) => (reached = r));
      (pool as any).query = async (text: string, ...args: any[]) => {
        if (
          !intercepted &&
          text.startsWith("UPDATE amp_google_collection_cursors") &&
          args[0][1] === "stripe"
        ) {
          intercepted = true;
          reached();
          await hold;
        }
        return (query as any)(text, ...args);
      };
      try {
        const slow = googleMeasurementBatch(pool, config, "collect", 1);
        await ready;
        await googleMeasurementBatch(pool, config, "collect", 1);
        await googleMeasurementBatch(pool, config, "collect", 1);
        release();
        await slow;
        const row = (
          await pool.query(
            "SELECT after_id,revision FROM amp_google_collection_cursors WHERE kind='stripe'",
          )
        ).rows[0];
        assert.equal(row.after_id, null);
        assert.equal(row.revision, "2");
      } finally {
        release();
        (pool as any).query = query;
      }
    }),
);
