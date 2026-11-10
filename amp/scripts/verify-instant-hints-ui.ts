import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { chromium as rawChromium, firefox, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import {
  preparePracticeAnswer,
  trackPracticeProblems,
} from "./ui-practice-answer";
/**
 * Instant hints, in Chromium and Firefox against the real learning API. Each
 * journey practices as a new signed-in learner (development auth) at
 * `/practice`:
 *
 * - `preloaded`: hints arrive with the batch, so Hint needs no request; a
 *   trip to Progress and Back keeps the problem and its revealed hint; a lost
 *   attempt response retries with the same answer and assistance.
 * - `fallback`: a batch without hints falls back to the hint request, after
 *   a skip and the same trip to Progress and Back.
 * - `opening`: the first problem is the hinted one.
 *
 * `--port` moves the web server (the API takes the next port).
 */
const families = {
  chromium: {
    preloaded: ["hierarchy-statement", "polygon-sides-select"],
    fallback: ["proportional-match-table", "graph-of-proportional-rate"],
    opening: ["scientific-notation-work", "unit-piece-size"],
  },
  firefox: {
    preloaded: ["plot-points", "hierarchy-statement"],
    fallback: ["polygon-sides-select", "proportional-match-table"],
    opening: ["unit-piece-size", "scientific-notation-work"],
  },
} as const;
const portFlag = process.argv.indexOf("--port");
const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : 4462,
  apiPort = port + 1,
  origin = `http://127.0.0.1:${port}`;
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
// The signed-in app reads the account (`/api/v1/me`) from the family routes.
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate: developmentAuth(),
  development: true,
});
await app.listen({ host: "127.0.0.1", port: apiPort });
const root = new URL("../", import.meta.url).pathname;
const vite = await createServer({
  root,
  configFile: root + "vite.config.ts",
  cacheDir: "node_modules/.vite-instant-hints",
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    fs: { allow: [root, realpathSync(root + "node_modules")] },
    proxy: { "/api": { target: `http://127.0.0.1:${apiPort}` } },
  },
});
await vite.listen();
/** The development account is shared: these are removed at the end. */
const learners: string[] = [];
/** Answers and skips the server has counted against the free problems. */
async function freeUsed(learnerId: string) {
  const { rows } = await repository.pool.query<{ used: number }>(
    "SELECT free_online_used AS used FROM amp_learners WHERE id=$1",
    [learnerId],
  );
  return rows[0]!.used;
}
async function attempt(page: Page) {
  const { problem, submit } = await preparePracticeAnswer(page, true);
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
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
      for (const mode of ["preloaded", "fallback", "opening"] as const) {
        console.log(`${name}/${mode}: opening hint journey`);
        const fallback = mode === "fallback";
        const [hintedFamily, independentFamily] =
          families[name as keyof typeof families][mode];
        let servingFamily =
          mode === "opening" ? hintedFamily : "multiply-facts";
        const created = await app.inject({
          method: "POST",
          url: "/api/v1/learners",
          headers: { authorization: "Bearer amp-local-development" },
          payload: { name: "Hint learner", birthYear: 2016 },
        });
        assert.equal(created.statusCode, 201, created.body);
        const { id: learnerId } = created.json() as { id: string };
        learners.push(learnerId);
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
        });
        await context.addInitScript(
          (id) =>
            localStorage.setItem(
              "amp.learner",
              JSON.stringify({ state: { learnerId: id }, version: 1 }),
            ),
          learnerId,
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
        await page.goto(`${origin}/practice`);
        await page
          .locator(".question")
          .waitFor()
          .catch(async (error) => {
            throw new Error(
              `${name}/${mode}: ${page.url()}: ${errors.join("; ")}; ${(await page.locator("body").innerText()).slice(0, 2000)}`,
              { cause: error },
            );
          });
        if (mode !== "opening") {
          // Arm the next family before answering can start its prefetch.
          servingFamily = hintedFamily;
          if (fallback) {
            await page.getByRole("button", { name: /^Skip/ }).click();
            await page.locator(".next-action").waitFor();
          } else await attempt(page);
          assert.equal(
            await freeUsed(learnerId),
            1,
            `${name}/${mode}: the server counted the first problem`,
          );
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
        if (mode !== "opening") {
          // Progress, from the drawer, and Back: practice is where it was.
          await page.getByRole("button", { name: "Open AMP menu" }).click();
          await page
            .getByRole("link", { name: "Progress" })
            .click({ noWaitAfter: true });
          await page
            .waitForURL((url) => url.pathname === "/overview")
            .catch((error) => {
              throw new Error(
                `${name}/${mode}: progress navigation reached ${page.url()}`,
                { cause: error },
              );
            });
          await page
            .locator(".frontier-map")
            .waitFor()
            .catch(async (error) => {
              // Say what Progress showed instead: a skeleton, an error, or a
              // redirect back to practice each have a different cause.
              throw new Error(
                `${name}/${mode}: no level map at ${page.url()}; page errors=${JSON.stringify(errors)}; navigations=${JSON.stringify(navigations.slice(-6))}; screen=${await page
                  .locator("body")
                  .innerText({ timeout: 1000 })
                  .then((text) => text.slice(0, 600))
                  .catch(() => "Unavailable")}`,
                { cause: error },
              );
            });
          console.log(`${name}/${mode}: returning from progress`);
          await page
            .goBack({ waitUntil: "domcontentloaded" })
            .catch((error) => {
              throw new Error(
                `${name}/${mode}: Back stopped at ${page.url()}; navigations=${JSON.stringify(navigations)}; errors=${JSON.stringify(errors)}`,
                { cause: error },
              );
            });
          await page.waitForURL((url) => url.pathname === "/practice");
          await page.locator(".question").waitFor();
        }
        assert.equal(
          await page
            .locator(".problem-content")
            .getAttribute("data-problem-id"),
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
        if (mode === "preloaded") {
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
            page.waitForResponse(
              (r) =>
                r.url().endsWith("/attempts") &&
                r.request().postDataJSON()?.problemId === planned.problem.id,
            ),
            page
              .locator(".answer-action:visible, .choice-submit:visible")
              .click(),
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
          ["Bearer"],
          `${name}/${mode}: learning requests use the account's session`,
        );
        await page.unrouteAll({ behavior: "wait" });
        await context.close();
        console.log(
          `${name}/${mode}: ${fallback ? "legacy fallback" : "preloaded hints without a hint request"}, ${mode === "opening" ? "" : "progress/back, "}assisted ${hintedKind}, independent ${independentKind}`,
        );
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await vite.close();
  await app.close();
  if (learners.length)
    await repository.pool.query("DELETE FROM amp_learners WHERE id=ANY($1)", [
      learners,
    ]);
  await repository.close();
}
