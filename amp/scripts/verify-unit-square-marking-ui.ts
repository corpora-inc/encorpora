/** Real practice routes and API grading. Requires a disposable AMP_TEST_DATABASE_URL.
 * AMP_EVIDENCE_DIR selects screenshots; --engine webkit checks the second engine. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chromium as rawChromium, webkit, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes";
import { generateProblem, type GeneratedProblem } from "../src/math/engine";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { chooseLearner } from "./ui-controls";
import { startTopic } from "./ui-practice";
import { publicationHtml } from "../src/content/publications";
import { areaByCountingLessons } from "../src/content/area-by-counting-lessons";

const database = process.env.AMP_TEST_DATABASE_URL;
assert.ok(database, "AMP_TEST_DATABASE_URL required");
assertTestDatabaseTarget(database);
const engine = process.argv.includes("webkit") ? "webkit" : "chromium";
const shots =
  process.env.AMP_EVIDENCE_DIR ??
  new URL("../artifacts/unit-square-marking-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const schema = `amp_square_ui_${randomUUID().replaceAll("-", "")}`;
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
  "Grid reviewer",
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
await app.listen({ host: "127.0.0.1", port: 4563 });
const vite = await createServer({
  server: {
    host: "127.0.0.1",
    port: 4562,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4563" } },
  },
});
await vite.listen();
const browser = await (
  engine === "webkit" ? webkit : secureChromium(rawChromium)
).launch();
const errors: string[] = [],
  evidence: object[] = [];
const fixtures: GeneratedProblem[] = [];
for (const id of ["mark-unit-squares", "mark-improvised-units"]) {
  for (let i = 0; i < 1000; i++) {
    const p = generateProblem(id, `browser-${i}`),
      r = p.public.response;
    if (r.kind !== "unit-square-marking") throw new Error("response");
    if (
      r.cols !== 5 ||
      (id === "mark-unit-squares"
        ? r.rows !== 6 || p.variant!.id !== "hole-rectangle"
        : r.rows !== 5 || r.tile !== "sticky")
    )
      continue;
    fixtures.push(p);
    break;
  }
}
assert.equal(
  fixtures.length,
  2,
  "Both largest representative grids are exercised",
);

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
      grid: box(".square-marking-grid"),
      tools: box(".square-marking-tools"),
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
  assert.deepEqual(after, before, "Marks and feedback must not shift content");
  assert.equal(after.overflow, 0);
  assert.equal(after.stageOverflow, 0);
}
async function promptVisible(page: Page) {
  await page.locator(".problem-stage").evaluate((node) => {
    node.scrollTop = 0;
  });
  const visible = await page.evaluate(() => {
    const r = document
      .querySelector("#problem-prompt")!
      .getBoundingClientRect();
    const stage = document
      .querySelector(".problem-stage")!
      .getBoundingClientRect();
    const bar = document
      .querySelector("[data-app-bar]")
      ?.getBoundingClientRect();
    const topic = document
      .querySelector(".practice-topic")
      ?.getBoundingClientRect();
    return (
      r.top >= Math.max(0, stage.top, bar?.bottom ?? 0, topic?.bottom ?? 0) - 1
    );
  });
  assert.ok(visible, "Prompt is never clipped under the app header");
}
async function countVisible(page: Page) {
  assert.ok(
    await page.locator(".square-marking-tools").evaluate((node) => {
      const tools = node.getBoundingClientRect();
      const stage = document
        .querySelector(".problem-stage")!
        .getBoundingClientRect();
      const dock = document
        .querySelector(".answer-dock")!
        .getBoundingClientRect();
      const overlaps = dock.left < tools.right && dock.right > tools.left;
      return (
        tools.top >= stage.top &&
        tools.bottom <= Math.min(stage.bottom, overlaps ? dock.top : innerHeight)
      );
    }),
    "The running count and reset are visible above the answer dock",
  );
}
async function visibleCells(page: Page) {
  const cells = page.locator(".square-marking-cell");
  for (let i = 0; i < (await cells.count()); i++) {
    await cells.nth(i).evaluate((node) => {
      const stage = document.querySelector<HTMLElement>(".problem-stage")!;
      stage.scrollTop +=
        node.getBoundingClientRect().top -
        stage.getBoundingClientRect().top -
        8;
    });
    assert.ok(
      await cells.nth(i).evaluate((node) => {
        const r = node.getBoundingClientRect(),
          stage = document
            .querySelector(".problem-stage")!
            .getBoundingClientRect();
        const feedback = document
          .querySelector(".feedback")
          ?.getBoundingClientRect();
        const covered =
          feedback && feedback.left < r.right && feedback.right > r.left;
        return (
          r.top >= stage.top - 1 &&
          r.bottom <=
            Math.min(stage.bottom, covered ? feedback.top : innerHeight) + 1
        );
      }),
      `Square ${i + 1} is reachable above feedback`,
    );
  }
}

try {
  for (const theme of ["light", "dark"] as const) {
    for (const [width, height] of [
      [320, 740],
      [390, 844],
      [768, 1024],
      [1280, 900],
    ]) {
      const context = await browser.newContext({
        viewport: { width: width!, height: height! },
        colorScheme: theme,
        hasTouch: width! < 400,
        reducedMotion: "reduce",
      });
      await context.addInitScript("globalThis.__name = (f) => f");
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("http://127.0.0.1:4562/overview");
      await chooseLearner(page, learner.id);
      for (const base of fixtures) {
        const tag = `${base.public.templateId}-${width}-${theme}`;
        for (const correct of [true, false]) {
          const p = structuredClone(base);
          p.public.id = randomBytes(32).toString("hex");
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
          await page.locator(".square-marking").waitFor();
          await page.evaluate(() => document.fonts.ready);
          assert.ok(capabilities.includes("unit-square-marking-v1"));
          const before = await geometry(page);
          assert.equal(before.overflow, 0);
          assert.equal(before.stageOverflow, 0);
          await promptVisible(page);
          await countVisible(page);
          const cells = page.locator(".square-marking-cell");
          const first = page.locator(
            '.square-marking-cell[data-row="0"][data-col="0"]',
          );
          const reset = page.getByRole("button", {
            name: "Reset marks",
            exact: true,
          });
          if (correct) {
            await page.screenshot({ path: `${shots}/${tag}-empty.png` });
            const targets = await page
              .locator(".square-marking button")
              .evaluateAll((nodes) =>
                nodes.map((n) => {
                  const r = n.getBoundingClientRect();
                  return [r.width, r.height];
                }),
              );
            assert.ok(
              targets.every(([w, h]) => w! >= 44 && h! >= 44),
              "Every touch target is at least 44px",
            );
            assert.ok(await reset.isDisabled());
            if (width! < 400) await first.tap();
            else await first.click();
            assert.equal(await first.getAttribute("aria-pressed"), "true");
            assert.match(
              (await first.getAttribute("aria-label")) ?? "",
              /Row 1, column 1, shaded, marked/,
            );
            await stable(page, before);
            await first.click();
            assert.equal(await first.getAttribute("aria-pressed"), "false");
            await first.focus();
            await page.keyboard.press("Space");
            assert.equal(
              await first.evaluate(
                (node) => getComputedStyle(node).outlineStyle,
              ),
              "solid",
              "Keyboard cursor is a visible outline",
            );
            await page.keyboard.press("ArrowRight");
            assert.equal(
              await page
                .locator('.square-marking-cell[data-row="0"][data-col="1"]')
                .evaluate((node) => node === document.activeElement),
              true,
            );
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("ArrowUp");
            await page.keyboard.press("ArrowLeft");
            await page.keyboard.press("Enter");
            assert.equal(
              await first.getAttribute("aria-pressed"),
              "false",
              "Enter unmarks the cell",
            );
            await page.keyboard.press("Enter");
            await reset.click();
            assert.equal(
              await page
                .locator('.square-marking-cell[aria-pressed="true"]')
                .count(),
              0,
            );
            await stable(page, before);
            const lastRow = await cells.last().getAttribute("data-row");
            const lastColumn = await cells.last().getAttribute("data-col");
            await page
              .locator(`.square-marking-cell[data-col="${lastColumn}"]`)
              .first()
              .focus();
            for (let row = 1; row < 6; row++)
              await page.keyboard.press("ArrowDown");
            assert.equal(
              await page.evaluate(() =>
                document.activeElement?.getAttribute("data-row"),
              ),
              lastRow,
              "Arrows reach the bottom row",
            );
            assert.ok(
              await page.evaluate(() => {
                const focused = document.activeElement!.getBoundingClientRect();
                const stage = document
                  .querySelector(".problem-stage")!
                  .getBoundingClientRect();
                return (
                  focused.top >= stage.top - 1 &&
                  focused.bottom <= stage.bottom + 1
                );
              }),
              "Arrow navigation scrolls the focused square into view",
            );
          }
          // Fill the visible shape via actual inputs. Typed area stays independent of marks.
          const shaded = page.locator(
            '.square-marking-cell[data-shaded="true"]',
          );
          for (let i = 0; i < (await shaded.count()); i++)
            await shaded.nth(i).click();
          assert.equal(
            await page.locator(".square-marking output").textContent(),
            `${p.answer} marked`,
          );
          await stable(page, before);
          await promptVisible(page);
          await countVisible(page);
          if (correct)
            await page.screenshot({ path: `${shots}/${tag}-filled.png` });
          if (correct && width === 768) await reset.click();
          const compact = page.locator(".compact-answer-action");
          if (await compact.isVisible()) await compact.click();
          await page
            .locator("#answer:visible")
            .fill(correct ? p.answer : String(Number(p.answer) + 1));
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
            reply.request().postDataJSON().response,
            correct ? p.answer : String(Number(p.answer) + 1),
            "Scratch marks never enter the answer payload",
          );
          await page.locator(".feedback").waitFor();
          assert.equal(
            await page
              .locator('.square-marking-cell[aria-pressed="true"]')
              .count(),
            0,
            "Submission resets scratch marks",
          );
          await page.keyboard.press("Tab");
          await cells
            .first()
            .evaluate((node: HTMLElement) =>
              node.focus({ preventScroll: true }),
            );
          assert.ok(
            await cells
              .first()
              .evaluate((node) => node.matches(":focus-visible")),
            "The graded cursor check exercises keyboard focus",
          );
          assert.equal(
            await cells
              .first()
              .evaluate((node) => getComputedStyle(node).outlineStyle),
            "none",
            "No editing cursor after grading",
          );
          await stable(page, before);
          await visibleCells(page);
          await page.locator(".practice-celebration").waitFor({ state: "hidden" });
          await promptVisible(page);
          await page.screenshot({
            path: `${shots}/${tag}-${correct ? "correct" : "incorrect"}.png`,
          });
          if (width === 320 && theme === "light" && correct) {
            const headers = {
              authorization: reply.request().headers().authorization!,
            };
            const report = await page.request.post(
              `http://127.0.0.1:4562/api/v1/learners/${learner.id}/problem-flags`,
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
            assert.equal(saved.rows[0].response_kind, "unit-square-marking");
          }
          evidence.push({
            template: p.public.templateId,
            seed: p.public.seed,
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
  }
  assert.deepEqual(errors, []);
  if (engine === "chromium") {
    const print = await browser.newPage();
    await print.emulateMedia({ media: "print" });
    for (const lesson of areaByCountingLessons) {
      await print.setContent(publicationHtml(lesson, "lesson"));
      await print.evaluate(() => document.fonts.ready);
      for (const format of ["Letter", "A4"] as const) {
        await print.pdf({
          path: `${shots}/${lesson.id}-${format}.pdf`,
          format,
          printBackground: true,
        });
      }
    }
    await print.close();
  }
  await writeFile(
    `${shots}/geometry-${engine}.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(
    `Unit-square marking (${engine}): ${evidence.length} graded cases passed; touch, keyboard, reset, scratch-only grading, 44px targets, header clearance, overflow, stable geometry and stored reports verified.`,
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.close();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
