import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { chromium } from "playwright";
import { createServer } from "vite";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { registerAnalyticsRoutes } from "../src/analytics/routes";
import { engagementReport } from "../src/analytics/engagement-report";

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
const schema = `amp_engagement_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: url, max: 1 });
const scoped = new URL(url);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await admin.query(`CREATE SCHEMA ${schema}`);
const pool = new Pool({ connectionString: scoped.href, max: 2 });
const api = Fastify();
const vite = await createServer({
  server: { host: "127.0.0.1", port: 4497, strictPort: true },
});
const browser = await chromium.launch();
try {
  await migrate(scoped.href);
  await api.register(rateLimit, { max: 1000, timeWindow: "1 minute" });
  await registerAnalyticsRoutes(api, { pool });
  await vite.listen();
  const page = await browser.newPage();
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    if (new URL(req.url()).pathname === "/api/v1/events") {
      const response = await api.inject({
        method: "POST",
        url: "/api/v1/events",
        payload: JSON.parse(req.postData()!),
      });
      assert.equal(response.statusCode, 202, response.body);
      return route.fulfill({
        status: response.statusCode,
        body: response.body,
        contentType: "application/json",
      });
    }
    return route.fulfill({
      json: {
        mode: "accounts",
        passwords: true,
        providers: [],
        offers: [],
        signedIn: false,
      },
    });
  });
  await page.goto(
    "http://127.0.0.1:4497/sign-up?utm_source=google&utm_campaign=synthetic",
  );
  await page.waitForFunction(() => !!localStorage.getItem("amp.visitor"));
  await page.waitForTimeout(2500);
  const before = (
    await pool.query("SELECT traffic_kind,utm_source FROM amp_funnel_visitors")
  ).rows;
  assert.deepEqual(before, [
    { traffic_kind: "automated", utm_source: "google" },
  ]);
  assert.equal(
    (await engagementReport(pool, 1)).screens.length,
    0,
    "automation excluded from customer counts",
  );
  // Exercise real SPA navigation and actual network delivery into PostgreSQL.
  await page.evaluate(async () => {
    const { router } = await import("/src/web/app/router.tsx" as string);
    await router.navigate({ to: "/invoice/arizona-esa" });
  });
  await page.waitForURL("**/invoice/arizona-esa");
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const a = await import("/src/web/lib/analytics.ts" as string);
    a.flush();
  });
  await page.waitForTimeout(500);
  let rows = (
    await pool.query(
      "SELECT screen,ordinal FROM amp_engagement_pages ORDER BY ordinal",
    )
  ).rows;
  assert.deepEqual(rows, [
    { screen: "auth", ordinal: 0 },
    { screen: "invoice", ordinal: 1 },
  ]);
  // Mark a staff browser without sending any account/name information.
  await page.evaluate(() =>
    localStorage.setItem("amp.analytics.traffic", "internal"),
  );
  await page.reload();
  await page.waitForTimeout(2500);
  // Automated is sticky: marking it internal does not relabel previous test activity.
  assert.equal((await engagementReport(pool, 1)).screens.length, 0);
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "doNotTrack", { value: "1" });
  });
  const optedOut = await context.newPage();
  let collected = 0;
  await optedOut.route("**/api/v1/events", (route) => {
    collected++;
    return route.fulfill({ status: 202, json: { accepted: 0 } });
  });
  await optedOut.goto("http://127.0.0.1:4497/sign-up");
  await optedOut.waitForTimeout(2500);
  assert.equal(
    collected,
    0,
    "DNT must disable event and engagement collection",
  );
  await context.close();
  console.log(
    "PASS: live app deep-entry attribution, real SPA routes, database delivery, automation exclusion, DNT",
  );
} finally {
  await browser.close();
  await vite.close();
  await api.close();
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
