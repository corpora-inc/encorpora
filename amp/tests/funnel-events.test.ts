import assert from "node:assert/strict";
import test from "node:test";
import {
  FUNNEL_EVENTS,
  SERVER_ONLY_EVENTS,
  eventBatchSchema,
  funnelPropsSchemas,
} from "../src/analytics/events";

const visitorId = "5b0a4c1e-8f43-4f0e-9a51-1c2d3e4f5a6b";
const batch = (events: unknown[]) =>
  eventBatchSchema.safeParse({ visitorId, events });

test("the vocabulary is exactly the issue's fixed list", () => {
  assert.deepEqual(
    Object.keys(funnelPropsSchemas).sort(),
    [...FUNNEL_EVENTS].sort(),
  );
  assert.equal(FUNNEL_EVENTS.length, 22);
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
