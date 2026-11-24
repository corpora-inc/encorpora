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
import { openMenu, practiceHere } from "./ui-controls";
import { openHome } from "./launcher";
import { resolveTheme, type Rgba } from "./color-system";
import { practicePath } from "../src/web/features/spaces/identity";

const chromium = secureChromium(rawChromium);
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw Error("AMP_TEST_DATABASE_URL is required");
const WEB = Number(process.env.AMP_CELEBRATION_WEB_PORT ?? 4826);
const API = WEB + 1;
/** Roles whose colors carry meaning and stay Calm's in Colorful (as
 * tests/color-roles.test.ts has them). */
const FIXED =
  /^--color-(strand-|grade-|heat-|dose-|coin-|bill-|avatar-|on-avatar-|provider|on-provider|brand-|print-)/;
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
  // Every moment the stage starts, as it starts (stage.ts sets `data-run`
  // on its part). The record's moments (Earned, Strong) start a frame or
  // more after the strength shows, from an effect and the stage's own next
  // frame; a look at the page at that instant can come before them.
  await page.addInitScript(() => {
    const started: string[] = [];
    (window as unknown as { __moments: string[] }).__moments = started;
    new MutationObserver((records) => {
      for (const record of records) {
        const node = record.target as HTMLElement;
        if (node.dataset?.run && node.dataset.part)
          started.push(`${node.dataset.part}:${node.dataset.kind}`);
      }
    }).observe(document, {
      attributes: true,
      attributeFilter: ["data-run"],
      subtree: true,
    });
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
  const hueWindows: [number, number][] = [];
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
    // The new problem's world turns (400 ms): one property, every role.
    // Nothing else runs while it does.
    const turned = await page.evaluate(() => performance.now());
    await page.waitForTimeout(700);
    hueWindows.push([turned + 60, turned + 700]);
  }
  const probe = await page.evaluate(
    () => (window as unknown as { __probe: Probe }).__probe,
  );
  for (const moment of await page.evaluate(
    () => (window as unknown as { __moments: string[] }).__moments,
  ))
    played.add(moment);
  if (look === "bold")
    await page.screenshot({ path: `${out}colorful-after-20.png` });
  else if (calmProblem && calmFeedback) {
    await writeFile(`${out}calm-problem.png`, calmProblem);
    await writeFile(`${out}calm-feedback.png`, calmFeedback);
  }
  await browser.close();
  return { probe, played, windows, hueWindows };
}

let failed = false;
// `--calm`: the Calm half only; `--sweep`: the leftover-color sweep only;
// `--hold`: only "a problem holds still and no press is lost".
const calmOnly = process.argv.includes("--calm");
const sweepOnly = process.argv.includes("--sweep");
const holdOnly = process.argv.includes("--hold");
try {
  if (!sweepOnly && !holdOnly) {
    if (!calmOnly) await colorful();
    await calmRun();
  }
  if (!sweepOnly)
    for (const look of ["calm", "bold"] as const) await holds(look);
  if (!calmOnly && !holdOnly) await leftoverSweep();
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
  // What the page did comes before how fast: on a machine busy with other
  // work a frame can run a few ms over the long-task budget below, and that
  // must not hide whether anything moved or a moment went missing.
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
  const inTurns = bold.probe.longTasks.filter((task) =>
    bold.hueWindows.some(
      ([from, to]) =>
        task.start >= from && task.start < to && task.duration > LONG_TASK,
    ),
  );
  console.log(
    `Long tasks while a new problem's world turned: ${inTurns.length}`,
    inTurns,
  );
  assert.equal(inTurns.length, 0, "turning the world is no long task");
}

/**
 * A problem holds still and no press is lost, in each look.
 *
 * A new problem is in its place from its first frame: its question never
 * moves while it arrives (Colorful once slid the whole problem up 36 px
 * over 220 ms, and every box in it read differently from one frame to the
 * next). And a press on the top edge of anything a child presses is a press
 * on it: Colorful's pressed controls go down a few pixels, and a mouse or
 * trackpad press on the strip they left used to let go over whatever was
 * behind, so the click went there and the tap was lost.
 */
