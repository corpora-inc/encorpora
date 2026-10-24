import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import Fastify from "fastify";
import { fixture } from "../tests/helpers/advertising.js";
import {
  registerAcquisitionRoutes,
  ACQUISITION_COOKIE,
} from "../src/advertising/acquisition.js";
import { registerFundingPurchaseRoutes } from "../src/funding-purchase/routes.js";
import { testFundingOffer } from "../tests/funding-purchase.fixture.js";
import { assertTestDatabaseTarget } from "./test-database-preflight.js";

// Every browser request is intercepted locally; no advertising/payment service
// or production website receives these synthetic identifiers.
assertTestDatabaseTarget(process.env.AMP_TEST_DATABASE_URL);
if (!process.env.AMP_TEST_DATABASE_URL)
  throw new Error("Disposable test database required");
await fixture(async (pool) => {
  const app = Fastify();
  await registerAcquisitionRoutes(app, { pool, origin: "https://corpora.inc" });
  await pool.query(
    "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES('amp|parent','fixture','verified','synthetic')",
  );
  await registerFundingPurchaseRoutes(app, {
    pool,
    authenticate: async () => "amp|parent",
    offers: [testFundingOffer],
  });
  const script = await readFile(
    new URL("../../corpora-site/src/acquisition-client.js", import.meta.url),
    "utf8",
  );
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const apiRequests: { path: string; cookie: boolean }[] = [];
    await context.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (
        url.origin === "https://corpora.inc" &&
        url.pathname === "/assets/acquisition.js"
      )
        return route.fulfill({ contentType: "text/javascript", body: script });
      if (
        url.origin === "https://corpora.inc" &&
        url.pathname === "/esa/arkansas-efa/"
      )
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html><head><script src="/assets/acquisition.js" data-acquisition-endpoint="https://amp.corpora.inc/api/v1/advertising/acquisition" defer></script></head><body><a href="https://amp.corpora.inc/purchase/arkansas-efa">Continue</a></body></html>',
        });
      if (
        url.origin === "https://amp.corpora.inc" &&
        url.pathname === "/purchase/arkansas-efa"
      )
        return route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><html><body><h1>Parent purchase fixture</h1></body></html>",
        });
      if (
        url.origin === "https://amp.corpora.inc" &&
        url.pathname.startsWith("/api/")
      ) {
        const headers = await request.allHeaders();
        apiRequests.push({
          path: url.pathname,
          cookie: headers.cookie?.includes(ACQUISITION_COOKIE) ?? false,
        });
        const response = await app.inject({
          method: request.method() as "GET" | "POST" | "OPTIONS",
          url: url.pathname,
          headers,
          payload: request.postData() ?? undefined,
        });
        const out = Object.fromEntries(
          Object.entries(response.headers).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join(",") : String(value),
          ]),
        );
        return route.fulfill({
          status: response.statusCode,
          headers: out,
          body: response.body,
        });
      }
      return route.abort();
    });
    const page = await context.newPage();
    const captured = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/advertising/acquisition") &&
        r.request().method() === "POST",
    );
    await page.goto(
      "https://corpora.inc/esa/arkansas-efa/?gclid=Browser_Google&fbclid=Browser_Meta&utm_campaign=ar-efa-launch&utm_source=google&utm_medium=cpc&utm_content=ar-funded-whats-next-responsive-v5",
    );
    assert.equal((await captured).status(), 204);
    assert.ok(!page.url().includes("gclid") && !page.url().includes("fbclid"));
    const cookies = await context.cookies("https://amp.corpora.inc");
    const cookie = cookies.find((c) => c.name === ACQUISITION_COOKIE);
    assert.ok(cookie?.httpOnly && cookie.secure && cookie.sameSite === "Lax");
    await page.getByRole("link", { name: "Continue" }).click();
    assert.ok(
      !(await page.evaluate(() => document.cookie)).includes(
        ACQUISITION_COOKIE,
      ),
    );
    const status = await page.evaluate(
      async (request) =>
        (
          await fetch("/api/v1/funding/requests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
          })
        ).status,
      {
        offerId: testFundingOffer.id,
        offerRevision: testFundingOffer.revision,
        learnerId: "child",
        idempotencyKey: randomUUID(),
      },
    );
    assert.equal(status, 200);
    assert.equal(
      (
        await pool.query(
          "SELECT DISTINCT e.campaign_labels FROM amp_ad_order_attribution a JOIN amp_ad_click_evidence e ON e.id=a.click_id JOIN amp_funding_requests r ON r.id=a.funding_request_id",
        )
      ).rows[0].campaign_labels.creative,
      "ar-funded-whats-next-responsive-v5",
    );
    assert.ok(
      apiRequests.some(
        (r) => r.path === "/api/v1/funding/requests" && r.cookie,
      ),
    );
    assert.equal(
      (await pool.query("SELECT count(*) FROM amp_ad_order_attribution"))
        .rows[0].count,
      "2",
    );
    await context.addInitScript(
      "Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', {get() {return true;}, configurable:true});",
    );
    const cleared = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/v1/advertising/acquisition") &&
        r.request().method() === "POST",
    );
    await page.goto(
      "https://corpora.inc/esa/arkansas-efa/?gclid=Do_Not_Collect",
    );
    const clearedResponse = await cleared;
    assert.equal(clearedResponse.status(), 204);
    assert.deepEqual(clearedResponse.request().postDataJSON(), {
      optOut: true,
    });
    await clearedResponse.finished();
    assert.ok(
      !(await context.cookies("https://amp.corpora.inc")).some(
        (c) => c.name === ACQUISITION_COOKIE,
      ),
    );
    assert.equal(
      (await pool.query("SELECT count(*) FROM amp_ad_click_evidence")).rows[0]
        .count,
      "2",
    );
    await context.close();
    console.log(
      "PASS: real Chromium cross-origin cookie, clean URL, owned funding binding and GPC clearing; all requests intercepted locally.",
    );
  } finally {
    await browser.close();
    await app.close();
  }
});
