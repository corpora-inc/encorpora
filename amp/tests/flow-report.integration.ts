import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { flowReport, formatFlowReport } from "../src/analytics/flow-report.js";

const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };

test(
  "the flow separates people from scanners and shows where people stop",
  enabled,
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_flow_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({ connectionString: scoped.href, max: 2 });
    try {
      await migrate(scoped.href);
      const visitor = async (
        labels: {
          source: string;
          medium?: string;
          device?: string;
          kind?: string;
        },
        events: [string, object?][],
        visibleMs?: number,
        screen = "pitch",
      ) => {
        const id = randomUUID();
        await pool.query(
          `INSERT INTO amp_funnel_visitors(visitor_id,first_seen,last_seen,utm_source,utm_medium,device,traffic_kind)
         VALUES ($1,CURRENT_DATE,CURRENT_DATE,$2,$3,$4,$5)`,
          [
            id,
            labels.source,
            labels.medium ?? null,
            labels.device ?? "phone",
            labels.kind ?? "external",
          ],
        );
        for (const [event, props] of [
          ["pitch_view"] as [string, object?],
          ...events,
        ])
          await pool.query(
            `INSERT INTO amp_funnel_events(visitor_id,event,props,occurred_on) VALUES ($1,$2,$3,CURRENT_DATE)`,
            [id, event, JSON.stringify(props ?? {})],
          );
        if (visibleMs !== undefined)
          await pool.query(
            `INSERT INTO amp_engagement_pages(visitor_id,page_id,session_id,ordinal,screen,occurred_on,visible_ms,active_ms)
           VALUES ($1,$2,$3,0,$4,CURRENT_DATE,$5,$5)`,
            [id, randomUUID(), randomUUID(), screen, visibleMs],
          );
      };
      // A scanner: loads, clicks Buy instantly, no time and no input.
      await visitor(
        { source: "facebook" },
        [["buy_click", { path: "funded" }]],
        0,
      );
      // A bounce with a little time.
      await visitor({ source: "google", medium: "cpc" }, [], 1200);
      // A parent who read but never played, then saw Buy.
      await visitor(
        { source: "google", medium: "cpc" },
        [["first_interaction", { kind: "pointer" }], ["pitch_buy_seen"]],
        20_000,
      );
      // A parent who watched 10 s then tried it, and reached a first problem.
      await visitor(
        { source: "google", medium: "cpc" },
        [
          ["first_interaction", { kind: "pointer" }],
          ["video_play", { mix: "b" }],
          ["video_seconds", { seconds: 3, mix: "b" }],
          ["video_seconds", { seconds: 10, mix: "b" }],
          ["try_click"],
          ["account_session"],
          ["trial_problem_view"],
        ],
        60_000,
        "practice",
      );
      // A parent who finished the film on desktop and bought with funds.
      await visitor(
        { source: "direct", device: "desktop" },
        [
          ["video_play", { mix: "a" }],
          ["video_seconds", { seconds: 30, mix: "a" }],
          ["video_progress", { percent: 100, mix: "a" }],
          ["buy_click", { path: "funded" }],
        ],
        170_000,
        "invoice",
      );
      // Excluded: our own automated checks.
      await visitor(
        { source: "google", kind: "automated" },
        [["video_play"]],
        5000,
      );

      const report = await flowReport(pool, { days: 1 });
      assert.equal(report.overall.landed, 5);
      assert.equal(report.overall.stayed, 3);
      assert.equal(report.overall.tooFast, 1);
      assert.equal(report.overall.played, 2);
      assert.equal(report.overall.interacted, 2);
      assert.equal(report.overall.sawBuy, 1);
      assert.equal(report.overall.tried, 1);
      assert.equal(
        report.overall.buyFunded,
        1,
        "the scanner's Buy isn't a person's",
      );
      assert.equal(report.overall.invoice, 1);
      assert.equal(report.overall.watch["video_seconds:10"], 1);
      assert.equal(report.overall.watch["video_progress:100"], 1);
      assert.equal(report.overall.medianStaySeconds, 60);

      const source = (name: string) =>
        report.bySource.find((r) => r.name === name)!;
      assert.equal(source("google / cpc").landed, 3);
      assert.equal(source("google / cpc").stayed, 2);
      assert.equal(source("facebook / none").stayed, 0);
      assert.deepEqual(report.byMix.map((r) => r.name).sort(), ["a", "b"]);
      const furthest = (step: string) =>
        report.furthest.find((r) => r.step === step)!.people;
      assert.equal(furthest("stayed"), 1);
      assert.equal(furthest("trial_problem_view"), 1);
      assert.equal(furthest("invoice"), 1);
      assert.equal(
        report.stay.find((r) => r.name === "no time recorded")!.browsers,
        1,
      );
      assert.equal(
        report.stay.find((r) => r.name === "under 3 s")!.browsers,
        1,
      );
      assert.deepEqual(report.lastScreen.map((r) => r.screen).sort(), [
        "invoice",
        "pitch",
        "practice",
      ]);
      assert.match(formatFlowReport(report), /Where people stopped/);
      assert.doesNotMatch(
        JSON.stringify(report),
        /[0-9a-f]{8}-[0-9a-f]{4}-/,
        "no visitor IDs",
      );
      await assert.rejects(flowReport(pool, { days: 0 }));
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
