/**
 * Daily workbook screens in a real browser: the real Fastify routes compose
 * and store workbooks for a synthetic learner (in memory); only sign-in and
 * the family summary are fixtures. Checks overflow, touch targets, that no
 * control moves while workbooks load, change, fail or download, real URLs
 * (Back, reload), and the unlicensed state. Screenshots at 320/390/768/1280
 * in light and dark go to docs/reviews/workbooks/.
 *
 *   npx tsx scripts/verify-workbooks-ui.ts
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium, type Page } from "playwright";
import { buildApp } from "../src/server/app";
import {
  ApiError,
  type LearnerTransaction,
  type Outcome,
  type Repository,
} from "../src/server/repository";
import { defaultPracticeSettings } from "../src/learning/practice-settings";
import type { WorkbookRecord } from "../src/workbook/contracts";
import { sampleLearners, simulateLearner } from "../src/workbook/synthetic";
import { retentionNotice } from "../src/family/contracts";
import { fixtureMe } from "./me-fixture";
import { composeWorkbook, workbookCode } from "../src/workbook/compose";
import { skills } from "../src/curriculum/catalog";
import { lessons } from "../src/content/lessons";
import { templates } from "../src/math/engine";

const output = new URL("../docs/reviews/workbooks/", import.meta.url).pathname;
await mkdir(output, { recursive: true });
const learnerId = "5d3c1b2a-0f9e-4d8c-8b7a-6e5f4d3c2b1a";
const unlicensedId = "6e4d2c3b-1a0f-4e9d-9c8b-7f6e5e4d3c2b";
const pad = (n: number) => String(n).padStart(2, "0");
const now = new Date();
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const simulated = simulateLearner(
  sampleLearners.find((l) => l.id === "third-grade")!,
  Date.now(),
);
const rows: WorkbookRecord[] = [];
const attempts: Outcome[] = [];
const repository = {
  hasConsent: async () => true,
  list: async () => [{ id: learnerId, name: "Maya", birthYear: 2017 }],
  transaction: async <T>(
    _account: string,
    id: string,
    run: (tx: LearnerTransaction) => Promise<T>,
  ) => {
    if (id !== learnerId) throw new ApiError(404, "Learner not found");
    return run({
      hasAccess: async () => true,
      frontier: async () => simulated.frontier,
      skillEvidence: async () => simulated.evidence,
      recentAttempts: async () => simulated.attempts.slice(-12),
      workbooks: async (date?: string) =>
        rows
          .filter((r) => !date || r.date === date)
          .sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              b.number - a.number ||
              a.minutes - b.minutes,
          )
          .map((r) => ({ ...r })),
      workbook: async (workbookId: string) => {
        const found = rows.find((r) => r.id === workbookId);
        return found && { ...found };
      },
      saveWorkbook: async (record: WorkbookRecord) => {
        const found = rows.find(
          (r) =>
            r.date === record.date &&
            r.number === record.number &&
            r.minutes === record.minutes,
        );
        if (found) return { ...found };
        rows.push(record);
        return { ...record };
      },
      setWorkbookPaper: async (
        workbookId: string,
        paper: WorkbookRecord["paper"],
      ) => {
        rows.find((r) => r.id === workbookId)!.paper = paper;
      },
      workbookPdf: async () => undefined,
      saveWorkbookPdf: async () => undefined,
      workbookByCode: async (code: string) => rows.find((r) => r.code === code),
      recentWorkbooks: async () => rows,
      practiceSettings: async () => defaultPracticeSettings(),
      attemptByRequest: async (requestId: string) =>
        attempts.find((a) => a.requestId === requestId),
      attemptByProblem: async (problemId: string) =>
        attempts.find((a) => a.problemId === problemId),
      saveProblem: async () => undefined,
      saveAttempt: async (outcome: Outcome) => {
        attempts.push(outcome);
      },
    } as unknown as LearnerTransaction);
  },
} as unknown as Repository;
const api = buildApp({
  repository,
  development: true,
  // The PDF path, with a stand-in renderer (the render service has its own
  // tests); the 503 case is injected per request below.
  workbookRenderer: {
    render: async ({ format }) => Buffer.from(`%PDF-1.7 ${format}`),
  },
  authenticate: async () => "parent-one",
});
// Earlier workbooks for the history list, composed as the API would.
for (const [date, minutes] of [
  ["2026-10-30", 30],
  ["2026-10-29", 60],
] as const) {
  const spec = composeWorkbook({
    templates,
    skills,
    lessons,
    frontier: simulated.frontier,
    evidence: simulated.evidence,
    date,
    minutes,
    learnerKey: learnerId,
  });
  rows.push({
    id: crypto.randomUUID(),
    date,
    number: 1,
    minutes,
    paper: "letter",
    spec,
    code: workbookCode(spec),
    createdAt: `${date}T15:00:00Z`,
  });
}

const authPath = fileURLToPath(new URL("../src/web/auth.ts", import.meta.url));
const auth = `export async function accessSession(){return {token:"parent-one",accountId:"parent-one"};}export function onSessionChanged(){return()=>{};}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:'accounts',passwords:true,providers:[]};}`;
const vite = await createServer({
  logLevel: "warn",
  plugins: [
    {
      name: "workbooks-proof-auth",
      enforce: "pre",
      load(id) {
        return id.split("?")[0] === authPath ? auth : undefined;
      },
      // Analytics beacons bypass page routing; answer them here.
      configureServer(server) {
        server.middlewares.use("/api/v1/events", (_request, response) => {
          response.statusCode = 204;
          response.end();
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 0 },
});
await vite.listen();
const address = vite.httpServer!.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;

const me = fixtureMe(
  {
    consent: {
      status: "active",
      policyVersion: "fixture",
      recordedAt: null,
      withdrawnAt: null,
    },
    learners: [
      {
        id: learnerId,
        name: "Maya",
        birthYear: 2017,
        deletedAt: null,
        access: [],
        stripeLinked: false,
        canPractice: true,
      },
      {
        id: unlicensedId,
        name: "Theo",
        birthYear: 2015,
        deletedAt: null,
        access: [],
        stripeLinked: false,
        canPractice: false,
      },
    ],
    retained: retentionNotice,
  },
  "parent-one",
);

/** "pdf": the renderer is down; "all": the API cannot serve the file. */
let failNextDownload: false | "pdf" | "all" = false;
async function fixture(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.includes("/workbooks")) {
      const failing =
        failNextDownload &&
        (url.pathname.endsWith("/pdf") ||
          (failNextDownload === "all" && url.pathname.endsWith("/document")));
      if (failing) {
        if (url.pathname.endsWith("/document") || failNextDownload === "pdf")
          failNextDownload = false;
        return route.fulfill({
          status: 503,
          json: {
            error: "Your workbook is being prepared; try again in a minute.",
          },
        });
      }
      const response = await api.inject({
        method: request.method() as "GET" | "POST",
        url: url.pathname + url.search,
        headers: {
          authorization: request.headers().authorization ?? "",
          ...(request.postData() ? { "content-type": "application/json" } : {}),
        },
        payload: request.postData() ?? undefined,
      });
      return route.fulfill({
        status: response.statusCode,
        headers: Object.fromEntries(
          Object.entries(response.headers).map(([k, v]) => [k, String(v)]),
        ),
        body: response.rawPayload,
      });
    }
    if (url.pathname.endsWith("/me")) return route.fulfill({ json: me });
    if (url.pathname.endsWith("/auth-config"))
      return route.fulfill({
        json: { mode: "accounts", passwords: true, providers: [] },
      });
    if (url.pathname.includes("/events"))
      return route.fulfill({ status: 204, body: "" });
    console.warn(`Unhandled fixture request ${url.pathname}`);
    return route.fulfill({ status: 404, json: { error: "Not found" } });
  });
  return errors;
}

