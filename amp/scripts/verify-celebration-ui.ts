import { secureChromium } from "../browser-security.mjs";
/**
 * Colorful's moments on a slow machine, and Calm untouched.
 *
 * A child answers 20 problems on a school laptop's budget (the CPU slowed
 * six times through the DevTools protocol). Every answer is graded right
 * without help (the verdict is set on the way back, as verify-contrast does)
 * and the skill's record is set so that the run meets every moment: Earned on
 * the first answer, Strong on the fifth, streaks of 3, 5 and 10, the tenth
 * and twentieth point.
 *
 * Colorful: the celebration's own main-thread work (its `amp-celebration`
 * timings) stays under a long task (50 ms), no long task starts while only
 * its animations run, the page has zero layout shift, and every moment
 * played. Calm: the same 20 answers build no overlay and set no look, and
 * the screen is pixel for pixel the same with every Colorful rule taken out
 * of the page's styles, at a problem and at its feedback.
 *
 *   AMP_TEST_DATABASE_URL=… npx tsx scripts/verify-celebration-ui.ts
 */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { developmentAuth } from "../src/server/auth";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { migrate } from "./migrate";
import { practiceHere } from "./ui-controls";
import { openHome } from "./launcher";

const chromium = secureChromium(rawChromium);
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw Error("AMP_TEST_DATABASE_URL is required");
const WEB = Number(process.env.AMP_CELEBRATION_WEB_PORT ?? 4826);
const API = WEB + 1;
const ANSWERS = 20;
const THROTTLE = 6;
const LONG_TASK = 50;
/** A still frame: no caret blink, animations at their end. */
const still = { animations: "disabled", caret: "hide" } as const;
/** What only the animations do after an answer has settled: the burst, the
 * +1's flight and the chip's moment. */
const TAIL_MS = 1300;
const out = new URL("../artifacts/celebration/", import.meta.url).pathname;
await mkdir(out, { recursive: true });

await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const learner = await repository.create(
  "development-household",
  "Celebration check",
  2017,
);
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate: developmentAuth(),
  development: true,
});
await registerSchoolRoutes(app, {
  pool: repository.pool,
  authenticate: developmentAuth(),
});
await app.listen({ host: "127.0.0.1", port: API });
const origin = `http://127.0.0.1:${WEB}`;
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  cacheDir: new URL("../artifacts/celebration/vite-cache", import.meta.url)
    .pathname,
  logLevel: "error",
  server: {
    fs: { strict: false },
    host: "127.0.0.1",
    port: WEB,
    strictPort: true,
    proxy: { "/api": { target: `http://127.0.0.1:${API}` } },
  },
});
await vite.listen();

type Probe = {
  longTasks: { start: number; duration: number }[];
  celebration: { start: number; duration: number }[];
  shifts: { value: number; sources: string[] }[];
};

async function chooseLook(page: Page, look: "calm" | "bold") {
  const path = `${origin}/api/v1/learners/${learner.id}/practice-state`;
  // The development sign-in (server/auth.ts developmentAuth).
  const headers = { origin, authorization: "Bearer amp-local-development" };
  const state = (await (await page.request.get(path, { headers })).json()) as {
    revision: number;
  };
  const changed = await page.request.post(path, {
    data: {
      kind: "look",
      look,
      revision: state.revision,
      requestId: crypto.randomUUID(),
    },
    headers,
  });
  assert.equal(changed.status(), 200, await changed.text());
}

