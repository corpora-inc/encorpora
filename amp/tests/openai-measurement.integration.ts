import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { Pool } from "pg";
import {
  fixture,
  enabled,
  stripe,
  esa,
  sources,
  observation,
  refund,
} from "./helpers/advertising.js";
import {
  registerAcquisitionRoutes,
  ACQUISITION_COOKIE,
} from "../src/advertising/acquisition.js";
import {
  retainAdClick,
  bindAdClicksToOrder,
  orderClickEvidence,
  invoiceAcquisitionSnapshot,
} from "../src/advertising/click-evidence.js";
import { changeAdvertisingPermission } from "../src/advertising/permission.js";
import { OPENAI_PURCHASE_MEASUREMENT_NOTICE as notice } from "../src/advertising/permission-contracts.js";
import {
  queueOpenAIPayment,
  deliverOpenAIPayment,
  openaiMeasurementBatch,
} from "../src/advertising/openai-delivery.js";
import type { PaymentReference } from "../src/advertising/verified-payment.js";
const config = { enabled: true, pixelId: "synthetic_pixel", sources };
async function grant(pool: Pool) {
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
    "openai",
  );
  await pool.query(
    "UPDATE amp_openai_advertising_permissions SET granted_at=clock_timestamp()-interval '2 days'",
  );
}
async function bind(pool: Pool, ref: PaymentReference) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const kept = await retainAdClick(
      c,
      { provider: "openai", identifiers: { oppref: "Opaque_Exact+Case/=~" } },
      undefined,
      undefined,
      undefined,
      "https://amp.corpora.inc/",
    );
    await c.query(
      "UPDATE amp_ad_click_journeys SET created_at=created_at-interval '3 days',expires_at=expires_at-interval '3 days'",
    );
    await c.query(
      "UPDATE amp_ad_click_evidence SET observed_at=observed_at-interval '3 days',first_observed_at=first_observed_at-interval '3 days'",
    );
    const id = (
      await c.query(
        ref.kind === "stripe"
          ? "SELECT checkout_id AS id FROM amp_payment_records WHERE id=$1"
          : "SELECT id FROM amp_funding_requests WHERE order_id=$1",
        [ref.id],
      )
    ).rows[0].id;
    const target = {
      kind:
        ref.kind === "stripe"
          ? ("stripe-checkout" as const)
          : ("funding-request" as const),
      id,
    };
    const snap = await invoiceAcquisitionSnapshot(
      c,
      kept.token,
      { programId: "ar-efa", jurisdiction: "AR" },
      new Date(),
    );
    assert.ok(snap?.journeyId);
    assert.equal(snap.labels, null);
    assert.equal(
      (await bindAdClicksToOrder(c, "amp|parent", kept.token, target)).bound,
      1,
    );
    assert.equal(
      await orderClickEvidence(c, "amp|other", target, "openai"),
      null,
    );
    await c.query("COMMIT");
  } finally {
    c.release();
  }
}
const accepted = (bodies: any[]) => ({
  accessToken: async () => "synthetic",
  fetcher: (async (_url: any, init: any) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ accepted_events: 1 }));
  }) as typeof fetch,
});
for (const kind of ["stripe", "arkansas-efa", "arizona-esa"] as const)
  test(
    `${kind}: exact OpenAI click, verified purchase and duplicate suppression`,
    enabled,
    () =>
      fixture(async (pool) => {
        await grant(pool);
        const p =
          kind === "stripe" ? await stripe(pool) : await esa(pool, { kind });
        await bind(pool, p.reference);
        const queued = await queueOpenAIPayment(pool, config, p.reference);
        assert.equal(queued.outcome, "queued");
        assert.ok("eventId" in queued);
        assert.equal(
          (await queueOpenAIPayment(pool, config, p.reference)).outcome,
          "retained",
        );
        const bodies: any[] = [];
        const rt = accepted(bodies);
        assert.equal(
          await deliverOpenAIPayment(pool, config, queued.eventId!, rt),
          "accepted",
        );
        assert.equal(
          await deliverOpenAIPayment(pool, config, queued.eventId!, rt),
          "unchanged",
        );
        assert.equal(bodies.length, 1);
        const e = bodies[0].events[0];
        assert.equal(e.oppref, "Opaque_Exact+Case/=~");
        assert.equal(e.data.amount, 49900);
        assert.equal(e.opt_out, true);
        assert.equal(e.action_source, kind === "stripe" ? "web" : "other");
        assert.deepEqual(
          Object.keys(e).sort(),
          [
            "id",
            "type",
            "timestamp_ms",
            "oppref",
            "action_source",
            "opt_out",
            "data",
            ...(kind === "stripe" ? ["source_url"] : []),
          ].sort(),
        );
      }),
  );
