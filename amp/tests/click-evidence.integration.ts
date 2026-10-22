import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { fixture, enabled } from "./helpers/advertising.js";
import {
  retainAdClick,
  bindAdClicksToOrder,
  orderClickEvidence,
  purgeAdClickEvidence,
  eraseAccountAdClicks,
  type AttributionTarget,
} from "../src/advertising/click-evidence.js";
async function transaction<T>(
  pool: Pool,
  run: (client: PoolClient) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('amp|parent',0))",
    );
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function order(
  client: PoolClient,
  kind: AttributionTarget["kind"],
  account = "amp|parent",
): Promise<AttributionTarget> {
  const id = randomUUID();
  if (kind === "stripe-checkout")
    await client.query(
      "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,learner_id,request_id,closed,created_at) VALUES($1,'acct_fixture:live',$2,'child',$3,true,clock_timestamp())",
      [id, account, randomUUID()],
    );
  else
    await client.query(
      `INSERT INTO amp_funding_requests(id,account_id,learner_id,idempotency_key,offer_id,offer_revision,offer_snapshot,created_at,expires_at)
     VALUES($1,$2,'child',$3,'synthetic','v1','{}',clock_timestamp(),clock_timestamp()+interval '1 day')`,
      [id, account, randomUUID()],
    );
  return { kind, id } as AttributionTarget;
}
test(
  "real database retains both providers, immutable order binding and original click time",
  enabled,
  async () =>
    fixture(async (pool) => {
      await transaction(pool, async (client) => {
        const click = await retainAdClick(client, {
          provider: "google",
          identifiers: { gclid: "Original_Google" },
        });
        await retainAdClick(
          client,
          { provider: "meta", identifiers: { fbclid: "Original_Meta" } },
          click.token,
        );
        const first = (
          await client.query(
            "SELECT observed_at FROM amp_ad_click_evidence WHERE provider='meta'",
          )
        ).rows[0].observed_at as Date;
        await retainAdClick(
          client,
          { provider: "meta", identifiers: { fbclid: "Original_Meta" } },
          click.token,
        );
        assert.equal(
          (await client.query("SELECT count(*) FROM amp_ad_click_evidence"))
            .rows[0].count,
          "2",
        );
        const stored = (
          await client.query("SELECT token_digest FROM amp_ad_click_journeys")
        ).rows[0].token_digest;
        assert.notEqual(stored, click.token);
        assert.match(click.token, /^[a-f0-9]{64}$/);
        for (const kind of ["funding-request", "stripe-checkout"] as const) {
          const target = await order(client, kind);
          assert.equal(
            (
              await bindAdClicksToOrder(
                client,
                "amp|parent",
                click.token,
                target,
              )
            ).bound,
            2,
          );
          assert.equal(
            (
              await bindAdClicksToOrder(
                client,
                "amp|parent",
                click.token,
                target,
              )
            ).bound,
            0,
          );
          assert.deepEqual(
            (await orderClickEvidence(client, "amp|parent", target, "google"))
              ?.identifiers,
            {
              gclid: "Original_Google",
            },
          );
          assert.equal(
            (await orderClickEvidence(client, "amp|parent", target, "meta"))
              ?.observedAt,
            first.toISOString(),
          );
          assert.deepEqual(
            (await orderClickEvidence(client, "amp|parent", target, "meta"))
              ?.identifiers,
            { fbc: `fb.1.${+first}.Original_Meta` },
          );
          assert.equal(
            await orderClickEvidence(client, "amp|other", target, "google"),
            null,
          );
          await retainAdClick(
            client,
            { provider: "google", identifiers: { gclid: "Later_Click" } },
            click.token,
          );
          await bindAdClicksToOrder(client, "amp|parent", click.token, target);
          assert.deepEqual(
            (await orderClickEvidence(client, "amp|parent", target, "google"))
              ?.identifiers,
            {
              gclid: "Original_Google",
            },
          );
        }
      });
    }),
);
test(
  "foreign targets and shared-browser account changes cannot steal attribution",
  enabled,
  async () =>
    fixture(async (pool) => {
      await transaction(pool, async (client) => {
        const click = await retainAdClick(client, {
          provider: "google",
          identifiers: { gclid: "Owner_Click" },
        });
        const target = await order(client, "funding-request");
        await assert.rejects(
          bindAdClicksToOrder(client, "amp|other", click.token, target),
          /attribution_target_unavailable/,
        );
        await bindAdClicksToOrder(client, "amp|parent", click.token, target);
        const other = await order(client, "funding-request", "amp|other");
        assert.equal(
          (await bindAdClicksToOrder(client, "amp|other", click.token, other))
            .bound,
          0,
        );
        assert.equal(
          await orderClickEvidence(client, "amp|other", other, "google"),
          null,
        );
      });
    }),
);
test(
  "clicks after order creation do not backfill attribution; expired identifiers cannot return",
  enabled,
  async () =>
    fixture(async (pool) => {
      await transaction(pool, async (client) => {
        const old = await order(client, "stripe-checkout");
        await client.query(
          "UPDATE amp_stripe_checkouts SET created_at=clock_timestamp()-interval '1 hour' WHERE id=$1",
          [old.id],
        );
        const click = await retainAdClick(client, {
          provider: "google",
          identifiers: { gclid: "After_Order" },
        });
        assert.equal(
          (await bindAdClicksToOrder(client, "amp|parent", click.token, old))
            .bound,
          0,
        );
        const target = await order(client, "funding-request");
        await bindAdClicksToOrder(client, "amp|parent", click.token, target);
        await client.query(
          "UPDATE amp_ad_click_journeys SET created_at=statement_timestamp()-interval '91 days',expires_at=statement_timestamp()-interval '1 day'",
        );
        assert.equal(
          await orderClickEvidence(client, "amp|parent", target, "google"),
          null,
        );
        assert.equal(await purgeAdClickEvidence(client), 1);
        assert.equal(
          (await client.query("SELECT count(*) FROM amp_ad_click_evidence"))
            .rows[0].count,
          "0",
        );
        assert.equal(
          (
            await client.query(
              "SELECT click_id FROM amp_ad_order_attribution WHERE funding_request_id=$1",
              [target.id],
            )
          ).rows[0].click_id,
          null,
        );
        const later = await retainAdClick(client, {
          provider: "google",
          identifiers: { gclid: "Replacement" },
        });
        assert.equal(
          (await bindAdClicksToOrder(client, "amp|parent", later.token, target))
            .bound,
          0,
        );
      });
    }),
);

