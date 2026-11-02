/**
 * Practice polish verification and audit: drives the real practice app (Vite dev server,
 * synthetic learning API) through every response kind. Each case starts a
 * topic, opens the hint and the lesson, answers wrong, answers right, then
 * skips, in chromium and webkit, light and dark, at phone, tablet and desktop
 * sizes. It records horizontal overflow, layout shift, small targets,
 * truncation, mid-word wraps, tiny text, covered controls, figure fit, axe
 * contrast and keyboard focus, and writes a screenshot of every state.
 *
 * By default it verifies a representative matrix and fails on any finding,
 * any layout shift on a problem state, any axe violation or invisible focus.
 * AUDIT_FULL=1 runs every case at six sizes in chromium and webkit and only
 * reports (amp/docs/reviews/practice-polish/README.md). Narrow either with
 *   AUDIT_BROWSERS=chromium,webkit AUDIT_CASES=number,choice
 *   AUDIT_SIZES=320x568,390x844 AUDIT_THEMES=light AUDIT_OUT=artifacts/...
 *
 * Synthetic data only: no database, no account, no network beyond loopback.
 */
import AxeBuilder from "@axe-core/playwright";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import {
  chromium,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";
import { skills } from "../src/curriculum/catalog";
import { templates, generateProblemFor } from "../src/math/engine";
import { responseForClient } from "../src/math/multi-part-choice";
import { problemLesson } from "../src/content/problem-lessons";
import { defaultPracticeSettings } from "../src/learning/practice-settings";
import type { Outcome } from "../src/server/repository";
import type { GeneratedProblem } from "../src/math/contracts";
import {
  anchors,
  probe,
  settle,
  takeShifts,
  watchShifts,
  type Finding,
} from "./practice-polish-probe";

if (process.env.NODE_ENV === "production")
  throw new Error("The practice audit is local development only");

export const CASES = [
  ["number", "multiply-facts"],
  ["number-plain", "log-equation"],
  ["number-scene", "unit-cube-volume"],
  ["fraction", "unit-piece-size"],
  ["choice", "hierarchy-statement"],
  ["choice-scene", "first-quadrant-locate"],
  ["choice-clocks", "clock-minute-match"],
  ["multi-select", "fact-equation-truth-select"],
  ["multi-select-figure", "slope-triangle-statements"],
  ["parts-cards", "booth-equation-slots"],
  ["parts-inline", "fraction-forms-blanks"],
  ["parts-slots", "order-whole-numbers-slots"],
  ["parts-table", "proportional-match-table"],
  ["figure-choice", "graph-of-proportional-rate"],
  ["point-plot", "plot-points"],
  ["work-steps", "scientific-notation-work"],
  ["work-fill", "scale-drawing-work"],
  ["work-proof", "two-column-congruence-proof"],
] as const;
const SIZES: [number, number][] = [
  [320, 568],
  [320, 720],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 800],
];
const list = (v: string | undefined) =>
  v
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const full = process.env.AUDIT_FULL === "1";
/** The verify matrix: one case per response surface. */
const VERIFY = [
  "number",
  "choice-scene",
  "multi-select-figure",
  "parts-inline",
  "parts-cards",
  "point-plot",
  "figure-choice",
  "work-steps",
];
const browsers =
  list(process.env.AUDIT_BROWSERS) ??
  (full ? ["chromium", "webkit"] : ["chromium"]);
const caseFilter = list(process.env.AUDIT_CASES) ?? (full ? null : VERIFY);
const cases = CASES.filter(
  ([label]) => !caseFilter || caseFilter.includes(label),
);
const sizes =
  list(process.env.AUDIT_SIZES)?.map(
    (s) => s.split("x").map(Number) as [number, number],
  ) ??
  (full
    ? SIZES
    : ([
        [320, 568],
        [390, 844],
        [768, 1024],
        [1280, 800],
      ] as [number, number][]));
const themes = (list(process.env.AUDIT_THEMES) ?? ["light", "dark"]) as (
  "light" | "dark"
)[];
const out = process.env.AUDIT_OUT ?? "artifacts/practice-polish";
const workers = Number(process.env.AUDIT_WORKERS ?? 4);
await mkdir(out, { recursive: true });

