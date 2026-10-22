import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { migrate } from "../scripts/migrate";
import { arkansasOrderSummary } from "../src/analytics/campaign-orders";
import { registerCampaignRoutes } from "../src/analytics/campaign-routes";

test(
  "campaign POST persists counts without creating visitor or invoice records",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `campaign_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set(
      "options",
      `-c search_path=${schema} -c timezone=Pacific/Honolulu`,
    );
    const pool = new Pool({ connectionString: scoped.href });
    const app = Fastify();
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await registerCampaignRoutes(app, {
        pool,
        origin: "https://example.test",
      });
      const payload = {
        state: "AR",
        program: "arkansas-efa",
        campaign: "ar-efa-launch",
        source: "facebook",
        medium: "paid-social",
        action: "invoice_click",
      };
      for (let i = 0; i < 2; i++)
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/api/v1/campaign-events",
              headers: { origin: "https://example.test" },
              payload,
            })
          ).statusCode,
          202,
        );
      const rows = (
        await pool.query("SELECT action,count FROM amp_campaign_daily")
      ).rows;
      assert.deepEqual(rows, [{ action: "invoice_click", count: "2" }]);
      for (const creative of [
        "efa-facebook-feed-v1",
        "efa-facebook-feed-v1",
        "efa-facebook-vertical-v1",
      ]) {
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: "/api/v1/campaign-events",
              headers: { origin: "https://example.test" },
              payload: { ...payload, creative },
            })
          ).statusCode,
          202,
        );
      }
      assert.deepEqual(
        (
          await pool.query(
            "SELECT creative,count FROM amp_campaign_creative_daily ORDER BY creative",
          )
        ).rows,
        [
          { creative: "efa-facebook-feed-v1", count: "2" },
          { creative: "efa-facebook-vertical-v1", count: "1" },
        ],
      );
      assert.equal(
        (await pool.query("SELECT count FROM amp_campaign_daily")).rows[0]
          .count,
        "5",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM amp_campaign_creative_daily WHERE day != (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (await pool.query("SELECT count(*) FROM amp_funnel_visitors")).rows[0]
          .count,
        "0",
      );
      await pool.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES('fixture-learner','fixture-parent','Test')",
      );
      for (const [id, programId, jurisdiction, status] of [
        ["ar-ready", "ar-efa", "AR", "prepared"],
        ["ar-submitted", "ar-efa", "AR", "parent-reported-submitted"],
        ["other", "fl-pep", "FL", "prepared"],
        ["wrong-state", "ar-efa", "GA", "prepared"],
      ]) {
        await pool.query(
          `INSERT INTO amp_funding_requests(id,account_id,learner_id,idempotency_key,offer_id,offer_revision,offer_snapshot,status,created_at,expires_at)
        VALUES($1,'fixture-parent','fixture-learner',$2,'fixture-offer','1',$3,$4,now(),now()+interval '1 day')`,
          [
            id,
            randomUUID(),
            JSON.stringify({ programId, jurisdiction }),
            status,
          ],
        );
      }
      const order = {
        id: "fixture-order",
        account: { id: "fixture-parent" },
        license: { accountId: "fixture-parent", learnerId: "fixture-learner" },
        channel: "esa",
        channelReference: "fixture-program",
        externalOrderId: "fixture-external",
        approval: "approved",
        settlement: "settled",
        refund: "completed",
      };
      await pool.query(
        `INSERT INTO amp_commerce_orders(id,account_id,learner_id,channel,channel_reference,external_order_id,order_state) VALUES('fixture-order','fixture-parent','fixture-learner','esa','fixture-program','fixture-external',$1)`,
        [JSON.stringify(order)],
      );
      await pool.query(
        `UPDATE amp_funding_requests SET order_id='fixture-order',conversion_payload='{}' WHERE id='ar-submitted'`,
      );
      const summary = await arkansasOrderSummary(pool, 30);
      assert.equal(summary.prepared_request_records, 2);
      assert.equal(summary.parent_reported_submitted, 1);
      assert.equal(summary.linked_esa_orders, 1);
      assert.equal(summary.settled_orders, 1);
      assert.equal(summary.refunded_orders, 1);
      assert.equal(summary.issued_license_orders, 0);
      await pool.query(
        `INSERT INTO amp_funding_requests(id,account_id,learner_id,idempotency_key,offer_id,offer_revision,offer_snapshot,status,created_at,expires_at)
      SELECT 'utc-boundary',account_id,learner_id,$1,offer_id,offer_revision,offer_snapshot,status,
      ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date)::timestamp AT TIME ZONE 'UTC',expires_at
      FROM amp_funding_requests WHERE id='ar-ready'`,
        [randomUUID()],
      );
      assert.equal(
        (await arkansasOrderSummary(pool, 1)).prepared_request_records,
        3,
      );
    } finally {
      await app.close();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
