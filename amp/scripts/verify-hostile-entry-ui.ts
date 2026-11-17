import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { mkdir, mkdtemp } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
  type Route,
} from "playwright";
import { build } from "vite";
import { eventBatchSchema } from "../src/analytics/events";

/**
 * AMP's public entry in hostile environments: the production build, served as
 * nginx serves it with its real security headers, in Chromium (Android user
 * agents) and WebKit (iOS user agents). Every case loads `/`, presses Try it
 * free and must reach a usable sign-up screen with a provider button, or, where
 * a failure can't be hidden, a clear message in place with a button that then
 * works:
 *
 * - control, with the Google tag loaded (a stub that sends to GA4's own hosts),
 *   so a content-policy block of analytics fails here;
 * - a blocker (uBlock Origin with EasyList and EasyPrivacy, emulated with
 *   request blocking: the third-party tags and any first-party path that names
 *   analytics, tracking, ads, pixels, beacons, collection or events. Stricter
 *   than the real lists, which today block none of AMP's own paths);
 * - Instagram, Facebook and TikTok in-app browsers, iOS and Android, each
 *   injecting scripts that throw on load, from timers and as rejections;
 * - third-party cookies off; Global Privacy Control on;
 * - each call before sign-up failing in turn: prices, invoice offers, the
 *   sign-in configuration, the sign-up intent and the event collector;
 * - a deploy: the sign-up screen's file 404s once (one automatic reload), or
 *   until the visitor reloads (one automatic reload, then a message and
 *   Reload in place), the app's entry file 404s, and its stylesheet 404s
 *   once (the entry guard).
 *
 * Every case also asserts: no content-policy violation, no error screen
 * unless the case expects its message, no page error from AMP's code, and no
 * `client_error` blaming AMP for a webview's script. Roles and labels only; no
 * sleeps or retries. The API is synthetic; nothing leaves the machine.
 *
 *     npx tsx scripts/verify-hostile-entry-ui.ts [--engine chromium|webkit]
 *       [--only control,blocker,...] [--port 4596] [--shots DIR]
 */
const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const only = argument("only")?.split(",");
const engines = (
  argument("engine") ? [argument("engine")] : ["chromium", "webkit"]
) as ("chromium" | "webkit")[];
const port = Number(argument("port") ?? 4596);
// Pages load at production's address, so its content policy (with
// upgrade-insecure-requests) and its Google tag apply as they do there. Every
// request is answered here: the page from the local server below, the API
// from synthetic answers. Nothing reaches production.
const origin = "https://amp.corpora.inc";
const local = `http://127.0.0.1:${port}`;
const shots = argument("shots") ?? "artifacts/hostile-entry";
await mkdir(shots, { recursive: true });

// A production build of this checkout, with the pitch's own document.
const dist = await mkdtemp(join(tmpdir(), "amp-hostile-entry-"));
await build({ logLevel: "error", build: { outDir: dist, emptyOutDir: true } });
execFileSync("npx", ["tsx", "scripts/build-home-document.ts"], {
  env: { ...process.env, AMP_DIST_DIR: dist },
  stdio: "inherit",
});

// The headers nginx sends on every response (docker/security-headers.conf).
const headers = Object.fromEntries(
  [
    ...readFileSync("docker/security-headers.conf", "utf8").matchAll(
      /^add_header\s+(\S+)\s+(?:"([^"]*)"|(\S+))\s+always;/gm,
    ),
  ].map(([, name, quoted, bare]) => [name, quoted ?? bare]),
);
assert.ok(headers["Content-Security-Policy"], "the header file has a policy");
const types: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
};
/** dist/ as docker/nginx.conf serves it: `/` is home.html, a missing file is
 * a 404 page, any other path is the app. */
const server = http.createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? "/", local).pathname);
  const file = normalize(path === "/" ? "/home.html" : path);
  const full = join(dist, file);
  const found =
    full.startsWith(dist) && existsSync(full) && statSync(full).isFile();
  const served = found ? full : extname(file) ? null : join(dist, "index.html");
  for (const [name, value] of Object.entries(headers))
    response.setHeader(name, value);
  if (!served) {
    response.writeHead(404, {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    });
    response.end("<!doctype html><title>Not found</title>");
    return;
  }
  response.writeHead(200, {
    "Content-Type": types[extname(served)] ?? "application/octet-stream",
    "Cache-Control": file.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });
  createReadStream(served).pipe(response);
});
await new Promise<void>((resolve) =>
  server.listen(port, "127.0.0.1", () => resolve()),
);