/** The page's styles with every Colorful rule taken out, then put back. */
async function withoutColorful(page: Page, shoot: () => Promise<Buffer>) {
  const removed = await page.evaluate(() => {
    const taken: { sheet: CSSStyleSheet; index: number; text: string }[] = [];
    const sweep = (sheet: CSSStyleSheet | CSSGroupingRule) => {
      const rules = sheet.cssRules;
      for (let i = rules.length - 1; i >= 0; i--) {
        const rule = rules[i]!;
        if (rule instanceof CSSGroupingRule) sweep(rule);
        else if (rule.cssText.includes("[data-look=")) {
          sheet.deleteRule(i);
          if (sheet instanceof CSSStyleSheet)
            taken.push({ sheet, index: i, text: rule.cssText });
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        sweep(sheet);
      } catch (error) {
        console.warn("A stylesheet could not be read", error);
      }
    }
    return taken.length;
  });
  const shot = await shoot();
  // Back as it was: a reload restores every sheet.
  return { removed, shot };
}

async function run(look: "calm" | "bold") {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => console.error("page error:", error.message));
  // tsx names nested functions with a helper the page doesn't have.
  await page.addInitScript("window.__name = (fn) => fn");
  await page.addInitScript(() => {
    const probe: Probe = { longTasks: [], celebration: [], shifts: [] };
    (window as unknown as { __probe: Probe }).__probe = probe;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        probe.longTasks.push({
          start: entry.startTime,
          duration: entry.duration,
        });
    }).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (entry.name === "amp-celebration")
          probe.celebration.push({
            start: entry.startTime,
            duration: entry.duration,
          });
    }).observe({ type: "measure", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        sources?: { node?: Node }[];
      })[])
        probe.shifts.push({
          value: entry.value,
          sources: (entry.sources ?? []).map((source) =>
            source.node instanceof Element
              ? `${source.node.tagName}.${source.node.className}`
              : String(source.node?.nodeName),
          ),
        });
    }).observe({ type: "layout-shift", buffered: true });
  });
  await chooseLook(page, look);
  // Typed problems only, so every answer is the same gesture.
  await page.route("**/batches", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fallback();
    await route.continue({
      postData: JSON.stringify({
        ...request.postDataJSON(),
        templateId: "mean-data",
      }),
    });
  });
  await page.route("**/attempts", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      response,
      json: { ...body, correct: true, assisted: false },
    });
  });
  // The skill's record as the run would make it: Earned on the first answer,
  // Strong on the fifth.
  let answered = 0;
  await page.route("**/progress?*", async (route) => {
    const skill = new URL(route.request().url()).searchParams.get("skill");
    const n = answered;
    const recent = Array.from({ length: Math.min(n, 5) }, () => ({
      correct: true,
      assisted: false,
      at: new Date().toISOString(),
    }));
    await route.fulfill({
      json: {
        asOf: new Date().toISOString(),
        skills: [
          {
            skillId: skill,
            attempts: n,
            independentCorrect: n,
            recentIndependentCorrect: Math.min(n, 5),
            independentOccasions: 1,
            status: n >= 5 ? "review-ready" : "practicing",
            lastPracticedAt: new Date().toISOString(),
            reviewDueAt: null,
            recent,
          },
        ],
      },
    });
  });
  await openHome(page, origin);
  await practiceHere(page, learner.id);
  await page.locator("#answer").waitFor();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  const played = new Set<string>();
  const windows: [number, number][] = [];
  let calmProblem: Buffer | null = null;
  let calmFeedback: Buffer | null = null;
  for (let i = 0; i < ANSWERS; i++) {
    await page.locator("#answer").fill("1");
    answered = i + 1;
    if (look === "calm" && i === 0) {
      const plain = await page.screenshot(still);
      const { removed, shot } = await withoutColorful(page, () =>
        page.screenshot(still),
      );
      assert.ok(removed > 0, "the page carries Colorful's rules to remove");
      assert.ok(plain.equals(shot), "Calm's problem is untouched by Colorful");
      calmProblem = plain;
      await page.reload();
      await page.locator("#answer").waitFor();
      await page.locator("#answer").fill("1");
    }
    await page.getByRole("button", { name: "Check" }).click();
    await page.locator(".feedback.correct").waitFor();
    // Watch the moments start (Colorful only).
    if (look === "bold")
      for (const part of await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>("[data-part][data-run]"),
        ].map((node) => `${node.dataset.part}:${node.dataset.kind}`),
      ))
        played.add(part);
    // The strength arrives (its record), and with it Strong or Earned.
    await page
      .locator("[data-strength]:not([aria-busy=true]) strong")
      .first()
      .waitFor();
    if (look === "bold")
      for (const part of await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>("[data-part][data-run]"),
        ].map((node) => `${node.dataset.part}:${node.dataset.kind}`),
      ))
        played.add(part);
    const settled = await page.evaluate(() => performance.now());
    await page.waitForTimeout(TAIL_MS);
    windows.push([settled, settled + TAIL_MS]);
    if (look === "calm" && i === 0) {
      const plain = await page.screenshot(still);
      const { shot } = await withoutColorful(page, () =>
        page.screenshot(still),
      );
      assert.ok(plain.equals(shot), "Calm's feedback is untouched by Colorful");
      calmFeedback = plain;
    }
    if (look === "calm")
      assert.equal(
        await page
          .evaluate(() => ({
            look: document.documentElement.getAttribute("data-look"),
            stage: !!document.querySelector("[data-celebration]"),
          }))
          .then((found) => JSON.stringify(found)),
        JSON.stringify({ look: null, stage: false }),
        "Calm sets no look and builds no overlay",
      );
    await page.getByRole("button", { name: /^Next/ }).click();
    await page.locator(".feedback").waitFor({ state: "detached" });
    await page.locator("#answer").waitFor();
  }
  const probe = await page.evaluate(
    () => (window as unknown as { __probe: Probe }).__probe,
  );
  if (look === "bold")
    await page.screenshot({ path: `${out}colorful-after-20.png` });
  else if (calmProblem && calmFeedback) {
    await writeFile(`${out}calm-problem.png`, calmProblem);
    await writeFile(`${out}calm-feedback.png`, calmFeedback);
  }
  await browser.close();
  return { probe, played, windows };
}

