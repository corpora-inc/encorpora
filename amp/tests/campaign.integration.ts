import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import { migrate } from "../scripts/migrate";
import { registerCampaignRoutes } from "../src/analytics/campaign-routes";

test(
  "campaign POST persists counts without creating visitor or invoice records",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `campaign_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
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
      assert.equal(
        (await pool.query("SELECT count(*) FROM amp_funnel_visitors")).rows[0]
          .count,
        "0",
      );
    } finally {
      await app.close();
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
