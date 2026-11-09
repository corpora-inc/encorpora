/** Real routes, stored problems and API grading; a dedicated test DB only. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { chromium, webkit, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes";
import { generateProblem } from "../src/math/engine";
import type {
  ShapeAnswer,
  ShapeComposerResponse,
} from "../src/math/shape-composer";
import { shapeComposerLesson } from "../src/content/shape-composer-lessons";
import { publicationHtml } from "../src/content/publications";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { chooseLearner } from "./ui-controls";
import { startTopic } from "./ui-practice";
import { fillShapeStage } from "./ui-shape-composer";

const database = process.env.AMP_TEST_DATABASE_URL;
assert.ok(database, "AMP_TEST_DATABASE_URL required");
assertTestDatabaseTarget(database);
const engine = process.argv.includes("--webkit") ? "webkit" : "chromium",
  smoke = process.argv.includes("--smoke");
const shots =
  process.env.AMP_EVIDENCE_DIR ??
  new URL("../artifacts/shape-composer-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const schema = `amp_shape_ui_${randomUUID().replaceAll("-", "")}`,
  admin = new Pool({ connectionString: database, max: 1 });
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
  2019,
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
const apiOrigin = await app.listen({ host: "127.0.0.1", port: 0 });
const vite = await createServer({
  server: {
    host: "127.0.0.1",
    port: 4586,
    strictPort: true,
    proxy: { "/api": { target: apiOrigin } },
  },
});
await vite.listen();
const browser = await (
  engine === "webkit" ? webkit : secureChromium(chromium)
).launch();
const errors: string[] = [],
  evidence: object[] = [];
const fixtures = new Map<string, ReturnType<typeof generateProblem>>();
for (let i = 0; i < 500; i++) {
  const p = generateProblem("compose-flat-shape", `browser-${i}`),
    v = p.variant!.id,
    recipe = p.variant!.axes!.recipe;
  const tag =
    v === "from-composite" && recipe === "half-circle"
      ? "joined-circle"
      : v === "many-pieces" && recipe === "house"
        ? "house"
        : v === "two-pieces" && recipe === "trapezoid-piece"
          ? "flip-trapezoid"
          : v === "two-pieces" && recipe === "unit-square"
            ? "triangles"
            : null;
  if (tag && !fixtures.has(tag)) fixtures.set(tag, p);
  if (fixtures.size === 4) break;
}
assert.equal(fixtures.size, 4);
async function geometry(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".problem-stage")!;
    const boxes = Object.fromEntries(
      [
        "#problem-prompt",
        ".shape-board",
        ".shape-tray",
        ".shape-tools",
        ".answer-dock",
      ].map((s) => {
        const node = document.querySelector(s)!,
          b = node.getBoundingClientRect();
        return [
          s,
          [
            b.x,
            b.y + (stage.contains(node) ? stage.scrollTop : 0),
            b.width,
            b.height,
          ].map((n) => Math.round(n * 10) / 10),
        ];
      }),
    );
    return {
      boxes,
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
    "Placing, turning and removing pieces must not move the layout",
  );
  assert.equal(after.overflow, 0);
  assert.equal(after.stageOverflow, 0);
}
try {
  for (const theme of smoke
    ? (["light"] as const)
    : (["light", "dark"] as const))
    for (const [width, height] of smoke
      ? [[390, 900]]
      : [
          [320, 900],
          [390, 900],
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
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("http://127.0.0.1:4586/overview");
      await chooseLearner(page, learner.id);
      for (const [tag, base] of fixtures)
        for (const correct of [true, false]) {
          const p = structuredClone(base);
          p.public.id = randomUUID();
          const r = p.public.response as ShapeComposerResponse;
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
          await page.locator(".shape-composer").waitFor();
          await page.waitForFunction(
            (id) =>
              document
                .querySelector(".problem-content")
                ?.getAttribute("data-problem-id") === id,
            p.public.id,
          );
          await page.evaluate(() => document.fonts.ready);
          assert.ok(capabilities.includes("shape-composer-v1"));
          const before = await geometry(page);
          assert.equal(before.overflow, 0);
          assert.equal(before.stageOverflow, 0);
          assert.equal(await page.locator(".shape-composer").count(), 1);
          assert.equal(
            await page
              .locator(".shape-answer button[type=submit]")
              .isDisabled(),
            true,
          );
          const targets = await page
            .locator(".shape-composer button,.shape-answer button")
            .evaluateAll((nodes) =>
              nodes.map((n) => {
                const b = n.getBoundingClientRect();
                return [b.width, b.height];
              }),
            );
          assert.ok(
            targets
              .filter(([w, h]) => w! > 0 || h! > 0)
              .every(([w, h]) => w! >= 43.9 && h! >= 43.9),
            `44px targets: ${JSON.stringify(targets)}`,
          );
          const name = `${tag}-${width}-${theme}`;
          if (correct) {
            await page.screenshot({ path: `${shots}/${name}-empty.png` });
            const first =
              r.stages[0]!.tray.find((t) => t.canFlip) ??
              r.stages[0]!.tray.find((t) => t.canRotate)!;
            await page.locator(`[data-piece="${first.id}:0"]`).focus();
            await page.keyboard.press("Enter");
            await page.keyboard.press("ArrowRight");
            await page.keyboard.press("Enter");
            await stable(page, before);
            await page.keyboard.press("r");
            await stable(page, before);
            assert.match(
              (await page
                .locator('.shape-composer [role="status"]')
                .textContent())!,
              /90 degrees/,
            );
            if (first.canFlip) {
              await page.keyboard.press("f");
              await stable(page, before);
              assert.match(
                (await page
                  .locator('.shape-composer [role="status"]')
                  .textContent())!,
                /flipped/,
              );
            }
            await page.keyboard.press("Delete");
            await stable(page, before);
            assert.equal(await page.locator(".shape-placed").count(), 0);
            // Drag is a second route to the same snapped placement.
            const source = page.locator(`[data-piece="${first.id}:0"]`),
              dest = page.locator('[data-cell="2,1"]');
            await source.scrollIntoViewIfNeeded();
            const s = await source.boundingBox();
            await dest.scrollIntoViewIfNeeded();
            const d = await dest.boundingBox();
            // Keep both in view before starting; phone uses taps above.
            if (width! >= 768) {
              await page.mouse.move(s!.x + s!.width / 2, s!.y + s!.height / 2);
              await page.mouse.down();
              await page.mouse.move(d!.x + d!.width / 2, d!.y + d!.height / 2, {
                steps: 8,
              });
              await page.mouse.up();
              assert.equal(await page.locator(".shape-placed").count(), 1);
              await page
                .getByRole("button", { name: "Reset", exact: true })
                .click();
              await stable(page, before);
            }
            if (engine === "chromium" && width === 390 && tag === "house") {
              const touch = await context.newCDPSession(page);
              const start = { x: s!.x + s!.width / 2, y: s!.y + s!.height / 2 },
                end = { x: d!.x + d!.width / 2, y: d!.y + d!.height / 2 };
              await touch.send("Input.dispatchTouchEvent", {
                type: "touchStart",
                touchPoints: [start],
              });
              for (let step = 1; step <= 12; step++)
                await touch.send("Input.dispatchTouchEvent", {
                  type: "touchMove",
                  touchPoints: [
                    {
                      x: start.x + ((end.x - start.x) * step) / 12,
                      y: start.y + ((end.y - start.y) * step) / 12,
                    },
                  ],
                });
              await touch.send("Input.dispatchTouchEvent", {
                type: "touchEnd",
                touchPoints: [],
              });
              assert.equal(
                await page.locator(".shape-placed").count(),
                1,
                "A native touch drag snaps a tray piece onto the board",
              );
              await page
                .getByRole("button", { name: "Reset", exact: true })
                .tap();
              await stable(page, before);
              const tray = page.locator(".shape-tray"),
                box = await tray.boundingBox();
              await touch.send("Input.dispatchTouchEvent", {
                type: "touchStart",
                touchPoints: [{ x: box!.x + box!.width - 15, y: box!.y + 30 }],
              });
              for (let step = 1; step <= 10; step++)
                await touch.send("Input.dispatchTouchEvent", {
                  type: "touchMove",
                  touchPoints: [
                    { x: box!.x + box!.width - 15 - step * 18, y: box!.y + 30 },
                  ],
                });
              await touch.send("Input.dispatchTouchEvent", {
                type: "touchEnd",
                touchPoints: [],
              });
              assert.ok(
                await tray.evaluate((n) => n.scrollLeft > 0),
                "Horizontal touch swipes reveal the rest of the tray",
              );
              assert.equal(await page.locator(".shape-placed").count(), 0);
              await tray.evaluate((n) => {
                n.scrollLeft = 0;
              });
              await touch.detach();
            }
          }
          const a = JSON.parse(p.answer) as ShapeAnswer;
          if (!correct) {
            if (tag === "triangles") a[0]![1] = { ...a[0]![0]!, copy: 1 };
            else a[a.length - 1] = a.at(-1)!.slice(0, -1);
          }
          for (let stage = 0; stage < a.length; stage++) {
            await fillShapeStage(page, a[stage]!);
            await stable(page, before);
            if (stage < a.length - 1) {
              await page
                .getByRole("button", { name: "Join pieces", exact: true })
                .click();
              await page
                .getByText("Your pieces joined", { exact: true })
                .waitFor();
            }
          }
          await page.locator(".shape-board").scrollIntoViewIfNeeded();
          assert.ok(
            await page.locator(".shape-grid button").evaluateAll((nodes) =>
              nodes.every((n) => {
                const style = getComputedStyle(n);
                return (
                  style.backgroundColor === "rgba(0, 0, 0, 0)" &&
                  style.getPropertyValue("-webkit-tap-highlight-color") ===
                    "rgba(0, 0, 0, 0)" &&
                  style.filter === "none"
                );
              }),
            ),
            "A hovered or tapped grid space must never look like a filled square",
          );
          await page.screenshot({
            path: `${shots}/${name}-${correct ? "filled" : "gap"}.png`,
          });
          const attempt = page.waitForResponse(
            (res) =>
              res.url().endsWith("/attempts") &&
              res.request().method() === "POST",
          );
          await page.locator('.shape-answer button[type="submit"]').click();
          const res = await attempt;
          assert.equal(res.status(), 200, await res.text());
          const outcome = await res.json();
          assert.equal(outcome.correct, correct, JSON.stringify(outcome));
          await page.locator(".feedback").waitFor();
          assert.equal(await page.locator(".shape-cursor").count(), 0);
          assert.equal(
            await page.locator(".shape-tray [aria-pressed=true]").count(),
            0,
          );
          if (width! < 400)
            await page.waitForFunction(
              () => {
                const board = document
                    .querySelector(".shape-board")!
                    .getBoundingClientRect(),
                  stage = document
                    .querySelector(".problem-stage")!
                    .getBoundingClientRect(),
                  feedback = document
                    .querySelector(".feedback")!
                    .getBoundingClientRect();
                return (
                  board.top >= stage.top - 1 && board.bottom <= feedback.top + 1
                );
              },
              undefined,
              { timeout: 3000 },
            );
          await page.screenshot({
            path: `${shots}/${name}-${correct ? "correct" : "incorrect"}.png`,
          });
          const request = res.request(),
            body = request.postDataJSON(),
            headers = {
              authorization: request.headers().authorization!,
            };
          const retryAnswer = JSON.parse(body.response) as ShapeAnswer;
          retryAnswer.forEach((s) => s.reverse());
          body.response = JSON.stringify(retryAnswer);
          const retry = await page.request.post(request.url(), {
            data: body,
            headers,
          });
          assert.equal(retry.status(), 200, await retry.text());
          assert.equal((await retry.json()).id, outcome.id);
          await page
            .getByRole("button", { name: "Show one way", exact: true })
            .click();
          assert.equal(await page.locator(".shape-cursor").count(), 0);
          if (correct && width === 390 && theme === "light") {
            const report = await page.request.post(
              `http://127.0.0.1:4586/api/v1/learners/${learner.id}/problem-flags`,
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
            assert.equal(saved.rows[0].response_kind, "shape-composer");
            const legacy = await page.request.post(
              `http://127.0.0.1:4586/api/v1/learners/${learner.id}/batches`,
              {
                headers,
                data: {
                  count: 1,
                  templateId: "composite-shape-name",
                  responseCapabilities: ["single-choice-v1"],
                  figureCapabilities: ["scenes-v1"],
                },
              },
            );
            assert.equal(legacy.status(), 200, await legacy.text());
            assert.equal(
              (await legacy.json()).problems[0].response.kind,
              "choice",
            );
          }
          evidence.push({
            tag,
            width,
            height,
            theme,
            correct,
            geometry: before,
          });
        }
      await context.close();
    }
  assert.deepEqual(errors, []);
  if (engine === "chromium") {
    const print = await browser.newPage();
    await print.emulateMedia({ media: "print" });
    await print.setContent(publicationHtml(shapeComposerLesson, "lesson"));
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
    `Shape composer (${engine}): ${evidence.length} graded cases passed; stable placement/rotation/removal, no overflow, 44px targets, keyboard, drag, staging, retries, flags and legacy format.`,
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
