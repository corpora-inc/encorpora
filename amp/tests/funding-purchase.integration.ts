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
  scoped.searchParams.set("options", `-c search_path=${schema}`);
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
