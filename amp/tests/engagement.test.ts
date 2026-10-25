import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  EngagementClock,
  engagementSchema,
  screenForPath,
} from "../src/analytics/engagement.js";
import { eventBatchSchema } from "../src/analytics/events.js";

test("active time stops at idle threshold, resumes on input, excludes hidden time and suspension", () => {
  const c = new EngagementClock(0, true);
  c.sample(30000, true);
  c.sample(60000, true);
  c.sample(90000, true);
  assert.equal(c.activeMs, 60000);
  assert.equal(c.visibleMs, 90000);
  c.sample(100000, true, true);
  c.sample(105000, false);
  assert.equal(c.activeMs, 65000);
  c.sample(165000, true, true);
  c.sample(170000, true);
  assert.equal(c.activeMs, 70000);
  c.sample(500000, true); // Sleep / background timer throttling is not activity.
  assert.equal(c.activeMs, 70000);
  assert.equal(c.visibleMs, 110000);
});

test("screen categories never expose query values, dynamic IDs or private routes", () => {
  assert.equal(
    screenForPath("/invoice/arizona-esa?email=private@example.com"),
    "invoice",
  );
  assert.equal(screenForPath("/pathways/private-id"), "pathways");
  assert.equal(screenForPath("/unknown/private-name#token"), "other");
  assert.equal(screenForPath("/try/practice"), "practice");
});

test("engagement rejects impossible durations and arbitrary fields", () => {
  const p = {
    sessionId: randomUUID(),
    pageId: randomUUID(),
    ordinal: 0,
    screen: "home",
    activeMs: 10,
    visibleMs: 20,
  };
  assert.equal(engagementSchema.safeParse(p).success, true);
  for (const bad of [
    { ...p, activeMs: 21 },
    { ...p, visibleMs: -1 },
    { ...p, visibleMs: 86400001 },
    { ...p, url: "https://private/" },
    { ...p, screen: "/private" },
  ])
    assert.equal(engagementSchema.safeParse(bad).success, false);
  assert.equal(
    eventBatchSchema.safeParse({
      visitorId: randomUUID(),
      traffic: "internal",
      context: { referrer: "search", device: "phone", utmSource: "google" },
      events: [{ event: "page_engagement", at: 1, props: p }],
    }).success,
    true,
  );
});
