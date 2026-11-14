/**
 * Product measurement is not under test, and a browser check never sends it.
 * A network route alone misses a `keepalive` send started while a document is
 * torn down (the `pagehide` flush in src/web/lib/analytics.ts), so the stub
 * sits in every document, ahead of the app: a POST to `/api/v1/events` (by
 * `fetch` or `sendBeacon`) is answered 202 in the page and never leaves it.
 * Each stubbed send is counted in the origin's localStorage, so a self-test
 * can see sends that happened during navigation and close.
 */
import assert from "node:assert/strict";
import type { BrowserContext } from "playwright";
import type pg from "pg";

const COUNT = "__ampEventsStubbed";

export async function stubAnalytics(context: BrowserContext) {
  // Plain source, not a compiled function: it runs before anything else in
  // the page and needs nothing tsx adds (`__name`).
  await context.addInitScript(`(() => {
    const key = ${JSON.stringify(COUNT)};
    const events = (url) => {
      try {
        return new URL(String(url), location.href).pathname === "/api/v1/events";
      } catch {
        return false;
      }
    };
    const note = () => {
      try {
        localStorage.setItem(key, String(Number(localStorage.getItem(key) || 0) + 1));
      } catch {}
    };
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : input;
      const method = String(
        (init && init.method) || (input instanceof Request ? input.method : "GET"),
      ).toUpperCase();
      if (method === "POST" && events(url)) {
        note();
        return Promise.resolve(
          new Response("{}", { status: 202, headers: { "content-type": "application/json" } }),
        );
      }
      return fetch(input, init);
    };
    if (typeof navigator.sendBeacon === "function") {
      const beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (url, data) => {
        if (!events(url)) return beacon(url, data);
        note();
        return true;
      };
    }
  })();`);
  // A backstop for anything that reaches the network all the same.
  await context.route("**/api/v1/events", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 202, json: {} })
      : route.fallback(),
  );
}

/** How many events this context's pages stubbed, across navigations. */
async function stubbed(context: BrowserContext, origin: string) {
  const page = await context.newPage();
  await page.goto(`${origin}/dev/personas`);
  const count = await page.evaluate(
    (key) => Number(localStorage.getItem(key) ?? 0),
    COUNT,
  );
  await page.close();
  return count;
}

/**
 * The stub holds through navigation and close: pages that measure are opened,
 * navigated away from and closed; their sends are counted as stubbed, and
 * (with the scratch database) the server recorded none of them.
 */
export async function analyticsSelfTest(
  context: BrowserContext,
  origin: string,
  paths: readonly string[],
  pool?: pg.Pool,
) {
  const rows = async () =>
    pool
      ? Number(
          (await pool.query("SELECT count(*)::int AS n FROM amp_funnel_events"))
            .rows[0].n,
        )
      : 0;
  const before = await rows();
  const start = await stubbed(context, origin);
  const page = await context.newPage();
  for (const path of paths) {
    await page.goto(`${origin}${path}`);
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
  // Teardown: the pagehide flush runs as the page closes.
  await page.close({ runBeforeUnload: true });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const end = await stubbed(context, origin);
  assert.ok(end > start, "the pages sent no measurement to stub");
  if (pool) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    assert.equal(await rows(), before, "a measurement reached the server");
  }
  return end - start;
}