const root = new URL("../", import.meta.url).pathname;
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  cacheDir: "node_modules/.vite-practice-polish",
  plugins: [
    {
      name: "practice-polish-fixture-auth",
      enforce: "pre",
      load(id) {
        if (id.split("?")[0] === root + "src/web/auth.ts")
          return `export async function accessSession(){return localStorage.getItem("fixture.parent")?{token:"synthetic",accountId:"fixture-parent"}:null;}export function onSessionChanged(){return()=>{}}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:"accounts",passwords:true,providers:[]}}`;
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: Number(process.env.AUDIT_PORT ?? 0),
    hmr: false,
  },
});
await vite.listen();
const address = vite.httpServer!.address();
if (!address || typeof address === "string") throw new Error("No address");
const origin = `http://127.0.0.1:${address.port}`;

const account = fixtureMe(
  {
    consent: {
      status: "active",
      policyVersion: "fixture",
      recordedAt: "2026-01-01",
      withdrawnAt: null,
    },
    retained: retentionNotice,
    learners: [
      {
        id: "sample-learner",
        name: "Sample learner",
        birthYear: 2014,
        deletedAt: null,
        access: [],
        stripeLinked: false,
        canPractice: true,
      },
    ],
  },
  "fixture-parent",
);
const frontier = {
  expected: 6,
  overall: { level: 6, sd: 0.7, answered: 42, independent: 30 },
  strands: {},
};

/** One synthetic learning API per context. `grade` decides the next result. */
async function mockApi(context: BrowserContext, templateId: string) {
  const state = {
    templateId,
    grade: false,
    problems: new Map<string, GeneratedProblem>(),
    count: 0,
  };
  let practice = defaultPracticeSettings();
  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON() ?? {};
    const json = (value: unknown) => route.fulfill({ json: value });
    if (path === "/api/v1/auth-config")
      return json({ mode: "accounts", passwords: true, providers: [] });
    if (path === "/api/v1/me") return json(account);
    if (path === "/api/v1/trials/current")
      return json({
        trial: {
          token: "synthetic-trial",
          learnerId: "trial-learner",
          birthYear: 2014,
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      });
    if (path === "/api/v1/catalog")
      return json({
        skills,
        templates,
        lessons: [],
        mode: "hosted",
        trial: { free: 100, placement: 10 },
      });
    if (path === "/api/v1/learners")
      return json({ learners: [{ id: "trial-learner", birthYear: 2014 }] });
    if (path.endsWith("/trial-progress"))
      return json({
        phase: "practice",
        free: 100,
        placement: 10,
        remaining: 58,
        totals: { answered: 42, correct: 30, assisted: 0 },
        mastered: [],
        frontier: { placement: null, current: frontier },
      });
    if (path.endsWith("/progress"))
      return json({ asOf: new Date().toISOString(), skills: [] });
    if (path.endsWith("/frontier")) return json(frontier);
    if (path.endsWith("/books")) return json({ books: [] });
    if (path.endsWith("/practice-state")) {
      if (route.request().method() === "POST")
        practice = { ...practice, revision: practice.revision + 1 };
      return json(practice);
    }
    if (path.endsWith("/batches")) {
      const problem = generateProblemFor(
        state.templateId,
        `polish-${state.templateId}-${state.count++}`,
        body.figureCapabilities ?? [],
      );
      problem.public = responseForClient(
        problem.public,
        body.responseCapabilities ?? [],
      );
      state.problems.set(problem.public.id, problem);
      return json({
        problems: [problem.public],
        hints: {
          [problem.public.id]: {
            hint: problem.hint,
            ...(problem.hintCue ? { cue: problem.hintCue } : {}),
          },
        },
        lesson: null,
        trialRemaining: 58,
      });
    }
    const problem = state.problems.get(body.problemId);
    const reveal = (extra: Partial<Outcome>): Outcome => ({
      id: crypto.randomUUID(),
      requestId: body.requestId ?? crypto.randomUUID(),
      problemId: body.problemId,
      skillId: problem!.public.skillId,
      templateId: problem!.public.templateId,
      response: body.response ?? "",
      correct: false,
      assisted: false,
      createdAt: new Date().toISOString(),
      answer: problem!.answer,
      explanation: problem!.explanation,
      ...extra,
    });
    if (path.endsWith("/attempts") && problem)
      return json(
        reveal({
          correct: state.grade,
          response: state.grade ? problem.answer : body.response,
        }),
      );
    if (path.endsWith("/skips") && problem)
      return json(reveal({ skipped: true, response: "" }));
    if (path.endsWith("/hints") && problem)
      return json({
        hint: problem.hint,
        ...(problem.hintCue ? { cue: problem.hintCue } : {}),
      });
    if (path.endsWith("/lesson-support") && problem)
      return json({
        recorded: true,
        lesson: problemLesson(
          problem.public.templateId,
          problem.public.seed,
          problem.public.prompt,
          problem.public.response,
          problem,
        ),
      });
    if (path.includes("/events") || path.includes("/engagement"))
      return route.fulfill({ status: 204, body: "" });
    console.warn(`unmocked ${route.request().method()} ${path}`);
    return route.fulfill({ status: 404, json: { error: "Synthetic route" } });
  });
  return state;
}

