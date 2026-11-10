import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import {
  chromium as rawChromium,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { createServer } from "vite";
import { eventBatchSchema } from "../src/analytics/events";
import type { BrowserKind } from "../src/analytics/browser-kind";

/**
 * The pitch at `/` in the browsers paid ads open it in. TikTok, Instagram,
 * Facebook and Snapchat show links in their own webviews, which inject
 * scripts, refuse storage and autoplay, and leave out APIs. In Chromium
 * (Android user agents) and WebKit (iOS user agents), at 390 and 1280 px,
 * light and dark, under each condition:
 *
 * - the pitch paints with no horizontal overflow and no layout shift;
 * - the film shows its poster and plays on a tap;
 * - Buy and Try it free reach their sign-up screens, and Back returns;
 * - no error boundary shows and no `client_error` blames our code. The
 *   webview's own errors are still recorded, as external, at most three of a
 *   kind, and every error and landing names the browser it came from.
 *
 * The API is synthetic; nothing leaves the machine.
 *
 *     npx tsx scripts/verify-in-app-browser-ui.ts [--engine chromium|webkit|all]
 *       [--widths 390,1280] [--only control,tiktok,...] [--port 4570]
 *       [--shots DIR] [--verbose]
 */
const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const engines =
  (argument("engine") ?? "all") === "all"
    ? (["chromium", "webkit"] as const)
    : ([argument("engine")] as ["chromium" | "webkit"]);
const widths = (argument("widths") ?? "390,1280").split(",").map(Number);
const only = argument("only")?.split(",");
const verbose = process.argv.includes("--verbose");
const shots = argument("shots") ?? "artifacts/in-app-browser";
await mkdir(shots, { recursive: true });
const port = Number(argument("port") ?? 4570);
const origin = `http://127.0.0.1:${port}`;

/** Synthetic user agents in each app's published shape: iOS apps run WebKit,
 * Android apps run Chromium. */
const ios = (tail: string, safari = false) =>
  `Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) ${safari ? "Version/18.1 " : ""}Mobile/15E148${tail}`;
const android = (tail: string, webview = true) =>
  `Mozilla/5.0 (Linux; Android 14; Pixel 8${webview ? " Build/AP2A.240905.003; wv" : ""}) AppleWebKit/537.36 (KHTML, like Gecko) ${webview ? "Version/4.0 " : ""}Chrome/130.0.6723.107 Mobile Safari/537.36${tail}`;
const agents: Record<
  "chromium" | "webkit",
  Record<BrowserKind, string> & { control: string }
> = {
  webkit: {
    "inapp-tiktok": ios(
      " musical_ly_37.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US WKWebView/1 BytedanceWebview/d8a21c6",
    ),
    "inapp-instagram": ios(
      " Instagram 355.0.0.29.82 (iPhone15,2; iOS 18_1; en_US; en; scale=3.00; 1179x2556; 652843921)",
    ),
    "inapp-facebook": ios(
      " [FBAN/FBIOS;FBAV/489.0.0.40.109;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBLC/en_US]",
    ),
    "inapp-snapchat": ios(
      " Snapchat/13.20.0.43 (like Safari/8619.1.26.30.5, panda)",
    ),
    "inapp-other": ios(" Pinterest/iOS"),
    standard: ios(" Safari/604.1", true),
    control: ios(" Safari/604.1", true),
  },
  chromium: {
    "inapp-tiktok": android(
      " trill_370404 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/trill app_version/37.4.4 ByteLocale/en Region/US BytedanceWebview/d8a21c6",
    ),
    "inapp-instagram": android(
      " Instagram 355.0.0.29.82 Android (34/14; 420dpi; 1080x2400; Google/google; Pixel 8; shiba; shiba; en_US; 652843921)",
    ),
    "inapp-facebook": android(" [FB_IAB/FB4A;FBAV/489.0.0.40.109;]"),
    "inapp-snapchat": android(
      " Snapchat/13.20.0.43 (Pixel 8; Android 14; gzip)",
    ),
    "inapp-other": android(""),
    standard: android("", false),
    control: android("", false),
  },
};

type Hostility = "inject" | "storage" | "autoplay" | "keepalive" | "apis";
type Condition = {
  name: string;
  browser: BrowserKind;
  hostile: Hostility[];
};
const conditions: Condition[] = [
  { name: "control", browser: "standard", hostile: [] },
  { name: "tiktok", browser: "inapp-tiktok", hostile: ["inject"] },
  {
    name: "instagram",
    browser: "inapp-instagram",
    hostile: ["inject", "storage"],
  },
  {
    name: "facebook",
    browser: "inapp-facebook",
    hostile: ["autoplay", "keepalive"],
  },
  { name: "snapchat", browser: "inapp-snapchat", hostile: ["apis"] },
  {
    name: "everything",
    browser: "inapp-other",
    hostile: ["inject", "storage", "autoplay", "keepalive", "apis"],
  },
];

/** What each in-app webview does to a page, installed before any page script. */
function hostile(kinds: Hostility[]) {
  const scripts: string[] = [];
  if (kinds.includes("storage"))
    scripts.push(`(() => {
      const refuse = () => { throw new DOMException("The operation is insecure.", "SecurityError"); };
      for (const name of ["localStorage", "sessionStorage"]) {
        Object.defineProperty(window, name, { configurable: true, get: refuse });
        try { Object.defineProperty(Window.prototype, name, { configurable: true, get: refuse }); } catch {}
      }
      Object.defineProperty(Document.prototype, "cookie", { configurable: true, get: () => "", set: refuse });
    })();`);
  if (kinds.includes("autoplay"))
    // Playback needs a tap in the last second, as an in-app webview requires.
    scripts.push(`(() => {
      let tapped = -Infinity;
      for (const type of ["pointerdown", "pointerup", "click", "touchend"])
        addEventListener(type, (event) => { if (event.isTrusted) tapped = performance.now(); }, true);
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (performance.now() - tapped > 1000)
          return Promise.reject(new DOMException("play() needs a tap", "NotAllowedError"));
        return play.call(this);
      };
    })();`);
  if (kinds.includes("keepalive"))
    scripts.push(`(() => {
      const fetch = window.fetch;
      window.fetch = function (input, init) {
        if (init && init.keepalive) throw new TypeError("keepalive is not supported");
        return fetch.call(this, input, init);
      };
    })();`);
  if (kinds.includes("apis"))
    scripts.push(`(() => {
      delete window.IntersectionObserver;
      delete window.requestIdleCallback;
      delete window.cancelIdleCallback;
      delete Navigator.prototype.sendBeacon;
      window.matchMedia = (media) => ({ matches: false, media });
    })();`);
  if (kinds.includes("inject"))
    // The webview's own bridge: a native script, a cross-origin script and a
    // CORS script, each throwing on load, from a timer, and with an unhandled
    // rejection. The timer repeats one error, as a polling bridge does.
    scripts.push(`(() => {
      const bridge = () => { throw new Error("in-app bridge"); };
      setTimeout(() => { for (let i = 0; i < 6; i++) setTimeout(bridge, 100 * i); }, 1500);
      setTimeout(() => { Promise.reject(new Error("in-app bridge rejected")); }, 1600);
      document.addEventListener("DOMContentLoaded", () => {
        for (const [src, cors] of [["http://inapp-cdn.test/bridge.js", false], ["http://inapp-cors.test/bridge.js", true]]) {
          const script = document.createElement("script");
          if (cors) script.crossOrigin = "anonymous";
          script.src = src;
          document.head.append(script);
        }
      });
      throw new Error("in-app bridge on load");
    })();`);
  return scripts;
}
const bridgeScript = `setTimeout(() => { throw new Error("bridge timer"); }, 1700);
Promise.reject(new Error("bridge rejected"));
throw new Error("bridge on load");`;

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
async function serve(context: BrowserContext, events: Recorded[]) {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === "http://inapp-cdn.test")
      return route.fulfill({
        contentType: "text/javascript",
        body: bridgeScript,
      });
    if (url.origin === "http://inapp-cors.test")
      return route.fulfill({
        contentType: "text/javascript",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: bridgeScript,
      });
    if (url.origin !== origin) return route.abort();
    const path = url.pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (path === "/api/v1/events") {
      // The collector's own schema: a prop the server rejects fails here.
      const batch = eventBatchSchema.parse(request.postDataJSON());
      for (const event of batch.events)
        events.push({
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
          parentFollowup: true,
          providers: [],
        },
      });
    if (path === "/api/auth/get-session") return route.fulfill({ json: null });
    if (path === "/api/v1/billing/prices")
      return route.fulfill({
        json: { available: true, offers, extraOffers: [] },
      });
    if (path === "/api/v1/funding/invoice-offers")
      return route.fulfill({ json: { offers: [] } });
    if (path === "/api/v1/events/context")
      return route.fulfill({ json: { generation: "initial" } });
    return route.fulfill({ status: 204 });
  });
}

