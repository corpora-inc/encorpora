/** Real practice routes, API grading and responsive line-plot interaction.
 * Requires a disposable AMP_TEST_DATABASE_URL. Evidence: AMP_EVIDENCE_DIR. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes";
import { generateProblem, type GeneratedProblem } from "../src/math/engine";
import {
  linePlotCounts,
  linePlotValues,
  type LinePlotBuildResponse,
} from "../src/math/line-plot-build";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { chooseLearner } from "./ui-controls";
import { startTopic } from "./ui-practice";
import { publicationHtml } from "../src/content/publications";
import { linePlotBuildLesson } from "../src/content/line-plot-build-lessons";

const database = process.env.AMP_TEST_DATABASE_URL;
assert.ok(database, "AMP_TEST_DATABASE_URL required");
assertTestDatabaseTarget(database);
const shots =
  process.env.AMP_EVIDENCE_DIR ??
  new URL("../artifacts/line-plot-build-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const schema = `amp_line_plot_ui_${randomUUID().replaceAll("-", "")}`;
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
  "Plot reviewer",
  2018,
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
await app.listen({ host: "127.0.0.1", port: 4553 });
const vite = await createServer({
  server: {
    host: "127.0.0.1",
    port: 4552,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4553" } },
  },
});
await vite.listen();
const browser = await secureChromium(rawChromium).launch();
const errors: string[] = [];
const evidence: object[] = [];
const families = [
  "given-several",
  "given-repeated",
  "given-table",
  "measure-and-plot",
];
const fixtures = new Map<string, GeneratedProblem>();
for (let i = 0; i < 1000 && fixtures.size < 4; i++) {
  const p = generateProblem("line-plot-build", `browser-${i}`);
  const r = p.public.response as LinePlotBuildResponse;
  if (p.variant!.id === "given-several" && r.axis.max - r.axis.min !== 5)
    continue;
  if (!fixtures.has(p.variant!.id)) fixtures.set(p.variant!.id, p);
}
assert.equal(fixtures.size, 4);

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
      canvas: box(".line-build-canvas"),
      stepper: box(".line-build-stepper"),
      dock: box(".answer-dock"),
      overflow: document.documentElement.scrollWidth - innerWidth,
      stageOverflow: stage.scrollWidth - stage.clientWidth,
    };
  });
}
async function fill(
  page: Page,
  response: LinePlotBuildResponse,
  counts: Record<string, number>,
) {
  const columns = page.locator(".line-build-column");
  for (const [index, v] of linePlotValues(response).entries()) {
    await columns.nth(index).focus();
    for (let i = 0; i < (counts[v] ?? 0); i++)
      await page.keyboard.press("Enter");
  }
}
async function stable(
  page: Page,
  before: Awaited<ReturnType<typeof geometry>>,
) {
  const after = await geometry(page);
  assert.deepEqual(
    after,
    before,
    "No overflow or movement when editing and grading",
  );
  assert.equal(after.overflow, 0);
  assert.equal(after.stageOverflow, 0);
}
try {
  for (const theme of ["light", "dark"] as const)
    for (const width of [320, 390, 768, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 768 ? 1024 : 900 },
        colorScheme: theme,
        hasTouch: width < 400,
        reducedMotion: "reduce",
      });
      await context.addInitScript("globalThis.__name = (f) => f");
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://127.0.0.1:4552/overview");
      await chooseLearner(page, learner.id);
      for (const family of families) {
        const base = fixtures.get(family)!;
        const r = base.public.response as LinePlotBuildResponse;
        const counts = linePlotCounts(r, base.answer);
        const tag = `${family}-${width}-${theme}`;
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
          await startTopic(page, "line-plot-build", { entry: "lesson-url" });
          await page.locator(".line-build").waitFor();
          await page.evaluate(() => document.fonts.ready);
          assert.ok(capabilities.includes("line-plot-build-v1"));
          const before = await geometry(page);
          assert.equal(before.overflow, 0);
          assert.equal(before.stageOverflow, 0);
          assert.ok(
            await page
              .getByRole("button", { name: "Check", exact: true })
              .isDisabled(),
          );
          if (correct) {
            if (p.public.figure)
              await page.screenshot({ path: `${shots}/${tag}-source.png` });
            await page.locator(".line-build-canvas").scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${shots}/${tag}-empty.png` });
            const first = page.locator(".line-build-column").first();
            // Pointer adds in the blank space; tapping the top mark removes it.
            await first.click({ position: { x: 8, y: 8 } });
            assert.match(
              (await first.getAttribute("aria-label")) ?? "",
              /1 Xs/,
            );
            const bounds = (await first.boundingBox())!;
            await first.click({
              position: { x: bounds.width / 2, y: (bounds.height * 168) / 188 },
            });
            assert.match(
              (await first.getAttribute("aria-label")) ?? "",
              /0 Xs/,
            );
            await first.focus();
            await page.keyboard.press("Space");
            await page.keyboard.press("ArrowRight");
            assert.equal(
              await page
                .locator(".line-build-column")
                .nth(1)
                .evaluate((n) => n === document.activeElement),
              true,
            );
            await page.keyboard.press("ArrowUp");
            await page.keyboard.press("Backspace");
            await page
              .getByRole("button", { name: "Reset", exact: true })
              .click();
            await stable(page, before);
            await first.focus();
            for (let i = 0; i < 8; i++) await page.keyboard.press("Enter");
            assert.match(
              (await first.getAttribute("aria-label")) ?? "",
              /6 Xs/,
            );
            assert.ok(
              await page
                .getByRole("button", {
                  name: `Add X at ${r.axis.min}`,
                  exact: true,
                })
                .isDisabled(),
            );
            await page
              .getByRole("button", { name: "Reset", exact: true })
              .click();
            await stable(page, before);
            const targets = await page
              .locator(
                ".line-build-column, .line-build-stepper button, .line-build-form button",
              )
              .evaluateAll((nodes) =>
                nodes.map((n) => {
                  const b = n.getBoundingClientRect();
                  return [b.width, b.height];
                }),
              );
            assert.ok(
              targets.every(([w, h]) => w! >= 44 && h! >= 44),
              "44px editing controls",
            );
          }
          await fill(
            page,
            r,
            correct
              ? counts
              : Object.fromEntries(Object.keys(counts).map((v) => [v, 1])),
          );
          await stable(page, before);
          await page.locator(".line-build-canvas").scrollIntoViewIfNeeded();
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
          if (!correct)
            assert.match(
              outcome.explanation[0],
              /dropped the repeated measurements/,
            );
          await page.locator(".line-build-expected").first().waitFor();
          await page
            .locator(".practice-celebration")
            .waitFor({ state: "hidden" });
          await stable(page, before);
          await page.screenshot({
            path: `${shots}/${tag}-${correct ? "correct" : "incorrect"}.png`,
          });
          // Retrying an equivalent count map, with explicit zero columns, is idempotent.
          const body = reply.request().postDataJSON();
          const received = linePlotCounts(r, body.response);
          body.response = JSON.stringify({
            counts: Object.fromEntries(
              linePlotValues(r)
                .reverse()
                .map((v) => [v, received[v] ?? 0]),
            ),
          });
          const headers = {
            authorization: reply.request().headers().authorization!,
          };
          const retry = await page.request.post(reply.url(), {
            data: body,
            headers,
          });
          assert.equal(retry.status(), 200, await retry.text());
          assert.equal((await retry.json()).id, outcome.id);
          if (
            family === "given-several" &&
            width === 320 &&
            theme === "light" &&
            correct
          ) {
            const invalid = await page.request.post(reply.url(), {
              headers,
              data: {
                ...body,
                requestId: randomUUID(),
                response: JSON.stringify({ counts: { [r.axis.max + 1]: 1 } }),
              },
            });
            assert.equal(invalid.status(), 400);
            const report = await page.request.post(
              `http://127.0.0.1:4552/api/v1/learners/${learner.id}/problem-flags`,
              {
                headers,
                data: {
                  problemId: p.public.id,
                  requestId: randomUUID(),
                  reasons: ["confusing-wording"],
                  client: { kind: "web", viewport: { width, height: 900 } },
                },
              },
            );
            assert.equal(report.status(), 201, await report.text());
            const saved = await repository.pool.query(
              "SELECT response_kind FROM amp_problem_flags WHERE id=$1",
              [(await report.json()).id],
            );
            assert.equal(saved.rows[0].response_kind, "line-plot-build");
          }
          evidence.push({ family, theme, width, correct, geometry: before });
        }
      }
      await context.close();
    }
  assert.deepEqual(errors, []);
  const print = await browser.newPage();
  await print.emulateMedia({ media: "print" });
  await print.setContent(publicationHtml(linePlotBuildLesson, "lesson"));
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
  await writeFile(`${shots}/geometry.json`, JSON.stringify(evidence, null, 2));
  console.log(
    `Line-plot builder: ${evidence.length} graded browser cases; pointer, keyboard, reset, bounds, idempotence, overflow and stable geometry passed.`,
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
    learner.id,
  ]);
  await repository.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