const visibleCheck = (page: Page) =>
  page
    .locator("dialog[open] button, .practice-workspace button")
    .filter({ hasText: /^Check$/ })
    .locator("visible=true")
    .first();

/** Enter some response, by the controls a learner would use. */
async function fill(page: Page, kind: string) {
  const opener = page.locator(".compact-answer-action:visible");
  if (await opener.count()) await opener.click();
  const scope = page.locator("dialog[open]").last();
  const inDialog = (await scope.count()) > 0;
  const area = inDialog ? scope : page.locator(".practice-workspace");
  if (kind.startsWith("number") || kind === "fraction") {
    const keys = kind === "fraction" ? ["3", "/", "4"] : ["7"];
    const pad = area.locator(".math-keypad");
    if (await pad.isVisible())
      for (const k of keys)
        await pad
          .getByRole("button", {
            name: k === "/" ? "Fraction slash" : k,
            exact: true,
          })
          .click();
    else await area.locator("#answer").fill(keys.join(""));
    return;
  }
  if (kind.startsWith("choice")) {
    await area.locator(".choice-option").first().click();
    return;
  }
  if (kind.startsWith("multi-select")) {
    const text =
      (await area.locator(".selection-count").textContent()) ?? "0 of 2";
    const need = Number(/of (\d+)/.exec(text)?.[1] ?? 2);
    for (let i = 0; i < need; i++)
      await area.locator(".choice-option").nth(i).click();
    return;
  }
  if (kind === "parts-cards") {
    // Each card fills the next empty box; a placed card leaves the tray.
    for (let i = 0; i < 12; i++) {
      const card = page.locator(".multi-part-card:not([disabled])").first();
      if (!(await card.count())) break;
      await card.scrollIntoViewIfNeeded();
      await card.click();
    }
    return;
  }
  if (kind === "parts-table") {
    const rows = page.locator(".multi-part-table tbody tr");
    for (let i = 0; i < (await rows.count()); i++) {
      const cell = rows.nth(i).locator(".multi-part-cell").first();
      await cell.scrollIntoViewIfNeeded();
      await cell.click();
    }
    return;
  }
  if (kind.startsWith("parts")) {
    const blanks = page.locator(".multi-part-blank");
    for (let i = 0; i < (await blanks.count()); i++) {
      await blanks.nth(i).scrollIntoViewIfNeeded();
      await blanks.nth(i).click();
      await page.locator(".multi-part-menu").waitFor();
      await page
        .locator(".multi-part-menu [role=menuitemradio]")
        .first()
        .click();
      await page.locator(".multi-part-menu").waitFor({ state: "detached" });
    }
    return;
  }
  if (kind === "figure-choice") {
    const card = page.locator(".figure-choice-card").first();
    await card.scrollIntoViewIfNeeded();
    await card.click();
    return;
  }
  if (kind === "point-plot") {
    const layer = page.locator(".point-plot-layer").first();
    await layer.scrollIntoViewIfNeeded();
    await layer.focus();
    for (let i = 0; i < 8 && !(await visibleCheck(page).isEnabled()); i++) {
      await page.keyboard.press("Enter");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowUp");
    }
    return;
  }
  if (kind.startsWith("work")) {
    for (let pass = 0; pass < 6; pass++) {
      const inputs = page.locator(".work-input");
      for (let i = 0; i < (await inputs.count()); i++) {
        const input = inputs.nth(i);
        if (await input.inputValue()) continue;
        await input.scrollIntoViewIfNeeded();
        await input.fill("1");
      }
      const done = page.locator('.work-keypad [data-key="done"]:visible');
      if (await done.count()) await done.click();
      const choices = page.locator(".work-choice");
      for (let i = 0; i < (await choices.count()); i++) {
        const c = choices.nth(i);
        if (!(await c.locator(".work-choice-placeholder").count())) continue;
        await c.scrollIntoViewIfNeeded();
        await c.click();
        await page.locator(".work-menu").waitFor();
        await page.locator(".work-menu [role=menuitemradio]").first().click();
        await page.locator(".work-menu").waitFor({ state: "detached" });
      }
      if (await visibleCheck(page).isEnabled()) return;
      const add = page.locator(".work-add:visible");
      if ((await add.count()) && (await add.isEnabled())) await add.click();
      else return;
    }
  }
}

