/** Capture the public site's 14 AMP screenshots from current components.
 * Run from amp/: npx tsx scripts/capture-public-site-assets.ts --out <directory>
 *   --date 2026-11-15 [--port 0] [--source-commit <sha>]
 * Uses only synthetic fixtures, loopback HTTP, and an in-memory repository.
 * The manifest records source/date, dimensions, routes, and content hashes.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer as httpServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import Fastify from "fastify";
import { createServer as viteServer } from "vite";
import { chromium, type BrowserContext, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";
import { skills } from "../src/curriculum/catalog";
import { templates, generateProblemFor } from "../src/math/engine";
import type { GeneratedProblem } from "../src/math/contracts";
import { responseForClient } from "../src/math/multi-part-choice";
import { problemLesson } from "../src/content/problem-lessons";
import { lessons } from "../src/content/lessons";
import { defaultPracticeSettings } from "../src/learning/practice-settings";
import type { LearnerTransaction, Repository } from "../src/server/repository";
import type { WorkbookRecord } from "../src/workbook/contracts";
import { sampleLearners, simulateLearner } from "../src/workbook/synthetic";
import { composeWorkbook, workbookCode } from "../src/workbook/compose";
import { registerWorkbookRoutes } from "../src/workbook/routes";
import { workbookHtml } from "../src/workbook/render";
import { printWorkbookPdf } from "../src/workbook/pdf";
import { checkWorkbookLayout, layoutFailures } from "./workbook-layout";

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    date: { type: "string", default: "2026-11-15" },
    port: { type: "string", default: "0" },
    "source-commit": { type: "string" },
  },
});
assert(values.out, "--out is required");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(values.out),
  date = values.date!,
  at = Date.parse(`${date}T12:00:00Z`);
assert(
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    new Date(at).toISOString().slice(0, 10) === date,
  "Invalid --date",
);
const port = Number(values.port);
assert(Number.isInteger(port) && port >= 0 && port < 65536, "Invalid --port");
const sourceCommit =
  values["source-commit"] ??
  execFileSync("git", ["-C", process.cwd(), "rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
assert(/^[a-f0-9]{40}$/.test(sourceCommit), "Expected exact source Git SHA");
mkdirSync(join(out, "screenshots"), { recursive: true });
const cache = mkdtempSync(join(tmpdir(), "amp-public-capture-"));
const learnerId = "5d3c1b2a-0f9e-4d8c-8b7a-6e5f4d3c2b1a";
const account = Object.assign(
  fixtureMe(
    {
      consent: {
        status: "active",
        policyVersion: "fixture",
        recordedAt: null,
        withdrawnAt: null,
      },
      retained: retentionNotice,
      learners: [
        {
          id: learnerId,
          name: "Sample learner",
          birthYear: 2017,
          deletedAt: null,
          access: [],
          stripeLinked: false,
          canPractice: true,
        },
      ],
    },
    "fixture-parent",
  ),
  { adultPractice: { eligible: true, learner: null } },
);
const simulated = simulateLearner(
  sampleLearners.find((l) => l.id === "third-grade")!,
  at,
);
const spec = composeWorkbook({
  templates,
  skills,
  lessons,
  frontier: simulated.frontier,
  evidence: simulated.evidence,
  date,
  minutes: 45,
  learnerKey: "public-screenshot",
  now: at,
});
const rows: WorkbookRecord[] = [
  {
    id: "c4eb954c-4b5b-4f16-9c43-04b6447eb676",
    date,
    number: 1,
    minutes: 45,
    paper: "letter",
    spec,
    code: workbookCode(spec),
    createdAt: new Date(at).toISOString(),
  },
];
const repository = {
  hasConsent: async () => true,
  list: async () => [
    { id: learnerId, name: "Sample learner", birthYear: 2017 },
  ],
  transaction: async <T>(
    _account: string,
    id: string,
    run: (tx: LearnerTransaction) => Promise<T>,
  ) => {
    assert.equal(id, learnerId, "Only the synthetic learner exists");
    return run({
      hasAccess: async () => true,
      onSchoolRoster: async () => false,
      isAdult: async () => false,
      frontier: async () => simulated.frontier,
      skillEvidence: async () => simulated.evidence,
      recentAttempts: async () => simulated.attempts.slice(-12),
      paperResultCounts: async () => new Map(),
      practiceSettings: async () => defaultPracticeSettings(),
      workbooks: async (d?: string) => rows.filter((r) => !d || r.date === d),
      workbook: async (id: string) => rows.find((r) => r.id === id),
      recentWorkbooks: async () => rows,
      workbookByCode: async (code: string) => rows.find((r) => r.code === code),
      saveWorkbook: async (r: WorkbookRecord) => {
        rows.push(r);
        return r;
      },
      setWorkbookPaper: async (id: string, paper: WorkbookRecord["paper"]) => {
        rows.find((r) => r.id === id)!.paper = paper;
      },
    } as unknown as LearnerTransaction);
  },
} as unknown as Repository;
const api = Fastify({ logger: false });
registerWorkbookRoutes(api, {
  repository,
  parent: async () => "fixture-parent",
  development: true,
  now: () => at,
});
const authPath = join(root, "src/web/auth.ts");
const vite = await viteServer({
  root,
  configFile: join(root, "vite.config.ts"),
  cacheDir: cache,
  logLevel: "warn",
  plugins: [
    {
      name: "public-site-synthetic-session",
      enforce: "pre",
      load(id) {
        if (id.split("?")[0] === authPath)
          return `export async function accessSession(){return {token:"synthetic",accountId:"fixture-parent"}}export function onSessionChanged(){return()=>{}}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:"accounts",passwords:true,providers:[]}}`;
      },
      configureServer(server) {
        server.middlewares.use("/api", (_request, response) => {
          response.statusCode = 204;
          response.end();
        });
      },
    },
  ],
  server: {
    middlewareMode: true,
    hmr: false,
    fs: { allow: [root, realpathSync(join(root, "node_modules"))] },
  },
});
const server = httpServer(vite.middlewares);
await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await secureChromium(chromium).launch({ headless: true });
const errors: string[] = [],
  unhandled: string[] = [],
  blocked: string[] = [];
const manifest: any[] = [];
async function fixture(
  context: BrowserContext,
  templateId = "unit-piece-size",
) {
  const problems = new Map<string, GeneratedProblem>();
  let count = 0;
  await context.addInitScript(() => {
    localStorage.setItem("amp.theme", "light");
    navigator.sendBeacon = () => true;
  });
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== origin) {
      blocked.push(url.origin + url.pathname);
      return route.abort("blockedbyclient");
    }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const path = url.pathname,
      body = request.postDataJSON() ?? {},
      json = (value: unknown) => route.fulfill({ json: value });
    if (path.includes("/workbooks")) {
      const response = await api.inject({
        method: request.method() as "GET" | "POST",
        url: path + url.search,
        headers: {
          authorization: "Bearer synthetic",
          ...(request.postData() ? { "content-type": "application/json" } : {}),
        },
        payload: request.postData() ?? undefined,
      });
      if (response.statusCode >= 400)
        console.error("Fixture API", path, response.statusCode, response.body);
      return route.fulfill({
        status: response.statusCode,
        headers: Object.fromEntries(
          Object.entries(response.headers).map(([k, v]) => [k, String(v)]),
        ),
        body: response.rawPayload,
      });
    }
    if (path === "/api/v1/auth-config")
      return json({ mode: "accounts", passwords: true, providers: [] });
    if (path === "/api/v1/me") return json(account);
    if (path === "/api/v1/families") return json({ families: [], next: null });
    if (path === "/api/v1/catalog")
      return json({
        skills,
        templates,
        lessons: [],
        mode: "hosted",
        trial: { free: 100, placement: 10 },
      });
    if (path.endsWith("/books")) return json({ books: [] });
    if (path.endsWith("/practice-state"))
      return json(defaultPracticeSettings());
    if (path.endsWith("/frontier"))
      return json({
        expected: 6,
        overall: { level: 6, sd: 0.7, answered: 42, independent: 30 },
        strands: {},
      });
    if (path.endsWith("/progress"))
      return json({
        asOf: new Date(at).toISOString(),
        skills: [
          "multiplication-facts",
          "fractions-number-line",
          "rectangle-area",
          "statistics-mean",
          "count-to-20",
          "fraction-equivalence",
        ].map((skillId, i) => ({
          skillId,
          attempts: 8 + i * 2,
          independentCorrect: 6 + i,
          recentIndependentCorrect: i === 2 ? 3 : 4,
          status: "practicing",
          lastPracticedAt: new Date(at).toISOString(),
          reviewDueAt: i === 2 ? new Date(at).toISOString() : null,
          independentOccasions: 3,
          recent: [true, true, i !== 2, true, true].map((correct) => ({
            correct,
            assisted: false,
            at: new Date(at).toISOString(),
          })),
        })),
      });
    if (path.endsWith("/batches")) {
      const p = generateProblemFor(
        templateId,
        `polish-${templateId}-${count++}`,
        body.figureCapabilities ?? [],
      );
      p.public = responseForClient(p.public, body.responseCapabilities ?? []);
      problems.set(p.public.id, p);
      return json({
        problems: [p.public],
        hints: {
          [p.public.id]: {
            hint: p.hint,
            ...(p.hintCue ? { cue: p.hintCue } : {}),
          },
        },
        lesson: null,
      });
    }
    const p = problems.get(body.problemId);
    if (path.endsWith("/hints") && p)
      return json({ hint: p.hint, ...(p.hintCue ? { cue: p.hintCue } : {}) });
    if (path.endsWith("/skips") && p)
      return json({
        id: randomUUID(),
        requestId: body.requestId ?? randomUUID(),
        problemId: body.problemId,
        skillId: p.public.skillId,
        templateId: p.public.templateId,
        response: "",
        correct: false,
        assisted: false,
        skipped: true,
        createdAt: new Date(at).toISOString(),
        answer: p.answer,
        explanation: p.explanation,
      });
    if (path.endsWith("/lesson-support") && p)
      return json({
        recorded: true,
        lesson: problemLesson(
          p.public.templateId,
          p.public.seed,
          p.public.prompt,
          p.public.response,
          p,
        ),
      });
    if (path.includes("/events") || path.includes("/engagement"))
      return route.fulfill({ status: 204, body: "" });
    if (path === "/api/v1/billing/prices")
      return json({ available: false, offers: [] });
    unhandled.push(request.method() + " " + path);
    return route.fulfill({
      status: 404,
      json: { error: "No synthetic fixture" },
    });
  });
}
async function ready(page: Page, selector: string) {
  await page.locator(selector).first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
}
async function capture(
  page: Page,
  id: string,
  alt: string,
  locator?: ReturnType<Page["locator"]>,
) {
  const file = `screenshots/${id}.png`,
    path = join(out, file);
  if (locator) await locator.screenshot({ path });
  else await page.screenshot({ path, fullPage: true });
  const bytes = readFileSync(path);
  manifest.push({
    id,
    file,
    alt,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    source: "amp/scripts/capture-public-site-assets.ts",
    sourceCommit,
    fixtureDate: date,
    fixture: "Synthetic only; no production learner data",
    route: page.url().startsWith(origin)
      ? page.url().slice(origin.length)
      : "generated workbook",
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  console.log("Captured", id);
}
async function contextFor(width: number, templateId?: string) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
    colorScheme: "light",
    reducedMotion: "reduce",
    timezoneId: "America/New_York",
    locale: "en-US",
    serviceWorkers: "block",
  });
  await fixture(context, templateId);
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(at));
  page.on("pageerror", (e) => errors.push(e.message));
  return { context, page };
}
try {
  for (const width of [1280, 390]) {
    const { context, page } = await contextFor(width);
    const size = width === 390 ? "mobile" : "desktop";
    for (const [name, path, selector, alt] of [
      [
        "practice",
        "/practice",
        ".question",
        "A fraction strip and numeric keypad in AMP practice",
      ],
      [
        "practice-profile",
        "/me/profiles/new?grade=4&pace=behind",
        "form",
        "Choose a practice grade, pace, and levels by math area",
      ],
      [
        "progress",
        "/progress",
        ".progress-workspace",
        "Progress by math area and practiced skill",
      ],
    ] as const) {
      await page.goto(origin + path);
      await ready(page, selector);
      await capture(page, `${name}-${size}`, alt);
    }
    if (width === 1280) {
      await page.goto(origin + "/me/level?grade=4&pace=behind");
      await ready(page, "form");
      await capture(
        page,
        "practice-level-desktop",
        "Choose a grade and pace for practice",
      );
    }
    await page.goto(`${origin}/learners/${learnerId}/workbooks/${date}`);
    await page
      .getByRole("heading", { name: "Workbook No. 1", exact: true })
      .waitFor();
    await ready(page, "[role=dialog]");
    if (width === 1280)
      await capture(
        page,
        "workbook-summary-desktop",
        "Workbook contents: warm-up, lesson, practice, review and challenge",
      );
    await page
      .getByRole("group", { name: "Areas", exact: true })
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await capture(
      page,
      `workbook-controls-${size}`,
      "Choose workbook duration, paper size, difficulty and math areas",
    );
    await context.close();
  }
  {
    const { context, page } = await contextFor(1280, "multiply-facts");
    await page.goto(origin + "/practice");
    await ready(page, ".question");
    await page
      .getByRole("button", { name: "Hint", exact: true })
      .first()
      .click();
    await ready(page, "dialog[open]");
    await capture(
      page,
      "practice-hint-desktop",
      "A specific hint supports a multiplication problem",
    );
    await context.close();
  }
  {
    const { context, page } = await contextFor(390);
    await page.goto(origin + "/practice");
    await ready(page, ".question");
    await page
      .getByRole("button", { name: /Skip this problem/ })
      .first()
      .click();
    await page.locator(".feedback.skipped").waitFor();
    const why = page.getByRole("button", { name: "See why", exact: true });
    if (await why.count()) await why.first().click();
    await ready(page, ".feedback-steps");
    await capture(
      page,
      "practice-solution-mobile",
      "A worked fraction explanation after skipping a problem",
    );
    await context.close();
  }
  {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 1500 },
    });
    await page.route("**/*", (route) => route.abort());
    const html = workbookHtml(spec, {
      lessons,
      skillTitle: (id) => skills.find((s) => s.id === id)?.title ?? id,
      paper: "letter",
    });
    const pdf = await printWorkbookPdf(page, html);
    const layout = await checkWorkbookLayout(page);
    assert.deepEqual(layoutFailures(layout, pdf), [], "Workbook layout failed");
    await capture(
      page,
      "workbook-practice-page",
      "Printable AMP workbook practice with space to work",
      page
        .locator(".wb-page--student")
        .filter({ has: page.locator(".wb-item.wb-sec--practice") })
        .first(),
    );
    await capture(
      page,
      "workbook-answer-key",
      "Printable AMP workbook worked answer key",
      page
        .locator(".wb-page")
        .filter({ has: page.locator(".wb-key-item") })
        .first(),
    );
    writeFileSync(
      join(out, "workbook-layout.json"),
      JSON.stringify(layout, null, 2) + "\n",
    );
    await page.close();
  }
  assert.equal(manifest.length, 14);
  assert.deepEqual(errors, [], "Browser errors");
  assert.deepEqual(unhandled, [], "Unmocked API requests");
  writeFileSync(
    join(out, "screenshots-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  writeFileSync(
    join(out, "capture-validation.json"),
    JSON.stringify(
      {
        sourceCommit,
        fixtureDate: date,
        captured: 14,
        browserErrors: errors,
        unhandledApi: unhandled,
        blockedExternalRequests: blocked,
        network:
          "Only loopback HTTP permitted; analytics discarded; service workers blocked",
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await vite.close();
  await api.close();
  await new Promise<void>((resolve, reject) =>
    server.close((e) => (e ? reject(e) : resolve())),
  );
  rmSync(cache, { recursive: true, force: true });
}