let failed = false;
// `--calm`: the Calm half only.
const calmOnly = process.argv.includes("--calm");
try {
  if (!calmOnly) await colorful();
  await calmRun();
  console.log("verify-celebration-ui: passed");
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  await vite.close();
  await app.close();
  await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
    learner.id,
  ]);
  await repository.pool.end();
}
process.exit(failed ? 1 : 0);

async function colorful() {
  const bold = await run("bold");
  const own = bold.probe.celebration;
  const slowest = Math.max(0, ...own.map((entry) => entry.duration));
  console.log(
    `Colorful at ${THROTTLE}x CPU: ${own.length} celebration timings, slowest ${slowest.toFixed(1)} ms`,
  );
  assert.ok(own.length >= ANSWERS, "every right answer was celebrated");
  assert.ok(
    slowest < LONG_TASK,
    `the celebration's own work stays under a long task (${slowest} ms)`,
  );
  const inTails = bold.probe.longTasks.filter((task) =>
    bold.windows.some(
      ([from, to]) =>
        task.start >= from && task.start < to && task.duration > LONG_TASK,
    ),
  );
  console.log(
    `Long tasks while only the animations ran: ${inTails.length}`,
    inTails,
  );
  assert.equal(inTails.length, 0, "no long task while a celebration plays");
  const shift = bold.probe.shifts.reduce((sum, entry) => sum + entry.value, 0);
  console.log(`Layout shift in Colorful: ${shift}`, bold.probe.shifts);
  assert.equal(shift, 0, "Colorful moves nothing");
  for (const moment of [
    "burst:right",
    "flyer:right",
    "chip:tick",
    "chipSparks:streak-3",
    "chipSparks:streak-5",
    "chipSparks:points-10",
    "stamp:earned",
    "confetti:strong",
  ])
    assert.ok(bold.played.has(moment), `${moment} played`);
  console.log("Moments seen:", [...bold.played].sort().join(", "));
}

async function calmRun() {
  const calm = await run("calm");
  const calmShift = calm.probe.shifts.reduce((sum, e) => sum + e.value, 0);
  console.log(`Calm: no overlay, no look; layout shift ${calmShift}`);
  assert.equal(calm.probe.celebration.length, 0, "Calm celebrates nothing");
}