type Row = {
  browser: string;
  case: string;
  template: string;
  width: number;
  height: number;
  theme: string;
  mode: string;
  state: string;
  cls: number | null;
  shiftSources: string[];
  moved: string[];
  findings: Finding[];
  axe?: { id: string; impact: string | null; nodes: string[] }[];
  focus?: { order: string[]; invisible: string[] };
  error?: string;
  screenshot: string;
};
const rows: Row[] = [];
const log = `${out}/results.jsonl`;
await writeFile(log, "");
/** Every state is appended as it is measured, so a stopped run keeps its data. */
const push = (row: Row) => {
  rows.push(row);
  return appendFile(log, JSON.stringify(row) + "\n");
};
const unique = (f: Finding[]) => [
  ...new Map(f.map((x) => [`${x.kind}|${x.selector}|${x.text}`, x])).values(),
];

async function axe(page: Page) {
  const result = await new AxeBuilder({ page })
    .include(".practice-workspace")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  return result.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    nodes: v.nodes.slice(0, 4).map((n) => n.target.join(" ")),
  }));
}

/** Tab through the workspace: order, and whether each focus is visible. */
async function focusWalk(page: Page) {
  await page
    .locator("body")
    .click({ position: { x: 1, y: 1 } })
    .catch(() => {});
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  const order: string[] = [];
  const invisible: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const e = document.activeElement as HTMLElement | null;
      if (!e || e === document.body) return null;
      const s = getComputedStyle(e);
      const ring =
        (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
        s.boxShadow !== "none";
      const label = (e.getAttribute("aria-label") ?? e.innerText ?? e.tagName)
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 30);
      const id = `${e.tagName.toLowerCase()}${e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : ""} "${label}"`;
      // A focus ring on a visually hidden radio shows on its label.
      const labelRing = (() => {
        const l = e.closest("label");
        if (!l) return false;
        const ls = getComputedStyle(l);
        return ls.outlineStyle !== "none" && parseFloat(ls.outlineWidth) > 0;
      })();
      return {
        id,
        ring: ring || labelRing,
        inWorkspace: !!e.closest(".practice-workspace"),
      };
    });
    if (!info) continue;
    if (order.includes(info.id)) break;
    order.push(info.id);
    if (!info.ring && info.inWorkspace) invisible.push(info.id);
  }
  return { order, invisible };
}

