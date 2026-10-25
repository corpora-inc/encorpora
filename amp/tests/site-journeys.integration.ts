import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { buildApp } from "../src/server/app.js";
import { PostgresRepository } from "../src/server/repository.js";
import { registerAnalyticsRoutes } from "../src/analytics/routes.js";
import { engagementReport } from "../src/analytics/engagement-report.js";
import { purgeFunnelEvents } from "../src/analytics/retention.js";

const origin = "https://corpora.inc";
const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };

test(
  "marketing actions join AMP visits, preserve creative attribution, deduplicate and expire",
  enabled,
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_journey_${randomUUID().replaceAll("-", "")}`;
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
    const visitorId = randomUUID();
    const event = {
      event: "page_engagement",
      at: Date.now(),
      props: {
        sessionId: randomUUID(),
        pageId: randomUUID(),
        ordinal: 0,
        screen: "marketing_ar",
        activeMs: 12000,
        visibleMs: 15000,
      },
    };
    const action = {
      event: "site_action",
      at: Date.now(),
      props: {
        eventId: randomUUID(),
        screen: "marketing_ar",
        action: "invoice_open",
      },
    };
    const payload = {
      visitorId,
      traffic: "external",
      context: {
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "ar-product",
        utmContent: "founder",
        referrer: "search",
        device: "phone",
      },
      events: [event, action],
    };
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await registerAnalyticsRoutes(app, { pool: repository.pool, origin });
      const post = (
        body: object,
        headers: Record<string, string> = { origin },
      ) =>
        app.inject({
          method: "POST",
          url: "/api/v1/site-events",
          headers,
          payload: body,
        });
      assert.equal(
        (await post(payload, { origin: "https://unrelated.example" }))
          .statusCode,
        403,
      );
      assert.equal((await post(payload, {})).statusCode, 403);
      const preflight = await app.inject({
        method: "OPTIONS",
        url: "/api/v1/site-events",
        headers: { origin },
      });
      assert.equal(preflight.statusCode, 204);
      assert.equal(preflight.headers["access-control-allow-origin"], origin);
      assert.equal(
        preflight.headers["access-control-allow-credentials"],
        undefined,
      );
      for (const rejected of [
        { ...payload, trial: "synthetic-trial-token" },
        {
          ...payload,
          events: [{ event: "placement_answer", at: 1, props: { index: 1 } }],
        },
        {
          ...payload,
          events: [{ ...event, props: { ...event.props, screen: "practice" } }],
        },
        {
          ...payload,
          events: [
            {
              ...action,
              props: { ...action.props, email: "private@example.test" },
            },
          ],
        },
        {
          ...payload,
          events: [{ event: "purchase", at: 1, props: { interval: "year" } }],
        },
      ])
        assert.equal((await post(rejected)).statusCode, 400);
      for (const privacy of [
        { origin, "sec-gpc": "1" },
        { origin, dnt: "1" },
      ] as Record<string, string>[])
        assert.equal((await post(payload, privacy)).statusCode, 204);
      assert.equal(
        (
          await repository.pool.query(
            "SELECT count(*)::int n FROM amp_funnel_visitors",
          )
        ).rows[0].n,
        0,
      );
      assert.equal((await post(payload)).statusCode, 202);
      assert.equal((await post(payload)).statusCode, 202);
      const amp = await app.inject({
        method: "POST",
        url: "/api/v1/events",
        payload: {
          visitorId,
          traffic: "external",
          context: { referrer: "internal", device: "phone" },
          events: [
            {
              ...event,
              props: {
                ...event.props,
                sessionId: randomUUID(),
                pageId: randomUUID(),
                screen: "invoice",
              },
            },
          ],
        },
      });
      assert.equal(amp.statusCode, 202);
      const visitor = (
        await repository.pool.query("SELECT * FROM amp_funnel_visitors")
      ).rows[0];
      assert.equal(visitor.utm_source, "google");
      assert.equal(visitor.utm_content, "founder");
      assert.equal(
        (
          await repository.pool.query(
            "SELECT count(*)::int n FROM amp_journey_actions",
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await repository.pool.query(
            "SELECT count(*)::int n FROM amp_funnel_events",
          )
        ).rows[0].n,
        0,
      );
      const report = await engagementReport(repository.pool, 7);
      assert.equal(report.sources[0].creative, "founder");
      assert.equal(report.sources[0].browsers, 1);
      assert.equal(report.sources[0].document_sessions, 2);
      assert.equal(report.actions[0].action, "invoice_open");
      assert.equal(report.actions[0].actions, 1);
      assert.ok(
        report.journeys.some(
          (row) =>
            row.screen === "marketing_ar" && row.next_screen === "invoice",
        ),
      );
      assert.ok(!JSON.stringify(report).includes(visitorId));
      await post({ ...payload, traffic: "internal" });
      const excluded = await engagementReport(repository.pool, 7);
      assert.equal(excluded.sources.length, 0);
      assert.equal(excluded.actions.length, 0);
      assert.equal(excluded.journeys.length, 0);
      await repository.pool.query(
        "UPDATE amp_journey_actions SET occurred_on=CURRENT_DATE-100",
      );
      await repository.pool.query(
        "UPDATE amp_engagement_pages SET occurred_on=CURRENT_DATE-100",
      );
      // Expire old observations even when this browser continues visiting.
      await purgeFunnelEvents(repository.pool);
      assert.equal(
        (
          await repository.pool.query(
            "SELECT count(*)::int n FROM amp_journey_actions",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await repository.pool.query(
            "SELECT count(*)::int n FROM amp_engagement_pages",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await repository.pool.query(
            "SELECT count(*)::int n FROM amp_funnel_visitors",
          )
        ).rows[0].n,
        1,
      );
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
