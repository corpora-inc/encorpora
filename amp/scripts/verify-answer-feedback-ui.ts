import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium, type Page } from "playwright";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";
import { skills } from "../src/curriculum/catalog";
import { templates, generateProblem } from "../src/math/engine";
import { projectSkillEvidence } from "../src/server/evidence";
import type { Outcome } from "../src/server/repository";
import { answerPathways } from "../src/web/features/practice/answer-pathways";

const root = new URL("../", import.meta.url).pathname;
const vite = await createServer({
  plugins: [
    {
      name: "answer-feedback-fixture-auth",
      enforce: "pre",
      load(id) {
        if (id.split("?")[0] === root + "src/web/auth.ts")
          return `export async function accessSession(){return localStorage.getItem("fixture.parent")?{token:"synthetic",accountId:"fixture-parent"}:null;}export function onSessionChanged(){return()=>{}}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return {mode:"accounts",passwords:true,providers:[]}}`;
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
const output = "artifacts/answer-feedback";
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
  strands: {},
};
async function submit(page: Page, answer: string) {
  const compact = page.locator(".compact-answer-action");
  if (await compact.isVisible()) await compact.click();
  await page.locator("#answer:visible").fill(answer);
  await page.locator("#answer:visible").press("Enter");
  await page.getByRole("region", { name: "Answer feedback" }).waitFor();
}
try {
  for (const mode of ["account", "trial"])
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
          ({ mode, theme }) => {
            localStorage.setItem("amp.trial", "synthetic-trial");
            if (mode === "account") localStorage.setItem("fixture.parent", "1");
            localStorage.setItem("amp.theme", theme);
            navigator.sendBeacon = () => true;
            Object.defineProperty(navigator, "vibrate", { value: () => true });
          },
          { mode, theme },
        );
        const attempts: Outcome[] = [];
        const instances = new Map<string, ReturnType<typeof generateProblem>>();
        const batches: (string | null)[] = [];
        let failProgress = false;
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
          if (path === "/api/v1/catalog")
            return route.fulfill({
              json: {
                skills,
                templates,
                lessons: [],
                mode: "hosted",
                trial: { free: 100, placement: 10 },
              },
            });
          if (path === "/api/v1/learners")
            return route.fulfill({
              json: { learners: [{ id: "trial-learner", birthYear: 2016 }] },
            });
          if (path.endsWith("/trial-progress"))
            return route.fulfill({
              json: {
                phase: "practice",
                free: 100,
                placement: 10,
                remaining: 58 - attempts.length,
                totals: {
                  answered: 42 + attempts.length,
                  correct: 30 + attempts.filter((a) => a.correct).length,
                  assisted: 0,
                },
                mastered: [],
                frontier: { placement: null, current: frontier },
              },
            });
          if (path.endsWith("/progress")) {
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
          if (path.endsWith("/frontier"))
            return route.fulfill({ json: frontier });
          if (path.endsWith("/batches")) {
            batches.push(body.templateId ?? null);
            if (body.templateId && failBranch)
              return route.fulfill({
                status: 503,
                json: { error: "Synthetic branch failure" },
              });
            const problem = generateProblem(
              body.templateId ?? initial.id,
              `feedback-${batches.length}`,
            );
            instances.set(problem.public.id, problem);
            return route.fulfill({
              json: {
                problems: [problem.public],
                trialRemaining: 58 - attempts.length,
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
          return route.fulfill({
            status: 404,
            json: { error: "Synthetic route unavailable" },
          });
        });
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        const routePath = mode === "account" ? "/practice" : "/try/practice";
        await page.goto(origin + routePath);
        await page.locator(".question").waitFor();
        const current = async () => {
          const id = await page
            .locator(".problem-content")
            .getAttribute("data-template");
          return [...instances.values()]
            .reverse()
            .find((p) => p.public.templateId === id)!;
        };
        await submit(page, (await current()).answer);
        await page.getByText("+1 XP", { exact: true }).waitFor();
        await page
          .getByText("4 more correct without help for Strong", { exact: true })
          .waitFor();
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
        await page
          .getByRole("button", { name: "Leads to", exact: false })
          .click();
        const dialog = page.getByRole("dialog", {
          name: "Leads to",
          exact: true,
        });
        await dialog.waitFor();
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
          batches.some((t) => t !== null),
          "Connected choice requests a specific problem",
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
        await page.screenshot({
          path: `${output}/${mode}-${width}-${theme}-incorrect.png`,
        });
        const beforeNext = batches.length;
        await next.click();
        await page.waitForFunction(
          (templateId) =>
            document
              .querySelector(".problem-content")
              ?.getAttribute("data-template") === templateId,
          initial.id,
        );
        assert.equal(
          batches.at(-1),
          null,
          "Next consumes an adaptive request, not the last selected template",
        );
        assert(
          batches.length >= beforeNext,
          "Adaptive prefetch can be consumed",
        );
        if (width === 390 && theme === "light") {
          failProgress = true;
          await submit(page, (await current()).answer);
          await page
            .getByText("Progress unavailable.", { exact: false })
            .waitFor();
          assert(
            await next.isEnabled(),
            "A progress failure never blocks Next",
          );
          failProgress = false;
          await page
            .getByRole("button", { name: "Retry", exact: true })
            .click();
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
          await page.locator("#answer").waitFor();
          await page.keyboard.press("Escape");
          await page.getByRole("button", { name: "Open AMP menu" }).click();
          await page
            .getByRole("checkbox", { name: "Sound", exact: true })
            .check();
          await page
            .getByRole("checkbox", { name: "Haptics", exact: true })
            .check();
          await page.keyboard.press("Escape");
          await page.reload();
          await page.locator(".question").waitFor();
          await page.getByRole("button", { name: "Open AMP menu" }).click();
          assert(
            await page
              .getByRole("checkbox", { name: "Sound", exact: true })
              .isChecked(),
          );
          assert(
            await page
              .getByRole("checkbox", { name: "Haptics", exact: true })
              .isChecked(),
          );
        }
        assert.deepEqual(errors, []);
        console.log(
          `${mode} ${width} ${theme}: correct → connected problem → incorrect → adaptive Next`,
        );
        await context.close();
      }
} finally {
  await browser.close();
  await vite.close();
}
