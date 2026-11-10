import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import Fastify from "fastify";
import {
  EVENT_MAX_IN_FLIGHT,
  registerAnalyticsRoutes,
} from "../src/analytics/routes";
import {
  FUNNEL_EVENTS,
  SERVER_ONLY_EVENTS,
  eventBatchSchema,
  funnelPropsSchemas,
} from "../src/analytics/events";

const visitorId = "5b0a4c1e-8f43-4f0e-9a51-1c2d3e4f5a6b";
const batch = (events: unknown[]) =>
  eventBatchSchema.safeParse({ visitorId, events });

test("the transport contains the fixed milestones and separate engagement and marketing actions", () => {
  assert.deepEqual(
    Object.keys(funnelPropsSchemas).sort(),
    [...FUNNEL_EVENTS, "page_engagement", "site_action"].sort(),
  );
  assert.equal(FUNNEL_EVENTS.length, 46);
});

test("pitch events carry only their fixed choices", () => {
  assert.ok(
    batch([
      { event: "pitch_view", at: 1 },
      { event: "pitch_view", at: 2, props: { program: "az-esa" } },
      { event: "video_play", at: 3 },
      { event: "video_progress", at: 4, props: { percent: 75 } },
      { event: "video_play", at: 3, props: { mix: "b" } },
      { event: "video_progress", at: 4, props: { percent: 75, mix: "b" } },
      { event: "buy_click", at: 5, props: { path: "funded" } },
      { event: "buy_click", at: 6, props: { path: "card" } },
      { event: "workbook_click", at: 7 },
      { event: "buy_click", at: 8, props: { path: "card", from: "chrome" } },
      { event: "invite_view", at: 9, props: { at: "workbook" } },
      { event: "video_seconds", at: 10, props: { seconds: 3 } },
      { event: "video_seconds", at: 11, props: { seconds: 30, mix: "c" } },
      { event: "first_interaction", at: 12, props: { kind: "pointer" } },
      { event: "pitch_buy_seen", at: 13 },
    ]).success,
  );
  for (const bad of [
    { event: "pitch_view", at: 1, props: { program: "tx-esa" } },
    { event: "video_progress", at: 1, props: { percent: 30 } },
    { event: "video_play", at: 1, props: { mix: "z" } },
    { event: "video_progress", at: 1, props: { percent: 25, mix: "z" } },
    { event: "video_progress", at: 1 },
    { event: "buy_click", at: 1, props: { path: "paypal" } },
    { event: "workbook_click", at: 1, props: { grade: "3" } },
    { event: "buy_click", at: 1, props: { path: "card", from: "email" } },
    { event: "invite_view", at: 1, props: { at: "paywall" } },
    { event: "video_seconds", at: 1, props: { seconds: 7 } },
    { event: "video_seconds", at: 1, props: { seconds: 3, mix: "z" } },
    { event: "first_interaction", at: 1, props: { kind: "typed text" } },
    { event: "first_interaction", at: 1 },
    { event: "pitch_buy_seen", at: 1, props: { top: 700 } },
  ])
    assert.equal(batch([bad]).success, false, JSON.stringify(bad));
});

test("accepts known events with valid props", () => {
  const parsed = batch([
    {
      event: "landing_view",
      at: 1,
      props: { referrer: "search", device: "phone", utmSource: "News" },
    },
    { event: "try_click", at: 2 },
    { event: "placement_done", at: 3, props: { gradeBand: "3" } },
    { event: "checkout_return", at: 4, props: { outcome: "cancel" } },
  ]);
  assert.ok(parsed.success);
  assert.equal(
    (parsed.data.events[0].props as { utmSource?: string }).utmSource,
    "news",
  );
});

test("rejects unknown names, server-only events, extra and free-text props", () => {
  assert.equal(batch([{ event: "page_view", at: 1 }]).success, false);
  for (const event of SERVER_ONLY_EVENTS)
    assert.equal(
      batch([{ event, at: 1, props: { interval: "year", full: true } }])
        .success,
      false,
    );
  assert.equal(
    batch([{ event: "try_click", at: 1, props: { email: "a@b.c" } }]).success,
    false,
  );
  assert.equal(
    batch([
      {
        event: "landing_view",
        at: 1,
        props: { referrer: "search", device: "phone", utmSource: "has space" },
      },
    ]).success,
    false,
  );
  assert.equal(
    batch([
      { event: "paywall_dismiss", at: 1, props: { reason: "my kid hates it" } },
    ]).success,
    false,
  );
});

test("bounds the batch and the visitor ID", () => {
  assert.equal(batch([]).success, false);
  assert.equal(
    batch(Array.from({ length: 26 }, () => ({ event: "try_click", at: 1 })))
      .success,
    false,
  );
  assert.equal(
    eventBatchSchema.safeParse({
      visitorId: "parent@example.com",
      events: [{ event: "try_click", at: 1 }],
    }).success,
    false,
  );
});

test("the database guard lists exactly the same vocabulary", () => {
  // The newest migration that sets the event check is the one in force.
  const directory = new URL("../migrations/", import.meta.url);
  const list = readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map(
      (name) =>
        /CHECK \(event IN \(([^)]*)\)\)/.exec(
          readFileSync(new URL(name, directory), "utf8"),
        )?.[1],
    )
    .filter((found) => found !== undefined)
    .at(-1);
  assert.ok(list);
  assert.deepEqual(
    list.split(",").map((name) => name.trim().replaceAll("'", "")),
    [...FUNNEL_EVENTS],
  );
});

test("the endpoint holds at most a few database connections", async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const client = {
    query: async () => ({ rows: [], rowCount: 0 }),
    release: () => {},
  };
  const pool = { connect: () => held.then(() => client) };
  const app = Fastify();
  await registerAnalyticsRoutes(app, { pool: pool as never });
  const send = () =>
    app.inject({
      method: "POST",
      url: "/api/v1/events",
      payload: { visitorId, events: [{ event: "map_view", at: 1 }] },
    });
  const waiting = Array.from({ length: EVENT_MAX_IN_FLIGHT }, send);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal((await send()).statusCode, 503);
  release();
  for (const response of await Promise.all(waiting))
    assert.equal(response.statusCode, 202);
  assert.equal((await send()).statusCode, 202);
  await app.close();
});
