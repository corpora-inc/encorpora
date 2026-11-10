/** Real practice routes and server grading; isolated schema in an explicitly
 * disposable AMP_TEST_DATABASE_URL. Evidence goes to AMP_EVIDENCE_DIR. */
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
  normalizePegBoard,
  stickKey,
  type PegBoardResponse,
  type Stick,
} from "../src/math/peg-board";
import { pegBoardLesson } from "../src/content/peg-board-lessons";
import { publicationHtml } from "../src/content/publications";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { chooseLearner } from "./ui-controls";
import { startTopic } from "./ui-practice";

const database = process.env.AMP_TEST_DATABASE_URL;
assert.ok(database, "AMP_TEST_DATABASE_URL required");
assertTestDatabaseTarget(database);
const engine = process.argv.includes("--webkit") ? "webkit" : "chromium",
  smoke = process.argv.includes("--smoke");
const port = engine === "webkit" ? 4586 : 4584,
  baseUrl = `http://127.0.0.1:${port}`;
const shots =
  process.env.AMP_EVIDENCE_DIR ??
  new URL("../artifacts/peg-board-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const schema = `amp_peg_ui_${randomUUID().replaceAll("-", "")}`;
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
  "Shape reviewer",
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
for (let i = 0; i < 200 && fixtures.size < 5; i++) {
  const p = generateProblem("build-shape-sticks-balls", `browser-${i}`),
    r = p.public.response as PegBoardResponse;
  if (r.check.name === "square" && !r.given.length && r.skin === "build")
    fixtures.set("square", p);
  if (r.check.name === "rectangle" && r.given.length) fixtures.set("finish", p);
  if (r.check.name === "triangle" && r.skin === "draw" && !r.given.length)
    fixtures.set("draw", p);
  const count = generateProblem("build-shape-by-count", `browser-${i}`);
  if ((count.public.response as PegBoardResponse).check.sides === 6)
    fixtures.set("count", count);
  fixtures.set("copy", generateProblem("copy-peg-shape", `browser-${i}`));
}
assert.equal(fixtures.size, 5);
async function geometry(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".problem-stage")!;
    const box = (selector: string) => {
      const node = document.querySelector(selector)!,
        r = node.getBoundingClientRect();
      return [
        r.x,
        r.y + (stage.contains(node) ? stage.scrollTop : 0),
        r.width,
        r.height,
      ].map((n) => Math.round(n * 10) / 10);
    };
    return {
      prompt: box("#problem-prompt"),
      board: box(".peg-board"),
      counts: box(".peg-counts"),
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
  assert.deepEqual(
    await geometry(page),
    before,
    "Sticks, removal, reset and grading must not move the board or controls",
  );
  assert.equal(before.overflow, 0);
  assert.equal(before.stageOverflow, 0);
}
async function visible(page: Page) {
  assert.ok(
    await page.evaluate(() => {
      const prompt = document
          .querySelector("#problem-prompt")!
          .getBoundingClientRect(),
        stage = document
          .querySelector(".problem-stage")!
          .getBoundingClientRect();
      const header = document
        .querySelector("[data-app-bar]")
        ?.getBoundingClientRect();
      return prompt.top >= Math.max(stage.top, header?.bottom ?? 0) - 1;
    }),
    "Prompt is below the header",
  );
}
async function connect(page: Page, edge: Stick, keyboard = false) {
  for (const id of edge) {
    const peg = page.locator(`[data-peg="${id}"]`);
    if (keyboard) {
      await peg.focus();
      await page.keyboard.press("Enter");
    } else await peg.click();
  }
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
      page.setDefaultTimeout(15000);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${baseUrl}/overview`);
      await chooseLearner(page, learner.id);
      for (const variant of smoke
        ? ["square", "copy", "draw", "finish"]
        : width === 390
          ? [...fixtures.keys()]
          : ["square", "count", "copy"])
        for (const correct of [true, false]) {
          const p = structuredClone(fixtures.get(variant)!);
          p.public.id = randomUUID();
          const r = p.public.response as PegBoardResponse,
            tag = `${variant}-${width}-${theme}`;
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
          await page.waitForFunction(
            (id) =>
              document
                .querySelector(".problem-content")
                ?.getAttribute("data-problem-id") === id,
            p.public.id,
          );
          await page.locator(".peg-board").waitFor();
          await page.evaluate(() => document.fonts.ready);
          assert.ok(capabilities.includes("peg-board-v1"));
          assert.equal(await page.locator(".peg-board").count(), 1);
          const before = await geometry(page);
          await stable(page, before);
          await visible(page);
          assert.ok(
            await page
              .getByRole("button", { name: "Check", exact: true })
              .isDisabled(),
            "Initial empty transport never submits, including a given stick",
          );
          assert.ok(
            await page
              .locator(".peg-grid button, .peg-board-form button")
              .evaluateAll((nodes) =>
                nodes.every((n) => {
                  const b = n.getBoundingClientRect();
                  return b.width >= 44 && b.height >= 44;
                }),
              ),
          );
          if (correct) {
            await page.screenshot({ path: `${shots}/${tag}-empty.png` });
            const first = page.locator('[data-peg="0"]');
            await first.focus();
            await page.keyboard.press("ArrowRight");
            assert.equal(
              await page.locator(":focus").getAttribute("data-peg"),
              "1",
            );
            await page.keyboard.press("Enter");
            assert.equal(
              await page.locator('.peg-grid [aria-pressed="true"]').count(),
              1,
            );
            assert.equal(
              await page.locator(".peg-stick").count(),
              r.given.length,
              "Provisional start never draws a stick",
            );
            await page.screenshot({ path: `${shots}/${tag}-provisional.png` });
            await page.keyboard.press("Escape");
            await first.focus();
            await page.keyboard.press("Enter");
            await page
              .getByRole("button", { name: "Reset", exact: true })
              .click();
            await page.waitForFunction(
              () =>
                document.querySelectorAll('.peg-grid [aria-pressed="true"]')
                  .length === 0,
            );
            assert.equal(
              await page.locator('.peg-grid [aria-pressed="true"]').count(),
              0,
            );
            assert.match(
              (await page
                .locator('.peg-builder [role="status"]')
                .textContent())!,
              /Board reset.*sticks.*corners/,
            );
            await connect(page, [0, 1], true);
            await stable(page, before);
            await page.locator('[data-stick="0:1"]').focus();
            await page.keyboard.press("Enter");
            await stable(page, before);
            await connect(page, [0, 4], true);
            // A ball along a stick stays selectable. The visible stick between
            // balls removes the whole stick, even away from its midpoint.
            await page.locator('[data-peg="2"]').click();
            assert.equal(
              await page.locator('[data-peg="2"]').getAttribute("aria-pressed"),
              "true",
            );
            await page.keyboard.press("Escape");
            const board = (await page.locator(".peg-board").boundingBox())!;
            await page.mouse.click(
              board.x + board.width * 0.2,
              board.y + board.height * 0.1,
            );
            assert.equal(await page.locator('[data-stick="0:4"]').count(), 0);
            await stable(page, before);
            if (r.skin === "draw") {
              const from = (await page
                  .locator('[data-peg="0"]')
                  .boundingBox())!,
                to = (await page.locator('[data-peg="6"]').boundingBox())!;
              await page.mouse.move(from.x + 22, from.y + 22);
              await page.mouse.down();
              assert.equal(
                await page
                  .locator('[data-peg="0"]')
                  .getAttribute("aria-pressed"),
                "true",
              );
              await page.mouse.move(to.x + 22, to.y + 22, { steps: 5 });
              await page.mouse.up();
              assert.equal(
                await page.locator('[data-stick="0:6"]').count(),
                1,
                "A real drag draws one side",
              );
              await page
                .getByRole("button", { name: "Reset", exact: true })
                .click();
              await stable(page, before);
            }
          }
          const edges = (
            JSON.parse(p.answer) as { sticks: Stick[] }
          ).sticks.filter(
            (e) => !r.given.some((g) => stickKey(g) === stickKey(e)),
          );
          if (!correct) edges.pop();
          for (const edge of edges) {
            await connect(page, edge);
            await stable(page, before);
          }
          assert.match(
            (await page.locator('.peg-builder [role="status"]').textContent())!,
            /sticks.*corners/,
          );
          if (correct) {
            const edge = edges[0]!;
            await page.locator(`[data-stick="${stickKey(edge)}"]`).focus();
            await page.keyboard.press("Enter");
            await stable(page, before);
            await connect(page, edge);
            await stable(page, before);
            await page
              .getByRole("button", { name: "Reset", exact: true })
              .click();
            await stable(page, before);
            assert.equal(
              await page.locator(".peg-stick").count(),
              r.given.length,
            );
            for (const e of edges) await connect(page, e, true);
            // Leave a provisional selection so the grading state must clear it.
            await page.locator('[data-peg="12"]').focus();
            await page.keyboard.press("Enter");
          }
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
          await page.locator('.peg-builder[data-resolved="true"]').waitFor();
          await page
            .locator(".practice-celebration")
            .waitFor({ state: "hidden" });
          await stable(page, before);
          await visible(page);
          assert.ok(
            await page.evaluate(() => {
              const board = document
                .querySelector(".peg-board")!
                .getBoundingClientRect();
              const counts = document
                .querySelector(".peg-counts")!
                .getBoundingClientRect();
              const sheet = document
                .querySelector(".feedback")!
                .getBoundingClientRect();
              return (
                sheet.left >= board.right ||
                sheet.right <= board.left ||
                (board.top >= 0 && counts.bottom <= sheet.top)
              );
            }),
            "The entire board and counts stay visible above or beside feedback",
          );
          assert.equal(
            await page.locator('.peg-grid [aria-pressed="true"]').count(),
            0,
          );
          if (!correct)
            assert.match(
              (await page.locator(".feedback-head").textContent())!,
              /not closed yet/,
            );
          await page.screenshot({
            path: `${shots}/${tag}-${correct ? "correct" : "incorrect"}.png`,
          });
          const request = reply.request().postDataJSON();
          const retrySticks = JSON.parse(outcome.response)
            .sticks.reverse()
            .map(([a, b]: Stick) => [b, a]);
          const retry = await page.request.post(reply.url(), {
            headers: {
              authorization: reply.request().headers().authorization!,
            },
            data: {
              ...request,
              response: JSON.stringify({ sticks: retrySticks }),
            },
          });
          assert.equal(retry.status(), 200);
          assert.equal((await retry.json()).id, outcome.id);
          assert.equal(
            normalizePegBoard(r, outcome.response),
            outcome.response,
          );
          if (width === 390 && theme === "light" && correct) {
            await page
              .getByRole("button", { name: "See why", exact: true })
              .click();
            await page
              .getByRole("dialog", { name: "Explanation", exact: true })
              .waitFor();
            await page.keyboard.press("Escape");
            await stable(page, before);
            const report = await page.request.post(
              `${baseUrl}/api/v1/learners/${learner.id}/problem-flags`,
              {
                headers: {
                  authorization: reply.request().headers().authorization!,
                },
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
            assert.equal(saved.rows[0].response_kind, "peg-board");
          }
          evidence.push({ variant, width, theme, correct, geometry: before });
        }
      await context.close();
    }
  assert.deepEqual(errors, []);
  if (engine === "chromium") {
    const print = await browser.newPage();
    await print.emulateMedia({ media: "print" });
    await print.setContent(publicationHtml(pegBoardLesson, "lesson"));
    await print.evaluate(() => document.fonts.ready);
    for (const format of ["Letter", "A4"] as const) {
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
    `Peg board (${engine}): ${evidence.length} graded cases passed. No overflow or layout shift; 44px pegs; keyboard, provisional selection, removal, reset, grading and idempotent retries.`,
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
