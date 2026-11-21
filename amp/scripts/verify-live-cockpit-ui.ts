/**
 * The live cockpit never moves under live data (round 2026-11-20, lane L).
 *
 * Opens the gallery's busy class (`/design/specimen/live-busy`, fixtures
 * only, no API or database) at 320, 390, 768 and 1280 px, applies 200
 * random changes as a stream would bring them (answers, help, sign-ins,
 * requests raised and resolved, time passing so statuses turn quiet), and
 * after every one asserts that each row's box, the strip's, the totals'
 * (and each tile's) and the control bar's are exactly where they were. It
 * also checks that the changes really happened and that nothing scrolls
 * sideways.
 *
 *   npx tsx scripts/verify-live-cockpit-ui.ts [--origin http://127.0.0.1:4860]
 *     [--shots-only]    skip the check (only with --shots)
 *     [--shots <dir>]   also save each designed state at 390 and 1280 px in
 *                       light and dark, and the busy state at 320 and 768.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { secureChromium } from "../browser-security.mjs";

const chromium = secureChromium(rawChromium);
const arg = (name: string) => {
  const at = process.argv.indexOf(name);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const WIDTHS = [320, 390, 768, 1280] as const;
const HEIGHT = (width: number) =>
  width >= 1024 ? 800 : width >= 768 ? 1024 : 844;
const CHANGES = 200;

let vite: ViteDevServer | undefined;
let origin = arg("--origin");
if (!origin) {
  const port = Number(arg("--port") ?? 4862);
  vite = await createServer({
    configFile: new URL("../vite.config.ts", import.meta.url).pathname,
    server: { host: "127.0.0.1", port, strictPort: true },
    logLevel: "warn",
  });
  await vite.listen();
  origin = `http://127.0.0.1:${port}`;
}

type Box = { x: number; y: number; width: number; height: number };
type Boxes = Record<string, Box>;

/** Every box that must hold still, by a stable name. */
async function measure(page: Page): Promise<Boxes> {
  return page.evaluate(() => {
    const out: Record<string, Box> = {};
    const put = (name: string, element: Element | null) => {
      if (!element) return;
      const r = element.getBoundingClientRect();
      out[name] = { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    for (const row of document.querySelectorAll<HTMLElement>("[data-live-row]"))
      put(`row:${row.dataset.liveRow}`, row.closest("tr") ?? row);
    put("strip", document.querySelector("[data-live-strip]"));
    put("totals", document.querySelector("[data-live-totals]"));
    for (const tile of document.querySelectorAll<HTMLElement>("[data-tile]"))
      put(`tile:${tile.dataset.tile}`, tile);
    put("control", document.querySelector("[data-live-control]"));
    put("roster", document.querySelector("[data-live-roster]"));
    return out;
  });
}

/** What the changes change: proof the check isn't watching a still page. */
const content = (page: Page) =>
  page.evaluate(() => ({
    roster: document.querySelector("[data-live-roster]")?.textContent ?? "",
    requests: document.querySelectorAll("[data-signal]").length,
    empty: document.querySelector("[data-live-strip][data-empty]") !== null,
    marks: [...document.querySelectorAll("[data-live-roster] svg[data-status]")]
      .map((mark) => mark.getAttribute("data-status"))
      .join(","),
  }));

const frames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

async function open(page: Page, specimen: string) {
  // tsx names the functions it compiles; the page has no such helper.
  await page.addInitScript("globalThis.__name ??= (f) => f");
  await page.goto(`${origin}/design/specimen/${specimen}`);
  await page.waitForFunction(() => window.ampLiveFixture?.ready === true);
  await page.evaluate(() => document.fonts.ready);
  await frames(page);
}

const browser = await chromium.launch();
const failures: string[] = [];
try {
  for (const width of process.argv.includes("--shots-only") ? [] : WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: HEIGHT(width) },
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await open(page, "live-busy");
    const before = await measure(page);
    const rows = Object.keys(before).filter((key) => key.startsWith("row:"));
    assert.equal(rows.length, 14, `${width}px: 14 rows drawn`);
    for (const name of ["strip", "totals", "control", "roster"])
      assert.ok(before[name], `${width}px: ${name} drawn`);
    const first = await content(page);
    const seen = {
      requests: new Set<number>(),
      empty: false,
      marks: new Set<string>(),
    };
    for (let change = 1; change <= CHANGES; change++) {
      await page.evaluate(
        (seed) => window.ampLiveFixture!.change(seed),
        width * 1000 + change,
      );
      await frames(page);
      const now = await measure(page);
      for (const [name, box] of Object.entries(before)) {
        const after = now[name];
        if (!after) {
          failures.push(`${width}px change ${change}: ${name} disappeared`);
          continue;
        }
        for (const side of ["x", "y", "width", "height"] as const)
          if (Math.abs(after[side] - box[side]) > 0.5)
            failures.push(
              `${width}px change ${change}: ${name} ${side} ${box[side].toFixed(1)} → ${after[side].toFixed(1)}`,
            );
      }
      const state = await content(page);
      seen.requests.add(state.requests);
      seen.empty ||= state.empty;
      seen.marks.add(state.marks);
    }
    const last = await content(page);
    assert.notEqual(
      last.roster,
      first.roster,
      `${width}px: the figures changed`,
    );
    assert.ok(seen.requests.size > 1, `${width}px: requests came and went`);
    assert.ok(seen.marks.size > 1, `${width}px: statuses changed`);
    const sideways = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    assert.ok(
      sideways <= 0,
      `${width}px: the page scrolls sideways by ${sideways}px`,
    );
    assert.deepEqual(errors, [], `${width}px: no page errors`);
    console.log(
      `${width}px: ${rows.length} rows, strip, totals and control held still over ${CHANGES} changes (requests shown: ${[...seen.requests].sort((a, b) => a - b).join(", ")})`,
    );
    await context.close();
  }
  if (failures.length) {
    console.error(failures.slice(0, 40).join("\n"));
    throw new Error(`${failures.length} box(es) moved`);
  }

  const shots = arg("--shots");
  if (shots) {
    await mkdir(shots, { recursive: true });
    const states = ["resting", "started", "half", "busy", "edges", "class-35"];
    const plan: [string, number, "light" | "dark"][] = [];
    for (const state of states)
      for (const width of [390, 1280])
        for (const theme of ["light", "dark"] as const)
          plan.push([state, width, theme]);
    for (const width of [320, 768])
      for (const theme of ["light", "dark"] as const)
        plan.push(["busy", width, theme]);
    for (const [state, width, theme] of plan) {
      const context = await browser.newContext({
        viewport: { width, height: HEIGHT(width) },
        colorScheme: theme,
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      await open(page, `live-${state}`);
      // The document fades in once; shoot it settled.
      await page.waitForTimeout(1200);
      await page.screenshot({
        path: `${shots}/${state}-${width}-${theme}.png`,
      });
      await context.close();
    }
    console.log(`Saved ${plan.length} screenshots in ${shots}`);
  }
} finally {
  await browser.close();
  await vite?.close();
}
