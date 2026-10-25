import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";

test("real Google tag emits sanitized pages/actions and stops on learning routes", async () => {
  const bundle = await build({
    stdin: {
      contents:
        'import {createGoogleAnalytics} from "./src/analytics/google-analytics"; window.ga = createGoogleAnalytics(); window.ga.navigate();',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
  });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  // Exercise a normal visitor; production ignores webdriver traffic.
  await context.addInitScript(
    'Object.defineProperty(navigator, "webdriver", { get: () => false })',
  );
  const hits: URLSearchParams[] = [];
  let tagLoads = 0;
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.hostname.endsWith("google-analytics.com")) {
      for (const line of (request.postData() || "").split("\n"))
        hits.push(new URLSearchParams(url.search.slice(1) + "&" + line));
      await route.fulfill({ status: 204 }); // No synthetic events leave this test.
    } else if (url.hostname === "www.googletagmanager.com") {
      tagLoads++;
      await route.continue(); // Run the actual SDK, not a made-up gtag substitute.
    } else if (url.hostname === "amp.corpora.inc") {
      await route.fulfill({
        contentType: "text/html",
        body: `<title>Private title must not be sent</title><script>${bundle.outputFiles[0].text}</script>`,
      });
    } else await route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    console.error("Browser error:", error.message),
  );
  page.on("requestfailed", (request) =>
    console.error(
      "Request failed:",
      new URL(request.url()).origin,
      request.failure()?.errorText,
    ),
  );
  async function awaitEvent(name: string, count: number) {
    const until = Date.now() + 15000;
    while (
      hits.filter((h) => h.get("en") === name).length < count &&
      Date.now() < until
    )
      await page.waitForTimeout(100);
    assert.equal(
      hits.filter((h) => h.get("en") === name).length,
      count,
      `${name}: ${JSON.stringify(hits.map((h) => Object.fromEntries(h)))}`,
    );
  }
  try {
    await page.goto(
      "https://amp.corpora.inc/?utm_source=google&utm_medium=cpc&email=private@example.test#secret",
    );
    await awaitEvent("page_view", 1);
    await page.evaluate(() => {
      const ga = (window as any).ga;
      history.pushState({}, "", "/purchase/arizona?token=private-invoice");
      ga.navigate();
      ga.navigate();
      ga.event("checkout_start");
      ga.event("purchase");
    });
    await awaitEvent("page_view", 2);
    await awaitEvent("begin_checkout", 1);
    assert.equal(tagLoads, 1);
    assert.equal(
      hits.some((h) => h.get("en") === "purchase"),
      false,
    );
    await page.waitForTimeout(1200);
    await page.evaluate(`window.dispatchEvent(new Event('pagehide'));`);
    await awaitEvent("user_engagement", 1);
    assert.equal(
      hits.find((h) => h.get("en") === "user_engagement")?.get("dl"),
      "https://amp.corpora.inc/purchase/arizona",
    );
    await page.evaluate(
      `Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'}); document.dispatchEvent(new Event('visibilitychange'));`,
    );
    for (const hit of hits) {
      assert.equal(hit.get("dt"), "AMP by Corpora");
      assert.ok(!decodeURIComponent(hit.toString()).includes("private"));
      assert.ok(!decodeURIComponent(hit.toString()).includes("secret"));
    }
    const count = hits.length;
    await page.evaluate(() => {
      history.pushState({}, "", "/try/practice?learner=private");
      (window as any).ga.navigate();
      (window as any).ga.event("checkout_start");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(1500);
    assert.equal(hits.length, count, "learning route must not send GA events");
    await page.evaluate(() => {
      history.pushState({}, "", "/purchase/arizona");
      (window as any).ga.navigate();
      (window as any).ga.event("checkout_start");
    });
    await page.evaluate(`window.dispatchEvent(new Event('pagehide'));`);
    await page.waitForTimeout(1500);
    assert.equal(
      hits.length,
      count,
      "returning to purchase must not export the learning interval",
    );
    // Fresh opt-out sessions must not even load Google's script.
    const optedOut = await context.newPage();
    await optedOut.addInitScript(
      'Object.defineProperty(navigator, "globalPrivacyControl", { get: () => true })',
    );
    await optedOut.goto("https://amp.corpora.inc/");
    await optedOut.waitForTimeout(500);
    assert.equal(tagLoads, 1);
  } finally {
    await browser.close();
  }
});