/** Each app's published user-agent shape: iOS apps run WebKit, Android
 * apps run Chromium. */
const ios = (tail: string, safari = false) =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${safari ? "Version/18.1 " : ""}Mobile/15E148${tail}`;
const android = (tail: string, webview = true) =>
  `Mozilla/5.0 (Linux; Android 14; Pixel 8${webview ? " Build/AP2A.240905.003; wv" : ""}) AppleWebKit/537.36 (KHTML, like Gecko) ${webview ? "Version/4.0 " : ""}Chrome/130.0.6723.107 Mobile Safari/537.36${tail}`;
type App = "standard" | "instagram" | "facebook" | "tiktok";
const agents: Record<"chromium" | "webkit", Record<App, string>> = {
  webkit: {
    standard: ios(" Safari/604.1", true),
    instagram: ios(
      " Instagram 355.0.0.29.82 (iPhone15,2; iOS 18_1; en_US; en; scale=3.00; 1179x2556; 652843921)",
    ),
    facebook: ios(
      " [FBAN/FBIOS;FBAV/489.0.0.40.109;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBLC/en_US]",
    ),
    tiktok: ios(
      " musical_ly_37.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US WKWebView/1 BytedanceWebview/d8a21c6",
    ),
  },
  chromium: {
    standard: android("", false),
    instagram: android(
      " Instagram 355.0.0.29.82 Android (34/14; 420dpi; 1080x2400; Google/google; Pixel 8; shiba; shiba; en_US; 652843921)",
    ),
    facebook: android(" [FB_IAB/FB4A;FBAV/489.0.0.40.109;]"),
    tiktok: android(
      " trill_370404 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/trill app_version/37.4.4 ByteLocale/en Region/US BytedanceWebview/d8a21c6",
    ),
  },
};

type Fail =
  | "prices"
  | "invoice-offers"
  | "auth-config"
  | "intent"
  | "events"
  | "sign-up-chunk-once"
  | "sign-up-chunk"
  | "entry-chunk"
  | "entry-css-once";
type Case = {
  name: string;
  app?: App;
  blocker?: boolean;
  inject?: boolean;
  gpc?: boolean;
  noThirdPartyCookies?: boolean;
  fail?: Fail;
  /** Press the provider button and require the provider's page. */
  continueWithGoogle?: boolean;
  /** Owned by another change that hasn't landed: reported, not failed, and
   * flagged once it passes so the mark is removed. */
  pending?: string;
};
const cases: Case[] = [
  { name: "control", continueWithGoogle: true },
  { name: "blocker", blocker: true, continueWithGoogle: true },
  ...(["instagram", "facebook", "tiktok"] as const).map((app) => ({
    name: app,
    app,
    inject: true,
  })),
  { name: "no-third-party-cookies", noThirdPartyCookies: true },
  { name: "gpc", gpc: true, continueWithGoogle: true },
  { name: "fail-prices", fail: "prices" },
  { name: "fail-invoice-offers", fail: "invoice-offers" },
  {
    name: "fail-auth-config",
    fail: "auth-config",
    pending: "improve-first-visit: sign-in configuration retry",
  },
  {
    name: "fail-intent",
    fail: "intent",
    continueWithGoogle: true,
    pending: "improve-first-visit: the sign-up intent doesn't block",
  },
  { name: "fail-events", fail: "events", continueWithGoogle: true },
  { name: "deploy-once", fail: "sign-up-chunk-once" },
  { name: "deploy-stuck", fail: "sign-up-chunk" },
  { name: "deploy-entry", fail: "entry-chunk" },
  { name: "deploy-css", fail: "entry-css-once" },
];

// The Google tag's stand-in: it sends where GA4 sends with ad storage granted,
// so the browser's own content policy decides, as in production.
const gtagStub = `(() => {
  const hit = "v=2&tid=G-TEST&en=page_view";
  for (const url of [
    "https://region1.google-analytics.com/g/collect?" + hit,
    "https://region1.analytics.google.com/g/collect?" + hit,
    "https://stats.g.doubleclick.net/g/collect?" + hit,
    "https://www.google.com/ads/ga-audiences?" + hit,
  ]) {
    fetch(url, { method: "POST", mode: "no-cors", keepalive: true }).catch(() => {});
    new Image().src = url;
  }
})();`;
// What uBlock Origin's default lists block, as request patterns.
const thirdPartyTags =
  /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|google\.com\/ads|facebook\.(?:com|net)|connect\.facebook|tiktok\.com|clarity\.ms/;
const trackingPath =
  /analytic|track|pixel|(?:^|[/_.-])ads?(?:[/_.-]|$)|advertis|beacon|collect|(?:^|[/_-])events?(?:[/_?.-]|$)|telemetry|metrics/i;
// An in-app webview's own bridge, which the app injects natively (past the
// content policy): throwing on load, from a timer (repeated, as a polling
// bridge does), as a rejection, and as code it evaluates in the page, which
// reports the page's URL.
const injected = `(() => {
  const bridge = () => { throw new Error("in-app bridge"); };
  setTimeout(() => { for (let i = 0; i < 6; i++) setTimeout(bridge, 50 * i); }, 300);
  setTimeout(() => { Promise.reject(new Error("in-app bridge rejected")); }, 320);
  setTimeout(() => dispatchEvent(new ErrorEvent("error", {
    error: new TypeError("in-app bridge in the page"), filename: location.href, lineno: 1, colno: 1,
  })), 340);
  throw new Error("in-app bridge on load");
})();`;
const offers = [
  {
    id: "a".repeat(64),
    mode: "test",
    currency: "USD",
    amountMinor: 59900,
    formattedAmount: "$599.00",
    interval: "year",
    learnerCount: 1,
  },
  {
    id: "b".repeat(64),
    mode: "test",
    currency: "USD",
    amountMinor: 5900,
    formattedAmount: "$59.00",
    interval: "month",
    learnerCount: 1,
  },
];

type Recorded = { event: string; props: Record<string, unknown> };
type State = {
  failing: boolean;
  documents: number;
  events: Recorded[];
  social: number;
  gtag: number;
};
const failedPath: Record<Fail, RegExp> = {
  prices: /^\/api\/v1\/billing\/prices$/,
  "invoice-offers": /^\/api\/v1\/funding\/invoice-offers$/,
  "auth-config": /^\/api\/v1\/auth-config$/,
  intent: /^\/api\/v1\/parent-followup\/intent$/,
  events: /^\/api\/v1\/events$/,
  "sign-up-chunk-once": /^\/assets\/SignInScreen-[\w-]+\.js$/,
  "sign-up-chunk": /^\/assets\/SignInScreen-[\w-]+\.js$/,
  "entry-chunk": /^\/assets\/(?:home|boot)-[\w-]+\.js$/,
  "entry-css-once": /^\/assets\/document-runtime-[\w-]+\.css$/,
};

async function intercept(context: BrowserContext, test: Case, state: State) {
  await context.route("**/*", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.isNavigationRequest() && url.origin === origin)
      state.documents++;
    if (url.origin !== origin) {
      if (test.blocker && thirdPartyTags.test(url.href)) return route.abort();
      if (/googletagmanager\.com\/gtag\/js/.test(url.href)) {
        state.gtag++;
        return route.fulfill({
          contentType: "text/javascript",
          body: gtagStub,
        });
      }
      // Reached only past the content policy: answered here, never sent.
      if (
        /google-analytics\.com|analytics\.google\.com|doubleclick\.net|www\.google\.com/.test(
          url.host,
        )
      )
        return route.fulfill({ status: 204 });
      return route.abort();
    }
    const path = url.pathname;
    if (test.blocker && trackingPath.test(path)) return route.abort();
    if (test.fail && state.failing && failedPath[test.fail].test(path)) {
      if (test.fail === "sign-up-chunk-once" || test.fail === "entry-css-once")
        state.failing = false;
      return path.startsWith("/assets/")
        ? route.fulfill({
            // As nginx answers a missing file (docker/nginx.conf, /404.html).
            status: 404,
            headers: { "Cache-Control": "no-store" },
            contentType: "text/html",
            body: "<!doctype html><title>Not found</title>",
          })
        : route.abort("failed");
    }
    if (path === "/__provider")
      return route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Provider</title><h1>Provider sign-in</h1>",
      });
    if (!path.startsWith("/api/"))
      return route.fulfill({
        response: await route.fetch({ url: `${local}${path}${url.search}` }),
      });
    if (path === "/api/v1/events") {
      for (const event of eventBatchSchema.parse(request.postDataJSON()).events)
        state.events.push({
          event: event.event,
          props: (event.props ?? {}) as Record<string, unknown>,
        });
      return route.fulfill({ status: 202, json: { accepted: 1 } });
    }
    if (path === "/api/v1/auth-config")
      return route.fulfill({
        json: {
          mode: "accounts",
          passwords: true,
          passkeySignup: true,
          parentFollowup: true,
          providers: ["google", "microsoft", "apple"],
        },
      });
    if (path === "/api/auth/get-session") return route.fulfill({ json: null });
    if (path === "/api/v1/billing/prices")
      return route.fulfill({
        json: { available: true, offers, extraOffers: [] },
      });
    if (path === "/api/v1/funding/invoice-offers")
      return route.fulfill({ json: { offers: [] } });
    if (path === "/api/v1/parent-followup/intent")
      return route.fulfill({ status: 204 });
    if (path === "/api/auth/sign-in/social") {
      state.social++;
      return route.fulfill({
        json: { url: `${origin}/__provider`, redirect: true },
      });
    }
    return route.fulfill({ status: 204 });
  });
}

const tryButton = (page: Page) =>
  page
    .getByRole("link", { name: /^Try it free/ })
    .or(page.getByRole("button", { name: /^Try it free/ }));
const google = (page: Page) =>
  page.getByRole("button", { name: "Continue with Google" });

async function run(
  browser: Browser,
  engine: "chromium" | "webkit",
  test: Case,
) {
  const tag = `${engine}-${test.name}`;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: agents[engine][test.app ?? "standard"],
    ...(test.gpc ? { extraHTTPHeaders: { "Sec-GPC": "1" } } : {}),
  });
  const state: State = {
    failing: true,
    documents: 0,
    events: [],
    social: 0,
    gtag: 0,
  };
  const pageErrors: string[] = [];
  const consoleLines: string[] = [];
  try {
    await intercept(context, test, state);
    // A visitor's browser, not an automated one: the Google tag loads.
    await context.addInitScript(`(() => {
      Object.defineProperty(Navigator.prototype, "webdriver", { configurable: true, get: () => false });
      ${test.gpc ? 'Object.defineProperty(Navigator.prototype, "globalPrivacyControl", { configurable: true, get: () => true });' : ""}
      globalThis.__violations = [];
      document.addEventListener("securitypolicyviolation", (e) =>
        globalThis.__violations.push(e.effectiveDirective + " " + e.blockedURI + " " + e.sourceFile + ":" + e.lineNumber));
    })();`);
    if (test.inject) await context.addInitScript({ content: injected });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame())
        consoleLines.push(`navigated: ${frame.url()}`);
    });
    page.on("request", (request) => {
      if (/\/assets\/SignInScreen-.*\.js/.test(request.url()))
        consoleLines.push(`request: ${request.url().split("/").pop()}`);
    });
    page.on("requestfailed", (request) => {
      if (/\/assets\//.test(request.url()))
        consoleLines.push(
          `failed: ${request.url().split("/").pop()} ${request.failure()?.errorText}`,
        );
    });
    page.on("requestfinished", async (request) => {
      if (/\/assets\/SignInScreen-/.test(request.url()))
        consoleLines.push(
          `file: ${request.url().split("/").pop()} ${(await request.response())?.status()}`,
        );
    });
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning")
        consoleLines.push(`${message.type()}: ${message.text().slice(0, 300)}`);
    });
    page.on("pageerror", (error) => {
      if (!/in-app bridge/.test(error.message)) pageErrors.push(error.message);
    });
    await page.goto(`${origin}/`);
    if (test.fail === "entry-chunk") {
      // The pitch's code is gone: one automatic reload, then the guard's
      // message in place of the wave, and its Reload works.
      const alert = page.getByRole("alert");
      await alert.filter({ hasText: "AMP didn’t finish loading." }).waitFor();
      assert.equal(state.documents, 2, `${tag}: one automatic reload`);
      await page.screenshot({ path: `${shots}/${tag}-message.png` });
      state.failing = false;
      await alert.getByRole("button", { name: "Reload" }).click();
    }
    await tryButton(page).first().click();
    if (test.fail === "sign-up-chunk") {
      const alert = page
        .getByRole("alert")
        .filter({ hasText: "This page didn’t finish loading." });
      await alert.waitFor();
      assert.equal(state.documents, 2, `${tag}: one automatic reload`);
      await page.screenshot({ path: `${shots}/${tag}-message.png` });
      state.failing = false;
      await page.getByRole("button", { name: "Reload", exact: true }).click();
    }
    if (test.fail === "auth-config") {
      // A clear message with a retry in place, which works once the
      // configuration answers again.
      const retry = page.getByRole("button", { name: /Try again|Retry/ });
      await page.getByRole("alert").first().waitFor();
      await retry.waitFor();
      await page.screenshot({ path: `${shots}/${tag}-message.png` });
      state.failing = false;
      await retry.click();
    }
    await page.waitForURL((url) => url.pathname === "/sign-up");
    await google(page).waitFor();
    assert.ok(await google(page).isEnabled(), `${tag}: Google can be pressed`);
    // A file that 404s once may load on the import's own retry; at most
    // one automatic reload.
    if (test.fail === "sign-up-chunk-once")
      assert.ok(state.documents <= 2, `${tag}: at most one reload`);
    // The page's stylesheet failed before any of AMP's code ran. Where the
    // browser reports the response's status, the entry guard reloads once;
    // either way the next step works.
    if (test.fail === "entry-css-once")
      assert.ok(state.documents <= 2, `${tag}: at most one reload`);
    await page.screenshot({ path: `${shots}/${tag}.png` });
    assert.equal(
      await page
        .getByText(/This screen could not be loaded|Something went wrong/)
        .count(),
      0,
      `${tag}: no error screen`,
    );
    assert.deepEqual(
      await page.evaluate(
        () =>
          (globalThis as unknown as { __violations: string[] }).__violations,
      ),
      [],
      `${tag}: nothing broke the content policy`,
    );
    assert.ok(
      (await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      )) <= 1,
      `${tag}: no horizontal overflow`,
    );

    if (test.continueWithGoogle) {
      await google(page).click();
      await page.getByRole("heading", { name: "Provider sign-in" }).waitFor();
      assert.equal(state.social, 1, `${tag}: one provider sign-in started`);
    }
    assert.deepEqual(pageErrors, [], `${tag}: no page error from AMP's code`);
    const blamed = state.events.filter(
      (e) =>
        e.event === "client_error" &&
        e.props.source === "app" &&
        e.props.category !== "chunk",
    );
    assert.deepEqual(blamed, [], `${tag}: no client_error blames AMP`);
    // GPC is the browser's opt-out: no first-party events and no Google tag
    // (lib/analytics.ts analyticsAllowed).
    if (test.gpc) {
      assert.equal(state.events.length, 0, `${tag}: GPC sends no events`);
      assert.equal(state.gtag, 0, `${tag}: GPC loads no Google tag`);
    } else if (!test.blocker)
      assert.ok(state.gtag > 0, `${tag}: the Google tag loaded`);
    else assert.equal(state.gtag, 0, `${tag}: the blocker kept the tag out`);
  } catch (error) {
    // What the visitor saw, and how the page got there.
    for (const page of context.pages())
      await page
        .screenshot({ path: `${shots}/${tag}-failure.png` })
        .catch((shot: unknown) => console.warn(`${tag}: no screenshot`, shot));
    console.log(
      `${tag}: ${state.documents} document(s)\n  ${[...pageErrors, ...consoleLines].join("\n  ")}`,
    );
    throw error;
  } finally {
    await context.close();
  }
}

