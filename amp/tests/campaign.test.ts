import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { RETENTION } from "../src/privacy/retention-periods";
import Fastify from "fastify";
import type { Pool } from "pg";
import { campaignEventSchema } from "../src/analytics/campaign";
import {
  campaignOrigin,
  registerCampaignRoutes,
} from "../src/analytics/campaign-routes";
const payload = {
  state: "AR",
  program: "arkansas-efa",
  campaign: "ar-efa-launch",
  source: "facebook",
  medium: "paid-social",
  action: "invoice_click",
};
test("campaign rejects identifiers, arbitrary labels and purchase events", () => {
  assert.ok(campaignEventSchema.safeParse(payload).success);
  for (const extra of [
    { email: "parent@example.test" },
    { visitorId: "id" },
    { source: "personal-name" },
    { creative: "personal-name" },
    { creative: "efa-math", campaign: "none" },
    { action: "purchase" },
    { program: "other" },
    { url: "https://example.test" },
  ])
    assert.equal(
      campaignEventSchema.safeParse({ ...payload, ...extra }).success,
      false,
    );
  assert.equal(campaignOrigin(undefined), undefined);
  assert.equal(campaignOrigin("https://example.test/"), "https://example.test");
  for (const origin of [
    "*",
    "http://example.test",
    "https://example.test/path",
    "https://user@example.test",
  ])
    assert.throws(() => campaignOrigin(origin));
});
test("campaign endpoint requires configured origin and writes only validated aggregates", async () => {
  const app = Fastify();
  const queries: unknown[] = [];
  const pool = {
    connect: async () => ({
      query: async (q: unknown) => {
        if (typeof q !== "string") queries.push(q);
        return {};
      },
      release: () => {},
    }),
  } as unknown as Pool;
  await registerCampaignRoutes(app, { pool, origin: "https://example.test" });
  try {
    for (const origin of [undefined, "https://bad.example"])
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/campaign-events",
            payload,
            headers: origin ? { origin } : {},
          })
        ).statusCode,
        403,
      );
    const headers = { origin: "https://example.test" };
    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/campaign-events",
      headers,
    });
    assert.equal(preflight.statusCode, 204);
    assert.equal(
      preflight.headers["access-control-allow-origin"],
      headers.origin,
    );
    assert.equal(
      preflight.headers["access-control-allow-credentials"],
      undefined,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/campaign-events",
          headers,
          payload: { ...payload, email: "x" },
        })
      ).statusCode,
      400,
    );
    assert.equal(queries.length, 0);
    for (const privacy of [{ "sec-gpc": "1" }, { dnt: "1" }]) {
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: "/api/v1/campaign-events",
            headers: { ...headers, ...privacy },
            payload: { ...payload, creative: "efa-math" },
          })
        ).statusCode,
        204,
      );
    }
    assert.equal(queries.length, 0);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/campaign-events",
      headers,
      payload,
    });
    assert.equal(response.statusCode, 202);
    assert.deepEqual(response.json(), { accepted: 1 });
    assert.equal(queries.length, 1);
  } finally {
    await app.close();
  }
});

test("campaign report refuses a window beyond retained conversion events", () => {
  const run = (days: number) =>
    spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/report-campaign.ts", String(days)],
      { encoding: "utf8", env: { ...process.env, AMP_DATABASE_URL: "" } },
    );
  const tooLong = run(RETENTION.funnelEventDays + 1);
  assert.notEqual(tooLong.status, 0);
  assert.match(tooLong.stderr, /available funnel-retention window/);
  const allowed = run(RETENTION.funnelEventDays);
  assert.match(allowed.stderr, /AMP_DATABASE_URL is required/);
});
