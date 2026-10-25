import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { build } from "esbuild";
import { Pool } from "pg";
import { migrate } from "./migrate.js";
import { assertTestDatabaseTarget } from "./test-database-preflight.js";
import { buildApp } from "../src/server/app.js";
import { PostgresRepository } from "../src/server/repository.js";
import { registerAnalyticsRoutes } from "../src/analytics/routes.js";

test(
  "real browser shares marketing and AMP identity, attribution and staff status; privacy opts out",
  {},
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL;
    if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
    assertTestDatabaseTarget(url);
    const schema = `amp_journey_browser_${randomUUID().replaceAll("-", "")}`;
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
    const marketing = await build({
      entryPoints: ["../corpora-site/src/engagement-client.ts"],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
    });
    const product = await build({
      stdin: {
        contents: `
    import { startEngagement } from './src/web/lib/engagement';
    import { flush } from './src/web/lib/analytics';
    startEngagement(); flush();
  `,
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
    });
    const releases: (() => void)[] = [];
    const browser = await chromium.launch({ headless: true });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await registerAnalyticsRoutes(app, {
        pool: repository.pool,
        origin: "https://corpora.inc",
      });
      for (const mode of ["customer", "internal", "gpc", "delayed"] as const) {
        const context = await browser.newContext();
        let releaseMarketing: () => void = () => {};
        const marketingGate = new Promise<void>((resolve) => {
          releaseMarketing = resolve;
        });
        releases.push(releaseMarketing);
        let ampArrivedFirst = false;
        const collected: {
          visitorId: string;
          traffic: string;
          context: { utmContent?: string };
        }[] = [];
        const errors: string[] = [];
        await context.addInitScript((mode) => {
          Object.defineProperty(navigator, "webdriver", { value: false });
          if (mode === "gpc")
            Object.defineProperty(navigator, "globalPrivacyControl", {
              value: true,
            });
          if (mode === "internal" && location.hostname === "corpora.inc")
            localStorage.setItem("amp.analytics.traffic", "internal");
        }, mode);
        // All requests stay inside this fixture, including requests to production-shaped URLs.
        await context.route("**/*", async (route) => {
          const request = route.request(),
            u = new URL(request.url());
          if (u.pathname.startsWith("/api/")) {
            const payload = request.postData();
            if (payload) collected.push(JSON.parse(payload));
            if (mode === "delayed" && u.pathname === "/api/v1/site-events")
              await marketingGate;
            const response = await app.inject({
              method: request.method() as "POST" | "OPTIONS",
              url: u.pathname,
              headers: request.headers(),
              ...(payload ? { payload } : {}),
            });
            if (
              mode === "delayed" &&
              u.pathname === "/api/v1/events" &&
              request.method() === "POST"
            ) {
              ampArrivedFirst = true;
              releaseMarketing();
            }
            if (response.statusCode >= 400)
              errors.push(`collector ${response.statusCode}: ${response.body}`);
            await route.fulfill({
              status: response.statusCode,
              headers: Object.fromEntries(
                Object.entries(response.headers).map(([k, v]) => [
                  k,
                  String(v),
                ]),
              ),
              body: response.body,
            });
            return;
          }
          if (u.pathname === "/client.js") {
            await route.fulfill({
              contentType: "application/javascript",
              body:
                u.hostname === "corpora.inc"
                  ? marketing.outputFiles[0].text
                  : product.outputFiles[0].text,
            });
            return;
          }
          if (!["corpora.inc", "amp.corpora.inc"].includes(u.hostname)) {
            errors.push("Unexpected external request");
            await route.abort();
            return;
          }
          await route.fulfill({
            contentType: "text/html",
            body:
              u.hostname === "corpora.inc"
                ? '<!doctype html><button data-invoice-form="open" onclick="document.querySelector(&quot;dialog&quot;).showModal()">Invoice</button><dialog data-invoice-dialog><button data-invoice-close onclick="document.querySelector(&quot;dialog&quot;).close()">Close</button></dialog><a href="https://amp.corpora.inc/try">Start assessment</a><script src="/client.js" data-engagement-endpoint="https://amp.corpora.inc/api/v1/site-events" defer></script>'
                : '<!doctype html><p>Assessment fixture</p><script src="/client.js" defer></script>',
          });
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(
          "https://corpora.inc/esa/arkansas-efa/?utm_source=google&utm_medium=cpc&utm_campaign=ar-product&utm_content=founder",
        );
        if (mode !== "gpc" && mode !== "delayed")
          await page
            .waitForResponse(
              (r) =>
                r.url().endsWith("/site-events") &&
                r.request().method() === "POST",
              { timeout: 5000 },
            )
            .catch(async () => {
              assert.ok(collected.length > 0, "initial site event collected");
            });
        const marketingId = await page.evaluate(() =>
          localStorage.getItem("amp.visitor"),
        );
        if (mode === "customer") {
          await page
            .getByRole("button", { name: "Invoice", exact: true })
            .click();
          await page.keyboard.press("Escape");
          await page
            .getByRole("button", { name: "Invoice", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Close", exact: true })
            .click();
        }
        await page.getByRole("link", { name: "Start assessment" }).click();
        await page.waitForURL("https://amp.corpora.inc/try");
        await page.waitForLoadState("networkidle");
        const ampId = await page.evaluate(() =>
          localStorage.getItem("amp.visitor"),
        );
        if (mode === "gpc") {
          assert.equal(collected.length, 0);
          assert.equal(marketingId, null);
          assert.equal(ampId, null);
          assert.equal((await context.cookies()).length, 0);
        } else {
          if (mode === "delayed")
            assert.ok(
              ampArrivedFirst,
              "AMP collection deliberately precedes the paid marketing entry",
            );
          assert.ok(marketingId);
          assert.equal(ampId, marketingId);
          assert.ok(collected.length >= 3);
          assert.ok(collected.every((b) => b.visitorId === marketingId));
          assert.ok(
            collected.every(
              (b) =>
                b.traffic === (mode === "internal" ? "internal" : "external"),
            ),
          );
          assert.equal(collected[0].context.utmContent, "founder");
          const rows = (
            await repository.pool.query(
              "SELECT utm_source,utm_content,traffic_kind FROM amp_funnel_visitors WHERE visitor_id=$1",
              [marketingId],
            )
          ).rows;
          assert.deepEqual(rows, [
            {
              utm_source: "google",
              utm_content: "founder",
              traffic_kind: mode === "internal" ? "internal" : "external",
            },
          ]);
          if (mode === "customer") {
            const closes = await repository.pool.query(
              "SELECT count(*)::int n FROM amp_journey_actions WHERE visitor_id=$1 AND action='invoice_close'",
              [marketingId],
            );
            assert.equal(
              closes.rows[0].n,
              2,
              "Escape and close button each count exactly once",
            );
          }
          const cookies = await context.cookies();
          assert.ok(
            cookies.some(
              (c) =>
                c.name === "amp_analytics_visitor" &&
                c.domain === ".corpora.inc" &&
                c.secure,
            ),
          );
        }
        assert.deepEqual(errors, []);
        await context.close();
      }
    } finally {
      for (const release of releases) release();
      await browser.close();
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