test(
  "provider erasure preserves the other recipient and prevents attribution refill",
  enabled,
  async () =>
    fixture(async (pool) => {
      await transaction(pool, async (client) => {
        const first = await retainAdClick(client, {
          provider: "google",
          identifiers: { gclid: "G_first" },
        });
        await retainAdClick(
          client,
          { provider: "google", identifiers: { gclid: "G_last" } },
          first.token,
        );
        await retainAdClick(
          client,
          { provider: "meta", identifiers: { fbclid: "M_first" } },
          first.token,
        );
        // Equal clocks must use insertion sequence, never random UUID ordering.
        await client.query(
          "UPDATE amp_ad_click_evidence SET first_observed_at=date_trunc('second',statement_timestamp()),observed_at=date_trunc('second',statement_timestamp())",
        );
        const target = await order(client, "funding-request");
        assert.equal(
          (await bindAdClicksToOrder(client, "amp|parent", first.token, target))
            .bound,
          2,
        );
        assert.deepEqual(
          (await orderClickEvidence(client, "amp|parent", target, "google"))
            ?.identifiers,
          { gclid: "G_last" },
        );
        assert.equal(await eraseAccountAdClicks(client, "amp|other"), 0);
        assert.equal(
          await eraseAccountAdClicks(client, "amp|parent", "google"),
          2,
        );
        assert.equal(
          await orderClickEvidence(client, "amp|parent", target, "google"),
          null,
        );
        assert.ok(
          await orderClickEvidence(client, "amp|parent", target, "meta"),
        );
        const next = await retainAdClick(
          client,
          { provider: "google", identifiers: { gclid: "Shared_Browser" } },
          first.token,
        );
        assert.notEqual(next.token, first.token);
        assert.equal(
          (await bindAdClicksToOrder(client, "amp|parent", next.token, target))
            .bound,
          0,
        );
        assert.equal(
          await orderClickEvidence(client, "amp|parent", target, "google"),
          null,
        );
        assert.equal(await eraseAccountAdClicks(client, "amp|parent"), 2);
      });
    }),
);