/** Where everything a parent reads or presses sits, in page coordinates. */
const layout = (page: Page) =>
  page.evaluate(() =>
    [
      "h1",
      "[data-pitch] figure",
      "[data-pitch] [data-buy] button",
      "[data-pitch] main section:nth-of-type(2)",
      "footer",
    ].map((selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box
        ? `${selector} ${Math.round(box.x)} ${Math.round(box.y + scrollY)} ${Math.round(box.width)} ${Math.round(box.height)}`
        : `${selector} missing`;
    }),
  );
const boundaryText = /This screen could not be loaded|Something went wrong/;
const heading = "See how far your child can go in math.";

async function run(
  browser: Browser,
  engine: "chromium" | "webkit",
  condition: Condition,
  width: number,
  colorScheme: "light" | "dark",
  navigate: boolean,
) {
  const tag = `${engine}-${condition.name}-${width}-${colorScheme}`;
  const context = await browser.newContext({
    viewport: { width, height: width >= 768 ? 900 : 844 },
    colorScheme,
    userAgent: agents[engine][condition.browser],
  });
  const events: Recorded[] = [];
  const pageErrors: string[] = [];
  try {
    await serve(context, events);
    for (const script of hostile(condition.hostile))
      await context.addInitScript({ content: script });
    if (engine === "chromium")
      await context.addInitScript(() => {
        const w = window as unknown as { shifts: number };
        w.shifts = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[])
            if (!entry.hadRecentInput) w.shifts += entry.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
    const page = await context.newPage();
    page.on("pageerror", (error) => {
      if (!/bridge/.test(error.message)) pageErrors.push(error.message);
    });
    const poster = page
      .waitForResponse(
        (response) => /pitch-fixture-poster/.test(response.url()),
        { timeout: 20_000 },
      )
      .catch(() => null);
    await page.goto(`${origin}/`);
    // Each condition is really in force in this page.
    assert.deepEqual(
      await page.evaluate(`(async () => {
        const throws = (read) => {
          try {
            read();
            return false;
          } catch {
            return true;
          }
        };
        return {
          storage: throws(() => localStorage) && throws(() => sessionStorage),
          keepalive: throws(() =>
            fetch("/api/v1/probe", { method: "POST", keepalive: true }),
          ),
          // An empty player's play() waits for a source unless refused.
          autoplay: await Promise.race([
            document
              .createElement("video")
              .play()
              .then(
                () => false,
                (error) => error.name === "NotAllowedError",
              ),
            new Promise((resolve) => setTimeout(() => resolve(false), 300)),
          ]),
          apis:
            typeof IntersectionObserver === "undefined" &&
            typeof requestIdleCallback === "undefined" &&
            typeof navigator.sendBeacon === "undefined" &&
            typeof matchMedia("(min-width: 1px)").addEventListener ===
              "undefined",
        };
      })()`),
      {
        storage: condition.hostile.includes("storage"),
        keepalive: condition.hostile.includes("keepalive"),
        autoplay: condition.hostile.includes("autoplay"),
        apis: condition.hostile.includes("apis"),
      },
      `${tag}: the conditions hold`,
    );
    await page.getByRole("heading", { name: heading }).waitFor();
    await page.getByRole("button", { name: "Buy AMP" }).first().waitFor();
    assert.equal((await poster)?.status(), 200, `${tag}: poster loads`);
    await page.evaluate(() => document.fonts.ready);
    const figure = await page.locator("[data-pitch] figure").boundingBox();
    assert.ok(
      figure && figure.height > 100 && figure.width > 100,
      `${tag}: the film's box shows`,
    );
    assert.ok(
      await page.evaluate(
        () =>
          !!document
            .querySelector("[data-pitch] video")
            ?.getAttribute("poster"),
      ),
      `${tag}: the film shows its poster`,
    );
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok((await overflow()) <= 1, `${tag}: no horizontal overflow`);
    const before = await layout(page);
    await page.screenshot({ path: `${shots}/${tag}.png` });
    // The webview's late errors arrive (1.5 s); nothing moves for them.
    await page.waitForTimeout(
      condition.hostile.includes("inject") ? 2400 : 300,
    );
    assert.deepEqual(await layout(page), before, `${tag}: nothing moves`);
    await page.getByRole("button", { name: /^Play .*with sound$/ }).click();
    await page.waitForFunction(
      () => {
        const video = document.querySelector("video");
        return !!video && video.currentTime > 0.3 && !video.paused;
      },
      undefined,
      { timeout: 15_000 },
    );
    assert.deepEqual(
      await layout(page),
      before,
      `${tag}: playing moves nothing`,
    );
    assert.ok((await overflow()) <= 1, `${tag}: no overflow while playing`);
    if (engine === "chromium")
      assert.equal(
        await page.evaluate(
          () => (window as unknown as { shifts: number }).shifts,
        ),
        0,
        `${tag}: cumulative layout shift`,
      );
    assert.equal(
      await page.getByText(boundaryText).count(),
      0,
      `${tag}: no error boundary`,
    );
    if (navigate) {
      // Buy and Try both sign up first; Back returns to the same pitch.
      for (const [name, entry, title] of [
        ["Buy AMP", "pitch-buy", "Create your account to buy"],
        ["Try it free", "pitch-try", "Try AMP free"],
      ] as const) {
        await page.getByRole("button", { name }).first().click();
        await page.getByRole("heading", { name: title }).waitFor();
        const url = new URL(page.url());
        assert.equal(url.pathname, "/sign-up", `${tag}: ${name} signs up`);
        assert.equal(url.searchParams.get("entry"), entry, `${tag}: ${name}`);
        assert.ok((await overflow()) <= 1, `${tag}: ${name} sign-up fits`);
        assert.equal(await page.getByText(boundaryText).count(), 0, tag);
        if (name === "Try it free")
          await page.screenshot({ path: `${shots}/${tag}-sign-up.png` });
        await page.goBack();
        await page.getByRole("heading", { name: heading }).waitFor();
      }
    }
    // Leaving delivers the queue, the way a closing webview does.
    await page.evaluate(() => dispatchEvent(new Event("pagehide")));
    const deadline = Date.now() + 5000;
    while (
      !events.some((event) => event.event === "landing_view") &&
      Date.now() < deadline
    )
      await page.waitForTimeout(100);
    await page.waitForTimeout(300);
    const landing = events.find((event) => event.event === "landing_view");
    assert.ok(landing, `${tag}: landing recorded`);
    assert.equal(landing.props.browser, condition.browser, `${tag}: browser`);
    const errors = events
      .filter((event) => event.event === "client_error")
      .map((event) => event.props);
    const ours = errors.filter(
      (error) => error.source === "app" || error.kind === "render",
    );
    assert.deepEqual(ours, [], `${tag}: no error from our code`);
    assert.deepEqual(pageErrors, [], `${tag}: no page errors`);
    for (const error of errors)
      assert.equal(error.browser, condition.browser, `${tag}: error browser`);
    if (condition.hostile.includes("inject")) {
      assert.ok(errors.length > 0, `${tag}: the webview's errors recorded`);
      const kinds = new Map<string, number>();
      for (const error of errors) {
        const key = JSON.stringify([
          error.kind,
          error.source,
          error.asset,
          error.line,
          error.column,
        ]);
        kinds.set(key, (kinds.get(key) ?? 0) + 1);
      }
      assert.ok(
        [...kinds.values()].every((count) => count <= 3) &&
          [...kinds.values()].includes(3),
        `${tag}: a repeated error stops at three (${JSON.stringify([...kinds])})`,
      );
    } else assert.deepEqual(errors, [], `${tag}: no errors`);
    if (verbose) console.log(tag, JSON.stringify(errors));
    return errors;
  } finally {
    await context.close();
  }
}

const vite = await createServer({
  cacheDir: "node_modules/.vite-in-app-browser",
  logLevel: "error",
  plugins: [
    {
      name: "absorb-late-api-requests",
      configureServer(server) {
        // A keepalive send can outlive its page and Playwright's interception.
        // Answer it here, before the dev proxy could forward it to an API.
        server.middlewares.use((request, response, next) => {
          if (!request.url?.startsWith("/api/")) return next();
          response.statusCode = 204;
          response.end();
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port, strictPort: true },
});
await vite.listen();
try {
  for (const engine of engines) {
    const browser = await (
      engine === "webkit" ? webkit : secureChromium(rawChromium)
    ).launch();
    try {
      const started = Date.now();
      const cases = conditions
        .filter((condition) => !only || only.includes(condition.name))
        .flatMap((condition) =>
          widths.flatMap((width) =>
            (["light", "dark"] as const).map(
              (scheme, index) =>
                [
                  condition,
                  width,
                  scheme,
                  // Navigation once per condition and width.
                  index === 0,
                ] as const,
            ),
          ),
        );
      const recorded: Record<string, unknown>[] = [];
      // A few pages at a time keeps the run short and the engine steady.
      for (let i = 0; i < cases.length; i += 3)
        for (const errors of await Promise.all(
          cases
            .slice(i, i + 3)
            .map(([condition, width, scheme, navigate]) =>
              run(browser, engine, condition, width, scheme, navigate),
            ),
        ))
          recorded.push(...errors);
      const tally = new Map<string, number>();
      for (const error of recorded) {
        const key = `${error.kind} from ${error.source ?? "no frame"}`;
        tally.set(key, (tally.get(key) ?? 0) + 1);
      }
      console.log(
        `PASS ${engine}: pitch in ${conditions
          .map((c) => c.name)
          .filter((name) => !only || only.includes(name))
          .join(
            ", ",
          )} at ${widths.join("/")} px, light and dark (${cases.length} pages, ${Math.round((Date.now() - started) / 1000)} s); none blamed on AMP; webview errors recorded: ${[...tally].map(([key, count]) => `${count} ${key}`).join(", ") || "none"}`,
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await vite.close();
}
