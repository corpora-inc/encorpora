import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { migrate } from "../scripts/migrate.js";
import { FundingPurchaseRepository } from "../src/funding-purchase/repository.js";
import { registerFundingPurchaseRoutes } from "../src/funding-purchase/routes.js";
import {
  provisionFundingRequest,
  annualTermEnd,
} from "../src/funding-purchase/provision.js";
import { purgeExpiredFundingRequests } from "../src/funding-purchase/retention.js";
import { applyCommerceEvent } from "../src/commerce/postgres.js";
import type { CommerceEvent } from "../src/commerce/contracts.js";
import { testFundingOffer as offer } from "./funding-purchase.fixture.js";
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
async function fixture(
  run: (pool: Pool, repository: FundingPurchaseRepository) => Promise<void>,
) {
  const url = process.env.AMP_TEST_DATABASE_URL!,
    schema = `amp_funding_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set(
    "options",
    `-c search_path=${schema} -c timezone=Pacific/Honolulu`,
  );
  scoped.searchParams.set("application_name", schema);
  const pool = new Pool({ connectionString: scoped.href, max: 8 });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    await pool.query(
      "INSERT INTO amp_learners(id,account_id,name) VALUES('child','owner','Fixture'),('foreign','other','Foreign')",
    );
    await pool.query(
      "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('owner','fixture','verified','private'),('other','fixture','verified','private')",
    );
    await run(pool, new FundingPurchaseRepository(pool, [offer]));
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
}
const create = () => ({
  offerId: offer.id,
  offerRevision: offer.revision,
  learnerId: "child",
  idempotencyKey: randomUUID(),
});
const campaignAttribution = {
  campaign: "ar-efa-launch",
  source: "facebook",
  medium: "paid-social",
} as const;
const arkansasOffer = { ...offer, programId: "ar-efa", jurisdiction: "AR" };
async function campaignCounts(pool: Pool) {
  return (
    await pool.query(
      "SELECT action,sum(count)::int count FROM amp_funded_campaign_daily GROUP BY action ORDER BY action",
    )
  ).rows;
}
test(
  "funded campaign uses evidence UTC dates and rolls back an invalid provisioning bundle",
  enabled,
  () =>
    fixture(async (pool) => {
      const repo = new FundingPurchaseRepository(pool, [arkansasOffer]);
      const midnight = new Date();
      midnight.setUTCHours(0, 0, 0, 0);
      const createdAt = new Date(midnight.getTime() - 2 * 86400000);
      const evidenceAt = new Date(midnight.getTime() - 86400000).toISOString();
      const request = await repo.create(
        "owner",
        { ...create(), campaignAttribution },
        createdAt,
      );
      const input = bundle(request.id);
      for (const event of input.events) event.occurredAt = evidenceAt;
      const first = input.events[0]!;
      assert.equal(first.type, "order.created");
      if (first.type !== "order.created") throw new Error("Invalid fixture");
      first.order.license.startsAt = evidenceAt;
      first.order.license.endsAt = annualTermEnd(evidenceAt);
      input.events.splice(2, 0, {
        id: randomUUID(),
        orderId: first.orderId,
        channel: "esa",
        channelReference: first.channelReference,
        type: "order.settled",
        occurredAt: evidenceAt,
        amountMinor: first.order.amountMinor,
        currency: "USD",
        evidence: "verified-fixture-settlement",
      });
      const invalid = {
        ...input,
        events: [
          input.events[0]!,
          input.events[1]!,
          input.events[2]!,
          input.events[4]!,
          input.events[3]!,
        ],
      };
      await assert.rejects(
        provisionFundingRequest(pool, invalid, [arkansasOffer]),
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_commerce_orders"))
          .rows[0].n,
        0,
      );
      assert.deepEqual(await campaignCounts(pool), [
        { action: "request_prepared", count: 1 },
      ]);
      await provisionFundingRequest(pool, input, [arkansasOffer]);
      await provisionFundingRequest(pool, input, [arkansasOffer]);
      const rows = (
        await pool.query(
          "SELECT day::text,action,count::int FROM amp_funded_campaign_daily ORDER BY action",
        )
      ).rows;
      assert.deepEqual(rows, [
        { day: evidenceAt.slice(0, 10), action: "order_created", count: 1 },
        { day: evidenceAt.slice(0, 10), action: "order_settled", count: 1 },
        {
          day: createdAt.toISOString().slice(0, 10),
          action: "request_prepared",
          count: 1,
        },
      ]);
    }),
);
function bundle(requestId: string) {
  const id = randomUUID(),
    at = new Date().toISOString();
  const base = {
    orderId: id,
    channel: "esa" as const,
    channelReference: offer.channelReference,
    occurredAt: at,
  };
  const events: CommerceEvent[] = [
    {
      ...base,
      id: `${id}:create`,
      type: "order.created",
      order: {
        id,
        account: { id: "owner" },
        license: {
          accountId: "owner",
          learnerId: "child",
          sku: offer.sku,
          startsAt: at,
          endsAt: annualTermEnd(at),
        },
        channel: "esa",
        channelReference: offer.channelReference,
        externalOrderId: `verified-${id}`,
        amountMinor: 12300,
        currency: "USD",
        activationPolicy: "after-approval",
      },
    },
    ...(
      ["order.approved", "order.fulfilled", "license.activated"] as const
    ).map((type) => ({
      ...base,
      id: `${id}:${type}`,
      type,
      evidence: `private-${type}`,
    })),
  ];
  return { requestId, events };
}
test(
  "funded campaign labels are immutable on retry and aggregate preparation survives expiry",
  enabled,
  () =>
    fixture(async (pool) => {
      const repo = new FundingPurchaseRepository(pool, [arkansasOffer]);
      const input = { ...create(), campaignAttribution };
      const results = await Promise.all(
        Array.from({ length: 6 }, () => repo.create("owner", input)),
      );
      assert.equal(new Set(results.map((r) => r.id)).size, 1);
      await repo.create("owner", {
        ...input,
        campaignAttribution: { ...campaignAttribution, source: "google" },
      });
      assert.deepEqual(await campaignCounts(pool), [
        { action: "request_prepared", count: 1 },
      ]);
      assert.deepEqual(
        (
          await pool.query(
            "SELECT campaign_attribution FROM amp_funding_requests WHERE id=$1",
            [results[0]!.id],
          )
        ).rows[0].campaign_attribution,
        campaignAttribution,
      );
      assert.equal(
        "campaignAttribution" in (await repo.present("owner", results[0]!)),
        false,
      );
      const { FamilyRepository } = await import("../src/family/repository.js");
      let exported: Record<string, unknown> | undefined;
      for await (const chunk of new FamilyRepository(pool).export("owner")) {
        const record = JSON.parse(chunk);
        if (
          record.type === "funding-request" &&
          record.data.id === results[0]!.id
        )
          exported = record.data;
      }
      assert.deepEqual(exported?.campaignAttribution, campaignAttribution);
      assert.equal("campaign_counted" in exported!, false);
      const unattributed = { ...create() };
      await repo.create("owner", unattributed);
      await repo.create("owner", { ...unattributed, campaignAttribution });
      assert.deepEqual(await campaignCounts(pool), [
        { action: "request_prepared", count: 1 },
      ]);
      assert.equal(
        await purgeExpiredFundingRequests(pool, new Date("2100-01-01")),
        2,
      );
      assert.deepEqual(await campaignCounts(pool), [
        { action: "request_prepared", count: 1 },
      ]);
      const columns = (
        await pool.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='amp_funded_campaign_daily' ORDER BY ordinal_position",
        )
      ).rows.map((r) => r.column_name);
      assert.deepEqual(columns, [
        "day",
        "campaign",
        "source",
        "medium",
        "action",
        "count",
      ]);
    }),
);

test(
  "funded campaign counts verified settlement/refund once, including settlement after credit activation",
  enabled,
  () =>
    fixture(async (pool) => {
      const repo = new FundingPurchaseRepository(pool, [arkansasOffer]);
      const request = await repo.create("owner", {
        ...create(),
        campaignAttribution,
      });
      await repo.update("owner", request.id, "parent-reported-submitted");
      assert.deepEqual(await campaignCounts(pool), [
        { action: "request_prepared", count: 1 },
      ]);
      const input = bundle(request.id);
      await Promise.all([
        provisionFundingRequest(pool, input, [arkansasOffer]),
        provisionFundingRequest(pool, input, [arkansasOffer]),
      ]);
      assert.deepEqual(await campaignCounts(pool), [
        { action: "order_created", count: 1 },
        { action: "request_prepared", count: 1 },
      ]);
      const event = {
        ...input.events[0]!,
        type: "order.settled" as const,
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
        evidence: "verified-fixture-payment",
        amountMinor: 12300,
        currency: "USD",
      };
      // Build the strict envelope without carrying order.created's order payload.
      const {
        orderId,
        channel,
        channelReference,
        occurredAt,
        id,
        type,
        evidence,
        amountMinor,
        currency,
      } = event;
      const settlement = {
        orderId,
        channel,
        channelReference,
        occurredAt,
        id,
        type,
        evidence,
        amountMinor,
        currency,
      };
      await assert.rejects(
        applyCommerceEvent(pool, { ...settlement, amountMinor: 1 }),
      );
      await Promise.all(
        Array.from({ length: 6 }, () => applyCommerceEvent(pool, settlement)),
      );
      await applyCommerceEvent(pool, {
        ...settlement,
        type: "refund.requested",
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
      });
      assert.deepEqual(await campaignCounts(pool), [
        { action: "order_created", count: 1 },
        { action: "order_settled", count: 1 },
        { action: "request_prepared", count: 1 },
      ]);
      const refund = {
        ...settlement,
        type: "refund.completed",
        id: randomUUID(),
        occurredAt: new Date().toISOString(),
      };
      await applyCommerceEvent(pool, refund);
      await applyCommerceEvent(pool, refund);
      await provisionFundingRequest(pool, input, []);
      assert.deepEqual(await campaignCounts(pool), [
        { action: "order_created", count: 1 },
        { action: "order_settled", count: 1 },
        { action: "refund_completed", count: 1 },
        { action: "request_prepared", count: 1 },
      ]);
      assert.equal(
        await purgeExpiredFundingRequests(pool, new Date("2100-01-01")),
        0,
      );
    }),
);

test(
  "funded campaign rejects untrusted labels/programs and honors parent privacy headers",
  enabled,
  () =>
    fixture(async (pool, otherProgram) => {
      await assert.rejects(
        otherProgram.create("owner", { ...create(), campaignAttribution }),
        /campaign_program_mismatch/,
      );
      const wrongState = new FundingPurchaseRepository(pool, [
        { ...arkansasOffer, jurisdiction: "GA" },
      ]);
      await assert.rejects(
        wrongState.create("owner", { ...create(), campaignAttribution }),
        /campaign_program_mismatch/,
      );
      const repo = new FundingPurchaseRepository(pool, [arkansasOffer]);
      for (const extra of [
        { email: "parent@example.test" },
        { source: "parent@example.test" },
        { campaign: "unknown" },
        { medium: "paid_social" },
      ])
        await assert.rejects(
          repo.create("owner", {
            ...create(),
            campaignAttribution: { ...campaignAttribution, ...extra },
          }),
        );
      const app = Fastify();
      await registerFundingPurchaseRoutes(app, {
        pool,
        offers: [arkansasOffer],
        authenticate: async () => "owner",
      });
      try {
        for (const headers of [{ "sec-gpc": "1" }, { dnt: "1" }]) {
          const result = await app.inject({
            method: "POST",
            url: "/api/v1/funding/requests",
            headers,
            payload: {
              ...create(),
              campaignAttribution: { email: "discarded@example.test" },
            },
          });
          assert.equal(result.statusCode, 200);
          const invalidPurchase = await app.inject({
            method: "POST",
            url: "/api/v1/funding/requests",
            headers,
            payload: { ...create(), extra: "not-allowed", campaignAttribution },
          });
          assert.equal(invalidPurchase.statusCode, 400);
        }
        assert.deepEqual(await campaignCounts(pool), []);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM amp_funding_requests WHERE campaign_attribution IS NOT NULL",
            )
          ).rows[0].n,
          0,
        );
      } finally {
        await app.close();
      }
    }),
);
test(
  "parent requests are isolated, price-bound, concurrent-idempotent and never grants",
  enabled,
  () =>
    fixture(async (pool, repo) => {
      const input = create(),
        requests = await Promise.all(
          Array.from({ length: 8 }, () => repo.create("owner", input)),
        );
      assert.equal(new Set(requests.map((r) => r.id)).size, 1);
      await assert.rejects(
        repo.create("owner", { ...input, offerRevision: "v2" }),
        /idempotency_payload_mismatch/,
      );
      await assert.rejects(
        repo.create("other", { ...create(), learnerId: "child" }),
        /learner_not_found/,
      );
      await assert.rejects(
        repo.read("other", requests[0]!.id),
        /request_not_found/,
      );
      await assert.rejects(
        repo.create("owner", { ...create(), offerRevision: "stale" }),
        /offer_unavailable/,
      );
      const request = await repo.update(
        "owner",
        requests[0]!.id,
        "parent-reported-submitted",
      );
      assert.equal(
        (await repo.present("owner", request)).accessStatus,
        "not-granted",
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0].n,
        0,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_commerce_orders"))
          .rows[0].n,
        0,
      );
      const app = Fastify();
      await registerFundingPurchaseRoutes(app, {
        pool,
        offers: [offer],
        authenticate: async (req) =>
          req.headers.authorization === "Bearer owner" ? "owner" : "other",
      });
      try {
        const response = await app.inject({
          method: "GET",
          url: `/api/v1/funding/requests/${request.id}`,
          headers: { authorization: "Bearer owner" },
        });
        assert.equal(response.statusCode, 200);
        assert.equal(response.headers["cache-control"], "no-store");
        assert.ok(!response.body.includes("private-"));
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url: `/api/v1/funding/requests/${request.id}`,
              headers: { authorization: "Bearer other" },
            })
          ).statusCode,
          404,
        );
        const quote = await app.inject({
          method: "GET",
          url: `/api/v1/funding/requests/${request.id}/quote`,
          headers: { authorization: "Bearer owner" },
        });
        assert.equal(quote.statusCode, 200);
        assert.equal(quote.headers["content-type"], "application/pdf");
        assert.equal(quote.rawPayload.subarray(0, 5).toString(), "%PDF-");
        assert.match(
          String(quote.headers["content-security-policy"]),
          /default-src 'none'/,
        );
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: `/api/v1/funding/requests/${request.id}/status`,
              headers: { authorization: "Bearer owner" },
              payload: { status: "approved" },
            })
          ).statusCode,
          400,
        );
      } finally {
        await app.close();
      }
      const disabled = new FundingPurchaseRepository(pool, []);
      assert.equal(
        (await disabled.present("owner", request)).offerAvailable,
        false,
      );
      await assert.rejects(
        disabled.update("owner", request.id, "parent-reported-submitted"),
        /offer_unavailable/,
      );
      const withdrawnApp = Fastify();
      await registerFundingPurchaseRoutes(withdrawnApp, {
        pool,
        offers: [],
        authenticate: async () => "owner",
      });
      try {
        assert.equal(
          (
            await withdrawnApp.inject({
              method: "GET",
              url: `/api/v1/funding/requests/${request.id}/quote`,
            })
          ).statusCode,
          409,
        );
      } finally {
        await withdrawnApp.close();
      }
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id='owner'",
      );
      await assert.rejects(
        repo.create("owner", create()),
        /verified_consent_required/,
      );
    }),
);
test(
  "verified provisioning is atomic, exact-price, replay-safe and parent status hides private evidence",
  enabled,
  () =>
    fixture(async (pool, repo) => {
      const request = await repo.create("owner", create()),
        input = bundle(request.id);
      const first = input.events[0]!;
      assert.equal(first.type, "order.created");
      const wrong = structuredClone(input);
      if (wrong.events[0]!.type === "order.created")
        wrong.events[0]!.order.amountMinor = 1;
      await assert.rejects(
        provisionFundingRequest(pool, wrong, [offer]),
        /order_quote_mismatch/,
      );
      const policyMismatch = structuredClone(input);
      if (policyMismatch.events[0]!.type === "order.created")
        policyMismatch.events[0]!.order.activationPolicy = "after-settlement";
      await assert.rejects(
        provisionFundingRequest(pool, policyMismatch, [offer]),
        /order_quote_mismatch/,
      );
      await assert.rejects(
        provisionFundingRequest(pool, input, [{ ...offer, enabled: false }]),
        /offer_unavailable/,
      );
      await assert.rejects(
        provisionFundingRequest(pool, input, [
          { ...offer, revision: "revoked-old-revision" },
        ]),
        /offer_unavailable/,
      );
      const rollback = structuredClone(input);
      rollback.events = [
        input.events[0]!,
        input.events[2]!,
        input.events[3]!,
        input.events[1]!,
      ];
      await assert.rejects(provisionFundingRequest(pool, rollback, [offer]));
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_commerce_orders"))
          .rows[0].n,
        0,
      );
      const results = await Promise.all([
        provisionFundingRequest(pool, input, [offer]),
        provisionFundingRequest(pool, input, [offer]),
      ]);
      assert.equal(results[0]!.orderId, results[1]!.orderId);
      assert.equal(
        (await provisionFundingRequest(pool, input, [])).orderId,
        results[0]!.orderId,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0].n,
        1,
      );
      const disabledRepository = new FundingPurchaseRepository(pool, []);
      assert.equal(
        (await disabledRepository.present("owner", request)).offerAvailable,
        false,
      );
      const safe = await repo.present(
        "owner",
        await repo.read("owner", request.id),
      );
      assert.equal(safe.accessStatus, "active");
      assert.equal(safe.paymentStatus, "pending");
      assert.ok(!JSON.stringify(safe).includes("private-"));
      const mismatch = structuredClone(input);
      mismatch.events[1] = {
        ...mismatch.events[1]!,
        type: "order.approved",
        evidence: "different",
      };
      await assert.rejects(
        provisionFundingRequest(pool, mismatch, [offer]),
        /provisioning_payload_mismatch/,
      );
      await assert.rejects(
        repo.update("owner", request.id, "cancelled"),
        /request_already_provisioned/,
      );
      const last = input.events.at(-1)!;
      await applyCommerceEvent(pool, {
        ...last,
        id: randomUUID(),
        type: "license.revoked",
        occurredAt: new Date().toISOString(),
        evidence: "private-revocation",
      });
      assert.equal(
        (await repo.present("owner", await repo.read("owner", request.id)))
          .accessStatus,
        "revoked",
      );
      assert.equal(
        await purgeExpiredFundingRequests(pool, new Date("2100-01-01")),
        0,
      );
    }),
);
test(
  "withdrawn, deleted, cancelled and expired quotes cannot provision; expiry purge preserves financial links",
  enabled,
  () =>
    fixture(async (pool, repo) => {
      const cancelled = await repo.create("owner", create());
      await repo.update("owner", cancelled.id, "cancelled");
      await assert.rejects(
        provisionFundingRequest(pool, bundle(cancelled.id), [offer]),
        /request_not_provisionable/,
      );
      const expired = await repo.create(
        "owner",
        create(),
        new Date(Date.now() - 31 * 86400000),
      );
      await assert.rejects(
        provisionFundingRequest(pool, bundle(expired.id), [offer]),
        /request_not_provisionable/,
      );
      const active = await repo.create("owner", create());
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=now() WHERE account_id='owner'",
      );
      await assert.rejects(
        provisionFundingRequest(pool, bundle(active.id), [offer]),
        /verified_consent_required/,
      );
      await pool.query(
        "UPDATE amp_parent_consents SET withdrawn_at=NULL WHERE account_id='owner'",
      );
      await pool.query(
        "UPDATE amp_learners SET deleted_at=now() WHERE id='child'",
      );
      await assert.rejects(
        provisionFundingRequest(pool, bundle(active.id), [offer]),
        /learner_not_found/,
      );
      assert.equal(await purgeExpiredFundingRequests(pool), 1);
      assert.equal(
        (await pool.query("SELECT count(*)::int n FROM amp_grants")).rows[0].n,
        0,
      );
    }),
);

test(
  "family export isolates and redacts funding snapshots; learning deletion purges drafts but retains converted records",
  enabled,
  async () =>
    fixture(async (pool, repo) => {
      const { FamilyRepository } = await import("../src/family/repository.js");
      const family = new FamilyRepository(pool);
      const converted = await repo.create("owner", create());
      await provisionFundingRequest(pool, bundle(converted.id), [offer]);
      const draft = await repo.create("owner", create());
      const foreign = await repo.create("other", {
        ...create(),
        learnerId: "foreign",
      });
      const exported: { type: string; value?: unknown }[] = [];
      for await (const chunk of family.export("owner"))
        exported.push(JSON.parse(chunk));
      const requests = exported.filter((row) => row.type === "funding-request");
      assert.equal(requests.length, 2);
      const serialized = JSON.stringify(requests);
      assert.ok(serialized.includes(converted.id));
      assert.ok(serialized.includes(draft.id));
      assert.ok(!serialized.includes(foreign.id));
      for (const privateText of [
        "private-",
        "idempotency_key",
        "conversion_payload",
        "account_id",
      ])
        assert.ok(!serialized.includes(privateText));
      await family.deleteLearning("owner", "child");
      const kept = (
        await pool.query(
          "SELECT id FROM amp_funding_requests WHERE account_id='owner'",
        )
      ).rows;
      assert.deepEqual(kept, [{ id: converted.id }]);
      assert.equal(
        (
          await pool.query(
            "SELECT deleted_at IS NOT NULL AS deleted FROM amp_learners WHERE id='child'",
          )
        ).rows[0].deleted,
        true,
      );
    }),
);

test(
  "parallel different requests serialize before overlap checks; scheduled grants block a new annual term",
  enabled,
  async () =>
    fixture(async (pool, repo) => {
      const requests = await Promise.all([
        repo.create("owner", create()),
        repo.create("owner", create()),
      ]);
      const inputs = requests.map((request) => bundle(request.id));
      const barrier = await pool.connect();
      const schema = (await pool.query("SELECT current_schema() AS name"))
        .rows[0].name;
      await barrier.query("BEGIN");
      await barrier.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        ["owner"],
      );
      let pending: Promise<PromiseSettledResult<unknown>[]> | undefined;
      try {
        pending = Promise.allSettled(
          inputs.map((input) => provisionFundingRequest(pool, input, [offer])),
        );
        const deadline = Date.now() + 2500;
        let waiting = 0;
        while (Date.now() < deadline) {
          waiting = Number(
            (
              await pool.query(
                "SELECT count(*) AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event='advisory'",
                [schema],
              )
            ).rows[0].n,
          );
          if (waiting === 2) break;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        assert.equal(
          waiting,
          2,
          "both conversions must reach the database barrier before release",
        );
      } finally {
        await barrier.query("ROLLBACK");
        barrier.release();
      }
      const results = await pending!;
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      const failure = results.find(
        (r) => r.status === "rejected",
      ) as PromiseRejectedResult;
      assert.match(String(failure.reason), /overlapping_learning_access/);
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM amp_commerce_orders"))
          .rows[0].n,
        1,
      );
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM amp_grants")).rows[0]
          .n,
        1,
      );
      const loser = results.findIndex((r) => r.status === "rejected");
      const winner = results.findIndex((r) => r.status === "fulfilled");
      await applyCommerceEvent(pool, {
        ...inputs[winner]!.events.at(-1)!,
        id: randomUUID(),
        type: "license.revoked",
        occurredAt: new Date().toISOString(),
        evidence: "fixture-revocation",
      });
      // An independently scheduled entitlement must also block overlapping access.
      await pool.query(
        "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES('scheduled-fixture','child','apple','scheduled-fixture','active',now()+interval '30 days',now()+interval '90 days')",
      );
      await assert.rejects(
        provisionFundingRequest(pool, inputs[loser], [offer]),
        /overlapping_learning_access/,
      );
      // A half-open adjacent term does not overlap.
      const start = (
        inputs[loser]!.events[0] as Extract<
          CommerceEvent,
          { type: "order.created" }
        >
      ).order.license.startsAt;
      await pool.query(
        "UPDATE amp_grants SET starts_at=$1::timestamptz-interval '1 year',ends_at=$1 WHERE id='scheduled-fixture'",
        [start],
      );
      await provisionFundingRequest(pool, inputs[loser], [offer]);
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM amp_commerce_orders"))
          .rows[0].n,
        2,
      );
    }),
);