const failures: string[] = [];
const passedPending: string[] = [];
try {
  for (const engine of engines) {
    const launch = (args: string[] = []) =>
      engine === "webkit"
        ? webkit.launch()
        : secureChromium(rawChromium).launch({ args });
    const browser = await launch();
    // Chromium's switch for the third-party cookie phase-out; WebKit blocks
    // third-party cookies by default.
    const strict =
      engine === "chromium"
        ? await launch(["--test-third-party-cookie-phaseout"])
        : browser;
    try {
      for (const test of cases) {
        if (only && !only.includes(test.name)) continue;
        const tag = `${engine}-${test.name}`;
        try {
          await run(test.noThirdPartyCookies ? strict : browser, engine, test);
          if (test.pending) passedPending.push(`${tag} (${test.pending})`);
          console.log(`PASS ${tag}`);
        } catch (error) {
          if (test.pending) {
            console.log(
              `PENDING ${tag}: ${test.pending}\n  ${String(error).split("\n")[0]}`,
            );
            continue;
          }
          failures.push(
            `${tag}: ${error instanceof Error ? error.message : error}`,
          );
          console.log(`FAIL ${tag}`);
        }
      }
    } finally {
      if (strict !== browser) await strict.close();
      await browser.close();
    }
  }
} finally {
  server.close();
}
if (passedPending.length)
  console.log(
    `These pass now; remove their \`pending\` mark:\n  ${passedPending.join("\n  ")}`,
  );
if (failures.length) {
  console.error(`\n${failures.length} failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("Hostile-environment entry: every case reaches a working sign-up.");
