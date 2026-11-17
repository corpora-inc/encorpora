import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { defaultPracticeSettings } from "../src/learning/practice-settings";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium as rawChromium, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { fixtureMe } from "./me-fixture";
import {
  FIXTURE_FAMILY_ID,
  fixtureChildProgress,
  fixtureFamilies,
  fixtureFamilyProjection,
} from "./family-space-fixture";
import { retentionNotice } from "../src/family/contracts";
import { skills } from "../src/curriculum/catalog";
import { templates, generateProblem } from "../src/math/engine";
import { projectSkillEvidence } from "../src/server/evidence";
import type { Outcome } from "../src/server/repository";
import { answerPathways } from "../src/web/features/practice/answer-pathways";
import { openHome } from "./launcher";

const root = new URL("../", import.meta.url).pathname;
const vite = await createServer({
  plugins: [
    {
      name: "answer-feedback-fixture-auth",
      enforce: "pre",
      load(id) {
        if (id.split("?")[0] === root + "src/web/auth.ts")
          return `export async function accessSession(){return localStorage.getItem("fixture.parent")?{token:"synthetic",accountId:"fixture-parent"}:null;}export function onSessionChanged(){return()=>{}}export async function signIn(){}export async function signOut(){}export function notifyDeviceSessionChanged(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:"accounts",passwords:true,providers:[]}}`;
      },
    },
  ],
  server: { host: "127.0.0.1", port: 0 },
});
await vite.listen();
const address = vite.httpServer!.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch();
const output = process.env.FEEDBACK_SCREENS ?? "artifacts/answer-feedback";
await mkdir(output, { recursive: true });
const initial = templates.find((t) => t.skillId === "add-two-digit")!;
assert(initial);
assert(answerPathways(initial.skillId, skills, templates).leadsTo.length > 0);
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
const frontier = {
  expected: 4,
  overall: { level: 4, sd: 0.7, answered: 42, independent: 30 },
  strands: {
    operations: { level: 2, sd: 0.7, answered: 24, independent: 18 },
    algebra: { level: 7, sd: 1.1, answered: 18, independent: 12 },
  },
};
async function submit(page: Page, answer: string) {
  const compact = page.locator(".compact-answer-action");
  if (await compact.isVisible()) await compact.click();
  await page.locator("#answer:visible").fill(answer);
  await page.locator("#answer:visible").press("Enter");
  await page.getByRole("region", { name: "Answer feedback" }).waitFor();
}
/**
 * Stacked, the feedback sheet keeps the problem in view above it, and its
 * result, explanation and skill read in one body: nothing inside the body
 * scrolls on its own, and a body that scrolls is a reading column, not a
 * sliver.
 */