test(
  "OpenAI timeout retries the identical event; amount changes cancel uncertain delivery",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      const p = await stripe(pool);
      await bind(pool, p.reference);
      const q = await queueOpenAIPayment(pool, config, p.reference);
      assert.ok("eventId" in q);
      const bodies: any[] = [];
      const rt = {
        accessToken: async () => "synthetic",
        fetcher: (async (_u: any, i: any) => {
          bodies.push(JSON.parse(i.body));
          throw new Error("timeout");
        }) as typeof fetch,
      };
      assert.equal(
        await deliverOpenAIPayment(pool, config, q.eventId!, rt),
        "retry",
      );
      assert.equal(
        await deliverOpenAIPayment(pool, config, q.eventId!, rt),
        "unchanged",
      );
      await pool.query(
        "UPDATE amp_openai_purchase_queue SET next_attempt_at=clock_timestamp()-interval '1 second'",
      );
      assert.equal(
        await deliverOpenAIPayment(pool, config, q.eventId!, accepted(bodies)),
        "accepted",
      );
      assert.deepEqual(bodies[0], bodies[1]);
      const p2 = await stripe(pool);
      await bind(pool, p2.reference);
      const q2 = await queueOpenAIPayment(pool, config, p2.reference);
      assert.ok("eventId" in q2);
      assert.equal(
        await deliverOpenAIPayment(pool, config, q2.eventId!, rt),
        "retry",
      );
      await observation(pool, p2.reference.id, [refund(p2.chargeId, 1000)]);
      await pool.query(
        "UPDATE amp_openai_purchase_queue SET next_attempt_at=clock_timestamp()-interval '1 second'",
      );
      assert.equal(
        await deliverOpenAIPayment(pool, config, q2.eventId!, accepted(bodies)),
        "ineligible",
      );
      assert.equal(bodies.length, 3);
    }),
);
test(
  "OpenAI rejects unpaid, unconsented, expired and test purchases; withdrawal stops delivery",
  enabled,
  () =>
    fixture(async (pool) => {
      const p = await stripe(pool);
      await bind(pool, p.reference);
      assert.equal(
        (await queueOpenAIPayment(pool, config, p.reference)).outcome,
        "ineligible",
      );
      await grant(pool);
      for (const item of [
        await esa(pool, { settled: false }),
        await stripe(pool, { live: false }),
        await stripe(pool, { reason: "subscription_cycle" }),
        await stripe(pool, {
          paidAt: Math.floor(Date.now() / 1000) - 8 * 86400,
        }),
      ]) {
        await bind(pool, item.reference);
        assert.equal(
          (await queueOpenAIPayment(pool, config, item.reference)).outcome,
          "ineligible",
        );
      }
      const q = await queueOpenAIPayment(pool, config, p.reference);
      assert.ok("eventId" in q);
      await changeAdvertisingPermission(
        pool,
        "amp|parent",
        { action: "withdraw" },
        false,
        "openai",
      );
      const bodies: any[] = [];
      assert.equal(
        await deliverOpenAIPayment(pool, config, q.eventId!, accepted(bodies)),
        "ineligible",
      );
      assert.equal(bodies.length, 0);
    }),
);
test(
  "OpenAI batch collects both payment channels and reports safe counts",
  enabled,
  () =>
    fixture(async (pool) => {
      await grant(pool);
      for (const p of [
        await stripe(pool),
        await esa(pool),
        await esa(pool, { kind: "arizona-esa" }),
      ])
        await bind(pool, p.reference);
      assert.deepEqual(await openaiMeasurementBatch(pool, config, "collect"), {
        queued: 3,
      });
      const bodies: any[] = [];
      assert.deepEqual(
        await openaiMeasurementBatch(
          pool,
          config,
          "deliver",
          20,
          accepted(bodies),
        ),
        { accepted: 3 },
      );
      assert.equal(bodies.length, 3);
    }),
);
test(
  "public app capture is origin/path constrained and returns only an HttpOnly cookie",
  enabled,
  () =>
    fixture(async (pool) => {
      const app = Fastify();
      await registerAcquisitionRoutes(app, {
        pool,
        origin: "https://corpora.inc",
      });
      const payload = {
        sourcePath: "/",
        clicks: [
          { provider: "openai", identifiers: { oppref: "Opaque_Value" } },
        ],
      };
      try {
        for (const origin of ["https://evil.example", "https://corpora.inc"]) {
          const r = await app.inject({
            method: "POST",
            url: "/api/v1/advertising/acquisition",
            headers: { origin },
            payload,
          });
          assert.ok([400, 403].includes(r.statusCode));
        }
        const r = await app.inject({
          method: "POST",
          url: "/api/v1/advertising/acquisition",
          headers: { origin: "https://amp.corpora.inc" },
          payload,
        });
        assert.equal(r.statusCode, 204);
        assert.equal(r.body, "");
        assert.ok(String(r.headers["set-cookie"]).includes(ACQUISITION_COOKIE));
        assert.ok(String(r.headers["set-cookie"]).includes("HttpOnly"));
        const no = await app.inject({
          method: "POST",
          url: "/api/v1/advertising/acquisition",
          headers: { origin: "https://amp.corpora.inc", "sec-gpc": "1" },
          payload,
        });
        assert.equal(no.statusCode, 204);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int AS n FROM amp_ad_click_evidence",
            )
          ).rows[0].n,
          1,
        );
      } finally {
        await app.close();
      }
    }),
);
