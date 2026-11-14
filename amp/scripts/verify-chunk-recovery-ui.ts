import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { preview } from "vite";
import {
  chromium as rawChromium,
  type BrowserContext,
  type Page,
} from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { eventBatchSchema } from "../src/analytics/events";

// Run after npm run build. Only local static assets and synthetic API responses.
const shots = process.env.AMP_QA_REPORT_DIR ?? "artifacts/chunk-recovery";
await mkdir(shots, { recursive: true });
const server = await preview({
  configFile: false,
  build: { outDir: "dist" },
  preview: { host: "127.0.0.1", port: 4850, strictPort: true },
  plugins: [
    {
      name: "local-api-only",
      configurePreviewServer(server) {
        server.middlewares.use((request, response, next) => {
          if (!request.url?.startsWith("/api/")) return next();
          response.statusCode = 204;
          response.end();
        });
      },
    },
  ],
});
const origin = "http://127.0.0.1:4850";
const browser = await secureChromium(rawChromium).launch();
type Recorded = { event: string; props: Record<string, unknown> };
async function fixture(
  context: BrowserContext,
  failCss = false,
  failAsset?: (pathname: string, documents: number) => boolean,
) {
  const events: Recorded[] = [];
  const receivedIds = new Set<string>();
  const state = {
    failCss,
    failAsset,
    documents: 0,
    events,
    aborted: [] as string[],
  };
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (request.isNavigationRequest()) state.documents++;
    if (url.pathname === "/api/v1/events") {
      // The collector deduplicates retries and pagehide's in-flight batches.
      for (const event of eventBatchSchema.parse(request.postDataJSON())
        .events) {
        if (event.id && receivedIds.has(event.id)) continue;
        if (event.id) receivedIds.add(event.id);
        events.push(event as Recorded);
      }
      return route.fulfill({ status: 202 });
    }
    if (url.pathname === "/api/v1/auth-config")
      return route.fulfill({
        json: {
          mode: "accounts",
          passwords: true,
          providers: ["google"],
          passkeySignup: true,
          parentFollowup: true,
        },
      });
    if (url.pathname === "/api/auth/get-session")
      return route.fulfill({ json: null });
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 204 });
    if (state.failAsset?.(url.pathname, state.documents)) {
      state.aborted.push(url.pathname);
      return route.abort();
    }
    if (
      state.failCss &&
      /\/assets\/SignInScreen-[^/]+\.css$/.test(url.pathname)
    )
      return route.abort();
    return route.continue();
  });
  return state;
}
async function diagnostics(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.waitForTimeout(150);
}
async function checkGeometry(page: Page) {
  const result = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    buttons: [...document.querySelectorAll("button")]
      .filter((el) => el.textContent === "Reload")
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          width: r.width,
          height: r.height,
          left: r.left,
          right: r.right,
        };
      }),
  }));
  assert(result.scroll <= result.width, JSON.stringify(result));
  assert(result.buttons.length);
  for (const r of result.buttons)
    assert(
      r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= result.width,
      JSON.stringify(r),
    );
}
async function injectChunk(
  page: Page,
  kind: "preload" | "rejection" | "error" = "preload",
) {
  await page
    .evaluate((kind) => {
      const error = new TypeError(
        "Failed to fetch dynamically imported module: synthetic",
      );
      if (kind === "preload") {
        const event = new Event("vite:preloadError", { cancelable: true });
        Object.assign(event, { payload: error });
        window.dispatchEvent(event);
      } else if (kind === "rejection") {
        window.dispatchEvent(
          new PromiseRejectionEvent("unhandledrejection", {
            reason: error,
            promise: Promise.resolve(),
          }),
        );
      } else
        window.dispatchEvent(
          new ErrorEvent("error", {
            error,
            message: error.message,
            filename: `${location.origin}/assets/probe-ABCdef12.js`,
          }),
        );
    }, kind)
    .catch((error) => {
      // Automatic recovery may replace the execution context immediately.
      if (!/Execution context was destroyed/.test(String(error))) throw error;
    });
}
// Real imports exercise the route loader's rejection path, including any reload
// it might attempt independently of Vite and the application's recovery guard.
async function verifyRouteImports() {
  const failures: unknown[] = [];
  for (const mode of [
    "payment",
    "recent",
    "mixed",
    "input",
    "storage",
    "plain",
  ] as const) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
    });
    try {
      const state = await fixture(context, false, (pathname, documents) => {
        if (mode === "payment")
          return /\/assets\/LegacyApp-[^/]+\.js$/.test(pathname);
        if (mode === "input")
          return /\/assets\/AccessScreen-[^/]+\.js$/.test(pathname);
        if (mode === "mixed" && documents === 1)
          return /\/assets\/SignInScreen-[^/]+\.css$/.test(pathname);
        return /\/assets\/SignInScreen-[^/]+\.js$/.test(pathname);
      });
      if (mode === "recent")
        await context.addInitScript(() => {
          sessionStorage.setItem("amp.release-reload", String(Date.now()));
        });
      if (mode === "storage")
        await context.addInitScript(() => {
          Object.defineProperty(window, "sessionStorage", {
            get() {
              throw new DOMException("disabled", "SecurityError");
            },
          });
        });
      const page = await context.newPage();
      await page.goto(
        `${origin}${
          mode === "payment"
            ? "/?billing=processing&purchase=00000000-0000-4000-8000-000000000001"
            : "/sign-up"
        }`,
      );
      if (mode === "input") {
        const input = page.locator('input[type="email"]');
        await input.fill("synthetic@example.test");
        // Navigate through browser history without replacing the document.
        // The guard must protect edits even after the control unmounts.
        await page.evaluate(() => {
          history.pushState({}, "", "/access");
          dispatchEvent(new PopStateEvent("popstate"));
        });
      }
      // Allow an independent reload to settle before checking the count.
      await page.waitForTimeout(2500);
      assert(
        state.aborted.some((path) => path.endsWith(".js")),
        `${mode}: aborted real JS`,
      );
      if (mode === "mixed")
        assert(state.aborted.some((path) => path.endsWith(".css")));
      assert.equal(
        state.documents,
        mode === "mixed" || mode === "plain" ? 2 : 1,
        `${mode}: guarded document count`,
      );
      await page.getByRole("button", { name: "Reload", exact: true }).waitFor();
      // Storage exceptions must not replace the chunk error with "Try again".
      assert.equal(
        await page
          .getByRole("button", { name: "Try again", exact: true })
          .count(),
        0,
      );
      await page
        .locator(".app-loading-body")
        .getByRole("button", { name: "Reload", exact: true })
        .waitFor();
      await checkGeometry(page);
      await diagnostics(page);
      const blocked = mode === "mixed" || mode === "plain" ? "recent" : mode;
      assert(
        state.events.some(
          (event) =>
            event.props.code === "chunk_reload_blocked" &&
            event.props.reloadBlock === blocked,
        ),
        `${mode}: blocked diagnostic`,
      );
      assert.equal(
        state.events.filter((event) => event.props.code === "chunk_reload")
          .length,
        mode === "mixed" || mode === "plain" ? 1 : 0,
      );
      assert.doesNotMatch(
        JSON.stringify(state.events),
        /synthetic@example|00000000-0000|stack|message|https?:/,
      );
      await page.screenshot({ path: join(shots, `route-js-${mode}.png`) });
      if (mode === "input") {
        await page.goBack();
        const input = page.locator('input[type="email"]');
        await input.waitFor();
        assert.equal(
          await input.inputValue(),
          "synthetic@example.test",
          "draft survives failed route and Back",
        );
        assert.equal(state.documents, 1);
      } else {
        state.failAsset = undefined;
        await page.getByRole("button", { name: "Reload", exact: true }).click();
        if (mode === "payment")
          await page
            .getByRole("button", { name: "Reload", exact: true })
            .waitFor({ state: "hidden" });
        else await page.locator('input[type="email"]').waitFor();
        assert.equal(
          state.documents,
          mode === "mixed" || mode === "plain" ? 3 : 2,
          `${mode}: manual recovery`,
        );
      }
      console.log(`real route import / ${mode}: passed`);
    } catch (error) {
      console.error(`real route import / ${mode}: FAILED`, error);
      failures.push(error);
    } finally {
      await context.close();
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "Real route import regressions");
}
async function verifyOtherRecovery() {
  // A real failed Vite CSS chunk reloads once and then settles on calm recovery.
  for (const colorScheme of ["light", "dark"] as const)
    for (const width of [320, 390, 768, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme,
      });
      try {
        const state = await fixture(context, true),
          page = await context.newPage();
        await page.goto(`${origin}/sign-up`);
        await page
          .getByRole("button", { name: "Reload", exact: true })
          .waitFor();
        await page.waitForTimeout(600);
        assert.equal(state.documents, 2, "one automatic reload, no loop");
        await checkGeometry(page);
        await page.screenshot({
          path: join(shots, `route-${width}-${colorScheme}.png`),
        });
        await diagnostics(page);
        assert(
          state.events.some(
            (e) =>
              e.event === "client_error" && e.props.code === "chunk_reload",
          ),
        );
        assert(
          state.events.some(
            (e) =>
              e.event === "client_error" &&
              e.props.code === "chunk_reload_blocked" &&
              e.props.reloadBlock === "recent",
          ),
        );
        state.failCss = false;
        await page.getByRole("button", { name: "Reload", exact: true }).click();
        await page.locator('input[type="email"]').waitFor();
        assert.equal(state.documents, 3, "manual reload recovers");
        // An actual controlled form edit must survive a chunk failure.
        const input = page.locator('input[type="email"]');
        await input.fill("synthetic@example.test");
        const before = await input.boundingBox();
        await injectChunk(page, "rejection");
        await page
          .getByRole("alert")
          .filter({ hasText: "This screen could not be loaded." })
          .waitFor();
        await checkGeometry(page);
        assert.deepEqual(
          await input.boundingBox(),
          before,
          "toast must not shift form",
        );
        assert.equal(await input.inputValue(), "synthetic@example.test");
        assert.equal(
          state.documents,
          3,
          "unsaved input blocks automatic reload",
        );
        await page.waitForTimeout(350);
        await page.screenshot({
          path: join(shots, `form-${width}-${colorScheme}.png`),
        });
        await diagnostics(page);
        assert(
          state.events.some(
            (e) =>
              e.props.code === "chunk_reload_blocked" &&
              e.props.reloadBlock === "input",
          ),
        );
        assert.doesNotMatch(
          JSON.stringify(state.events),
          /synthetic@example|stack|message|https?:/,
        );
        console.log(
          `${width}/${colorScheme}: once, manual recovery, form preserved, stable geometry`,
        );
      } finally {
        await context.close();
      }
    }
  for (const mode of ["payment", "storage", "privacy", "error"] as const) {
    const context = await browser.newContext();
    try {
      const state = await fixture(context),
        page = await context.newPage();
      if (mode === "storage")
        await context.addInitScript(() => {
          Object.defineProperty(window, "sessionStorage", {
            get() {
              throw new DOMException("disabled", "SecurityError");
            },
          });
        });
      if (mode === "privacy")
        await context.addInitScript(() =>
          Object.defineProperty(navigator, "doNotTrack", { value: "1" }),
        );
      await page.goto(
        `${origin}/sign-up${mode === "payment" ? "?billing=processing&purchase=synthetic" : ""}`,
      );
      await page.locator('input[type="email"]').waitFor();
      await injectChunk(page, mode === "error" ? "error" : "preload");
      if (mode === "payment" || mode === "storage") {
        await page
          .getByRole("button", { name: "Reload", exact: true })
          .waitFor();
        assert.equal(state.documents, 1);
        await diagnostics(page);
        assert(
          state.events.some(
            (e) =>
              e.props.code === "chunk_reload_blocked" &&
              e.props.reloadBlock === mode,
          ),
        );
      } else {
        await page.waitForFunction(() =>
          performance
            .getEntriesByType("navigation")
            .some(
              (entry) =>
                (entry as PerformanceNavigationTiming).type === "reload",
            ),
        );
        await page.locator('input[type="email"]').waitFor();
        assert.equal(state.documents, 2);
        if (mode === "privacy") assert.equal(state.events.length, 0);
      }
      console.log(`${mode}: verified`);
    } finally {
      await context.close();
    }
  }
  for (const userAgent of [
    "Instagram 355",
    "FBAN/FBIOS",
    "TikTok BytedanceWebview",
    "Mozilla/5.0 Safari/605.1",
  ]) {
    const context = await browser.newContext({ userAgent });
    try {
      const state = await fixture(context),
        page = await context.newPage();
      await page.goto(`${origin}/sign-up`);
      await page.locator('input[type="email"]').waitFor();
      await page.evaluate(() => {
        for (let i = 0; i < 60; i++) {
          const error = new Error("synthetic private text");
          error.stack =
            "Error\n at bridge (https://injected.example/bridge.js:1:2)";
          if (i % 2)
            window.dispatchEvent(
              new ErrorEvent("error", {
                error,
                filename: "https://injected.example/bridge.js",
              }),
            );
          else
            window.dispatchEvent(
              new PromiseRejectionEvent("unhandledrejection", {
                reason: error,
                promise: Promise.resolve(),
              }),
            );
        }
        const error = new Error("synthetic private text");
        error.stack = `Error\n at run (${location.origin}/assets/probe-ABCdef12.js:1:2)`;
        window.dispatchEvent(
          new ErrorEvent("error", {
            error,
            filename: `${location.origin}/assets/probe-ABCdef12.js`,
          }),
        );
      });
      await diagnostics(page);
      if (userAgent.startsWith("Mozilla")) {
        assert(!state.events.some((e) => e.event === "external_runtime_error"));
        assert(
          state.events.some(
            (e) => e.event === "client_error" && e.props.source === "external",
          ),
        );
      } else {
        assert.equal(
          state.events
            .filter((e) => e.event === "external_runtime_error")
            .reduce((total, e) => total + Number(e.props.count), 0),
          60,
        );
        assert(
          !state.events.some(
            (e) => e.event === "client_error" && e.props.source === "external",
          ),
        );
      }
      assert(
        state.events.some(
          (e) => e.event === "client_error" && e.props.source === "app",
        ),
      );
      assert.doesNotMatch(
        JSON.stringify(state.events),
        /private text|injected.example|stack|message/,
      );
      console.log(
        `${userAgent}: attribution and private-data exclusion verified`,
      );
    } finally {
      await context.close();
    }
  }
}
try {
  await verifyRouteImports();
  if (!process.argv.includes("--route-imports-only"))
    await verifyOtherRecovery();
} finally {
  await browser.close();
  await new Promise<void>((resolve) =>
    server.httpServer.close(() => resolve()),
  );
}