async function runCase(
  browser: Browser,
  browserName: string,
  [label, templateId]: readonly [string, string],
  [width, height]: [number, number],
  theme: "light" | "dark",
  mode: "account" | "trial",
) {
  const phone = width < 600;
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
    // Motion is reduced so screenshots are stable; AUDIT_MOTION=1 keeps it.
    reducedMotion:
      process.env.AUDIT_MOTION === "1" ? "no-preference" : "reduce",
    hasTouch: phone,
    isMobile: phone && browserName === "chromium",
  });
  await context.addInitScript("globalThis.__name ??= (f) => f");
  await context.addInitScript(
    ({ theme }) => {
      localStorage.setItem("amp.trial", "synthetic-trial");
      localStorage.setItem("fixture.parent", "1");
      localStorage.setItem("amp.theme", theme);
      navigator.sendBeacon = () => true;
    },
    { theme },
  );
  const api = await mockApi(context, templateId);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(10_000);
  const dir = `${out}/${browserName}/${width}x${height}-${theme}${mode === "trial" ? "-trial" : ""}`;
  await mkdir(dir, { recursive: true });
  const record = async (
    state: string,
    before: Awaited<ReturnType<typeof anchors>> | null,
    extra: Partial<Row> = {},
  ) => {
    await settle(page);
    const shifts = await takeShifts(page);
    const after = await anchors(page);
    const moved = before
      ? (Object.keys(after) as (keyof typeof after)[]).filter(
          (k) =>
            before[k] &&
            after[k] &&
            before[k]!.some((v, i) => Math.abs(v - after[k]![i]!) > 1),
        )
      : [];
    const screenshot = `${dir}/${label}-${state}.png`;
    await page.screenshot({ path: screenshot });
    await push({
      browser: browserName,
      case: label,
      template: templateId,
      width,
      height,
      theme,
      mode,
      state,
      cls: browserName === "chromium" ? shifts.cls : null,
      shiftSources: shifts.sources,
      moved: moved.map(
        (k) => `${k} ${JSON.stringify(before![k])}→${JSON.stringify(after[k])}`,
      ),
      findings: unique(await probe(page)),
      screenshot,
      ...extra,
    });
  };
  try {
    await page.goto(
      origin + (mode === "trial" ? "/try/practice" : "/practice"),
      {
        timeout: 120_000,
      },
    );
    await page
      .locator(".problem-content .question")
      .waitFor({ timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await watchShifts(page);
    const deep = !full || theme === "light" || width === 390;
    await record("start", null, {
      ...(deep ? { axe: await axe(page) } : {}),
      ...(deep && !phone ? { focus: await focusWalk(page) } : {}),
    });
    // Touch phones answer on AMP's keypad: the system keyboard never rises
    // over the problem for numeric or worked entry.
    if (phone && browserName === "chromium") {
      const raised = await page.evaluate(() =>
        [...document.querySelectorAll("#answer, .work-input")]
          .filter((e) => e.getAttribute("inputmode") !== "none")
          .map((e) => e.getAttribute("aria-label") ?? e.id),
      );
      if (raised.length)
        rows.at(-1)!.findings.push({
          kind: "system-keyboard",
          selector: "input",
          text: raised.join(", ").slice(0, 80),
          detail: "touch entry would raise the system keyboard",
        });
    }
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    // Hint
    let before = await anchors(page);
    await page
      .getByRole("button", { name: "Hint", exact: true })
      .first()
      .click();
    await page.locator("dialog[open]").waitFor();
    await page.waitForTimeout(150);
    await record("hint", null);
    await page.keyboard.press("Escape");
    await page.locator("dialog[open]").waitFor({ state: "detached" });
    await record("hint-closed", before);
    // Lesson
    before = await anchors(page);
    await page
      .getByRole("button", { name: "Lesson", exact: true })
      .first()
      .click();
    await page.locator("dialog[open]").waitFor();
    await page.waitForTimeout(300);
    await record("lesson", null, deep ? { axe: await axeDialog(page) } : {});
    await page.keyboard.press("Escape");
    await page.locator("dialog[open]").waitFor({ state: "detached" });
    await record("lesson-closed", before);
    // Wrong
    before = await anchors(page);
    await fill(page, label);
    await record("filled", before);
    before = await anchors(page);
    api.grade = false;
    const check = visibleCheck(page);
    if (!(await check.isEnabled()))
      throw new Error("Check stayed disabled after fill");
    await check.click();
    await page.locator(".feedback.incorrect").waitFor();
    await page.waitForTimeout(300);
    await record("incorrect", before, deep ? { axe: await axe(page) } : {});
    // Right
    await page.locator(".next-action").click();
    await page.locator(".feedback").waitFor({ state: "detached" });
    await page.waitForTimeout(200);
    await takeShifts(page);
    await fill(page, label);
    before = await anchors(page);
    api.grade = true;
    await visibleCheck(page).click();
    await page.locator(".feedback.correct").waitFor();
    await page.waitForTimeout(1300);
    await record("correct", before);
    const why = page.getByRole("button", { name: "See why", exact: true });
    if (await why.count()) {
      before = await anchors(page);
      await why.first().click();
      await page.waitForTimeout(200);
      await record(
        "see-why",
        (await page.locator("dialog[open]").count()) ? null : before,
      );
      if (await page.locator("dialog[open]").count()) {
        await page.keyboard.press("Escape");
      }
    }
    // Skip
    await page.locator(".next-action").click();
    await page.locator(".feedback").waitFor({ state: "detached" });
    await page.waitForTimeout(200);
    await takeShifts(page);
    before = await anchors(page);
    const skip = page.getByRole("button", { name: /Skip/ }).first();
    await skip.click();
    await page.locator(".feedback.skipped").waitFor();
    await page.waitForTimeout(300);
    await record("skipped", before);
  } catch (error) {
    const screenshot = `${dir}/${label}-error.png`;
    await page.screenshot({ path: screenshot }).catch(() => {});
    await push({
      browser: browserName,
      case: label,
      template: templateId,
      width,
      height,
      theme,
      mode,
      state: "error",
      cls: null,
      shiftSources: [],
      moved: [],
      findings: [],
      error: String(error).slice(0, 400),
      screenshot,
    });
  }
  if (errors.length)
    await push({
      browser: browserName,
      case: label,
      template: templateId,
      width,
      height,
      theme,
      mode,
      state: "page-errors",
      cls: null,
      shiftSources: [],
      moved: [],
      findings: [],
      error: errors.join(" | ").slice(0, 400),
      screenshot: "",
    });
  await context.close();
}

async function axeDialog(page: Page) {
  const result = await new AxeBuilder({ page })
    .include("dialog[open]")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  return result.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? null,
    nodes: v.nodes.slice(0, 4).map((n) => n.target.join(" ")),
  }));
}

