import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { chromium, firefox, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { trialKey } from "../src/web/lib/pending-trial";
import { fixtureMe } from "./me-fixture";
import { retentionNotice } from "../src/family/contracts";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import {
  preparePracticeAnswer,
  trackPracticeProblems,
} from "./ui-practice-answer";
const families = {
  chromium: {
    trial: ["hierarchy-statement", "polygon-sides-select"],
    fallback: ["proportional-match-table", "graph-of-proportional-rate"],
    account: ["scientific-notation-work", "unit-piece-size"],
  },
  firefox: {
    trial: ["plot-points", "hierarchy-statement"],
    fallback: ["polygon-sides-select", "proportional-match-table"],
    account: ["unit-piece-size", "scientific-notation-work"],
  },
} as const;
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
await app.listen({ host: "127.0.0.1", port: 4463 });
const root = new URL("../", import.meta.url).pathname;
const vite = await createServer({
  root,
  configFile: root + "vite.config.ts",
  cacheDir: "node_modules/.vite-instant-hints",
  plugins: [
    {
      name: "hint-test-auth",
      enforce: "pre",
      load(id) {
        // Route guards require a parent session. Trial/fallback keep the
        // local development trial token; account mode uses its /me fixture.
        if (id.split("?")[0] === root + "src/web/auth.ts")
          return `export async function accessSession(){return {token:"amp-local-development",accountId:"development-household"};}export function onSessionChanged(){return()=>{}}export async function signIn(){}export async function signOut(){}export function notifyAccountSessionChanged(){}export async function authConfig(){return localStorage.getItem("fixture.parent")?{mode:"accounts",passwords:true,providers:[]}:{mode:"development"}}`;
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 4462,
    strictPort: true,
    fs: { allow: [root, realpathSync(root + "node_modules")] },
    proxy: { "/api": { target: "http://127.0.0.1:4463" } },
  },
});
await vite.listen();
async function attempt(page: Page) {
  const { problem, submit } = await preparePracticeAnswer(page, true);
  const [response] = await Promise.all([
    page.waitForResponse((r) =>
      r.url().endsWith("/attempts") &&
      r.request().postDataJSON()?.problemId === problem.id,
    ),
    submit(),
  ]);
  assert.equal(response.status(), 200, await response.text());
  assert.equal((await response.json()).problemId, problem.id);
  return response;
}
async function nextProblem(page: Page) {
  const previous = await page
    .locator(".problem-content")
    .getAttribute("data-problem-id");
  assert.ok(previous, "Current problem has an identity before Next");
  await page.locator(".next-action").click();
  await page.locator(".feedback").waitFor({ state: "detached" });
  await page.waitForFunction((id) => {
    const current = document
      .querySelector(".problem-content")
      ?.getAttribute("data-problem-id");
    return !!current && current !== id;
  }, previous);
  await page.locator(".question").waitFor();
}

try {
  for (const [name, engine] of Object.entries({ chromium, firefox })) {
    console.log(`${name}: starting hint browser`);
    const browser = await engine.launch();
    try {
      for (const mode of ["trial", "fallback", "account"] as const) {
        console.log(`${name}/${mode}: opening hint journey`);
        const fallback = mode === "fallback";
        const [hintedFamily, independentFamily] =
          families[name as keyof typeof families][mode];
        let servingFamily = mode === "account" ? hintedFamily : "multiply-facts";
        const created = await app.inject({
          method: "POST",
          url: "/api/v1/trials",
          payload: { birthYear: 2016 },
        });
        assert.equal(created.statusCode, 201);
        const { token, learnerId } = created.json();
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
        });
        await context.addInitScript(
          ([key, token]) => localStorage.setItem(key!, token!),
          [trialKey, token],
        );
        const page = await context.newPage();
        const served = trackPracticeProblems(page);
        const navigations: string[] = [];
        page.on("framenavigated", (frame) => {
          if (frame === page.mainFrame()) navigations.push(frame.url());
        });
        const learningAuth = new Set<string>();
        page.on("request", (request) => {
          if (/\/(batches|attempts)$/.test(request.url()))
            learningAuth.add(
              (request.headers().authorization ?? "").split(" ")[0]!,
            );
        });
        if (mode === "account") {
          const learner = await repository.create(
            "development-household",
            "Hint learner",
            2016,
          );
          await context.addInitScript(() =>
            localStorage.setItem("fixture.parent", "1"),
          );
          await page.route("**/api/v1/me", (route) =>
            route.fulfill({
              json: fixtureMe(
                {
                  consent: {
                    status: "development",
                    policyVersion: "fixture",
                    recordedAt: null,
                    withdrawnAt: null,
                  },
                  learners: [
                    {
                      ...learner,
                      deletedAt: null,
                      stripeLinked: false,
                      canPractice: true,
                      access: [],
                    },
                  ],
                  retained: retentionNotice,
                },
                "development-household",
              ),
            }),
          );
        }
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        let hintRequests = 0;
        await page.route("**/hints", async (route) => {
          hintRequests++;
          if (fallback) await route.continue();
          else await route.abort();
        });
        // Deterministic families exercise different response surfaces while
        // the real server still generates/persists problems, hints and attempts.
        await page.route("**/batches", async (route) => {
          const response = await route.fetch({
            postData: JSON.stringify({
              ...route.request().postDataJSON(),
              templateId: servingFamily,
            }),
          });
          const body = await response.json();
          if (fallback) delete body.hints;
          await route.fulfill({ response, json: body });
        });
        await page.goto(
          `http://127.0.0.1:4462/${mode === "account" ? "practice" : "try/practice"}`,
        );
        await page
          .locator(".question")
          .waitFor()
          .catch(async (error) => {
            throw new Error(
              `${name}/${mode}: ${page.url()}: ${errors.join("; ")}; ${(await page.locator("body").innerText()).slice(0, 2000)}`,
              { cause: error },
            );
          });
        if (mode !== "account") {
          // A placement map needs a recorded answer; an empty placement
          // intentionally redirects to practice instead of showing the map.
          // Arm the next family before answering can start its prefetch.
          servingFamily = hintedFamily;
          await attempt(page);
          const progress = await app.inject({
            method: "GET",
            url: `/api/v1/learners/${learnerId}/trial-progress`,
            headers: { authorization: `Trial ${token}` },
          });
          assert.equal(progress.statusCode, 200);
          assert.equal(progress.json().totals.answered, 1);
          await nextProblem(page);
        }
        assert.equal(
          await page.locator(".problem-content").getAttribute("data-template"),
          hintedFamily,
        );
        const hintedId = await page
          .locator(".problem-content")
          .getAttribute("data-problem-id");
        assert.ok(hintedId);
        const hintedKind = served.get(hintedId)!.response.kind;
        const hint = page.getByRole("button", { name: "Hint", exact: true });
        await hint.click();
        const dialog = page.getByRole("dialog", { name: "Hint", exact: true });
        await page.waitForFunction(() => {
          const text = document.querySelector(".hint")?.textContent;
          return (
            text && !text.includes("Finding") && !text.includes("could not")
          );
        });
        const hintText = await dialog.locator(".hint").textContent();
        await page.keyboard.press("Escape");
        if (mode !== "account") {
          await page.getByRole("button", { name: "Open AMP menu" }).click();
          await page
            .getByRole("link", { name: "Your progress" })
            .click({ noWaitAfter: true });
          await page
            .waitForURL((url) => url.pathname === "/try/map")
            .catch((error) => {
              throw new Error(
                `${name}/${mode}: progress navigation reached ${page.url()}`,
                { cause: error },
              );
            });
          await page
            .getByRole("heading", { name: "Your progress", exact: true })
            .waitFor();
          await page.locator(".frontier-map").waitFor();
          console.log(`${name}/${mode}: returning from progress`);
          await page
            .goBack({ waitUntil: "domcontentloaded" })
            .catch((error) => {
              throw new Error(
                `${name}/${mode}: Back stopped at ${page.url()}; navigations=${JSON.stringify(navigations)}; errors=${JSON.stringify(errors)}`,
                { cause: error },
              );
            });
          await page.waitForURL((url) => url.pathname === "/try/practice");
          await page.locator(".question").waitFor();
        }
        assert.equal(
          await page.locator(".problem-content").getAttribute("data-problem-id"),
          hintedId,
          "navigation keeps the hinted problem",
        );
        await hint.click();
        assert.equal(
          await dialog.locator(".hint").textContent(),
          hintText,
          "navigation keeps revealed help",
        );
        await page.keyboard.press("Escape");
        assert.equal(
          hintRequests,
          fallback ? 1 : 0,
          "preloaded hints need no content request",
        );
        // Arm the family before an answer or retry can prefetch the next problem.
        servingFamily = independentFamily;
        if (mode === "trial") {
          const submitted: unknown[] = [];
          await page.route("**/attempts", async (route) => {
            submitted.push(route.request().postDataJSON());
            if (submitted.length === 1) {
              await route.fetch();
              await route.abort();
            } else await route.continue();
          });
          const planned = await preparePracticeAnswer(page, true);
          await planned.submit();
          await page.getByRole("alert").first().waitFor();
          assert.ok(
            await hint.isDisabled(),
            "cannot reveal extra help while retrying an immutable answer",
          );
          const [retried] = await Promise.all([
            page.waitForResponse((r) =>
              r.url().endsWith("/attempts") &&
              r.request().postDataJSON()?.problemId === planned.problem.id,
            ),
            page.locator(".answer-action:visible, .choice-submit:visible").click(),
          ]);
          assert.equal(retried.status(), 200);
          assert.equal((await retried.json()).problemId, planned.problem.id);
          assert.equal((await retried.json()).assisted, true);
          assert.equal(submitted.length, 2);
          assert.deepEqual(
            submitted[0],
            submitted[1],
            "lost-response retry preserves the answer and assistance",
          );
          await page.unroute("**/attempts");
        } else {
          const response = await attempt(page);
          assert.equal(response.status(), 200);
          assert.equal((await response.json()).assisted, true);
          assert.equal(
            response.request().postDataJSON().hintViewed,
            fallback ? undefined : true,
          );
        }
        await nextProblem(page);
        assert.equal(
          await page.locator(".problem-content").getAttribute("data-template"),
          independentFamily,
        );
        const independentId = await page
          .locator(".problem-content")
          .getAttribute("data-problem-id");
        assert.ok(independentId);
        const independentKind = served.get(independentId)!.response.kind;
        assert.notEqual(
          independentKind,
          hintedKind,
          "next independent answer changes response kind",
        );
        const next = await attempt(page);
        assert.equal(
          (await next.json()).assisted,
          false,
          "preloading alone is independent; help resets between problems",
        );
        assert.deepEqual(errors, []);
        assert.deepEqual(
          [...learningAuth],
          [mode === "account" ? "Bearer" : "Trial"],
          `${name}/${mode}: learning requests use the intended identity`,
        );
        await page.unrouteAll({ behavior: "wait" });
        await context.close();
        console.log(
          `${name}/${mode}: ${fallback ? "legacy fallback" : "preloaded hints without a hint request"}, ${mode === "account" ? "" : "map/back, "}assisted ${hintedKind}, independent ${independentKind}`,
        );
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await vite.close();
  await app.close();
  await repository.close();
}