async function holds(look: "calm" | "bold") {
  const browser = await chromium.launch();
  const name = look === "bold" ? "Colorful" : "Calm";
  let presses = 0;
  let arrivals = 0;
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    page.on("pageerror", (error) =>
      console.error("page error:", error.message),
    );
    await page.addInitScript("window.__name = (fn) => fn");
    // From the document's first frame: where each problem's question is, on
    // each of the first frames it is on screen.
    await page.addInitScript(() => {
      const seen: Record<string, number[]> = {};
      (window as unknown as { __arrivals: typeof seen }).__arrivals = seen;
      const tick = () => {
        const content = document.querySelector<HTMLElement>(
          ".problem-stage .problem-content",
        );
        const id = content?.dataset.problemId;
        const question = content?.querySelector(".question");
        const stage = content?.closest(".problem-stage");
        if (id && question && stage) {
          const frames = (seen[id] ??= []);
          if (frames.length < 40)
            frames.push(
              Math.round(
                (question.getBoundingClientRect().top + stage.scrollTop) * 100,
              ) / 100,
            );
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    // While `__held` is on, a click is recorded and goes no further, so a
    // press can be tried on every control without answering anything.
    await page.addInitScript(() => {
      const w = window as unknown as { __held: boolean; __clicks: Element[] };
      w.__held = false;
      w.__clicks = [];
      document.addEventListener(
        "click",
        (event) => {
          if (!w.__held) return;
          w.__clicks.push(event.target as Element);
          event.preventDefault();
          event.stopPropagation();
        },
        true,
      );
    });
    await chooseLook(page, look);
    await page.route("**/attempts", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: { ...body, correct: true, assisted: false },
      });
    });
    await openHome(page, origin);
    await practiceHere(page, learner.id);
    /** Each problem this document has shown, with where its question was on
     * its first frames: read before the document is left. */
    const watched: [string, number[]][] = [];
    const collect = async () =>
      watched.push(
        ...Object.entries(
          await page.evaluate(
            () =>
              (window as unknown as { __arrivals: Record<string, number[]> })
                .__arrivals,
          ),
        ),
      );
    /** Presses each control on its top edge with a mouse; the click must
     * land on that control. */
    const pressEdges = async (selector: string, what: string) => {
      const controls = page.locator(selector);
      const count = await controls.count();
      for (let i = 0; i < count; i++) {
        const control = controls.nth(i);
        if (!(await control.isVisible()) || !(await control.isEnabled()))
          continue;
        await control.scrollIntoViewIfNeeded();
        const box = (await control.boundingBox())!;
        for (const down of [1, 2.5]) {
          await page.evaluate(() => {
            const w = window as unknown as {
              __held: boolean;
              __clicks: Element[];
            };
            w.__held = true;
            w.__clicks = [];
          });
          await page.mouse.move(box.x + box.width / 2, box.y + down);
          await page.mouse.down();
          await page.waitForTimeout(120);
          await page.mouse.up();
          const landed = await control.evaluate((node) => {
            const w = window as unknown as {
              __held: boolean;
              __clicks: Element[];
            };
            w.__held = false;
            const [target] = w.__clicks;
            return target
              ? node.contains(target)
                ? ""
                : `${target.tagName.toLowerCase()}.${String(target.className).split(" ")[0]}`
              : "nothing";
          });
          assert.equal(
            landed,
            "",
            `${name} ${viewport.width}: a press ${down}px below the top edge of ${what} ${i + 1} is a press on it (the click went to ${landed})`,
          );
          presses++;
          await page.mouse.move(2, viewport.height / 2);
        }
      }
      return count;
    };
    for (const [template, selector, what] of [
      ["mean-data", ".math-keypad button", "a keypad key"],
      ["reciprocal-division-choice", ".answer-dock .choice-option", "a choice"],
      ["which-is-a-unit-square", ".figure-choice-card", "a figure card"],
    ] as const) {
      await page.goto(origin + practicePath(learner.id, { template }));
      await page.locator(".problem-content").waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.getAttribute("data-look") ?? "calm",
        ),
        look,
        `${name}: practice wears it`,
      );
      // The entrance is over and the dock has followed the viewport.
      await page.waitForTimeout(500);
      const pressed = await pressEdges(selector, what);
      // A phone shows the keypad; a wide screen may leave it to the keys.
      if (template !== "mean-data" || viewport.width < 640)
        assert.ok(pressed > 0, `${name} ${viewport.width}: ${what} is there`);
      await collect();
    }
    // Check, then Next: the two a child presses on every problem.
    await page.goto(
      origin + practicePath(learner.id, { template: "mean-data" }),
    );
    await page.locator("#answer").waitFor();
    for (let i = 0; i < 2; i++) {
      await page.locator("#answer").fill("1");
      await page.waitForTimeout(300);
      assert.ok(
        await pressEdges('form button[type="submit"]', "Check"),
        "Check is there",
      );
      await page.getByRole("button", { name: "Check", exact: true }).click();
      await page.locator(".feedback.correct").waitFor();
      // The sheet has risen into place.
      await page.waitForTimeout(900);
      assert.ok(await pressEdges(".next-action", "Next"), "Next is there");
      await page.getByRole("button", { name: /^Next/ }).click();
      await page.locator(".feedback").waitFor({ state: "detached" });
      await page.locator("#answer").waitFor();
      await page.waitForTimeout(700);
    }
    await collect();
    let here = 0;
    for (const [id, frames] of watched) {
      // A problem left as soon as it showed was not watched arriving.
      if (frames.length < 8) continue;
      assert.deepEqual(
        [...new Set(frames)],
        [frames[0]],
        `${name} ${viewport.width}: problem ${id}'s question is in its place from its first frame (it was at ${[...new Set(frames)].join(", ")})`,
      );
      here++;
    }
    assert.ok(
      here >= 5,
      `${name} ${viewport.width}: problems were watched arriving (${here})`,
    );
    arrivals += here;
    await context.close();
  }
  await browser.close();
  console.log(
    `${name}: ${arrivals} problems arrived in place; ${presses} presses on a control's top edge all landed on it`,
  );
}