/** Every visible control in the card meets the 44 px touch target. */
async function assertLayout(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  assert.equal(overflow, false, `${label}: horizontal overflow`);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("main button, main a, main [role=radio]")]
      .filter((el) => (el as HTMLElement).offsetParent)
      .map((el) => ({
        text: el.textContent?.trim().slice(0, 40),
        box: el.getBoundingClientRect(),
      }))
      .filter(({ box }) => box.height < 44 || box.width < 44)
      .map(({ text, box }) => `${text} ${box.width}x${box.height}`),
  );
  assert.deepEqual(small, [], `${label}: touch targets under 44 px`);
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll("main button, main h1, main h2")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent),
  );
  assert.deepEqual(clipped, [], `${label}: clipped text`);
}
/** Positions of the controls that must never move. */
const controlBoxes = (page: Page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "main [role=radiogroup], main [data-workbook-actions] button, main [aria-label='Workbook contents']",
      ),
    ].map((el) => {
      const box = el.getBoundingClientRect();
      return [Math.round(box.x), Math.round(box.y), Math.round(box.width)];
    }),
  );

const browser = await chromium.launch();
const summary: string[] = [];
try {
  for (const width of [320, 390, 768, 1280])
    for (const colorScheme of ["light", "dark"] as const) {
      const label = `${width}-${colorScheme}`;
      const context = await browser.newContext({
        viewport: { width, height: width < 700 ? 844 : 900 },
        colorScheme,
        acceptDownloads: true,
      });
      const page = await context.newPage();
      const errors = await fixture(page);
      rows.splice(2);
      attempts.length = 0;
      await page.goto(`${origin}/learners/${learnerId}/workbooks/${today}`);
      await page
        .getByRole("heading", { name: "No. 1" })
        .waitFor()
        .catch(async (error) => {
          console.error(
            errors,
            (await page.locator("body").innerText()).slice(0, 1500),
          );
          throw error;
        });
      await assertLayout(page, label);
      const before = await controlBoxes(page);
      assert.ok(before.length >= 4, "controls found");
      await page.screenshot({
        path: `${output}day-${label}.png`,
        fullPage: true,
      });

      // Length changes keep every control in place and keep the number.
      await page.getByRole("radio", { name: "60 min" }).click();
      await page.waitForURL(/minutes=60/);
      await page.getByText(/About (55|60|65) minutes/).waitFor();
      assert.deepEqual(await controlBoxes(page), before, `${label}: length`);

      // Another one: a new number, a new URL, nothing moves.
      const firstCode = await page
        .getByLabel("Workbook code")
        .first()
        .textContent();
      await page.getByRole("button", { name: "Another one" }).click();
      await page.getByRole("heading", { name: "No. 2" }).waitFor();
      assert.match(page.url(), /number=2/);
      assert.notEqual(
        await page.getByLabel("Workbook code").first().textContent(),
        firstCode,
      );
      assert.deepEqual(await controlBoxes(page), before, `${label}: another`);

      // A renderer outage still gives the parent a printable copy.
      failNextDownload = "pdf";
      const [fallback] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Download workbook" }).click(),
      ]);
      assert.equal(
        fallback.suggestedFilename(),
        `amp-workbook-${today}-2.html`,
      );
      assert.equal(await page.getByRole("alert").count(), 0);
      assert.deepEqual(await controlBoxes(page), before, `${label}: fallback`);

      // A download that cannot be served explains itself in place and is
      // logged.
      failNextDownload = "all";
      await page.getByRole("button", { name: "Download workbook" }).click();
      await page
        .getByRole("alert")
        .filter({ hasText: "didn't download" })
        .waitFor();
      assert.deepEqual(await controlBoxes(page), before, `${label}: error`);
      assert.ok(
        errors.some((e) => e.includes("AMP action failed")),
        "download failure is logged",
      );
      errors.length = 0;
      if (width === 390)
        await page.screenshot({ path: `${output}download-error-${label}.png` });

      // A download succeeds and clears the message.
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: "Download workbook" }).click(),
      ]);
      assert.equal(download.suggestedFilename(), `amp-workbook-${today}-2.pdf`);
      await page
        .getByRole("alert")
        .filter({ hasText: "didn't download" })
        .waitFor({ state: "detached" });
      assert.deepEqual(await controlBoxes(page), before, `${label}: download`);

      // Back returns to No. 1; reload restores the screen from the URL.
      await page.goBack();
      await page.getByRole("heading", { name: "No. 1" }).waitFor();
      await page.reload();
      await page.getByRole("heading", { name: "No. 1" }).waitFor();
      assert.equal(
        await page
          .getByRole("radio", { name: "60 min" })
          .getAttribute("aria-checked"),
        "true",
      );

      // History lists every stored workbook, newest first.
      await page.getByRole("link", { name: "Past workbooks" }).click();
      await page.waitForURL(new RegExp(`/learners/${learnerId}/workbooks$`));
      await page.getByRole("list", { name: "Workbooks" }).waitFor();
      const items = await page
        .getByRole("list", { name: "Workbooks" })
        .getByRole("listitem")
        .count();
      assert.equal(items, 5);
      await assertLayout(page, `${label} history`);
      await page.screenshot({
        path: `${output}history-${label}.png`,
        fullPage: true,
      });

      // Results: open by the printed code, enter a typed answer and a mark,
      // save; the rows lock as recorded and nothing moves.
      const code = rows.find((r) => r.date === today)!.code;
      await page
        .getByLabel("Enter results with the workbook code")
        .fill(code.toLowerCase().replace("-", ""));
      await page.getByRole("button", { name: "Open", exact: true }).click();
      await page.waitForURL(/\/results$/);
      await page.getByRole("list", { name: "Problems" }).waitFor();
      await assertLayout(page, `${label} results`);
      const save = page.getByRole("button", { name: /result/ });
      assert.equal(await save.isDisabled(), true);
      const answer = page.getByRole("textbox", { name: "Answer" }).first();
      await answer.fill("12345");
      await page
        .getByRole("radiogroup", { name: /^Mark problem/ })
        .last()
        .getByRole("radio", { name: "Right" })
        .click();
      await page.getByRole("button", { name: "Save 2 results" }).click();
      await page.getByText("2 results saved. Progress is updated.").waitFor();
      assert.equal(attempts.length, 2);
      assert.ok(attempts.every((a) => a.evidenceSource === "paper"));
      await page.getByText(/^Not yet · answer 12345$/).waitFor();
      await page.getByText(/^Right · marked$/).waitFor();
      await assertLayout(page, `${label} results saved`);
      await page.screenshot({
        path: `${output}results-${label}.png`,
        fullPage: true,
      });
      // Reload restores the screen and the recorded rows from the URL.
      await page.reload();
      await page.getByText(/^Right · marked$/).waitFor();

      // A learner without practice access is sent to set it up, never to a
      // download that would fail.
      await page.goto(`${origin}/learners/${unlicensedId}/workbooks/${today}`);
      await page.getByRole("link", { name: "Review access" }).waitFor();
      assert.equal(
        await page.getByRole("button", { name: /Download/ }).count(),
        0,
      );
      await assertLayout(page, `${label} unlicensed`);
      if (width === 390)
        await page.screenshot({ path: `${output}unlicensed-${label}.png` });
      assert.deepEqual(errors, [], `${label}: console errors`);
      await context.close();
      summary.push(`${label} ok`);
    }
} finally {
  await browser.close();
  await vite.close();
  await api.close();
}
console.log(summary.join("\n"));
console.log(`Screenshots: ${output}`);