async function solvedInView(page: Page, label: string) {
  const found = await page.evaluate(() => {
    const sheet = document.querySelector(".feedback")!.getBoundingClientRect();
    const stage = document
      .querySelector(".problem-stage")!
      .getBoundingClientRect();
    const question = document
      .querySelector(".problem-content .question")!
      .getBoundingClientRect();
    const body = document.querySelector<HTMLElement>("[data-feedback-body]");
    const nested = body
      ? [...body.querySelectorAll<HTMLElement>("*")]
          .filter((e) => e.scrollHeight > e.clientHeight + 1)
          .filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY))
          .map((e) => e.className)
      : ["no feedback body"];
    return {
      question: [question.top, question.bottom],
      stageTop: stage.top,
      sheetTop: sheet.top,
      nested,
      body: body
        ? { client: body.clientHeight, scroll: body.scrollHeight }
        : null,
    };
  });
  assert(
    found.question[0]! >= found.stageTop - 1 &&
      found.question[1]! <= found.sheetTop + 1,
    `${label}: the problem stays in view above the sheet: ${JSON.stringify(found)}`,
  );
  assert.deepEqual(found.nested, [], `${label}: no nested scroller`);
  assert(
    found.body &&
      (found.body.scroll <= found.body.client + 1 || found.body.client >= 200),
    `${label}: a scrolling body is a readable column: ${JSON.stringify(found.body)}`,
  );
}
// Signed-in practice for the family's learner.
const mode = "account";
try {
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1280, 800],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      await context.addInitScript("globalThis.__name ??= (f) => f");
      await context.addInitScript(
        ({ theme }) => {
          localStorage.setItem("fixture.parent", "1");
          localStorage.setItem("amp.theme", theme);
          navigator.sendBeacon = () => true;
          Object.defineProperty(navigator, "vibrate", { value: () => true });
        },
        { mode, theme },
      );
      const attempts: Outcome[] = [];
      const instances = new Map<string, ReturnType<typeof generateProblem>>();
      const batches: (string | null)[] = [];
      let practice = defaultPracticeSettings();
      let failProgress = false;
      // Holds the strength request open while the check looks at the wait.
      let holdProgress: Promise<void> | null = null;
      let failBranch = false;
      const errors: string[] = [];
      await context.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        const body = route.request().postDataJSON();
        if (path === "/api/v1/auth-config")
          return route.fulfill({
            json: { mode: "accounts", passwords: true, providers: [] },
          });
        if (path === "/api/v1/me") return route.fulfill({ json: account });
        // The parent's family (scripts/family-space-fixture.ts): its Today
        // and the learner's page.
        if (path === "/api/v1/families")
          return route.fulfill({ json: fixtureFamilies() });
        if (path === `/api/v1/families/${FIXTURE_FAMILY_ID}`)
          return route.fulfill({
            json: fixtureFamilyProjection([
              { id: "sample-learner", name: "Sample learner", birthYear: 2016 },
            ]),
          });
        if (path.endsWith("/children/sample-learner/progress"))
          return route.fulfill({
            json: fixtureChildProgress("sample-learner", "Sample learner"),
          });
        if (/^\/api\/v1\/catalog(?:\/map)?$/.test(path))
          return route.fulfill({
            json: {
              skills,
              templates,
              lessons: [],
              mode: "hosted",
              trial: { free: 100, placement: 10 },
            },
          });
        if (path.endsWith("/progress")) {
          if (holdProgress) await holdProgress;
          if (failProgress)
            return route.fulfill({
              status: 503,
              json: { error: "Synthetic progress failure" },
            });
          return route.fulfill({
            json: {
              asOf: new Date().toISOString(),
              skills: projectSkillEvidence(attempts).map((s) => ({
                ...s,
                independentOccasions: s.creditedRetrievals,
                reviewDueAt: null,
                recent: s.recentOutcomes.map((a) => ({
                  correct: a.correct,
                  assisted: a.assisted,
                  at: a.createdAt,
                })),
              })),
            },
          });
        }
        if (path.endsWith("/books"))
          return route.fulfill({ json: { books: [] } });
        if (path.endsWith("/frontier"))
          return route.fulfill({ json: frontier });
        if (path.endsWith("/practice-state")) {
          if (route.request().method() === "POST") {
            if (failBranch)
              return route.fulfill({
                status: 503,
                json: { error: "Synthetic branch failure" },
              });
            practice = {
              ...practice,
              revision: practice.revision + 1,
              ...(body.kind === "focus" ? { focusSkillId: body.skillId } : {}),
            };
          }
          return route.fulfill({ json: practice });
        }
        if (path.endsWith("/batches")) {
          batches.push(body.templateId ?? null);
          if (body.templateId && failBranch)
            return route.fulfill({
              status: 503,
              json: { error: "Synthetic branch failure" },
            });
          const problem = generateProblem(
            body.templateId ??
              templates.find((t) => t.skillId === practice.focusSkillId)?.id ??
              initial.id,
            `feedback-${batches.length}`,
          );
          instances.set(problem.public.id, problem);
          return route.fulfill({
            json: {
              problems: [problem.public],
            },
          });
        }
        if (path.endsWith("/attempts")) {
          const problem = instances.get(body.problemId)!;
          const outcome: Outcome = {
            id: crypto.randomUUID(),
            requestId: body.requestId,
            problemId: body.problemId,
            skillId: problem.public.skillId,
            templateId: problem.public.templateId,
            response: body.response,
            correct: body.response === problem.answer,
            assisted: false,
            createdAt: new Date().toISOString(),
            answer: problem.answer,
            explanation: problem.explanation,
          };
          attempts.push(outcome);
          return route.fulfill({ json: outcome });
        }
        if (path.includes("/events") || path.includes("/engagement"))
          return route.fulfill({ status: 204, body: "" });
        if (path === "/api/v1/billing/prices")
          return route.fulfill({ json: { available: false, offers: [] } });
        console.warn("Unmocked fixture route", path);
        return route.fulfill({
          status: 404,
          json: { error: "Synthetic route unavailable" },
        });
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${origin}/practice`);
      await page
        .locator(".question")
        .waitFor()
        .catch(async (error) => {
          await page.screenshot({
            path: `${output}/${mode}-${width}-${theme}-failure.png`,
          });
          console.error(await page.locator("body").innerText(), errors);
          throw error;
        });
      const current = async () => {
        const id = await page
          .locator(".problem-content")
          .getAttribute("data-template");
        return [...instances.values()]
          .reverse()
          .find((p) => p.public.templateId === id)!;
      };
      let release = () => {};
      holdProgress = new Promise((resolve) => (release = resolve));
      await submit(page, (await current()).answer);
      await page.getByText("+1 XP", { exact: true }).waitFor();
      // The win lands on the sheet, never drawn over the problem.
      assert.equal(await page.locator(".practice-celebration").count(), 0);
      // While the strength loads: its loaded space, wordless (no status).
      await page.locator("[data-strength-pending]").waitFor();
      const strength = page.locator("[data-strength]");
      assert.equal(
        (await strength.innerText()).trim(),
        "",
        `${mode} ${width}: the wait for strength shows no status text`,
      );
      const pendingBox = await strength.boundingBox();
      const pendingNext = await page
        .getByRole("button", { name: "Next", exact: false })
        .boundingBox();
      holdProgress = null;
      release();
      await page
        .getByText("4 more correct without help for Strong", { exact: true })
        .waitFor();
      const loadedBox = await strength.boundingBox();
      assert(
        pendingBox &&
          loadedBox &&
          Math.abs(pendingBox.height - loadedBox.height) <= 0.5 &&
          Math.abs(pendingBox.y - loadedBox.y) <= 0.5,
        `${mode} ${width}: the strength arrives in its reserved space: ${JSON.stringify({ pendingBox, loadedBox })}`,
      );
      assert.deepEqual(
        await page
          .getByRole("button", { name: "Next", exact: false })
          .boundingBox(),
        pendingNext,
        `${mode} ${width}: the strength arriving moves nothing`,
      );
      // What was solved stays readable with the win.
      const given = await page.locator(".feedback-head small").innerText();
      assert(
        given.startsWith("You entered") &&
          given.includes(String(attempts.at(-1)!.response)),
        `${mode} ${width}: the correct head names the answer given: ${given}`,
      );
      if (width < 900) await solvedInView(page, `${mode} ${width} correct`);
      const next = page.getByRole("button", { name: "Next", exact: false });
      const box = await next.boundingBox();
      assert(
        box && box.y >= 0 && box.y + box.height <= height,
        `${mode} ${width}: Next must stay visible`,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "No page overflow",
      );
      await page
        .locator(".practice-celebration")
        .waitFor({ state: "detached" });
      await page.screenshot({
        path: `${output}/${mode}-${width}-${theme}-correct.png`,
      });
      // Side by side, the sheet fills the answer column and explains every
      // result; stacked, a correct answer's explanation is a tap away.
      const why = page.getByRole("button", { name: "See why", exact: true });
      if (width >= 900) {
        assert.equal(await why.count(), 0, `${mode} ${width}: no See why`);
        await page.locator(".feedback-steps").waitFor();
        const column = await page
          .locator(".practice-surface")
          .evaluate((surface) => {
            const sheet = surface.querySelector(".feedback")!;
            const dock = surface.querySelector(".answer-dock")!;
            const a = sheet.getBoundingClientRect();
            const b = dock.getBoundingClientRect();
            return {
              sheet: a.toJSON(),
              dock: b.toJSON(),
              surface: surface.getBoundingClientRect().toJSON(),
              radius: getComputedStyle(sheet).borderTopLeftRadius,
            };
          });
        assert(
          Math.abs(column.sheet.top - column.dock.top) <= 1 &&
            Math.abs(column.sheet.bottom - column.dock.bottom) <= 1,
          `${mode} ${width}: the sheet fills the answer column: ${JSON.stringify(column)}`,
        );
        // Immersive: no card around practice. The stage meets the screen's
        // edges, and the panel is flush to the right and bottom edges.
        assert(
          column.surface.left <= 1 &&
            column.surface.right >= width - 1 &&
            column.sheet.right >= width - 1 &&
            column.sheet.bottom >= height - 1 &&
            column.radius === "0px",
          `${mode} ${width}: practice is edge to edge, the panel flush: ${JSON.stringify(column)}`,
        );
      } else await why.click();
      const explainedNext = await next.boundingBox();
      assert(
        explainedNext && box && Math.abs(explainedNext.y - box.y) <= 2,
        `${mode} ${width}: See why must not move Next`,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Mixed practice", exact: true })
          .count(),
        0,
        "Mixed practice is offered only while practice is focused",
      );
      await page
        .getByRole("button", { name: "Leads to", exact: false })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Leads to",
        exact: true,
      });
      await dialog.waitFor();
      // A grown-up's own practice always shows curriculum grades
      // (features/curriculum/CurriculumDetails.tsx); only a child's session
      // with levels hidden offers the local "Show details" reveal.
      assert.ok(
        (await dialog.locator('[class*="grade"]').count()) > 0,
        "A grown-up sees each skill's curriculum grade",
      );
      assert.equal(
        await dialog
          .getByRole("button", { name: /details: curriculum grades$/ })
          .count(),
        0,
        "No reveal where grades already show",
      );
      await page.screenshot({
        path: `${output}/${mode}-${width}-${theme}-details.png`,
      });
      await page.screenshot({
        path: `${output}/${mode}-${width}-${theme}-connections.png`,
      });
      await page.keyboard.press("Escape");
      assert(
        await page
          .getByRole("button", { name: "Leads to", exact: false })
          .evaluate((el) => el === document.activeElement),
        "Escape restores the connection trigger",
      );
      await page
        .getByRole("button", { name: "Leads to", exact: false })
        .click();
      await dialog.locator("li button").first().click();
      await page.waitForFunction(
        (templateId) =>
          document
            .querySelector(".problem-content")
            ?.getAttribute("data-template") !== templateId,
        initial.id,
      );
      assert(
        practice.focusSkillId !== null,
        "Connected choice persists the selected skill",
      );
      await submit(page, "999999999");
      assert.equal(
        await page
          .getByRole("button", { name: "Leads to", exact: false })
          .count(),
        0,
        "Incorrect answers offer foundations only",
      );
      await page
        .getByRole("button", { name: "Builds on", exact: false })
        .waitFor();
      assert.equal(await page.getByText("+1 XP", { exact: true }).count(), 0);
      if (width < 900) await solvedInView(page, `${mode} ${width} incorrect`);
      await page.screenshot({
        path: `${output}/${mode}-${width}-${theme}-incorrect.png`,
      });
      const incorrectNext = await next.boundingBox();
      assert(
        incorrectNext && box && Math.abs(incorrectNext.y - box.y) <= 2,
        `${mode} ${width}: correct and incorrect Next must share a position`,
      );
      // Focused on one skill, the feedback offers the way back beside Next,
      // on one line and inside the sheet at every width.
      const mixed = page.getByRole("button", {
        name: "Mixed practice",
        exact: true,
      });
      const mixedBox = await mixed.boundingBox();
      const sheetBox = await page.locator(".feedback").boundingBox();
      assert(
        mixedBox &&
          sheetBox &&
          incorrectNext &&
          Math.abs(mixedBox.y - incorrectNext.y) <= 1 &&
          mixedBox.height >= 44 &&
          mixedBox.x >= sheetBox.x &&
          incorrectNext.x + incorrectNext.width <= sheetBox.x + sheetBox.width,
        `${mode} ${width}: Mixed practice sits beside Next`,
      );
      assert(
        await mixed.evaluate((el) => el.scrollWidth <= el.clientWidth),
        `${mode} ${width}: Mixed practice keeps its label on one line`,
      );
      const selectedTemplate = templates.find(
        (t) => t.skillId === practice.focusSkillId,
      )!.id;
      await next.click();
      await page.waitForFunction(
        (templateId) =>
          document
            .querySelector(".problem-content")
            ?.getAttribute("data-template") === templateId,
        selectedTemplate,
      );
      assert.equal(
        batches.at(-1),
        null,
        "Next lets the server select within the saved skill",
      );
      await page.getByRole("button", { name: "Open AMP menu" }).click();
      await page
        .getByRole("button", {
          name: "Return to mixed practice",
          exact: true,
        })
        .click();
      await page.waitForFunction(
        (templateId) =>
          document
            .querySelector(".problem-content")
            ?.getAttribute("data-template") === templateId,
        initial.id,
      );
      assert.equal(practice.focusSkillId, null);
      if (width === 390 && theme === "light") {
        failProgress = true;
        await submit(page, (await current()).answer);
        await page
          .getByText("Progress unavailable.", { exact: false })
          .waitFor();
        assert(await next.isEnabled(), "A progress failure never blocks Next");
        failProgress = false;
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await page
          .getByText("3 more correct without help for Strong", {
            exact: true,
          })
          .waitFor();
        failBranch = true;
        await page
          .getByRole("button", { name: "Builds on", exact: false })
          .click();
        await page
          .getByRole("dialog", { name: "Builds on", exact: true })
          .locator("li button")
          .first()
          .click();
        await page.locator(".feedback-navigation-error").waitFor();
        assert(await next.isEnabled());
        failBranch = false;
        await next.click();
        // The next problem, whatever its kind (a typed answer or a
        // structured one).
        await page
          .locator(".question")
          .waitFor()
          .catch(async (error) => {
            await page.screenshot({
              path: `${output}/${mode}-${width}-${theme}-after-branch-failure.png`,
            });
            console.error(await page.locator("body").innerText(), errors);
            throw error;
          });
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Open AMP menu" }).click();
        await page
          .getByRole("switch", { name: "Sound", exact: true })
          .or(page.getByRole("checkbox", { name: "Sound", exact: true }))
          .check();
        await page
          .getByRole("switch", { name: "Haptics", exact: true })
          .or(page.getByRole("checkbox", { name: "Haptics", exact: true }))
          .check();
        await page.keyboard.press("Escape");
        await page.reload();
        await page
          .locator(".question")
          .waitFor()
          .catch(async (error) => {
            await page.screenshot({
              path: `${output}/${mode}-${width}-${theme}-failure.png`,
            });
            console.error(await page.locator("body").innerText(), errors);
            throw error;
          });
        await page.getByRole("button", { name: "Open AMP menu" }).click();
        assert(
          await page
            .getByRole("switch", { name: "Sound", exact: true })
            .or(page.getByRole("checkbox", { name: "Sound", exact: true }))
            .isChecked(),
        );
        assert(
          await page
            .getByRole("switch", { name: "Haptics", exact: true })
            .or(page.getByRole("checkbox", { name: "Haptics", exact: true }))
            .isChecked(),
        );
      }
      if (width === 390 && theme === "light") {
        await page.screenshot({
          path: `${output}/${mode}-${width}-${theme}-menu-details.png`,
        });
        await page.keyboard.press("Escape");
        await openHome(page, origin);
        // A grown-up's view always names grades, with no device toggle: the
        // learner's page draws their scale by grade.
        await page
          .locator('[data-child-page="sample-learner"]')
          .or(page.getByRole("link", { name: /Sample learner/ }).first())
          .first()
          .waitFor();
        if (!(await page.locator('[data-child-page="sample-learner"]').count()))
          await page
            .getByRole("link", { name: /Sample learner/ })
            .first()
            .click();
        await page.locator('[data-child-page="sample-learner"]').waitFor();
        await page.getByText("Gr 4", { exact: true }).first().waitFor();
        await page.screenshot({
          path: `${output}/${mode}-390-light-progress-details.png`,
          fullPage: true,
        });
      }
      assert.deepEqual(errors, []);
      console.log(
        `${mode} ${width} ${theme}: correct → focused skill → incorrect → continued focus → mixed practice`,
      );
      await context.close();
    }
} finally {
  await browser.close();
  await vite.close();
}
