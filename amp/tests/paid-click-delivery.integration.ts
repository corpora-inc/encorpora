import test from "node:test";
import { randomUUID } from "node:crypto";
import { applyCommerceEvent } from "../src/commerce/postgres.js";
import assert from "node:assert/strict";
import {
  fixture,
  enabled,
  esa,
  destination,
  sources,
} from "./helpers/advertising.js";
import {
  retainAdClick,
  bindAdClicksToOrder,
} from "../src/advertising/click-evidence.js";
import { queueGooglePayment } from "../src/advertising/purchase-queue.js";
import { deliverGooglePayment } from "../src/advertising/google-delivery.js";
import {
  queueMetaPayment,
  deliverMetaPayment,
  metaMeasurementBatch,
  metaMeasurementReport,
} from "../src/advertising/meta-delivery.js";
import { changeAdvertisingPermission } from "../src/advertising/permission.js";
import { META_PURCHASE_MEASUREMENT_NOTICE as notice } from "../src/advertising/permission-contracts.js";

async function clicks(pool: any, order: string) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('amp|parent',0))",
    );
    const google = await retainAdClick(c, {
      provider: "google",
      identifiers: { gclid: "Synthetic_ExactCase" },
    });
    await retainAdClick(
      c,
      { provider: "meta", identifiers: { fbclid: "Synthetic_MetaExact" } },
      google.token,
    );
    await c.query(
      "UPDATE amp_ad_click_journeys SET created_at=created_at-interval '3 days',expires_at=expires_at-interval '3 days'",
    );
    await c.query(
      "UPDATE amp_ad_click_evidence SET observed_at=observed_at-interval '3 days',first_observed_at=first_observed_at-interval '3 days'",
    );
    const request = (
      await c.query("SELECT id FROM amp_funding_requests WHERE order_id=$1", [
        order,
      ])
    ).rows[0];
    await bindAdClicksToOrder(c, "amp|parent", google.token, {
      kind: "funding-request",
      id: request.id,
    });
    await c.query("COMMIT");
  } finally {
    c.release();
  }
}
async function metaGrant(pool: any) {
  await changeAdvertisingPermission(
    pool,
    "amp|parent",
    {
      action: "allow",
      revision: null,
      noticeVersion: notice.version,
      adultAttestation: true,
    },
    false,
    "meta",
  );
  await pool.query(
    "UPDATE amp_meta_advertising_permissions SET granted_at=clock_timestamp()-interval '2 days'",
  );
}
for (const program of ["ar-efa", "az-esa"] as const) {
  const kind = program === "ar-efa" ? "arkansas-efa" : "arizona-esa";
  const stateSources =
    program === "ar-efa"
      ? { efaChannelReference: sources.efaChannelReference }
      : { azEsaChannelReference: sources.azEsaChannelReference };
  test(
    `${program}: verified DirectPay reaches both providers with original click IDs and one purchase identity`,
    enabled,
    () =>
      fixture(async (pool) => {
        await metaGrant(pool);
        const p = await esa(pool, { kind });
        await clicks(pool, p.reference.id);
        const google = await queueGooglePayment(
          pool,
          destination,
          stateSources,
          p.reference,
        );
        assert.ok("transactionId" in google);
        const googleBodies: any[] = [];
        const googleRuntime = {
          accessToken: async () => "synthetic-token",
          fetcher: (async (_url: any, init: any) => {
            googleBodies.push(JSON.parse(init.body));
            return new Response(
              JSON.stringify({ requestId: "synthetic-receipt" }),
            );
          }) as typeof fetch,
        };
        assert.equal(
          await deliverGooglePayment(
            pool,
            { enabled: true, destination, sources: stateSources },
            google.transactionId,
            googleRuntime,
          ),
          "accepted",
        );
        assert.deepEqual(googleBodies[0].events[0].adIdentifiers, {
          gclid: "Synthetic_ExactCase",
        });
        assert.equal(googleBodies[0].events[0].eventSource, "OTHER");
        assert.equal(googleBodies[0].events[0].conversionValue, 499);
        assert.equal(
          googleBodies[0].events[0].eventTimestamp,
          p.base.occurredAt,
        );
        const config = {
          enabled: true,
          destination: { datasetId: "1234567890" },
          sources: stateSources,
        };
        const queued = await queueMetaPayment(pool, config, p.reference);
        assert.equal(queued.outcome, "queued");
        assert.ok("eventId" in queued);
        const metaBodies: any[] = [];
        const rt = {
          accessToken: async () => "synthetic-token",
          fetcher: (async (_url: any, init: any) => {
            metaBodies.push(JSON.parse(init.body));
            return new Response(
              JSON.stringify({
                events_received: 1,
                messages: [],
                fbtrace_id: "synthetic",
              }),
            );
          }) as typeof fetch,
        };
        assert.equal(
          await deliverMetaPayment(pool, config, queued.eventId!, rt),
          "accepted",
        );
        await deliverMetaPayment(pool, config, queued.eventId!, rt);
        assert.equal(metaBodies.length, 1);
        const event = metaBodies[0].data[0];
        assert.equal(event.action_source, "other");
        assert.equal(event.event_source_url, undefined);
        assert.equal(event.user_data.client_user_agent, undefined);
        assert.match(
          event.user_data.fbc,
          /^fb\.1\.\d{13}\.Synthetic_MetaExact$/,
        );
        assert.equal(event.user_data.fbp, undefined);
        assert.equal(event.custom_data.value, 499);
        assert.equal(
          event.event_time,
          Math.floor(Date.parse(p.base.occurredAt) / 1000),
        );
        const report = await metaMeasurementReport(pool, {
          ...config,
          enabled: false,
          sources: stateSources,
        });
        assert.deepEqual(report.attempts, [
          { state: "accepted", count: 1, receipts_with_messages: 0 },
        ]);
        const next = await esa(pool, { kind });
        const nextQueued = await queueMetaPayment(pool, config, next.reference);
        assert.ok("eventId" in nextQueued);
        const uncertain = {
          accessToken: async () => "synthetic-token",
          fetcher: (async () => {
            throw new Error("connection lost");
          }) as typeof fetch,
        };
        assert.equal(
          await deliverMetaPayment(
            pool,
            config,
            nextQueued.eventId!,
            uncertain,
          ),
          "unknown",
        );
        assert.deepEqual((await metaMeasurementReport(pool, config)).attempts, [
          { state: "accepted", count: 1, receipts_with_messages: 0 },
          { state: "unknown", count: 1, receipts_with_messages: 0 },
        ]);
        const replay = await queueMetaPayment(pool, config, p.reference);
        assert.equal(replay.eventId, queued.eventId);
      }),
  );
  test(
    `${program}: Meta batch includes settled funded orders and excludes invoices and withdrawn permission`,
    enabled,
    () =>
      fixture(async (pool) => {
        await metaGrant(pool);
        const unsettled = await esa(pool, { kind, settled: false });
        const paid = await esa(pool, { kind });
        const otherState = await esa(pool, {
          kind: kind === "arkansas-efa" ? "arizona-esa" : "arkansas-efa",
        });
        const config = {
          enabled: true,
          destination: { datasetId: "1234567890" },
          sources: stateSources,
        };
        assert.equal(
          (await queueMetaPayment(pool, config, unsettled.reference)).outcome,
          "ineligible",
        );
        assert.equal(
          (await queueMetaPayment(pool, config, otherState.reference)).outcome,
          "ineligible",
        );
        assert.deepEqual(await metaMeasurementBatch(pool, config, "collect"), {
          queued: 1,
        });
        assert.equal(
          (await pool.query("SELECT efa_order_id FROM amp_meta_purchase_queue"))
            .rows[0].efa_order_id,
          paid.reference.id,
        );
        const retained = (
          await pool.query(
            "SELECT event_id,funded_program FROM amp_meta_purchase_queue",
          )
        ).rows[0];
        assert.equal(retained.funded_program, program);
        await assert.rejects(
          pool.query(
            "UPDATE amp_meta_purchase_queue SET funded_program=$1 WHERE event_id=$2",
            [program === "ar-efa" ? "az-esa" : "ar-efa", retained.event_id],
          ),
          /immutable/,
        );
        await applyCommerceEvent(pool, {
          ...paid.base,
          id: randomUUID(),
          type: "refund.completed",
          occurredAt: new Date().toISOString(),
          amountMinor: 49900,
          currency: "USD",
          evidence: "synthetic completed refund",
        });
        let sends = 0;
        assert.equal(
          await deliverMetaPayment(pool, config, retained.event_id, {
            accessToken: async () => "synthetic-token",
            fetcher: (async () => {
              sends++;
              throw new Error("must not send refunded purchase");
            }) as typeof fetch,
          }),
          "ineligible",
        );
        assert.equal(sends, 0);
        await changeAdvertisingPermission(
          pool,
          "amp|parent",
          { action: "withdraw" },
          false,
          "meta",
        );
        const another = await esa(pool, { kind });
        assert.equal(
          (await queueMetaPayment(pool, config, another.reference)).outcome,
          "ineligible",
        );
      }),
  );
}