async function calmRun() {
  const calm = await run("calm");
  const calmShift = calm.probe.shifts.reduce((sum, e) => sum + e.value, 0);
  console.log(`Calm: no overlay, no look; layout shift ${calmShift}`);
  assert.equal(calm.probe.celebration.length, 0, "Calm celebrates nothing");
}

/** Every color only Calm uses: each other role's value, light and dark,
 * less any that a fixed role shares (it may rightly show), white and black. */
function calmOnlyColors() {
  const seen = new Map<string, string>();
  const fixed = new Set<string>();
  const key = ([r, g, b, a]: Rgba) =>
    [r, g, b].map((v) => Math.round(v)).join(",") + "," + a.toFixed(2);
  for (const theme of ["light", "dark"] as const) {
    const { color, names } = resolveTheme(theme);
    for (const name of names.filter((n) => n.startsWith("--color-"))) {
      const value = key(color(name));
      if (FIXED.test(name)) fixed.add(value);
      else if (!seen.has(value)) seen.set(value, `${name} (${theme})`);
    }
  }
  for (const value of [...fixed, "255,255,255,1.00", "0,0,0,1.00"])
    seen.delete(value);
  return seen;
}

/** Every computed color on screen that is one of Calm's own, with where. */
function leftovers(calm: [string, string][]) {
  const known = new Map(calm);
  const props = [
    "color",
    "background-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "fill",
    "stroke",
    "text-decoration-color",
  ];
  const parse = (value: string) => {
    const m =
      /^rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)(?:,? \/? ?([\d.]+))?\)$/.exec(
        value,
      );
    if (!m) return null;
    const a = m[4] == null ? 1 : Number(m[4]);
    if (a === 0) return null;
    return (
      [m[1], m[2], m[3]].map((v) => Math.round(Number(v))).join(",") +
      "," +
      a.toFixed(2)
    );
  };
  const found: string[] = [];
  // A problem whose words name its figure's colors keeps Calm's marks on
  // purpose (data-figure-colors="named"): its drawing is not a leftover.
  const named = document.documentElement.dataset.figureColors === "named";
  for (const element of document.querySelectorAll<Element>("body, body *")) {
    if (element.closest("[data-celebration], script, style")) continue;
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    if (
      !element.checkVisibility({
        opacityProperty: true,
        visibilityProperty: true,
      })
    )
      continue;
    const style = getComputedStyle(element);
    for (const prop of props) {
      if (
        prop.startsWith("border") &&
        style.getPropertyValue(prop.replace("color", "width")) === "0px"
      )
        continue;
      if (prop === "outline-color" && style.outlineStyle === "none") continue;
      if (
        (prop === "fill" || prop === "stroke") &&
        (!(element instanceof SVGElement) || named)
      )
        continue;
      if (
        prop === "text-decoration-color" &&
        !style.textDecorationLine.includes("line")
      )
        continue;
      const value = parse(style.getPropertyValue(prop));
      if (value && known.has(value)) {
        const cls =
          typeof element.className === "string"
            ? element.className.split(/\s+/).slice(0, 2).join(".")
            : "";
        found.push(
          `${element.tagName.toLowerCase()}${cls ? "." + cls : ""} ${prop} = ${known.get(value)}`,
        );
      }
    }
  }
  return [...new Set(found)];
}

