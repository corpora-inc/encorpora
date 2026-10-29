import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { buildApp } from "../src/server/app.js";
import { PostgresRepository } from "../src/server/repository.js";
import {
  registerAnalyticsRoutes,
  EVENT_RATE_LIMIT,
} from "../src/analytics/routes.js";
import { purgeFunnelEvents } from "../src/analytics/retention.js";
import { funnelReport, formatFunnelReport } from "../src/analytics/report.js";
import {
  recordEventBatch,
  recordVerifiedPurchase,
  recordVerifiedRefund,
} from "../src/analytics/repository.js";
import { visitorJourneyReport } from "../src/analytics/visitor-journey-report.js";
import { FamilyRepository } from "../src/family/repository.js";
import { RETENTION } from "../src/privacy/retention-periods.js";

const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
const DAY = 86_400_000;

async function fixture(
  run: (f: { pool: Pool; app: ReturnType<typeof buildApp> }) => Promise<void>,
) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `amp_funnel_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  const repository = new PostgresRepository(scoped.href, { development: true });
  const app = buildApp({
    repository,
    development: true,
    authenticate: async () => "parent",
  });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    await registerAnalyticsRoutes(app, {
      pool: repository.pool,
      authenticate: async () => "parent",
    });
    await run({ pool: repository.pool, app });
  } finally {
    await app.close();
    await repository.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}

const post = (
  app: ReturnType<typeof buildApp>,
  payload: unknown,
  ip = "203.0.113.7",
) =>
  app.inject({
    method: "POST",
    url: "/api/v1/events",
    payload: payload as object,
    remoteAddress: ip,
  });
const count = async (pool: Pool, sql: string, args: unknown[] = []) =>
  (await pool.query(sql, args)).rows[0].n as number;

test(
  "events: writes a validated batch with first-touch attribution and a trial link",
  enabled,
  async () =>
    fixture(async ({ pool, app }) => {
      const trial = await app.inject({
        method: "POST",
        url: "/api/v1/trials",
        payload: { birthYear: new Date().getUTCFullYear() - 8 },
      });
      const { token } = trial.json();
      const visitorId = randomUUID();
      const sent = await post(app, {
        visitorId,
        trial: token,
        events: [
          {
            event: "landing_view",
            at: 1000,
            props: {
              utmSource: "Newsletter",
              utmCampaign: "fall",
              referrer: "email",
              device: "tablet",
            },
          },
          { event: "try_click", at: 2000 },
          { event: "placement_done", at: 3000, props: { gradeBand: "3" } },
        ],
      });
      assert.equal(sent.statusCode, 202);
      assert.deepEqual(sent.json(), { accepted: 3 });
      const visitor = (await pool.query("SELECT * FROM amp_funnel_visitors"))
        .rows[0];
      assert.equal(visitor.visitor_id, visitorId);
      assert.equal(visitor.utm_source, "newsletter");
      assert.equal(visitor.device, "tablet");
      assert.equal(visitor.grade_band, "3");
      assert.equal(visitor.age_band, "6-8");
      // The trial only lends its age band: no trial, account or learner key
      // is stored, so adopting the trial later joins nothing to this visitor.
      assert.deepEqual(Object.keys(visitor).sort(), [
        "age_band",
        "converted_on",
        "device",
        "first_seen",
        "grade_band",
        "last_seen",
        "referrer",
        "traffic_kind",
        "utm_campaign",
        "utm_content",
        "utm_medium",
        "utm_source",
        "visitor_id",
      ]);
      // A later visit from another campaign keeps the first touch.
      await post(app, {
        visitorId,
        events: [
          {
            event: "landing_view",
            at: 1,
            props: { utmSource: "ads", referrer: "search", device: "phone" },
          },
        ],
      });
      const again = (await pool.query("SELECT * FROM amp_funnel_visitors"))
        .rows[0];
      assert.equal(again.utm_source, "newsletter");
      assert.equal(again.referrer, "email");
      // The token itself is stored nowhere in funnel tables.
      const dump =
        JSON.stringify(
          (await pool.query("SELECT * FROM amp_funnel_events")).rows,
        ) +
        JSON.stringify(
          (await pool.query("SELECT * FROM amp_funnel_visitors")).rows,
        );
      assert.equal(dump.includes(token), false);
      assert.equal(
        (
          await pool.query("SELECT event FROM amp_funnel_events ORDER BY id")
        ).rows
          .map((r) => r.event)
          .join(","),
        "landing_view,try_click,placement_done,landing_view",
      );
    }),
);

test(
  "events: the vocabulary guard rejects unknown names, server-only events and free text",
  enabled,
  async () =>
    fixture(async ({ pool, app }) => {
      const visitorId = randomUUID();
      for (const events of [
        [{ event: "page_view", at: 1 }],
        [{ event: "purchase", at: 1, props: { interval: "year" } }],
        [{ event: "refund", at: 1, props: { full: true } }],
        [{ event: "try_click", at: 1, props: { email: "parent@example.com" } }],
        [{ event: "paywall_dismiss", at: 1, props: { reason: "free text" } }],
        Array.from({ length: 26 }, () => ({ event: "try_click", at: 1 })),
      ]) {
        const response = await post(app, { visitorId, events });
        assert.equal(response.statusCode, 400);
        assert.deepEqual(response.json(), { error: "invalid_events" });
      }
      assert.equal(
        (
          await post(app, {
            visitorId: "not-a-uuid",
            events: [{ event: "try_click", at: 1 }],
          })
        ).statusCode,
        400,
      );
      const big = await app.inject({
        method: "POST",
        url: "/api/v1/events",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({
          visitorId,
          events: [],
          pad: "x".repeat(9000),
        }),
      });
      assert.equal(big.statusCode, 413);
      assert.equal(
        await count(pool, "SELECT count(*)::int n FROM amp_funnel_events"),
        0,
      );
      // The database is a second guard against any other writer.
      await assert.rejects(
        pool.query(
          "INSERT INTO amp_funnel_events(event,occurred_on) VALUES('unknown_page',current_date)",
        ),
        /check constraint/,
      );
    }),
);

test("events: rate-limited per client address", enabled, async () =>
  fixture(async ({ app }) => {
    const body = {
      visitorId: randomUUID(),
      events: [{ event: "map_view", at: 1 }],
    };
    const codes: number[] = [];
    for (let i = 0; i <= EVENT_RATE_LIMIT; i++)
      codes.push((await post(app, body, "198.51.100.9")).statusCode);
    assert.equal(codes.filter((c) => c === 202).length, EVENT_RATE_LIMIT);
    assert.equal(codes.at(-1), 429);
    // Another address is unaffected.
    assert.equal((await post(app, body, "198.51.100.10")).statusCode, 202);
  }),
);

test(
  "retention: unconverted visitors go after 90 days; converted ones leave only aggregates",
  enabled,
  async () =>
    fixture(async ({ pool }) => {
      const now = new Date("2026-10-01T12:00:00Z");
      const old = new Date(
        now.getTime() - (RETENTION.funnelEventDays + 1) * DAY,
      );
      const recent = new Date(now.getTime() - 5 * DAY);
      const landing = {
        event: "landing_view" as const,
        at: 1,
        props: { referrer: "search" as const, device: "phone" as const },
      };
      const unconverted = randomUUID(),
        converted = randomUUID(),
        active = randomUUID();
      await recordEventBatch(
        pool,
        {
          visitorId: unconverted,
          events: [landing, { event: "try_click", at: 2, props: {} }],
        },
        old,
      );
      await recordEventBatch(
        pool,
        {
          visitorId: converted,
          events: [landing, { event: "plan_view", at: 2, props: {} }],
        },
        old,
      );
      await recordEventBatch(
        pool,
        { visitorId: active, events: [landing] },
        old,
      );
      await recordEventBatch(
        pool,
        {
          visitorId: active,
          events: [{ event: "map_view", at: 1, props: {} }],
        },
        recent,
      );
      const checkout = randomUUID();
      await pool.query(
        "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,request_id,created_at) VALUES($1,'test',$2,$3,$4)",
        [checkout, randomUUID(), randomUUID(), old],
      );
      await pool.query(
        "INSERT INTO amp_funnel_checkouts(checkout_id,visitor_id) VALUES($1,$2)",
        [checkout, converted],
      );
      await recordVerifiedPurchase(pool, checkout, "year", old);
      const result = await purgeFunnelEvents(pool, now);
      assert.deepEqual(result, {
        expiredFunnelEvents: 6,
        expiredFunnelVisitors: 2,
        expiredFunnelLinks: 0,
      });
      assert.deepEqual(
        (await pool.query("SELECT visitor_id,event FROM amp_funnel_events"))
          .rows,
        [{ visitor_id: active, event: "map_view" }],
      );
      assert.deepEqual(
        (await pool.query("SELECT visitor_id FROM amp_funnel_visitors")).rows,
        [{ visitor_id: active }],
      );
      const aggregates = (
        await pool.query(
          "SELECT event,source,device,count FROM amp_funnel_aggregates ORDER BY event",
        )
      ).rows;
      assert.deepEqual(aggregates, [
        { event: "landing_view", source: "search", device: "phone", count: 1 },
        { event: "plan_view", source: "search", device: "phone", count: 1 },
        { event: "purchase", source: "search", device: "phone", count: 1 },
      ]);
      assert.equal(JSON.stringify(aggregates).includes(converted), false);
      // A stale checkout link loses its visitor.
      const stale = randomUUID();
      await pool.query(
        "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,request_id,created_at) VALUES($1,'test',$2,$3,$4)",
        [stale, randomUUID(), randomUUID(), old],
      );
      await pool.query(
        "INSERT INTO amp_funnel_checkouts(checkout_id,visitor_id) VALUES($1,$2)",
        [stale, randomUUID()],
      );
      assert.equal((await purgeFunnelEvents(pool, now)).expiredFunnelLinks, 1);
      assert.deepEqual(await purgeFunnelEvents(pool, now), {
        expiredFunnelEvents: 0,
        expiredFunnelVisitors: 0,
        expiredFunnelLinks: 0,
      });
    }),
);

test(
  "report: conversion, drop-off, breakdowns, days to purchase, return visits, reasons and refunds",
  enabled,
  async () =>
    fixture(async ({ pool }) => {
      const start = new Date("2026-09-01T00:00:00Z");
      const visit = async (
        days: number,
        visitorId: string,
        events: { event: string; props?: object }[],
      ) =>
        recordEventBatch(
          pool,
          {
            visitorId,
            events: events.map((e, i) => ({
              event: e.event as "try_click",
              props: (e.props ?? {}) as Record<string, never>,
              at: i + 1,
            })),
          },
          new Date(start.getTime() + days * DAY + 3_600_000),
        );
      const buyer = randomUUID(),
        browser = randomUUID();
      await visit(0, buyer, [
        {
          event: "landing_view",
          props: { utmSource: "fall", referrer: "email", device: "phone" },
        },
        { event: "session_start", props: { daysSinceFirstVisit: 0 } },
        { event: "try_click" },
        { event: "placement_answer", props: { index: 0 } },
        { event: "placement_done", props: { gradeBand: "4", ageBand: "9-11" } },
        { event: "paywall_view", props: { reason: "limit" } },
        { event: "paywall_dismiss", props: { reason: "not-now" } },
      ]);
      await visit(3, buyer, [
        { event: "session_start", props: { daysSinceFirstVisit: 3 } },
        { event: "plan_view" },
        { event: "plan_select", props: { interval: "year" } },
        { event: "checkout_start", props: { interval: "year" } },
        { event: "checkout_return", props: { outcome: "success" } },
      ]);
      await visit(0, browser, [
        {
          event: "landing_view",
          props: { referrer: "search", device: "desktop" },
        },
        { event: "try_click" },
        { event: "paywall_view", props: { reason: "choice" } },
        { event: "paywall_dismiss", props: { reason: "price" } },
        { event: "checkout_return", props: { outcome: "cancel" } },
      ]);
      const checkout = randomUUID();
      await pool.query(
        "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,request_id) VALUES($1,'test',$2,$3)",
        [checkout, randomUUID(), randomUUID()],
      );
      await pool.query(
        "INSERT INTO amp_funnel_checkouts(checkout_id,visitor_id) VALUES($1,$2)",
        [checkout, buyer],
      );
      await recordVerifiedPurchase(
        pool,
        checkout,
        "year",
        new Date(start.getTime() + 3 * DAY + 7_200_000),
      );
      // Funnel times are whole days: nothing matches a billing timestamp.
      assert.deepEqual(
        (
          await pool.query(
            "SELECT DISTINCT data_type FROM information_schema.columns WHERE table_schema=current_schema() AND table_name LIKE 'amp_funnel_%' AND data_type LIKE 'timestamp%'",
          )
        ).rows,
        [],
      );
      // A partial refund that later becomes full is counted as full once.
      const refundDay = new Date(start.getTime() + 5 * DAY);
      assert.equal(
        await recordVerifiedRefund(pool, checkout, false, refundDay),
        true,
      );
      assert.equal(
        await recordVerifiedRefund(pool, checkout, false, refundDay),
        false,
      );
      assert.equal(
        await recordVerifiedRefund(pool, checkout, true, refundDay),
        true,
      );
      assert.equal(
        await recordVerifiedRefund(pool, checkout, true, refundDay),
        false,
      );
      const report = await funnelReport(pool, {
        from: start,
        to: new Date(start.getTime() + 30 * DAY),
      });
      const step = (e: string) => report.steps.find((s) => s.event === e)!;
      assert.equal(report.visitors, 2);
      assert.equal(step("landing_view").visitors, 2);
      assert.equal(step("try_click").fromPrevious, 1);
      assert.equal(
        step("checkout_return").visitors,
        1,
        "cancels are not progress",
      );
      assert.equal(step("purchase").visitors, 1);
      assert.equal(step("purchase").fromFirst, 0.5);
      assert.equal(step("placement_answer").dropOff, 1);
      assert.deepEqual(
        report.breakdowns.source.map((r) => [r.key, r.visitors, r.purchased]),
        [
          ["fall", 1, 1],
          ["search", 1, 0],
        ],
      );
      assert.deepEqual(
        report.breakdowns.gradeBand.map((r) => [r.key, r.purchased]),
        [
          ["4", 1],
          ["unknown", 0],
        ],
      );
      assert.equal(report.daysToPurchase.median, 3);
      assert.equal(report.returnVisits.returned, 1);
      assert.equal(report.returnVisits.within7Days, 1);
      assert.deepEqual(report.paywallDismissReasons, [
        { reason: "not-now", count: 1 },
        { reason: "price", count: 1 },
      ]);
      assert.equal(report.refunds.purchases, 1);
      assert.equal(report.refunds.refunds, 1, "one refunded purchase");
      assert.equal(report.refunds.fullRefunds, 1);
      const text = formatFunnelReport(report);
      assert.match(text, /purchase\s+1\s+/);
      assert.equal(text.includes(buyer), false, "aggregates only");
    }),
);

test(
  "engagement: deep-entry attribution, idempotent snapshots, customer filtering and expiry",
  enabled,
  async () =>
    fixture(async ({ pool, app }) => {
      const { engagementReport } =
        await import("../src/analytics/engagement-report.js");
      const external = randomUUID(),
        internal = randomUUID();
      const page = {
        sessionId: randomUUID(),
        pageId: randomUUID(),
        ordinal: 0,
        screen: "practice",
        visibleMs: 10000,
        activeMs: 9000,
      };
      const body = {
        visitorId: external,
        traffic: "external",
        context: {
          utmSource: "google",
          utmCampaign: "deep-entry",
          device: "phone",
          referrer: "search",
        },
        events: [{ event: "page_engagement", at: 1, props: page }],
      };
      assert.equal((await post(app, body)).statusCode, 202);
      assert.equal((await post(app, body)).statusCode, 202);
      assert.equal(
        (
          await post(app, {
            ...body,
            events: [
              {
                event: "page_engagement",
                at: 2,
                props: { ...page, visibleMs: 5000, activeMs: 4000 },
              },
            ],
          })
        ).statusCode,
        202,
      );
      const stored = (
        await pool.query(
          "SELECT visible_ms,active_ms FROM amp_engagement_pages",
        )
      ).rows;
      assert.deepEqual(stored, [{ visible_ms: 10000, active_ms: 9000 }]);
      const v = (
        await pool.query(
          "SELECT utm_source,utm_campaign,traffic_kind FROM amp_funnel_visitors",
        )
      ).rows[0];
      assert.deepEqual(v, {
        utm_source: "google",
        utm_campaign: "deep-entry",
        traffic_kind: "external",
      });
      await post(app, { ...body, visitorId: internal, traffic: "internal" });
      // Marking a known internal browser external later must not leak its prior tests into customer totals.
      await post(app, { ...body, visitorId: internal });
      let report = await engagementReport(pool, 7);
      assert.equal(report.screens.length, 1);
      assert.equal(report.screens[0].browsers, 1);
      assert.equal(report.screens[0].active_seconds, 9);
      assert.equal(report.sources[0].source, "google");
      assert.equal(
        report.coverage.find((r) => r.traffic_kind === "internal")?.browsers,
        1,
      );
      // First touch survives later direct navigation.
      await post(app, {
        ...body,
        context: { device: "phone", referrer: "direct" },
      });
      assert.equal(
        (await engagementReport(pool, 7)).sources[0].source,
        "google",
      );
      const now = new Date(),
        to = new Date(now.getTime() + DAY),
        from = new Date(now.getTime() - DAY);
      assert.equal((await funnelReport(pool, { from, to })).visitors, 1);
      await purgeFunnelEvents(
        pool,
        new Date(now.getTime() + (RETENTION.funnelEventDays + 1) * DAY),
      );
      assert.equal(
        await count(pool, "SELECT count(*)::int n FROM amp_engagement_pages"),
        0,
      );
      assert.equal(
        await count(pool, "SELECT count(*)::int n FROM amp_funnel_visitors"),
        0,
      );
    }),
);

test(
  "purchase attempts retain campaign outcomes without counting retries or staff as customers",
  enabled,
  async () =>
    fixture(async ({ pool, app }) => {
      const props = {
        attemptId: randomUUID(),
        stage: "funded_invoice",
        outcome: "failed",
        failure: "network",
      };
      const body = {
        visitorId: randomUUID(),
        traffic: "external",
        context: {
          utmSource: "facebook",
          utmMedium: "paid-social",
          utmCampaign: "ar-efa-launch",
          device: "phone",
          referrer: "social",
        },
        events: [{ event: "purchase_attempt", props, at: 1 }],
      };
      assert.equal((await post(app, body)).statusCode, 202);
      assert.equal((await post(app, body)).statusCode, 202);
      assert.equal(
        (
          await post(app, {
            ...body,
            visitorId: randomUUID(),
            traffic: "internal",
          })
        ).statusCode,
        202,
      );
      const { engagementReport } =
        await import("../src/analytics/engagement-report.js");
      const actionBody = {
        ...body,
        events: [
          {
            event: "purchase_action",
            at: 2,
            props: { actionId: randomUUID(), action: "document_download" },
          },
        ],
      };
      assert.equal((await post(app, actionBody)).statusCode, 202);
      assert.equal((await post(app, actionBody)).statusCode, 202);
      assert.equal(
        (
          await post(app, {
            ...actionBody,
            visitorId: randomUUID(),
            traffic: "internal",
          })
        ).statusCode,
        202,
      );
      const report = await engagementReport(pool, 7);
      assert.equal(report.purchaseActions.length, 1);
      assert.equal(report.purchaseActions[0].clicks, 1);
      assert.equal(report.purchaseActions[0].browsers, 1);
      assert.deepEqual(report.purchaseAttempts, [
        {
          stage: "funded_invoice",
          outcome: "failed",
          failure: "network",
          source: "facebook",
          medium: "paid-social",
          campaign: "ar-efa-launch",
          creative: "none",
          attempts: 1,
          browsers: 1,
        },
      ]);
      assert.equal(
        await count(
          pool,
          "SELECT count(*)::int n FROM amp_funnel_events WHERE event='purchase'",
        ),
        0,
      );
    }),
);

test(
  "card purchase campaign report counts verified sales, preserves first touch and excludes staff",
  enabled,
  async () =>
    fixture(async ({ pool }) => {
      const { engagementReport } =
        await import("../src/analytics/engagement-report.js");
      const buyer = randomUUID(),
        staff = randomUUID(),
        automated = randomUUID();
      for (const [visitorId, traffic] of [
        [buyer, "external"],
        [staff, "internal"],
        [automated, "automated"],
      ] as const) {
        await recordEventBatch(pool, {
          visitorId,
          traffic,
          context: {
            utmSource: "google",
            utmMedium: "cpc",
            utmCampaign: "az-math",
            utmContent: "founder",
            referrer: "search",
            device: "phone",
          },
          events: [{ event: "try_click", props: {}, at: 1 }],
        });
      }
      // Purchase-window reporting includes visitors who first arrived earlier.
      await pool.query(
        "UPDATE amp_funnel_visitors SET first_seen=CURRENT_DATE-30 WHERE visitor_id=$1",
        [buyer],
      );
      // A later campaign must not overwrite the buyer's first-touch tuple.
      await recordEventBatch(pool, {
        visitorId: buyer,
        context: {
          utmSource: "facebook",
          utmMedium: "social",
          utmCampaign: "later-campaign",
          utmContent: "demo",
          referrer: "social",
          device: "phone",
        },
        events: [
          { event: "checkout_return", props: { outcome: "success" }, at: 1 },
        ],
      });
      const paid = async (visitorId: string | null, when = new Date()) => {
        const checkout = randomUUID();
        await pool.query(
          "INSERT INTO amp_stripe_checkouts(id,namespace,account_id,request_id) VALUES($1,'test',$2,$3)",
          [checkout, randomUUID(), randomUUID()],
        );
        if (visitorId)
          await pool.query(
            "INSERT INTO amp_funnel_checkouts(checkout_id,visitor_id) VALUES($1,$2)",
            [checkout, visitorId],
          );
        assert.equal(
          await recordVerifiedPurchase(pool, checkout, "year", when),
          true,
        );
        assert.equal(
          await recordVerifiedPurchase(pool, checkout, "year", when),
          false,
        );
      };
      await paid(buyer);
      await paid(buyer);
      await paid(staff);
      await paid(automated);
      await paid(null);
      await paid(buyer, new Date(Date.now() - 30 * DAY));
      const report = await engagementReport(pool, 7);
      assert.deepEqual(report.cardPurchases, [
        {
          source: "google",
          medium: "cpc",
          campaign: "az-math",
          creative: "founder",
          interval: "year",
          purchases: 2,
          browsers: 1,
        },
        {
          source: "unattributed",
          medium: "none",
          campaign: "none",
          creative: "none",
          interval: "year",
          purchases: 1,
          browsers: 0,
        },
      ]);
    }),
);

test(
  "journey envelopes deduplicate and require matching authenticated scope",
  enabled,
  async () => {
    await fixture(async ({ pool, app }) => {
      const visitorId = randomUUID(),
        id = randomUUID(),
        sessionId = randomUUID();
      const at = Date.now() - 5000;
      const batch = {
        visitorId,
        accountScope: "parent",
        accountGeneration: "initial" as const,
        events: [
          {
            id,
            sessionId,
            at,
            event: "page_view",
            props: { screen: "auth", page: "sign-up" },
          },
        ],
      };
      assert.equal((await post(app, batch)).statusCode, 202);
      assert.equal((await post(app, batch)).statusCode, 202);
      const rows = (await pool.query("SELECT * FROM amp_visitor_journeys"))
        .rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].account_id, "parent");
      assert.equal(rows[0].client_at.getTime(), at);
      assert.equal(
        await count(pool, "SELECT count(*)::int AS n FROM amp_funnel_events"),
        1,
      );
      await post(app, {
        ...batch,
        accountScope: "another-parent",
        events: [{ ...batch.events[0], id: randomUUID() }],
      });
      assert.equal(
        await count(
          pool,
          "SELECT count(*)::int AS n FROM amp_visitor_journeys",
        ),
        1,
      );
      await post(app, {
        ...batch,
        accountScope: undefined,
        events: [{ ...batch.events[0], id: randomUUID() }],
      });
      assert.equal(
        await count(
          pool,
          "SELECT count(*)::int AS n FROM amp_visitor_journeys WHERE account_id IS NULL",
        ),
        1,
      );
    });
  },
);
test(
  "erasure generation rejects skewed-clock retries and retention expires details",
  enabled,
  async () => {
    await fixture(async ({ pool, app }) => {
      const visitorId = randomUUID();
      const batch = {
        visitorId,
        accountScope: "parent",
        accountGeneration: "initial" as const,
        events: [
          {
            id: randomUUID(),
            sessionId: randomUUID(),
            at: Date.now() + 300000,
            event: "plan_view",
            props: {},
          },
        ],
      };
      await post(app, batch);
      await pool.query(
        "INSERT INTO amp_journey_generations VALUES('parent',gen_random_uuid())",
      );
      await pool.query(
        "DELETE FROM amp_visitor_journeys WHERE account_id='parent'",
      );
      await post(app, batch);
      assert.equal(
        await count(
          pool,
          "SELECT count(*)::int AS n FROM amp_visitor_journeys",
        ),
        0,
      );
      const context = await app.inject({
        method: "GET",
        url: "/api/v1/events/context",
      });
      assert.equal(context.statusCode, 200);
      assert.equal(context.headers["cache-control"], "no-store");
      await post(app, {
        ...batch,
        accountGeneration: context.json().generation,
        events: [{ ...batch.events[0], id: randomUUID() }],
      });
      assert.equal(
        await count(
          pool,
          "SELECT count(*)::int AS n FROM amp_visitor_journeys WHERE account_id='parent'",
        ),
        1,
      );
      await post(app, {
        ...batch,
        accountScope: undefined,
        events: [{ ...batch.events[0], id: randomUUID() }],
      });
      await purgeFunnelEvents(pool, new Date(Date.now() + 92 * 86400000));
      assert.equal(
        await count(
          pool,
          "SELECT count(*)::int AS n FROM amp_visitor_journeys",
        ),
        0,
      );
      assert.equal(
        await count(
          pool,
          "SELECT count(*)::int AS n FROM amp_journey_generations",
        ),
        1,
      );
    });
  },
);

test(
  "private timeline distinguishes anonymous events and exports/deletes account detail",
  enabled,
  async () => {
    await fixture(async ({ pool }) => {
      await pool.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified") VALUES('journey','Synthetic','journey@example.test',true)`,
      );
      const visitorId = randomUUID(),
        sessionId = randomUUID();
      const envelope = (event: "plan_view" | "map_view") => ({
        visitorId,
        events: [
          { id: randomUUID(), sessionId, at: Date.now(), event, props: {} },
        ],
      });
      await recordEventBatch(pool, envelope("map_view"));
      await recordEventBatch(
        pool,
        envelope("plan_view"),
        new Date(),
        "amp|journey",
      );
      const report = await visitorJourneyReport(pool, {
        email: "journey@example.test",
      });
      assert.ok(report.timeline.some((e) => e.event === "plan_view"));
      assert.ok(!report.timeline.some((e) => e.event === "map_view"));
      assert.equal(report.browsers.length, 1);
      const family = new FamilyRepository(pool);
      let exported = "";
      for await (const line of family.export("amp|journey")) exported += line;
      assert.match(exported, /journey-event/);
      assert.doesNotMatch(exported, /map_view/);
      await family.deleteLearning("amp|journey");
      assert.equal(
        await count(
          pool,
          "SELECT count(*)::int AS n FROM amp_visitor_journeys WHERE account_id='amp|journey'",
        ),
        0,
      );
      assert.equal(
        await count(
          pool,
          "SELECT count(*)::int AS n FROM amp_journey_generations WHERE account_id='amp|journey'",
        ),
        1,
      );
    });
  },
);