test(
  "Meta isolates state reports and delivery when both programs share a payment account",
  enabled,
  () =>
    fixture(async (pool) => {
      await metaGrant(pool);
      const sharedChannel = "synthetic-shared-program-account";
      const ar = await esa(pool, {
        kind: "arkansas-efa",
        channelReference: sharedChannel,
      });
      const az = await esa(pool, {
        kind: "arizona-esa",
        channelReference: sharedChannel,
      });
      const all = {
        enabled: true,
        destination: { datasetId: "1234567890" },
        sources: {
          efaChannelReference: sharedChannel,
          azEsaChannelReference: sharedChannel,
        },
      };
      assert.deepEqual(await metaMeasurementBatch(pool, all, "collect"), {
        queued: 2,
      });
      const arOnly = {
        ...all,
        sources: { efaChannelReference: sharedChannel },
      };
      const azOnly = {
        ...all,
        sources: { azEsaChannelReference: sharedChannel },
      };
      const azQueued = await queueMetaPayment(pool, azOnly, az.reference);
      assert.ok("eventId" in azQueued);
      const bodies: any[] = [];
      const runtime = {
        accessToken: async () => "synthetic-token",
        fetcher: (async (_url: any, init: any) => {
          bodies.push(JSON.parse(init.body));
          return new Response(
            JSON.stringify({
              events_received: 1,
              messages: [],
              fbtrace_id: "synthetic",
            }),
          );
        }) as typeof fetch,
      };
      assert.deepEqual(
        await metaMeasurementBatch(pool, azOnly, "deliver", 20, runtime),
        { accepted: 1 },
      );
      assert.equal(bodies.length, 1);
      assert.equal(bodies[0].data[0].event_id, azQueued.eventId);
      const arReport = await metaMeasurementReport(pool, arOnly);
      const azReport = await metaMeasurementReport(pool, azOnly);
      assert.deepEqual(arReport.preparations, [{ state: "ready", count: 1 }]);
      assert.deepEqual(azReport.preparations, [{ state: "ready", count: 1 }]);
      assert.deepEqual(arReport.attempts, []);
      assert.deepEqual(azReport.attempts, [
        { state: "accepted", count: 1, receipts_with_messages: 0 },
      ]);
      assert.deepEqual((await metaMeasurementReport(pool, all)).preparations, [
        { state: "ready", count: 2 },
      ]);
      const arQueued = await queueMetaPayment(pool, arOnly, ar.reference);
      assert.ok("eventId" in arQueued);
      assert.equal(
        await deliverMetaPayment(pool, azOnly, arQueued.eventId!, runtime),
        "ineligible",
      );
      assert.equal(bodies.length, 1);
    }),
);
