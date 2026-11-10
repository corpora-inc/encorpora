/** Real practice routes and API grading. Requires a disposable
 * AMP_TEST_DATABASE_URL; writes screenshots to AMP_EVIDENCE_DIR. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chromium as rawChromium, webkit, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes";
import { generateProblem, type GeneratedProblem } from "../src/math/engine";
import {
  counterThings,
  type CounterBuilderResponse,
} from "../src/math/counter-builder";
import { counterBuilderVariants } from "../src/math/counter-builder-practice";
import { counterBuilderLesson } from "../src/content/counter-builder-lessons";
import { publicationHtml } from "../src/content/publications";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { chooseLearner } from "./ui-controls";
import { startTopic } from "./ui-practice";
import { fillCounterBuilder } from "./ui-counter-builder";

const database = process.env.AMP_TEST_DATABASE_URL;
assert.ok(database, "AMP_TEST_DATABASE_URL required");
assertTestDatabaseTarget(database);
const engine = process.argv.includes("--webkit") ? "webkit" : "chromium";
const port = engine === "webkit" ? 4576 : 4566;
const baseUrl = `http://127.0.0.1:${port}`;
const smoke = process.argv.includes("--smoke");
const shots =
  process.env.AMP_EVIDENCE_DIR ??
  new URL("../artifacts/counter-builder-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const schema = `amp_counter_ui_${randomUUID().replaceAll("-", "")}`;
const admin = new Pool({ connectionString: database, max: 1 });
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(database);
scoped.searchParams.set("options", `-c search_path=${schema}`);
await migrate(scoped.href);
const repository = new PostgresRepository(scoped.href, {
  development: true,
  freeProblems: 200,
});
const learner = await repository.create(
  "development-household",
  "Counter reviewer",
  2021,
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
await app.listen({ host: "127.0.0.1", port: port + 1 });
const vite = await createServer({
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
    proxy: { "/api": { target: `http://127.0.0.1:${port + 1}` } },
  },
});
await vite.listen();
const browser = await (
  engine === "webkit" ? webkit : secureChromium(rawChromium)
).launch();
const errors: string[] = [],
  evidence: object[] = [];
const fixtures = new Map<string, GeneratedProblem>();
for (let i = 0; i < 1000 && fixtures.size < 5; i++) {
  const p = generateProblem("build-the-number-sentence", `browser-${i}`);
  const a = JSON.parse(p.answer);
  // A full ten frame and a take-away with different taken/left quantities.
  if (p.variant!.id === "build-frame" && a.sentence[3] !== 10) continue;
  if (
    p.variant!.id.includes("take") &&
    (a.removed === a.sentence[3] || a.groups[0] < 5)
  )
    continue;
  if (!fixtures.has(p.variant!.id)) fixtures.set(p.variant!.id, p);
}
assert.equal(fixtures.size, 5);
// Review every silhouette at phone size, with both group colors in a full frame.
for (let i = 0; i < 2000 && fixtures.size < 5 + counterThings.length; i++) {
  const p = generateProblem("build-the-number-sentence", `object-${i}`);
  if (
    p.variant!.id !== "build-frame" ||
    JSON.parse(p.answer).sentence[3] !== 10
  )
    continue;
  const r = p.public.response as CounterBuilderResponse;
  fixtures.set(`object-${r.thing}`, p);
}
assert.equal(fixtures.size, 5 + counterThings.length);

async function geometry(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".problem-stage")!;
    const box = (selector: string) => {
      const node = document.querySelector(selector)!;
      const r = node.getBoundingClientRect();
      return [
        r.x,
        r.y + (stage.contains(node) ? stage.scrollTop : 0),
        r.width,
        r.height,
      ].map((n) => Math.round(n * 10) / 10);
    };
    return {
      prompt: box("#problem-prompt"),
      boards: box(".counter-boards"),
      groups: Array.from(
        document.querySelectorAll(".counter-group-heading"),
      ).map((node) => {
        const r = node.getBoundingClientRect();
        return [r.x, r.y + stage.scrollTop, r.width, r.height].map(
          (n) => Math.round(n * 10) / 10,
        );
      }),
      sentence: box(".counter-sentence"),
      tiles: box(".counter-tiles"),
      dock: box(".answer-dock"),
      overflow: document.documentElement.scrollWidth - innerWidth,
      stageOverflow: stage.scrollWidth - stage.clientWidth,
    };
  });
}
async function stable(
  page: Page,
  before: Awaited<ReturnType<typeof geometry>>,
) {
  const after = await geometry(page);
  assert.deepEqual(
    after,
    before,
    "Adding counters or Xs, editing tiles, reset and grading must not move content",
  );
  assert.equal(after.overflow, 0);
  assert.equal(after.stageOverflow, 0);
}
async function promptVisible(page: Page) {
  const visible = await page.evaluate(() => {
    const prompt = document
      .querySelector("#problem-prompt")!
      .getBoundingClientRect();
    const stage = document
      .querySelector(".problem-stage")!
      .getBoundingClientRect();
    const header = document
      .querySelector("[data-app-bar]")
      ?.getBoundingClientRect();
    const topic = document
      .querySelector(".practice-topic")
      ?.getBoundingClientRect();
    return (
      prompt.top >=
      Math.max(stage.top, header?.bottom ?? 0, topic?.bottom ?? 0) - 1
    );
  });
  assert.ok(visible, "Prompt must never be clipped under the header");
}
async function reachable(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  // Native scrollIntoView cannot account for the overlaid feedback sheet.
  // Scroll the stage as a reader would to uncover a control beneath it.
  await page.locator(selector).evaluate((node) => {
    const stage = document.querySelector<HTMLElement>(".problem-stage")!;
    const b = node.getBoundingClientRect();
    const sheet = document.querySelector(".feedback")?.getBoundingClientRect();
    if (sheet && sheet.left < b.right && sheet.right > b.left)
      stage.scrollTop += Math.max(0, b.bottom - sheet.top + 1);
  });
  const fits = await page.locator(selector).evaluate((node) => {
    const b = node.getBoundingClientRect();
    const stage = document
      .querySelector(".problem-stage")!
      .getBoundingClientRect();
    const sheet = document.querySelector(".feedback")?.getBoundingClientRect();
    const covered = sheet && sheet.left < b.right && sheet.right > b.left;
    return (
      b.top >= stage.top - 1 &&
      b.bottom <= Math.min(stage.bottom, covered ? sheet!.top : innerHeight) + 1
    );
  });
  assert.ok(fits, `${selector} is fully reachable above the dock and feedback`);
}

try {
  for (const theme of smoke
    ? (["light"] as const)
    : (["light", "dark"] as const))
    for (const [width, height] of smoke
      ? [[390, 900]]
      : process.argv.includes("--compact")
        ? [
            [320, 568],
            [844, 390],
          ]
        : [
            [320, 900],
            [390, 900],
            [768, 1024],
            [1280, 900],
            [320, 568],
            [844, 390],
          ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
        hasTouch: width < 400,
        reducedMotion: "reduce",
      });
      await context.addInitScript("globalThis.__name = (f) => f");
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${baseUrl}/overview`);
      await chooseLearner(page, learner.id);
      const compact = height < 600;
      for (const variant of smoke
        ? ["build-join", "build-frame", "story-take"]
        : [
            ...counterBuilderVariants,
            ...(width === 320 && !compact
              ? counterThings.map((thing) => `object-${thing}`)
              : []),
          ]) {
        const base = fixtures.get(variant)!;
        const r = base.public.response as CounterBuilderResponse;
        const tag = `${variant}-${compact ? `${width}x${height}` : width}-${theme}`;
        for (const correct of [true, false]) {
          const p = structuredClone(base);
          p.public.id = randomUUID();
          await repository.transaction(
            "development-household",
            learner.id,
            (tx) => tx.saveProblem(p),
          );
          const batches = `**/api/v1/learners/${learner.id}/batches`;
          await page.unroute(batches);
          let capabilities: string[] = [];
          await page.route(batches, (route) => {
            if (route.request().method() !== "POST") return route.continue();
            capabilities = route.request().postDataJSON().responseCapabilities;
            return route.fulfill({
              json: {
                problems: [p.public],
                hints: { [p.public.id]: { hint: p.hint } },
                lesson: null,
              },
            });
          });
          await startTopic(page, p.public.templateId, { entry: "lesson-url" });
          await page.locator(".counter-builder").waitFor();
          await page.waitForFunction(
            (id) =>
              document
                .querySelector(".problem-content")
                ?.getAttribute("data-problem-id") === id,
            p.public.id,
          );
          assert.equal(
            await page.locator("#problem-prompt").getAttribute("data-text"),
            p.public.prompt,
          );
          await page.evaluate(() => document.fonts.ready);
          assert.ok(capabilities.includes("counter-builder-v1"));
          const before = await geometry(page);
          assert.equal(before.overflow, 0);
          assert.equal(before.stageOverflow, 0);
          await promptVisible(page);
          assert.equal(
            await page.locator(".counter-group-heading").count(),
            r.canRemove ? 1 : 2,
          );
          assert.equal(
            await page.getByRole("button", { name: /^Group [12]:/ }).count(),
            0,
          );
          assert.ok(
            await page
              .getByRole("button", { name: "Check", exact: true })
              .isDisabled(),
          );
          if (correct) {
            await page.screenshot({ path: `${shots}/${tag}-empty.png` });
            const first = page.locator(".counter-cell").first();
            await first.focus();
            await page.keyboard.press("Enter");
            await stable(page, before);
            if (r.canRemove) {
              await page.keyboard.press("Enter");
              assert.equal(await page.locator(".counter-cross").count(), 1);
              await stable(page, before);
              await page.keyboard.press("Enter");
              assert.equal(await page.locator(".counter-cross").count(), 0);
            }
            await page.keyboard.press("Delete");
            await stable(page, before);
            await page.keyboard.press("Enter");
            await page.keyboard.press("ArrowRight");
            await page.keyboard.press("Space");
            await page
              .getByRole("button", { name: "Reset", exact: true })
              .click();
            await page.waitForFunction(() =>
              document
                .querySelector('.counter-builder [role="status"]')
                ?.textContent?.includes("Board reset"),
            );
            await stable(page, before);
            assert.match(
              (await page
                .locator('.counter-builder [role="status"]')
                .textContent())!,
              /Board reset/,
            );
            if (r.board === "frame") {
              const add = (group: number) =>
                page.getByRole("button", {
                  name: new RegExp(`Add ${r.thing} to group ${group}\\.`),
                });
              await add(2).click();
              const next = page.locator(".counter-cell").nth(1);
              await next.focus();
              assert.match((await next.getAttribute("aria-label"))!, /group 2/);
              await page.keyboard.press("Enter");
              await add(1).click();
              await next.focus();
              await page.keyboard.press("Delete");
              assert.deepEqual(
                await page.locator(".counter-group-count").allTextContents(),
                ["1", "1"],
              );
              await page
                .getByRole("button", { name: "Reset", exact: true })
                .click();
              await stable(page, before);
            }
            const targets = await page
              .locator(".counter-builder button, .counter-builder-form button")
              .evaluateAll((nodes) =>
                nodes.map((n) => {
                  const b = n.getBoundingClientRect();
                  return [b.width, b.height];
                }),
              );
            assert.ok(
              targets.every(([w, h]) => w >= 44 && h >= 44),
              "Every control is at least 44px",
            );
          }
          const answer = JSON.parse(p.answer);
          if (!correct) {
            // Real wrong models: taken and left swapped, or total-only join.
            if (r.canRemove) answer.removed = answer.sentence[3];
            else answer.groups = [answer.sentence[3], 0];
          }
          await fillCounterBuilder(page, r, JSON.stringify(answer));
          await stable(page, before);
          if (compact) {
            await reachable(page, ".counter-signs");
            await reachable(page, ".counter-ten");
          } else await reachable(page, ".counter-tiles");
          const placed = await page
            .locator('.counter-cell[data-placed="true"]')
            .count();
          assert.equal(
            placed,
            answer.groups.reduce((s: number, n: number) => s + n, 0),
          );
          for (const [group, count] of answer.groups.entries()) {
            const colors = await page
              .locator(
                `.counter-cell[data-placed="true"][data-color="${group}"] .counter-object`,
              )
              .evaluateAll((nodes) =>
                nodes.map((node) => getComputedStyle(node).color),
              );
            const swatch = await page
              .locator(
                `.counter-group-heading[data-color="${group}"] .counter-swatch`,
              )
              .evaluate((node) => getComputedStyle(node).backgroundColor);
            assert.equal(colors.length, count);
            assert.ok(
              colors.every((color) => color === swatch),
              "Every object matches its group's swatch, including the ten frame",
            );
          }
          assert.equal(
            await page.locator(".counter-cross").count(),
            answer.removed,
          );
          const live = await page
            .locator('.counter-builder [role="status"]')
            .textContent();
          assert.match(live!, /equals/);
          assert.match(live!, r.canRemove ? /crossed out/ : /in one group/);
          await page.locator(".problem-stage").evaluate((n) => {
            n.scrollTop = 0;
          });
          if (correct)
            await page.screenshot({ path: `${shots}/${tag}-filled.png` });
          const [reply] = await Promise.all([
            page.waitForResponse(
              (res) =>
                res.url().endsWith("/attempts") &&
                res.request().method() === "POST",
            ),
            page.getByRole("button", { name: "Check", exact: true }).click(),
          ]);
          assert.equal(reply.status(), 200, await reply.text());
          const outcome = await reply.json();
          assert.equal(outcome.correct, correct);
          assert.equal(
            outcome.response,
            JSON.stringify(answer),
            "Grading preserves the drawn groups and sentence",
          );
          await page
            .locator('.counter-builder[data-resolved="true"]')
            .waitFor();
          await page
            .locator(".practice-celebration")
            .waitFor({ state: "hidden" });
          await stable(page, before);
          await promptVisible(page);
          assert.equal(
            await page.locator(".counter-group-heading button:visible").count(),
            0,
          );
          await reachable(page, ".counter-sentence");
          await page.locator(".problem-stage").evaluate((n) => {
            n.scrollTop = 0;
          });
          assert.equal(
            await page
              .locator('.counter-builder [aria-pressed="true"]')
              .count(),
            0,
            "No selection cursor after grading",
          );
          await page.screenshot({
            path: `${shots}/${tag}-${correct ? "correct" : "incorrect"}.png`,
          });
          const actions = await page
            .locator(
              ".feedback .next-row button, .feedback .practice-tools button",
            )
            .evaluateAll((nodes) =>
              nodes.every((node) => {
                const b = node.getBoundingClientRect();
                return (
                  b.width >= 44 &&
                  b.height >= 44 &&
                  b.top >= 0 &&
                  b.bottom <= innerHeight + 1
                );
              }),
            );
          assert.ok(actions, "Feedback actions are visible and touch sized");
          if (width < 900) {
            await page
              .getByRole("button", { name: "See why", exact: true })
              .click();
            await page
              .getByRole("dialog", { name: "Explanation", exact: true })
              .waitFor();
            await page.keyboard.press("Escape");
            await promptVisible(page);
          }
          const body = reply.request().postDataJSON();
          const headers = {
            authorization: reply.request().headers().authorization!,
          };
          body.response = JSON.stringify(
            {
              sentence: answer.sentence,
              removed: answer.removed,
              groups: answer.groups,
            },
            null,
            1,
          );
          const retry = await page.request.post(reply.url(), {
            data: body,
            headers,
          });
          assert.equal(retry.status(), 200, await retry.text());
          assert.equal(
            (await retry.json()).id,
            outcome.id,
            "Equivalent transport retry is idempotent",
          );
          if (correct && width === 390 && theme === "light") {
            const legacy = await page.request.post(
              `${baseUrl}/api/v1/learners/${learner.id}/batches`,
              {
                headers,
                data: {
                  count: 1,
                  templateId: p.public.templateId,
                  responseCapabilities: ["figure-choice-v1"],
                  figureCapabilities: ["scenes-v1"],
                },
              },
            );
            assert.equal(legacy.status(), 200, await legacy.text());
            const oldProblem = (await legacy.json()).problems[0];
            assert.equal(
              oldProblem.response.kind,
              "figure-choice",
              "Old clients reach the fallback through the real API",
            );
            assert.deepEqual(
              oldProblem.prompt.match(/\d+/g),
              generateProblem(
                oldProblem.templateId,
                oldProblem.seed,
              ).public.prompt.match(/\d+/g),
            );
            const report = await page.request.post(
              `${baseUrl}/api/v1/learners/${learner.id}/problem-flags`,
              {
                headers,
                data: {
                  problemId: p.public.id,
                  requestId: randomUUID(),
                  reasons: ["confusing-wording"],
                  client: { kind: "web", viewport: { width, height } },
                },
              },
            );
            assert.equal(report.status(), 201, await report.text());
            const saved = await repository.pool.query(
              "SELECT response_kind FROM amp_problem_flags WHERE id=$1",
              [(await report.json()).id],
            );
            assert.equal(saved.rows[0].response_kind, "counter-builder");
          }
          evidence.push({
            variant,
            width,
            height,
            theme,
            correct,
            geometry: before,
          });
        }
      }
      await context.close();
    }
  assert.deepEqual(errors, []);
  if (engine === "chromium") {
    const print = await browser.newPage();
    await print.emulateMedia({ media: "print" });
    await print.setContent(publicationHtml(counterBuilderLesson, "lesson"));
    await print.evaluate(() => document.fonts.ready);
    for (const format of ["Letter", "A4"] as const) {
      await print.setViewportSize({
        width: format === "Letter" ? 816 : 794,
        height: format === "Letter" ? 1056 : 1123,
      });
      await print.pdf({
        path: `${shots}/lesson-${format}.pdf`,
        format,
        printBackground: true,
      });
      await print.screenshot({
        path: `${shots}/lesson-${format}.png`,
        fullPage: true,
      });
    }
    await print.close();
  }
  await writeFile(
    `${shots}/geometry-${engine}.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    `Counter builder (${engine}): ${evidence.length} graded cases passed. Stable counters, Xs and tiles; no overflow; 44px targets; keyboard, reset, announcements, grading, retries and reports verified.`,
  );
} catch (error) {
  const page = browser.contexts().at(-1)?.pages().at(-1);
  if (page) {
    await page.screenshot({ path: `${shots}/failure.png` });
    await writeFile(
      `${shots}/failure.txt`,
      await page.locator("body").innerText(),
    );
  }
  throw error;
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
