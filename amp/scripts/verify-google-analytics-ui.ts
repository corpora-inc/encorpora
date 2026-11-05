import { secureChromium } from "../browser-security.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium as rawChromium } from "playwright";
const chromium = secureChromium(rawChromium);

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
      for (const line of (request.postData() || "").split(/\r?\n/))
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
      "https://amp.corpora.inc/?utm_source=google&utm_medium=cpc&gclid=Valid_Click_123&email=private@example.test#secret",
    );
    await awaitEvent("page_view", 1);
    await page.waitForFunction(() => !!(window as any).ga.signupContext());
    const signup = await page.evaluate(() =>
      (window as any).ga.signupContext(),
    );
    assert.equal(
      signup.clientId,
      hits.find((h) => h.get("en") === "page_view")!.get("cid"),
    );
    assert.equal(
      String(signup.sessionId),
      hits.find((h) => h.get("en") === "page_view")!.get("sid"),
    );
    await page.evaluate(() => {
      const url = new URL(location.href);
      url.searchParams.delete("gclid");
      history.replaceState({}, "", url);
      (window as any).ga.event("invoice_open");
    });
    await awaitEvent("invoice_open", 1);
    assert.equal(hits.filter((h) => h.get("en") === "page_view").length, 1);
    assert.match(
      hits.find((h) => h.get("en") === "invoice_open")!.get("dl")!,
      /gclid=Valid_Click_123/,
    );
    await page.evaluate(() => {
      const ga = (window as any).ga;
      history.pushState({}, "", "/purchase/arizona-esa?token=private-invoice");
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
      "https://amp.corpora.inc/purchase/arizona-esa",
    );
    await page.evaluate(
      `Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'visible'}); document.dispatchEvent(new Event('visibilitychange'));`,
    );
    for (const hit of hits) {
      assert.equal(
        hit.get("dt"),
        new URL(hit.get("dl")!).pathname === "/"
          ? "AMP: Adaptive Math Pathways, a complete math curriculum"
          : "Pay with Arizona ESA | AMP",
      );
      assert.ok(!decodeURIComponent(hit.toString()).includes("private"));
      assert.ok(!decodeURIComponent(hit.toString()).includes("secret"));
    }
    await page.evaluate(() => {
      history.pushState({}, "", "/sign-up?email=private@example.test");
      (window as any).ga.navigate();
    });
    await awaitEvent("page_view", 3);
    assert.equal(
      hits
        .filter((h) => h.get("en") === "page_view")
        .at(-1)
        ?.get("dt"),
      "Create Your Account | AMP",
    );
    await page.evaluate(() => {
      history.pushState({}, "", "/plans");
      (window as any).ga.navigate();
    });
    await awaitEvent("page_view", 4);
    assert.equal(
      hits
        .filter((h) => h.get("en") === "page_view")
        .at(-1)
        ?.get("dt"),
      "Plans | AMP",
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          window.addEventListener(
            "popstate",
            () => {
              (window as any).ga.navigate();
              resolve();
            },
            { once: true },
          );
          history.back();
        }),
    );
    await awaitEvent("page_view", 5);
    assert.equal(
      hits
        .filter((h) => h.get("en") === "page_view")
        .at(-1)
        ?.get("dt"),
      "Create Your Account | AMP",
    );
    assert.equal(tagLoads, 1);
    const count = hits.length;
    await page.evaluate(() => {
      history.pushState({}, "", "/try/practice?learner=private");
      (window as any).ga.navigate();
      (window as any).ga.event("checkout_start");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(1500);
    assert.equal(hits.length, count, "learning route must not send GA events");
    assert.equal(
      await page.evaluate(() => (window as any).ga.signupContext()),
      undefined,
    );
    await page.evaluate(() => {
      history.pushState({}, "", "/purchase/arizona-esa");
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

test("the pitch reaches GA with its titles and video, Buy and try events, sanitized and opt-out aware", async () => {
  // The app's own collector, which forwards to GA exactly as the pitch screen
  // calls it (src/web/features/pitch: trackOnce/track with these props).
  const bundle = await build({
    stdin: {
      contents:
        'import * as amp from "./src/web/lib/analytics"; window.amp = amp;',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
  });
  const browser = await chromium.launch({ headless: true });
  const hits: URLSearchParams[] = [];
  const firstParty: { event: string; props?: Record<string, unknown> }[] = [];
  let tagLoads = 0;
  async function visitor(init?: string) {
    const context = await browser.newContext();
    await context.addInitScript(
      'Object.defineProperty(navigator, "webdriver", { get: () => false })',
    );
    if (init) await context.addInitScript(init);
    await context.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (url.hostname.endsWith("google-analytics.com")) {
        for (const line of (request.postData() || "").split(/\r?\n/))
          hits.push(new URLSearchParams(url.search.slice(1) + "&" + line));
        await route.fulfill({ status: 204 }); // Nothing reaches Google.
      } else if (url.hostname === "www.googletagmanager.com") {
        tagLoads++;
        await route.continue(); // The actual SDK.
      } else if (url.hostname === "amp.corpora.inc") {
        if (url.pathname === "/api/v1/events") {
          firstParty.push(...request.postDataJSON().events);
          await route.fulfill({ status: 202, json: { accepted: 1 } });
        } else if (url.pathname.startsWith("/api/"))
          await route.fulfill({ json: {} });
        else
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
    return { context, page };
  }
  const named = (name: string) => hits.filter((h) => h.get("en") === name);
  async function awaitHits(name: string, count: number) {
    const until = Date.now() + 15000;
    while (named(name).length < count && Date.now() < until)
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(
      named(name).length,
      count,
      `${name}: ${JSON.stringify(hits.map((h) => Object.fromEntries(h)))}`,
    );
  }
  const programTitle = "AMP: Adaptive Math Pathways for Arkansas EFA families";
  const landing =
    "https://amp.corpora.inc/?program=ar-efa&utm_source=google&utm_medium=cpc&utm_campaign=ar-efa-launch&gclid=Valid_Click_123&email=private@example.test#secret";
  try {
    const { page } = await visitor();
    await page.goto(landing);
    // Boot runs before the home route resolves: / is not yet known to be the
    // pitch, so nothing loads or sends.
    await page.evaluate(() => (window as any).amp.trackGooglePage());
    await page.waitForTimeout(500);
    assert.equal(tagLoads, 0, "no tag before / is known to show the pitch");
    await page.evaluate(() => {
      const amp = (window as any).amp;
      amp.setPitchShown(true);
      amp.trackGooglePage();
    });
    await awaitHits("page_view", 1);
    const view = named("page_view")[0];
    assert.equal(view.get("dt"), programTitle);
    assert.equal(view.get("ep.program"), "ar-efa");
    assert.equal(
      view.get("dl"),
      "https://amp.corpora.inc/?utm_source=google&utm_medium=cpc&utm_campaign=ar-efa-launch&gclid=Valid_Click_123",
    );
    await page.evaluate(() => {
      const { track, trackOnce } = (window as any).amp;
      trackOnce("pitch", "pitch_view", { program: "ar-efa" });
      trackOnce("pitch-video-play", "video_play", {});
      trackOnce("pitch-video-play", "video_play", {}); // A replay counts once.
      for (const percent of [25, 50, 75])
        trackOnce(`pitch-video-${percent}`, "video_progress", { percent });
      trackOnce("pitch-video-100", "video_progress", { percent: 100 });
      track("buy_click", { path: "funded" });
      track("buy_click", { path: "card" });
      track("try_click");
      track("workbook_click");
    });
    await awaitHits("video_start", 1);
    await awaitHits("video_progress", 3);
    await awaitHits("video_complete", 1);
    await awaitHits("buy_click", 2);
    await awaitHits("try_click", 1);
    await awaitHits("workbook_click", 1);
    assert.deepEqual(
      named("video_progress").map((h) => h.get("epn.video_percent")),
      ["25", "50", "75"],
    );
    assert.equal(named("video_complete")[0].get("epn.video_percent"), "100");
    assert.deepEqual(
      named("buy_click").map((h) => h.get("ep.payment_route")),
      ["ar-efa", "card"],
    );
    for (const name of [
      "video_start",
      "video_progress",
      "video_complete",
      "buy_click",
      "try_click",
      "workbook_click",
    ])
      for (const hit of named(name)) {
        assert.equal(hit.get("dt"), programTitle, name);
        assert.equal(hit.get("ep.program"), "ar-efa", name);
      }
    // A click is not a purchase or a checkout, and the pitch view itself is
    // GA's page_view, not a second event.
    for (const name of [
      "purchase",
      "begin_checkout",
      "pitch_view",
      "video_play",
    ])
      assert.equal(named(name).length, 0, name);
    // The same actions stay in first-party reporting.
    const until = Date.now() + 10000;
    while (firstParty.length < 10 && Date.now() < until)
      await page.waitForTimeout(100);
    assert.deepEqual(
      firstParty.map((e) => e.event),
      [
        "pitch_view",
        "video_play",
        "video_progress",
        "video_progress",
        "video_progress",
        "video_progress",
        "buy_click",
        "buy_click",
        "try_click",
        "workbook_click",
      ],
    );

    // Each sign-up intent is its own title on the same sanitized URL.
    await page.evaluate(() => {
      history.pushState(
        {},
        "",
        "/sign-up?entry=pitch-try&return=free-practice&program=ar-efa&email=private@example.test",
      );
      (window as any).amp.trackGooglePage();
    });
    await awaitHits("page_view", 2);
    await page.evaluate(() => {
      history.pushState({}, "", "/sign-up?entry=pitch-buy&program=ar-efa");
      (window as any).amp.trackGooglePage();
    });
    await awaitHits("page_view", 3);
    assert.deepEqual(
      named("page_view")
        .slice(1)
        .map((h) => [h.get("dl"), h.get("dt"), h.get("ep.program")]),
      [
        ["https://amp.corpora.inc/sign-up", "Try AMP Free | AMP", "ar-efa"],
        [
          "https://amp.corpora.inc/sign-up",
          "Create Your Account to Buy | AMP",
          "ar-efa",
        ],
      ],
    );

    // Signed in, / is the learning home: GA stops for this document.
    const count = hits.length;
    await page.evaluate(() => {
      const amp = (window as any).amp;
      amp.setPitchShown(false);
      history.pushState({}, "", "/");
      amp.trackGooglePage();
      amp.track("try_click");
      history.pushState({}, "", "/plans");
      amp.trackGooglePage();
      amp.track("plan_view");
    });
    await page.evaluate(`window.dispatchEvent(new Event('pagehide'));`);
    await page.waitForTimeout(1500);
    assert.equal(hits.length, count, "the signed-in home must not reach GA");

    for (const hit of hits) {
      const sent = decodeURIComponent(hit.toString());
      for (const value of ["private", "secret", "example.test", "email="])
        assert.ok(!sent.includes(value), `${value} in ${sent}`);
    }
    assert.equal(tagLoads, 1);

    // Global Privacy Control: no tag, no GA hit and no first-party event.
    const before = { hits: hits.length, firstParty: firstParty.length };
    const optedOut = await visitor(
      'Object.defineProperty(navigator, "globalPrivacyControl", { get: () => true })',
    );
    // Known staff browsers keep first-party records but never load GA.
    const staff = await visitor(
      'localStorage.setItem("amp.analytics.traffic", "internal")',
    );
    for (const { page: other } of [optedOut, staff]) {
      await other.goto(landing);
      await other.evaluate(() => {
        const { setPitchShown, trackGooglePage, track, trackOnce } = (
          window as any
        ).amp;
        setPitchShown(true);
        trackGooglePage();
        trackOnce("pitch-video-play", "video_play", {});
        track("buy_click", { path: "funded" });
        track("try_click");
        (window as any).amp.flush(true);
      });
    }
    await optedOut.page.waitForTimeout(2500);
    assert.equal(tagLoads, 1, "GPC and staff browsers never load the tag");
    assert.equal(hits.length, before.hits);
    assert.equal(
      firstParty.length - before.firstParty,
      3,
      "only the staff browser's first-party events arrive",
    );
  } finally {
    await browser.close();
  }
});
