import { secureChromium } from "../browser-security.mjs";
/**
 * Search fields type instantly. For every search box that mirrors its text
 * into the URL (Lessons, Pathways, Inventory), a fast typing burst must:
 *
 * - land every character, in order (no dropped, doubled or reordered keys);
 * - add at most one history entry (the URL follows with `replace`);
 * - end with the query in the URL, so refresh restores it;
 * - paint each keystroke quickly. Input-to-paint is measured per keystroke
 *   with the Performance API (a capture-phase `keydown` timestamp to the
 *   frame after it) and reported, with Event Timing durations alongside.
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_fixture \
 *     npx tsx scripts/verify-search-typing-ui.ts [--production]
 *       [--cpu 4] [--report FILE] [--no-assert]
 */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { settle } from "./app-shell-probe";
import { startShellFixture } from "./app-shell-fixture";

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const cpu = Number(argument("cpu") ?? 1);
const report = argument("report");
const enforce = !process.argv.includes("--no-assert");
// Twenty characters at 40 a second: faster than most people type.
const TEXT = "numbers and fraction";
const KEY_DELAY = 25;
// A keystroke must reach the screen within this (p95). Before the field
// owned its text, Lessons measured p95 100–118 ms unthrottled and 1.2 s at 4x;
// after, 40 ms and 125 ms.
const PAINT_BUDGET_MS = cpu > 1 ? 200 : 60;

const fixture = await startShellFixture({
  production: process.argv.includes("--production"),
  webPort: Number(process.env.AMP_SEARCH_WEB_PORT ?? 4630),
});
const { origin } = fixture;
const browser = await chromium.launch();
const failures: string[] = [];
const check = (ok: unknown, message: string) => {
  if (!ok) failures.push(message);
};

/** Records each keystroke's input-to-paint and every value the field shows. */
const recorder = (selector: string) => {
  const input = document.querySelector<HTMLInputElement>(selector)!;
  const record = {
    paints: [] as number[],
    values: [] as string[],
    events: [] as { name: string; duration: number }[],
  };
  (window as unknown as { __typing: typeof record }).__typing = record;
  input.addEventListener(
    "keydown",
    (event) => {
      const start = event.timeStamp;
      // The frame after the keystroke: rAF runs before it paints, a message
      // posted from there runs once it has.
      requestAnimationFrame(() => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () =>
          record.paints.push(performance.now() - start);
        channel.port2.postMessage(0);
      });
    },
    { capture: true },
  );
  input.addEventListener("input", () => record.values.push(input.value));
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      if (["keydown", "keypress", "keyup", "input"].includes(entry.name))
        record.events.push({ name: entry.name, duration: entry.duration });
  }).observe({
    type: "event",
    durationThreshold: 16,
  } as PerformanceObserverInit);
};

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!
    : 0;
};
const round = (n: number) => Math.round(n * 10) / 10;

type Screen = {
  id: string;
  path: string;
  label: string;
  param: string;
};
const screens: Screen[] = [
  {
    id: "lessons",
    path: "/lessons",
    label: "Search lessons",
    param: "q",
  },
  {
    id: "pathways",
    path: "/pathways",
    label: "Find a skill",
    param: "topic",
  },
  {
    id: "inventory",
    path: "/inventory",
    label: "Search your skills",
    param: "topic",
  },
];
const results: Record<string, unknown> = {};

async function typeBurst(page: Page, screen: Screen) {
  const field = page.getByRole("searchbox", { name: screen.label });
  await field.click();
  const historyBefore = await page.evaluate(() => history.length);
  await page.evaluate(recorder, `input[aria-label="${screen.label}"]`);
  await field.pressSequentially(TEXT, { delay: KEY_DELAY });
  // Let the debounced URL write land, then read everything back.
  await page
    .waitForURL((url) => url.searchParams.get(screen.param) === TEXT, {
      timeout: 5000,
    })
    .catch(() => undefined);
  await settle(page, 400);
  const record = await page.evaluate(
    () =>
      (
        window as unknown as {
          __typing: {
            paints: number[];
            values: string[];
            events: { name: string; duration: number }[];
          };
        }
      ).__typing,
  );
  const historyAfter = await page.evaluate(() => history.length);
  return { field, record, added: historyAfter - historyBefore };
}

try {
  for (const screen of screens) {
    // A plain signed-in context: the fixture's layout recorder samples the
    // page every frame, which would be measured as typing lag.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: fixture.paid.state,
    });
    // tsx names the functions this script passes to the page.
    await context.addInitScript("globalThis.__name ??= (f) => f;");
    await context.addInitScript(
      `localStorage.setItem('amp.learner', ${JSON.stringify(
        JSON.stringify({
          state: { learnerId: fixture.paid.jordan.id },
          version: 1,
        }),
      )})`,
    );
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (cpu > 1) {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    }
    await page.goto(origin + screen.path, { waitUntil: "domcontentloaded" });
    await page.getByRole("searchbox", { name: screen.label }).waitFor();
    if (screen.id === "lessons")
      await page
        .locator("[data-lesson-id]")
        .first()
        .waitFor({ state: "attached" });
    await settle(page, 600);

    const { field, record, added } = await typeBurst(page, screen);
    const tag = `${screen.id}:`;
    const value = await field.inputValue();
    check(value === TEXT, `${tag} the field reads "${value}", not "${TEXT}"`);
    const expected = [...TEXT].map((_, i) => TEXT.slice(0, i + 1));
    check(
      JSON.stringify(record.values) === JSON.stringify(expected),
      `${tag} characters dropped or reordered: ${JSON.stringify(record.values)}`,
    );
    check(added <= 1, `${tag} one burst added ${added} history entries`);
    check(
      new URL(page.url()).searchParams.get(screen.param) === TEXT,
      `${tag} the URL did not follow the field (${page.url()})`,
    );
    const p95 = percentile(record.paints, 0.95);
    check(
      p95 <= PAINT_BUDGET_MS,
      `${tag} input-to-paint p95 ${round(p95)} ms exceeds ${PAINT_BUDGET_MS} ms`,
    );
    const keydowns = record.events
      .filter((e) => e.name === "keydown")
      .map((e) => e.duration);
    results[screen.id] = {
      keystrokes: record.paints.length,
      inputToPaintMs: {
        p50: round(percentile(record.paints, 0.5)),
        p95: round(p95),
        max: round(Math.max(0, ...record.paints)),
      },
      // Event Timing reports only events of 16 ms or more.
      eventTimingKeydownsOver16ms: keydowns.length,
      eventTimingKeydownMaxMs: round(Math.max(0, ...keydowns)),
      historyEntriesAdded: added,
      finalValue: value,
    };

    // Refresh restores the query.
    await page.reload();
    const restored = page.getByRole("searchbox", { name: screen.label });
    await restored.waitFor();
    await settle(page, 300);
    check(
      (await restored.inputValue()) === TEXT,
      `${tag} refresh lost the query ("${await restored.inputValue()}")`,
    );
    check(!errors.length, `${tag} page errors ${errors.join("; ")}`);
    await context.close();
  }
} finally {
  await browser.close();
  await fixture.close();
}
const summary = {
  cpuThrottle: cpu,
  text: TEXT,
  keyDelayMs: KEY_DELAY,
  results,
};
console.log(JSON.stringify(summary, null, 2));
if (report) await writeFile(report, JSON.stringify(summary, null, 2));
if (enforce)
  assert.deepEqual(failures, [], `Search typing:\n${failures.join("\n")}`);
else if (failures.length) console.log(`Not enforced:\n${failures.join("\n")}`);
console.log("Search typing verified.");
process.exit(0);
