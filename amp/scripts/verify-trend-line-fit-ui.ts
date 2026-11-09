/** Real practice route, stored problems, server validation and grading.
 * Screenshots: AMP_EVIDENCE_DIR. Requires a disposable AMP_TEST_DATABASE_URL. */
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
import {
  generateProblem,
  gradeAnswer,
  type GeneratedProblem,
} from "../src/math/engine";
import {
  initialTrendPoints,
  type TrendLineFitResponse,
} from "../src/math/trend-line-fit";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { chooseLearner } from "./ui-controls";
import { startTopic } from "./ui-practice";
import { fillTrendLine } from "./ui-trend-line-fit";

const database = process.env.AMP_TEST_DATABASE_URL;
assert.ok(database);
assertTestDatabaseTarget(database);
const engine = process.argv.includes("--webkit") ? "webkit" : "chromium";
const port = engine === "webkit" ? 4618 : 4608;
const origin = `http://127.0.0.1:${port}`;
const smoke = process.argv.includes("--smoke");
const shots =
  process.env.AMP_EVIDENCE_DIR ??
  new URL("../artifacts/trend-line-fit-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const schema = `amp_trend_ui_${randomUUID().replaceAll("-", "")}`;
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
  "Scatter reviewer",
  2012,
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
for (let i = 0; fixtures.size < 2 && i < 500; i++) {
  const p = generateProblem("trend-line-fit", `browser-${i}`);
  if (["car", "study"].includes(p.variant!.axes!.context!))
    fixtures.set(p.variant!.id, p);
}
assert.equal(fixtures.size, 2);
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
      ].map((v) => Math.round(v * 10) / 10);
    };
    return {
      prompt: box("#problem-prompt"),
      canvas: box(".trend-canvas"),
      tools: box(".trend-tools"),
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
    "Moving or grading the line must not move the plot, prompt, tools or dock",
  );
  assert.equal(after.overflow, 0);
  assert.equal(after.stageOverflow, 0);
}
async function top(page: Page) {
  await page.locator(".problem-stage").evaluate((n) => {
    n.scrollTop = 0;
  });
}
try {
  for (const theme of smoke
    ? (["light"] as const)
    : (["light", "dark"] as const))
    for (const width of smoke ? [390] : [320, 390, 768, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 768 ? 1024 : 900 },
        colorScheme: theme,
        hasTouch: width < 400,
        reducedMotion: "reduce",
      });
      await context.addInitScript("globalThis.__name = (f) => f");
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${origin}/overview`);
      await chooseLearner(page, learner.id);
      for (const [variant, base] of fixtures)
        for (const correct of [true, false]) {
          const p = structuredClone(base);
          p.public.id = randomUUID();
          const r = p.public.response as TrendLineFitResponse;
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
          await page.locator(".trend-handle").first().waitFor();
          assert.ok(capabilities.includes("trend-line-fit-v1"));
          assert.equal(
            await page.locator(".trend-fit").count(),
            1,
            "Exactly one interaction",
          );
          assert.equal(await page.locator(".trend-handle").count(), 2);
          const before = await geometry(page);
          await stable(page, before);
          const tag = `${variant}-${width}-${theme}`;
          assert.ok(
            await page
              .getByRole("button", { name: "Check line", exact: true })
              .isDisabled(),
          );
          if (correct) {
            await top(page);
            await page.screenshot({ path: `${shots}/${tag}-empty.png` });
            const targets = await page
              .locator(".trend-fit button, .trend-answer button")
              .evaluateAll((nodes) =>
                nodes.map((n) => {
                  const b = n.getBoundingClientRect();
                  return [b.width, b.height];
                }),
              );
            assert.ok(targets.every(([w, h]) => w! >= 44 && h! >= 44));
            await page.locator(".trend-handle").first().focus();
            await page.keyboard.press("ArrowUp");
            await stable(page, before);
            await page
              .getByRole("button", { name: "Move down", exact: true })
              .click();
            await stable(page, before);
            assert.match(
              (await page.locator(".trend-status").textContent())!,
              /Slope/,
            );
            // A real drag, then a tap-to-select followed by an arrow button.
            await page
              .locator(".trend-handle")
              .first()
              .scrollIntoViewIfNeeded();
            const box = (await page
              .locator(".trend-handle")
              .first()
              .boundingBox())!;
            await page.mouse.move(
              box.x + box.width / 2,
              box.y + box.height / 2,
            );
            await page.mouse.down();
            await page.mouse.move(
              box.x + box.width / 2,
              box.y + box.height / 2 - 30,
              { steps: 5 },
            );
            await page.mouse.up();
            await stable(page, before);
            if (width < 400) await page.locator(".trend-handle").last().tap();
            else await page.locator(".trend-handle").last().click();
            await page
              .getByRole("button", { name: "Move up", exact: true })
              .click();
            await page
              .getByRole("button", { name: "Reset", exact: true })
              .click();
            await stable(page, before);
            assert.ok(
              await page
                .getByRole("button", { name: "Check line", exact: true })
                .isDisabled(),
            );
            await page.locator(".trend-handle").first().focus();
            for (let i = 0; i < (r.grid.xMax - r.grid.xMin) / r.grid.xStep; i++)
              await page.keyboard.press("ArrowRight");
            assert.match(
              (await page.locator(".trend-status").textContent())!,
              /different horizontal/,
            );
            await page
              .getByRole("button", { name: "Reset", exact: true })
              .click();
            assert.doesNotMatch(
              (await page.locator(".trend-status").textContent())!,
              /different horizontal/,
            );
            await page.locator(".trend-table summary").click();
            assert.equal(
              await page.locator(".trend-table tbody tr").count(),
              r.data.length,
            );
            await page.locator(".trend-table summary").click();
          }
          const candidates = [-1, 1].map((d) => {
            const key = JSON.parse(p.answer);
            key[0][1] += d;
            return JSON.stringify(key);
          });
          const answer = correct
            ? (candidates.find((raw) => gradeAnswer(p, raw)) ?? p.answer)
            : JSON.stringify(initialTrendPoints(r));
          await fillTrendLine(page, r, answer);
          await stable(page, before);
          await top(page);
          if (correct)
            await page.screenshot({ path: `${shots}/${tag}-filled.png` });
          const [reply] = await Promise.all([
            page.waitForResponse(
              (res) =>
                res.url().endsWith("/attempts") &&
                res.request().method() === "POST",
            ),
            page
              .getByRole("button", { name: "Check line", exact: true })
              .click(),
          ]);
          assert.equal(reply.status(), 200, await reply.text());
          const outcome = await reply.json();
          assert.equal(outcome.correct, correct);
          assert.equal(outcome.response, answer);
          await page.locator('.trend-fit[data-resolved="true"]').waitFor();
          await page
            .locator(".practice-celebration")
            .waitFor({ state: "hidden" });
          await stable(page, before);
          assert.equal(
            await page.locator(".problem-stage").evaluate((n) => n.scrollTop),
            0,
            "Grading must not auto-scroll the graph away",
          );
          const visiblePlot = await page
            .locator(".trend-legend")
            .evaluate((n) => {
              const b = n.getBoundingClientRect(),
                f = document
                  .querySelector(".feedback")!
                  .getBoundingClientRect();
              return (
                b.right <= f.left || b.left >= f.right || b.bottom <= f.top
              );
            });
          assert.ok(
            visiblePlot,
            "Entire graph and legend stay visible above feedback",
          );
          assert.equal(await page.locator(".trend-handle").count(), 0);
          assert.equal(await page.locator(".trend-good-line").count(), 1);
          assert.equal(await page.locator(".trend-student-line").count(), 1);
          assert.equal(
            await page.locator(".trend-residual").count(),
            2 * r.data.length,
          );
          await top(page);
          const visible = await page
            .locator("#problem-prompt")
            .evaluate(
              (n) =>
                n.getBoundingClientRect().top >=
                document
                  .querySelector(".problem-stage")!
                  .getBoundingClientRect().top -
                  1,
            );
          assert.ok(visible, "Prompt not clipped under header");
          await page.screenshot({
            path: `${shots}/${tag}-${correct ? "correct" : "incorrect"}.png`,
          });
          // Exact API replay, including reversed point order, grants no second attempt.
          const submitted = reply.request().postDataJSON();
          const retry = await page.request.post(
            `${origin}/api/v1/learners/${learner.id}/attempts`,
            {
              headers: { authorization: "Bearer amp-local-development" },
              data: {
                ...submitted,
                response: JSON.stringify(JSON.parse(answer).reverse()),
              },
            },
          );
          assert.equal(retry.status(), 200);
          assert.equal((await retry.json()).id, outcome.id);
          evidence.push({
            engine,
            variant,
            width,
            theme,
            correct,
            geometry: await geometry(page),
          });
        }
      // The companion problems use the real existing choice controls.
      for (const template of ["trend-line-compare", "trend-line-read"]) {
        const p = generateProblem(template, "companion-browser");
        p.public.id = randomUUID();
        await repository.transaction(
          "development-household",
          learner.id,
          (tx) => tx.saveProblem(p),
        );
        const batches = `**/api/v1/learners/${learner.id}/batches`;
        await page.unroute(batches);
        await page.route(batches, (route) =>
          route.request().method() === "POST"
            ? route.fulfill({
                json: {
                  problems: [p.public],
                  hints: { [p.public.id]: { hint: p.hint } },
                  lesson: null,
                },
              })
            : route.continue(),
        );
        await startTopic(page, template, { entry: "lesson-url" });
        await page
          .locator(`.problem-content[data-template="${template}"]`)
          .waitFor();
        const overflow = await page.evaluate(() => [
          document.documentElement.scrollWidth - innerWidth,
          document.querySelector(".problem-stage")!.scrollWidth -
            document.querySelector(".problem-stage")!.clientWidth,
        ]);
        assert.deepEqual(overflow, [0, 0]);
        await top(page);
        await page.screenshot({
          path: `${shots}/${template}-${width}-${theme}.png`,
        });
      }
      await context.close();
    }
  assert.deepEqual(errors, []);
  await writeFile(
    `${shots}/geometry-${engine}.json`,
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(
    `${engine}: ${evidence.length} graded real-route cases; no overflow or layout shift; drag, tap, arrows, reset and replay passed.`,
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
