/**
 * Capture the pitch's showcase: the slides beside Try it free at `/`
 * (src/web/features/pitch/showcase-slides.ts). Each practice slide is the real app
 * (this checkout's components, served by Vite) answering a real template's
 * problem; the workbook slide is a real workbook page from the print
 * pipeline. Synthetic fixtures only, loopback HTTP, no personal data.
 *
 *     npx tsx scripts/capture-pitch-showcase.ts [--only <slide>] [--png <dir>]
 *
 * Writes `src/web/features/pitch/showcase/<slide>-<shape>-<theme>.webp`:
 * wide (16:9, the app side by side, for screens wider than a phone) and
 * narrow (9:16, the phone’s own layout), light and dark. The workbook page is
 * paper in both themes. Run again after a practice screen changes.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium as rawChromium, type Page } from "playwright";
import { createServer } from "vite";
import { secureChromium } from "../browser-security.mjs";
import { skills } from "../src/curriculum/catalog";
import { lessons } from "../src/content/lessons";
import { retentionNotice } from "../src/family/contracts";
import { defaultPracticeSettings } from "../src/learning/practice-settings";
import type { GeneratedProblem } from "../src/math/contracts";
import { generateProblemFor, templates } from "../src/math/engine";
import { responseForClient } from "../src/math/multi-part-choice";
import { projectSkillEvidence } from "../src/server/evidence";
import type { Outcome } from "../src/server/repository";
import { composeWorkbook } from "../src/workbook/compose";
import { printWorkbookPdf } from "../src/workbook/pdf";
import { workbookHtml } from "../src/workbook/render";
import { sampleLearners, simulateLearner } from "../src/workbook/synthetic";
import {
  showcaseSizes,
  showcaseSlides,
} from "../src/web/features/pitch/showcase-slides";
import { fixtureMe } from "./me-fixture";
import {
  FIXTURE_FAMILY_ID,
  fixtureChildProgress,
  fixtureFamilies,
  fixtureFamilyProjection,
} from "./family-space-fixture";

/** How each slide (showcase-slides.ts) is made: practice on a real
 * template, after a first problem one grade lower in the same area so the
 * grade chip shows the step practice took; or pages of a real workbook. */
type Capture =
  | {
      lead?: { templateId: string; seed: string };
      problem: { templateId: string; seed: string };
      moment: "question" | "correct";
    }
  | { workbook: { learner: string } };
const captures: Record<string, Capture> = {
  "area-model": {
    lead: { templateId: "multiply-facts", seed: "showcase-1" },
    problem: { templateId: "area-model-product", seed: "s1" },
    moment: "correct",
  },
  "fraction-line": {
    // P at 2/3: clear of the line's "one whole" caption, which sits over
    // the middle of the line.
    problem: { templateId: "fraction-line-position", seed: "s4" },
    moment: "question",
  },
  workbook: { workbook: { learner: "third-grade" } },
  graph: {
    lead: { templateId: "two-step-equation", seed: "showcase-1" },
    problem: { templateId: "graphed-line-slope", seed: "s1" },
    moment: "question",
  },
  "box-plot": {
    lead: { templateId: "histogram-read", seed: "showcase-1" },
    problem: { templateId: "double-box-compare", seed: "s1" },
    moment: "correct",
  },
};
type PracticeCapture = Exclude<Capture, { workbook: unknown }>;
const { values } = parseArgs({
  options: {
    only: { type: "string" },
    png: { type: "string" },
    shape: { type: "string" },
    theme: { type: "string" },
  },
});
const root = new URL("../", import.meta.url).pathname;
const out = join(root, "src/web/features/pitch/showcase");
const png = values.png ?? mkdtempSync(join(tmpdir(), "amp-showcase-"));
mkdirSync(out, { recursive: true });
mkdirSync(png, { recursive: true });

/** The two frames every slide fills: CSS size, and the WebP it becomes. */
const shapes = {
  wide: { viewport: { width: 1120, height: 630 }, size: showcaseSizes.wide },
  narrow: { viewport: { width: 400, height: 711 }, size: showcaseSizes.narrow },
} as const;
type Shape = keyof typeof shapes;

