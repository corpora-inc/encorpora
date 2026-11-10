import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { buildApp } from "../src/server/app.js";
import { PostgresRepository } from "../src/server/repository.js";
import { registerAnalyticsRoutes } from "../src/analytics/routes.js";
import { engagementReport } from "../src/analytics/engagement-report.js";
import { errorOrigin } from "../src/analytics/error-origin.js";

const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };

test(
  "reports show AMP's errors apart from the in-app browsers' own, by browser",
  enabled,
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_errors_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const app = buildApp({
      repository,
      development: true,
      authenticate: async () => "parent",
    });
    const errors = [
      {
        kind: "render",
        boundary: "caught",
        exception: "TypeError",
        category: "runtime",
        source: "app",
        asset: "index-ABCdef12.js",
        line: 68,
        column: 61065,
        screen: "home",
        browser: "inapp-instagram",
      },
      {
        kind: "error",
        exception: "Error",
        category: "runtime",
        source: "external",
        screen: "pitch",
        browser: "inapp-tiktok",
      },
      {
        kind: "error",
        exception: "unknown",
        category: "unknown",
        source: "external",
        screen: "pitch",
        browser: "inapp-tiktok",
      },
      {
        kind: "error",
        exception: "ReferenceError",
        category: "runtime",
        source: "inline",
        screen: "pitch",
        browser: "inapp-facebook",
      },
      {
        kind: "unhandled_rejection",
        exception: "Error",
        category: "runtime",
        screen: "pitch",
        browser: "standard",
      },
      // A client from before the browser was recorded.
      {
        kind: "error",
        source: "app",
        asset: "index-ABCdef12.js",
        screen: "auth",
      },
    ];
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await registerAnalyticsRoutes(app, { pool: repository.pool });
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/events",
        payload: {
          visitorId: randomUUID(),
          traffic: "external",
          context: { referrer: "social", device: "phone" },
          events: [
            {
              event: "landing_view",
              at: Date.now(),
              id: randomUUID(),
              sessionId: randomUUID(),
              props: {
                referrer: "social",
                device: "phone",
                browser: "inapp-tiktok",
              },
            },
            ...errors.map((props) => ({
              event: "client_error",
              at: Date.now(),
              id: randomUUID(),
              sessionId: randomUUID(),
              props,
            })),
          ],
        },
      });
      assert.equal(response.statusCode, 202, response.body);
      const report = await engagementReport(repository.pool, 7);
      assert.deepEqual(
        report.ourErrors.map((row) => [
          row.browser,
          row.kind,
          row.asset,
          row.line,
          row.column,
        ]),
        [
          ["inapp-instagram", "render", "index-ABCdef12.js", 68, 61065],
          ["unknown", "error", "index-ABCdef12.js", null, null],
        ],
      );
      assert.deepEqual(
        report.externalErrors
          .map((row) => [row.browser, row.source, row.asset, row.errors])
          .sort(),
        [
          ["inapp-facebook", "inline", null, 1],
          ["inapp-tiktok", "external", null, 1],
          ["inapp-tiktok", "external", null, 1],
        ],
      );
      assert.deepEqual(
        report.unattributedErrors.map((row) => [row.browser, row.kind]),
        [["standard", "unhandled_rejection"]],
      );
      // The SQL and the shared rule agree on every row.
      const rows = {
        ours: report.ourErrors,
        external: report.externalErrors,
        unattributed: report.unattributedErrors,
      };
      for (const props of errors)
        assert.ok(
          rows[errorOrigin(props)].some(
            (row) => row.kind === props.kind && row.screen === props.screen,
          ),
          JSON.stringify(props),
        );
      const landing = await repository.pool.query(
        "SELECT props FROM amp_funnel_events WHERE event='landing_view'",
      );
      assert.equal(landing.rows[0].props.browser, "inapp-tiktok");
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