test(
  "bounded click history permits exact replay without changing timestamps",
  enabled,
  async () =>
    fixture(async (pool) => {
      await transaction(pool, async (client) => {
        const first = await retainAdClick(client, {
          provider: "google",
          identifiers: { gclid: "Click_0" },
        });
        for (let i = 1; i < 100; i++)
          await retainAdClick(
            client,
            { provider: "google", identifiers: { gclid: `Click_${i}` } },
            first.token,
          );
        await retainAdClick(
          client,
          { provider: "google", identifiers: { gclid: "Click_0" } },
          first.token,
        );
        await assert.rejects(
          retainAdClick(
            client,
            { provider: "google", identifiers: { gclid: "One_Too_Many" } },
            first.token,
          ),
          /click_history_limit/,
        );
        assert.equal(
          (await client.query("SELECT count(*) FROM amp_ad_click_evidence"))
            .rows[0].count,
          "100",
        );
      });
    }),
);

test(
  "cookie enrichment and safe handle rotation preserve the original click time",
  enabled,
  async () =>
    fixture(async (pool) => {
      await transaction(pool, async (client) => {
        const first = await retainAdClick(client, {
          provider: "meta",
          identifiers: { fbclid: "Same_Click" },
        });
        const original = new Date(Date.now() - 5000);
        await client.query(
          "UPDATE amp_ad_click_evidence SET first_observed_at=$1,observed_at=$1",
          [original],
        );
        const fbp = `fb.1.${+original + 1000}.1234`;
        await retainAdClick(
          client,
          { provider: "meta", identifiers: { fbclid: "Same_Click", fbp } },
          first.token,
        );
        const target = await order(client, "funding-request");
        await bindAdClicksToOrder(client, "amp|parent", first.token, target);
        assert.deepEqual(
          (await orderClickEvidence(client, "amp|parent", target, "meta"))
            ?.identifiers,
          { fbc: `fb.1.${+original}.Same_Click`, fbp },
        );
        const rotated = await retainAdClick(
          client,
          {
            provider: "meta",
            identifiers: {
              fbclid: "Same_Click",
              fbc: `fb.1.${+original + 2000}.Same_Click`,
              fbp,
            },
          },
          first.token,
        );
        assert.notEqual(rotated.token, first.token);
        const nextOrder = await order(client, "stripe-checkout");
        await bindAdClicksToOrder(
          client,
          "amp|parent",
          rotated.token,
          nextOrder,
        );
        assert.deepEqual(
          (await orderClickEvidence(client, "amp|parent", nextOrder, "meta"))
            ?.identifiers,
          { fbc: `fb.1.${+original}.Same_Click`, fbp },
        );
      });
    }),
);

test(
  "enriching an older click does not replace a newer acquisition",
  enabled,
  async () =>
    fixture(async (pool) => {
      await transaction(pool, async (client) => {
        const first = await retainAdClick(client, {
          provider: "meta",
          identifiers: { fbclid: "Older" },
        });
        await client.query(
          "UPDATE amp_ad_click_evidence SET first_observed_at=$1,observed_at=$1",
          [new Date(Date.now() - 5000)],
        );
        await retainAdClick(
          client,
          { provider: "meta", identifiers: { fbclid: "Newer" } },
          first.token,
        );
        await retainAdClick(
          client,
          {
            provider: "meta",
            identifiers: {
              fbclid: "Older",
              fbp: `fb.1.${Date.now() - 1000}.9876`,
            },
          },
          first.token,
        );
        const target = await order(client, "funding-request");
        await bindAdClicksToOrder(client, "amp|parent", first.token, target);
        const evidence = (await orderClickEvidence(
          client,
          "amp|parent",
          target,
          "meta",
        ))!;
        assert.ok("fbc" in evidence.identifiers);
        assert.match(evidence.identifiers.fbc!, /\.Newer$/);
      });
    }),
);

test(
  "retention duration stays absolute across a daylight-saving transition",
  enabled,
  async () =>
    fixture(async (pool) => {
      await transaction(pool, async (client) => {
        await client.query("SET LOCAL TIME ZONE 'America/New_York'");
        await client.query(
          "INSERT INTO amp_ad_click_journeys(id,token_digest,created_at,expires_at) VALUES($1,$2,'2026-01-01 00:00:00-05','2026-01-01 00:00:00-05'::timestamptz + interval '2160 hours')",
          [randomUUID(), "e".repeat(64)],
        );
      });
    }),
);