/** The probe's inline-target and glyph rules, on known markup: a word with
 * a 44 px invisible hit area passes and one without fails; a hidden "?"
 * badge is exempt from the text size and a hidden letter is not. */
async function probeSelfTest(browser: Browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
  await page.addInitScript("globalThis.__name ??= (f) => f");
  const sentence = (hitArea: boolean) =>
    `<main class="practice-workspace"><style>
      .t{display:inline;position:relative;padding:0;border:0;background:none;font:inherit}
      ${hitArea ? ".t::after{content:'';position:absolute;left:50%;top:50%;width:max(100%,44px);height:44px;transform:translate(-50%,-50%)}" : ""}
      .m{font-size:9px}
    </style><p style="font:16px/1.5 sans-serif;margin:120px 20px">Find the
      <button class="t" aria-label="ratio, what does this mean?">ratio<span class="m" aria-hidden="true">?</span></button>
      of the two lengths <span class="m" aria-hidden="true">A</span>.</p></main>`;
  // tsx names functions with __name; probe() runs in the page.
  const shim = "globalThis.__name ??= (f) => f";
  await page.setContent(sentence(true));
  await page.evaluate(shim);
  const passing = await probe(page);
  await page.setContent(sentence(false));
  await page.evaluate(shim);
  const failing = await probe(page);
  // A small inline control below the fold, and a row of small inline
  // controls whose neighbours cover each other, are still caught; a hidden
  // "$" beside an input (no named control around it) is still text.
  await page.setContent(`<main class="practice-workspace"><style>
      .s{display:inline-flex;width:20px;height:24px;padding:0;border:0}
      .m{font-size:9px}</style>
      <p style="width:120px;margin:20px">${Array.from({ length: 12 }, (_, i) => `<button class="s">${i}</button>`).join("")}</p>
      <p style="margin-top:900px">Below <button class="s">x</button> the fold</p>
      <p><span class="m" aria-hidden="true">$</span><input aria-label="Dollars"></p></main>`);
  await page.evaluate(shim);
  const crowded = await probe(page);
  await page.close();
  const kinds = (f: Finding[]) => f.map((x) => `${x.kind}:${x.text}`);
  const small = crowded
    .filter((f) => f.kind === "small-target")
    .map((f) => f.text);
  if (!small.includes("6") || !small.includes("x"))
    throw new Error(
      `Probe misses crowded or off-screen inline controls: ${small}`,
    );
  if (!crowded.some((f) => f.kind === "tiny-text" && f.text === "$"))
    throw new Error(
      "Probe exempts a hidden symbol that is not inside a named control",
    );
  if (passing.some((f) => f.kind === "small-target"))
    throw new Error(
      `Probe rejects an inline word with a 44 px hit area: ${kinds(passing)}`,
    );
  if (!failing.some((f) => f.kind === "small-target"))
    throw new Error("Probe accepts an inline word without a hit area");
  if (passing.some((f) => f.kind === "tiny-text" && f.text === "?"))
    throw new Error("Probe holds a hidden icon glyph to the text size");
  if (!passing.some((f) => f.kind === "tiny-text" && f.text === "A"))
    throw new Error("Probe exempts a hidden letter from the text size");
}