const vite = await createServer({
  root,
  logLevel: "warn",
  plugins: [
    {
      name: "pitch-showcase-fixture-auth",
      enforce: "pre",
      load(id) {
        if (id.split("?")[0] === root + "src/web/auth.ts")
          return `export async function accessSession(){return {token:"synthetic",accountId:"fixture-parent"}}export function onSessionChanged(){return()=>{}}export async function signIn(){}export async function signOut(){}export function notifyDeviceSessionChanged(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:"accounts",passwords:true,providers:[]}}`;
      },
    },
  ],
  server: { host: "127.0.0.1", port: 0, hmr: false },
});
await vite.listen();
const address = vite.httpServer!.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await secureChromium(rawChromium).launch();
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
        birthYear: 2016,
        deletedAt: null,
        access: [],
        stripeLinked: false,
        canPractice: true,
      },
    ],
  },
  "fixture-parent",
);

/** Open practice on the slide's problems, as a learner would reach them. */
async function practice(slide: PracticeCapture, shape: Shape, theme: string) {
  const { viewport } = shapes[shape];
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    colorScheme: theme as "light" | "dark",
    reducedMotion: "reduce",
    timezoneId: "America/New_York",
    locale: "en-US",
    serviceWorkers: "block",
  });
  await context.addInitScript("globalThis.__name ??= (f) => f");
  await context.addInitScript(() => {
    navigator.sendBeacon = () => true;
  });
  const queue = [...(slide.lead ? [slide.lead] : []), slide.problem];
  const instances = new Map<string, GeneratedProblem>();
  const attempts: Outcome[] = [];
  const errors: string[] = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort("blockedbyclient");
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const path = url.pathname;
    const body = route.request().postDataJSON() ?? {};
    const json = (value: unknown) => route.fulfill({ json: value });
    if (path === "/api/v1/auth-config")
      return json({ mode: "accounts", passwords: true, providers: [] });
    if (path === "/api/v1/me") return json(account);
    if (path === "/api/v1/families") return json(fixtureFamilies());
    if (path === `/api/v1/families/${FIXTURE_FAMILY_ID}`)
      return json(
        fixtureFamilyProjection([
          { id: "sample-learner", name: "Sample learner", birthYear: 2016 },
        ]),
      );
    if (path.endsWith("/children/sample-learner/progress"))
      return json(fixtureChildProgress("sample-learner", "Sample learner"));
    if (/^\/api\/v1\/catalog(?:\/map)?$/.test(path))
      return json({
        skills,
        templates,
        lessons: [],
        mode: "hosted",
        trial: { free: 100, placement: 10 },
      });
    if (path.endsWith("/progress"))
      return json({
        asOf: new Date().toISOString(),
        skills: projectSkillEvidence(attempts).map((s) => ({
          ...s,
          independentOccasions: s.creditedRetrievals,
          reviewDueAt: null,
          recent: s.recentOutcomes.map((a) => ({
            correct: a.correct,
            assisted: false,
            at: a.createdAt,
          })),
        })),
      });
    if (path.endsWith("/books")) return json({ books: [] });
    if (path.endsWith("/frontier"))
      return json({
        expected: 5,
        overall: { level: 5, sd: 0.7, answered: 42, independent: 30 },
        strands: {},
      });
    if (path.endsWith("/practice-state"))
      return json(defaultPracticeSettings());
    if (path.endsWith("/batches")) {
      const next = queue.shift() ?? slide.problem;
      const problem = generateProblemFor(
        next.templateId,
        next.seed,
        body.figureCapabilities ?? [],
        undefined,
        body.responseCapabilities ?? [],
      );
      problem.public = responseForClient(
        problem.public,
        body.responseCapabilities ?? [],
      );
      instances.set(problem.public.id, problem);
      return json({ problems: [problem.public] });
    }
    if (path.endsWith("/attempts")) {
      const problem = instances.get(body.problemId)!;
      const outcome: Outcome = {
        id: randomUUID(),
        requestId: body.requestId,
        problemId: body.problemId,
        skillId: problem.public.skillId,
        templateId: problem.public.templateId,
        response: body.response,
        correct: true,
        assisted: false,
        createdAt: new Date().toISOString(),
        answer: problem.answer,
        explanation: problem.explanation,
      };
      attempts.push(outcome);
      return json(outcome);
    }
    if (path.includes("/events") || path.includes("/engagement"))
      return route.fulfill({ status: 204, body: "" });
    if (path === "/api/v1/billing/prices")
      return json({ available: false, offers: [] });
    return route.fulfill({ status: 404, json: { error: "No fixture" } });
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/practice`);
  await page.locator(".question").waitFor();
  const answer = async () => {
    const id = await page
      .locator(".problem-content")
      .getAttribute("data-template");
    const problem = [...instances.values()]
      .reverse()
      .find((p) => p.public.templateId === id)!;
    const compact = page.locator(".compact-answer-action");
    if (await compact.isVisible()) await compact.click();
    await page.locator("#answer:visible").fill(String(problem.answer));
    await page.locator("#answer:visible").press("Enter");
    await page.getByRole("region", { name: "Answer feedback" }).waitFor();
  };
  if (slide.lead) {
    // A first problem in the same area, answered: the slide's problem then
    // shows the step practice took (the grade chip's ↑).
    await answer();
    await page.getByRole("button", { name: "Next", exact: false }).click();
    await page.waitForFunction(
      (templateId) =>
        document
          .querySelector(".problem-content")
          ?.getAttribute("data-template") === templateId,
      slide.problem.templateId,
    );
  }
  if (slide.moment === "correct") {
    await answer();
    await page
      .locator("[data-strength]:not([data-strength-pending])")
      .waitFor();
    if (shape === "narrow") {
      const why = page.getByRole("button", { name: "See why", exact: true });
      if (await why.count()) await why.click();
    }
  }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  return { page, errors, close: () => context.close() };
}

function encode(
  source: string,
  target: string,
  { width, height }: { width: number; height: number },
) {
  execFileSync("cwebp", [
    "-quiet",
    "-q",
    "80",
    "-m",
    "6",
    "-resize",
    String(width),
    String(height),
    source,
    "-o",
    target,
  ]);
}

/** The workbook's first page and its answer key, as printed. */
async function workbookPages(id: string, learner: string) {
  const at = Date.parse("2026-11-16T12:00:00Z");
  const simulated = simulateLearner(
    sampleLearners.find((l) => l.id === learner)!,
    at,
  );
  const spec = composeWorkbook({
    templates,
    skills,
    lessons,
    frontier: simulated.frontier,
    evidence: simulated.evidence,
    date: "2026-11-16",
    minutes: 45,
    learnerKey: "pitch-showcase",
    now: at,
  });
  const page = await browser.newPage({
    viewport: { width: 1100, height: 1500 },
    deviceScaleFactor: 2,
  });
  await page.route("**/*", (route) => route.abort());
  await printWorkbookPdf(
    page,
    workbookHtml(spec, {
      lessons,
      skillTitle: (skill) => skills.find((s) => s.id === skill)?.title ?? skill,
      paper: "letter",
    }),
  );
  const pages = [
    page.locator(".wb-page--student").first(),
    page
      .locator(".wb-page")
      .filter({ has: page.locator(".wb-key-item") })
      .first(),
  ];
  for (const [i, target] of pages.entries()) {
    const file = join(png, `${id}-page-${i + 1}.png`);
    await target.screenshot({ path: file });
    encode(file, join(out, `${id}-page-${i + 1}.webp`), showcaseSizes.page);
  }
  await page.close();
}

try {
  for (const { id } of showcaseSlides) {
    if (values.only && values.only !== id) continue;
    const slide = captures[id];
    assert(slide, `No capture for slide ${id}`);
    if ("workbook" in slide) {
      await workbookPages(id, slide.workbook.learner);
      console.log("Captured", id);
      continue;
    }
    for (const shape of Object.keys(shapes) as Shape[])
      for (const theme of ["light", "dark"]) {
        if (values.shape && values.shape !== shape) continue;
        if (values.theme && values.theme !== theme) continue;
        const { page, errors, close } = await practice(slide, shape, theme);
        const file = join(png, `${id}-${shape}-${theme}.png`);
        await page.screenshot({ path: file });
        await close();
        assert.deepEqual(errors, [], `${id}: browser errors`);
        encode(
          file,
          join(out, `${id}-${shape}-${theme}.webp`),
          shapes[shape].size,
        );
        console.log("Captured", id, shape, theme);
      }
  }
  console.log(`PNG sources: ${png}`);
} finally {
  await browser.close();
  await vite.close();
}