/**
 * The leftover-color sweep: a learner's Colorful screens at two hues, every
 * answer kind and every panel practice opens, fail on any color that is
 * Calm's own. A role Colorful forgot shows up here, not to a child.
 */
async function leftoverSweep() {
  const calm = [...calmOnlyColors()];
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => console.error("page error:", error.message));
  await page.addInitScript("window.__name = (fn) => fn");
  await chooseLook(page, "bold");
  const problems: Record<string, string> = {
    keypad: "mean-data",
    "choice-figures": "find-quadrilateral",
    "figure-cards": "which-is-a-unit-square",
    tiles: "build-the-number-sentence",
    "fill-ins": "place-shift-value",
    "structured-work": "oblique-triangle-solve",
    "multi-select": "fact-equation-truth-select",
  };
  const found = new Map<string, string[]>();
  const look = async (where: string, hue: number) => {
    await page.evaluate((h) => {
      document.documentElement.style.setProperty("--look-hue", `${h}deg`);
    }, hue);
    await page.waitForTimeout(650);
    const bad = await page.evaluate(leftovers, calm);
    if (bad.length) found.set(`${where} at ${hue}°`, bad);
    await page.screenshot({ path: `${out}sweep-${where}-${hue}.png` });
  };
  await openHome(page, origin);
  await practiceHere(page, learner.id);
  for (const hue of [40, 220]) {
    for (const [kind, template] of Object.entries(problems)) {
      await page.goto(origin + practicePath(learner.id, { template }));
      await page.locator(".problem-content").waitFor();
      await page.waitForTimeout(400);
      await look(kind, hue);
    }
    // A keypad problem's panels and both results.
    await page.goto(
      origin + practicePath(learner.id, { template: "mean-data" }),
    );
    await page.locator("#answer").waitFor();
    for (const [name, button] of [
      ["hint", "Hint"],
      ["lesson", "Lesson"],
    ] as const) {
      await page
        .getByRole("button", { name: button, exact: true })
        .first()
        .click();
      await page.waitForTimeout(800);
      await look(name, hue);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
    await page.route("**/attempts", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: { ...body, correct: false, assisted: false },
      });
    });
    await page.locator("#answer").fill("999");
    await page.getByRole("button", { name: "Check" }).click();
    await page.locator(".feedback.incorrect").waitFor();
    await look("not-yet", hue);
    const why = page.getByRole("button", { name: "See why" });
    if (await why.count()) {
      await why.first().click();
      await page.waitForTimeout(500);
      await look("see-why", hue);
    }
    const buildsOn = page.getByRole("button", { name: /Builds on/ });
    if (await buildsOn.count()) {
      await buildsOn.first().click();
      await page.waitForTimeout(500);
      await look("builds-on", hue);
      await page.keyboard.press("Escape");
    }
    await page.unroute("**/attempts");
    await page.route("**/attempts", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: { ...body, correct: true, assisted: false },
      });
    });
    await page.getByRole("button", { name: /^Next/ }).click();
    await page.locator("#answer").waitFor();
    await page.locator("#answer").fill("1");
    await page.getByRole("button", { name: "Check" }).click();
    await page.locator(".feedback.correct").waitFor();
    await page.waitForTimeout(1600);
    await look("right", hue);
    await page.unroute("**/attempts");
    const drawer = await openMenu(page);
    await drawer.waitFor();
    await page.waitForTimeout(400);
    await look("drawer", hue);
    await page.keyboard.press("Escape");
  }
  await browser.close();
  // A school student's own screens, on a running preview with a class's
  // sign-in: AMP_SWEEP_STUDENT=<origin>|<class code>|<name>|<pictures,…>
  // (scripts/design-preview.sh seeds one: fox, boat, kite).
  const student = process.env.AMP_SWEEP_STUDENT?.split("|");
  if (student) {
    const [at, code, name, pictures] = student as [
      string,
      string,
      string,
      string,
    ];
    const other = await chromium.launch();
    const signedIn = await other.newContext({
      viewport: { width: 390, height: 844 },
    });
    const kid = await signedIn.newPage();
    kid.setDefaultTimeout(30_000);
    await kid.addInitScript("window.__name = (fn) => fn");
    await kid.goto(`${at}/join/${code}`);
    await kid.getByText(name).click();
    for (const picture of pictures.split(","))
      await kid
        .getByRole("button", { name: new RegExp(picture, "i") })
        .first()
        .click();
    await kid.waitForURL((url) => url.pathname.startsWith("/practice"));
    const token = await kid.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("amp.student") ?? "{}")
          .token as string,
    );
    const id = new URL(kid.url()).pathname.split("/")[2]!;
    const headers = { authorization: `Bearer ${token}`, origin: at };
    const path = `${at}/api/v1/learners/${id}/practice-state`;
    const state = (await (await kid.request.get(path, { headers })).json()) as {
      revision: number;
      effectiveLook: string;
    };
    if (state.effectiveLook !== "bold")
      await kid.request.post(path, {
        headers,
        data: {
          kind: "look",
          look: "bold",
          revision: state.revision,
          requestId: crypto.randomUUID(),
        },
      });
    const seen = async (where: string) => {
      for (const hue of [40, 220]) {
        await kid.evaluate((h) => {
          document.documentElement.style.setProperty("--look-hue", `${h}deg`);
        }, hue);
        await kid.waitForTimeout(650);
        const bad = await kid.evaluate(leftovers, calm);
        if (bad.length) found.set(`student ${where} at ${hue}°`, bad);
        await kid.screenshot({
          path: `${out}sweep-student-${where}-${hue}.png`,
        });
      }
    };
    await kid.reload();
    await kid.locator(".problem-content").waitFor();
    await seen("practice");
    const menu = await openMenu(kid);
    await menu.waitFor();
    await seen("drawer");
    await kid.keyboard.press("Escape");
    for (const screen of ["/overview", "/standings"]) {
      await kid.goto(at + screen);
      await kid.waitForTimeout(2000);
      await seen(screen.slice(1));
    }
    await other.close();
  }
  const count = [...found.values()].reduce((n, list) => n + list.length, 0);
  for (const [where, list] of found)
    console.log(`Calm's colors left at ${where}:\n  ${list.join("\n  ")}`);
  console.log(
    `Leftover-color sweep: ${count} Calm color(s) on Colorful screens.`,
  );
  assert.equal(
    count,
    0,
    "no Calm color is left on a learner's Colorful screens",
  );
}