const started = Date.now();
try {
  for (const name of browsers) {
    const browser = await ({ chromium, webkit } as const)[
      name as "chromium" | "webkit"
    ].launch();
    await probeSelfTest(browser);
    const jobs: (() => Promise<void>)[] = [];
    for (const size of sizes)
      for (const theme of themes) {
        for (const c of cases)
          jobs.push(() => runCase(browser, name, c, size, theme, "account"));
        jobs.push(() => runCase(browser, name, CASES[0], size, theme, "trial"));
      }
    let next = 0;
    await Promise.all(
      Array.from({ length: workers }, async () => {
        while (next < jobs.length) {
          const job = jobs[next++]!;
          await job();
          if (next % 20 === 0)
            console.log(`${name}: ${next}/${jobs.length} cases`);
        }
      }),
    );
    await browser.close();
  }
} finally {
  await writeFile(`${out}/results.json`, JSON.stringify(rows, null, 1));
  await vite.close();
}
// A compact summary: counts per finding kind, worst offenders, CLS.
const counts = new Map<string, number>();
for (const r of rows)
  for (const f of r.findings) counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
/** Problem states: nothing in the workspace may move between them. */
const steady = new Set([
  "hint-closed",
  "lesson-closed",
  "filled",
  "incorrect",
  "correct",
  "skipped",
]);
const failures = rows.flatMap((r) => {
  const where = `${r.browser} ${r.width}x${r.height} ${r.theme} ${r.mode} ${r.case} ${r.state}`;
  return [
    ...(r.error ? [`${where}: ${r.error}`] : []),
    ...r.findings.map(
      (f) => `${where}: ${f.kind} ${f.selector} "${f.text}" ${f.detail}`,
    ),
    ...(steady.has(r.state) && ((r.cls ?? 0) > 0.001 || r.moved.length)
      ? [
          `${where}: layout shift ${(r.cls ?? 0).toFixed(4)} ${r.shiftSources.join(",")} ${r.moved.join("; ")}`,
        ]
      : []),
    ...(r.axe ?? []).map(
      (a) => `${where}: axe ${a.id} (${a.impact}) ${a.nodes.join(" | ")}`,
    ),
    ...(r.focus?.invisible ?? []).map((f) => `${where}: invisible focus ${f}`),
  ];
});
console.log({
  seconds: Math.round((Date.now() - started) / 1000),
  states: rows.length,
  errors: rows.filter((r) => r.error).length,
  shifted: rows.filter((r) => (r.cls ?? 0) > 0.001 || r.moved.length).length,
  findings: Object.fromEntries(counts),
});
if (!full) {
  if (failures.length) {
    console.error(failures.slice(0, 60).join("\n"));
    console.error(
      `${failures.length} practice polish failure(s); screenshots in ${out}`,
    );
    process.exitCode = 1;
  } else
    console.log(
      `Practice polish: ${rows.length} states across ${cases.length} response surfaces, ${sizes.length} sizes, ${themes.length} themes and ${browsers.join("+")} passed: no overflow, no shift, 44 px targets, one-line actions, unclipped feedback, visible review, no raw TeX, axe clean; screenshots in ${out}`,
    );
}
