/** Real practice routes, server grading, persistence, and responsive geometry. */
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
import type {
  EqualAddendsAnswer,
  EqualAddendsResponse,
} from "../src/math/equal-addends";
import { equalAddendsVariants } from "../src/math/equal-addends-practice";
import { equalAddendsLesson } from "../src/content/equal-addends-lessons";
import { publicationHtml } from "../src/content/publications";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { chooseLearner } from "./ui-controls";
import { startTopic } from "./ui-practice";
import { fillEqualAddends } from "./ui-equal-addends";

const database = process.env.AMP_TEST_DATABASE_URL;
assert.ok(database, "AMP_TEST_DATABASE_URL required");
assertTestDatabaseTarget(database);
const engine = process.argv.includes("--webkit") ? "webkit" : "chromium";
const port = engine === "webkit" ? 4596 : 4586,
  baseUrl = `http://127.0.0.1:${port}`;
const smoke = process.argv.includes("--smoke");
const shots =
  process.env.AMP_EVIDENCE_DIR ??
  new URL("../artifacts/equal-addends-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const schema = `amp_equal_ui_${randomUUID().replaceAll("-", "")}`;
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
  "Array reviewer",
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
const fixtures = new Map<string, GeneratedProblem>();
for (let i = 0; i < 1000 && fixtures.size < 4; i++) {
  const p = generateProblem("array-equal-addends-equation", `browser-${i}`),
    a = JSON.parse(p.answer) as EqualAddendsAnswer;
  if (
    p.variant!.id === "square"
      ? a.rows !== 5
      : p.variant!.id === "rows-or-columns"
        ? a.rows !== 3 || a.columns !== 4
        : a.rows !== 4 || a.columns !== 5
  )
    continue;
  fixtures.set(p.variant!.id, p);
}
assert.equal(fixtures.size, 4);
const errors: string[] = [],
  evidence: object[] = [];
async function geometry(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".problem-stage")!;
    const box = (selector: string) => {
      const node = document.querySelector(selector)!,
        b = node.getBoundingClientRect();
      return [
        b.x,
        b.y + (stage.contains(node) ? stage.scrollTop : 0),
        b.width,
        b.height,
      ].map((n) => Math.round(n * 10) / 10);
    };
    return {
      prompt: box("#problem-prompt"),
      array: box(".equal-array-area"),
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
    "Array resizing, sentence construction and grading must not shift the layout",
  );
  assert.equal(after.overflow, 0);
  assert.equal(after.stageOverflow, 0);
}
async function promptVisible(page: Page) {
  await page.locator(".problem-stage").evaluate((n) => {
    n.scrollTop = 0;
  });
  assert.ok(
    await page.evaluate(() => {
      const p = document
        .querySelector("#problem-prompt")!
        .getBoundingClientRect();
      return (
        p.top >=
        Math.max(
          ...[".problem-stage", "[data-app-bar]", ".practice-topic"].map(
            (s) => {
              const b = document.querySelector(s)?.getBoundingClientRect();
              return s === ".problem-stage" ? (b?.top ?? 0) : (b?.bottom ?? 0);
            },
          ),
        ) -
          1
      );
    }),
    "Prompt cannot hide under the header",
  );
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
        reducedMotion: "reduce",
        hasTouch: width! < 400,
      });
      await context.addInitScript("globalThis.__name = (f) => f");
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${baseUrl}/overview`);
      await chooseLearner(page, learner.id);
      for (const variant of equalAddendsVariants)
        for (const correct of [true, false]) {
          const p = structuredClone(fixtures.get(variant)!);
          p.public.id = randomUUID();
          const r = p.public.response as EqualAddendsResponse,
            answer = JSON.parse(p.answer) as EqualAddendsAnswer;
          // Exercise the other accepted orientation through actual controls.
          if (variant === "rows-or-columns" && correct)
            answer.addends = Array(answer.columns).fill(answer.rows);
          if (!correct) answer.total--;
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
          await page.locator(".equal-addends").waitFor();
          await page.evaluate(() => document.fonts.ready);
          assert.ok(capabilities.includes("equal-addends-v1"));
          assert.equal(
            await page.locator("#problem-prompt").getAttribute("data-text"),
            p.public.prompt,
          );
          const before = await geometry(page);
          await stable(page, before);
          await promptVisible(page);
          const tag = `${engine}-${variant}-${width}-${theme}`;
          await page.screenshot({ path: `${shots}/${tag}-empty.png` });
          assert.equal(
            await page
              .getByRole("button", { name: "Check", exact: true })
              .isDisabled(),
            true,
          );
          if (r.mode === "given") {
            await page.locator(".equal-group").first().focus();
            await page.keyboard.press("Enter");
            assert.equal(
              await page.locator('.equal-group[data-outlined="true"]').count(),
              1,
            );
            assert.match(
              await page.locator('.equal-addends [role="status"]').innerText(),
              /equals blank/,
            );
            await stable(page, before);
            if (r.orientation === "either") {
              await page
                .getByRole("button", { name: "Columns ↓", exact: true })
                .click();
              await page.locator(".equal-group").first().click();
              assert.equal(
                await page
                  .getByRole("button", {
                    name: `Addend 1: ${answer.rows}`,
                    exact: true,
                  })
                  .count(),
                1,
              );
              assert.equal(
                await page
                  .getByRole("button", { name: "Addend 2: blank", exact: true })
                  .count(),
                1,
              );
              await stable(page, before);
            }
            await page
              .getByRole("button", { name: "Reset", exact: true })
              .click();
          } else {
            for (let i = 0; i < 4; i++) {
              await page
                .getByRole("button", { name: "More rows", exact: true })
                .click();
              await page
                .getByRole("button", { name: "More columns", exact: true })
                .click();
              await stable(page, before);
            }
            assert.equal(await page.locator(".equal-object svg").count(), 25);
            assert.ok(
              await page
                .getByRole("button", { name: "More rows", exact: true })
                .isDisabled(),
            );
            await page
              .getByRole("button", { name: "Reset", exact: true })
              .click();
          }
          // Keyboard edits, deletion to empty and reset use the shared sentence slots.
          await page
            .getByRole("button", { name: "Addend 1:", exact: false })
            .focus();
          await page.keyboard.press("4");
          assert.match(
            (await page.locator(":focus").getAttribute("aria-label")) ?? "",
            /Addend 2:/,
          );
          await page.keyboard.press("ArrowLeft");
          assert.match(
            (await page.locator(":focus").getAttribute("aria-label")) ?? "",
            /Addend 1:/,
          );
          await page.keyboard.press("Tab");
          await page.keyboard.press("4");
          assert.match(
            (await page.locator(":focus").getAttribute("aria-label")) ?? "",
            /Total:/,
          );
          await page.keyboard.press("1");
          await page.keyboard.press("2");
          await page.keyboard.press("Backspace");
          assert.match(
            (await page.locator(":focus").getAttribute("aria-label")) ?? "",
            /Total: 1/,
          );
          await page
            .getByRole("button", { name: "Reset", exact: true })
            .click();
          await fillEqualAddends(page, r, JSON.stringify(answer));
          await stable(page, before);
          const targets = await page
            .locator(".equal-addends button, .counter-builder-form button")
            .evaluateAll((nodes) =>
              nodes.every((n) => {
                const b = n.getBoundingClientRect();
                return b.width >= 44 && b.height >= 44;
              }),
            );
          assert.ok(targets, "Every interactive target is at least 44px");
          assert.equal(
            await page.locator(".equal-object svg").count(),
            answer.rows * answer.columns,
          );
          await promptVisible(page);
          await page.screenshot({
            path: `${shots}/${tag}-${correct ? "right" : "wrong"}-filled.png`,
          });
          await page
            .locator(".equal-addends")
            .screenshot({
              path: `${shots}/${tag}-${correct ? "right" : "wrong"}-control.png`,
            });
          const [reply] = await Promise.all([
            page.waitForResponse(
              (v) =>
                v.url().endsWith("/attempts") &&
                v.request().method() === "POST",
            ),
            page.getByRole("button", { name: "Check", exact: true }).click(),
          ]);
          assert.equal(reply.status(), 200, await reply.text());
          const outcome = await reply.json();
          assert.equal(outcome.correct, correct);
          assert.equal(outcome.response, JSON.stringify(answer));
          await page.locator('.equal-addends[data-resolved="true"]').waitFor();
          await page
            .locator(".practice-celebration")
            .waitFor({ state: "hidden" });
          await stable(page, before);
          await promptVisible(page);
          assert.equal(
            await page.locator('.equal-addends [aria-pressed="true"]').count(),
            0,
          );
          await page.screenshot({
            path: `${shots}/${tag}-${correct ? "correct" : "incorrect"}.png`,
          });
          const body = reply.request().postDataJSON(),
            headers = {
              authorization: reply.request().headers().authorization!,
            };
          body.response = JSON.stringify(
            {
              total: answer.total,
              addends: answer.addends,
              columns: answer.columns,
              rows: answer.rows,
            },
            null,
            1,
          );
          const retry = await page.request.post(reply.url(), {
            data: body,
            headers,
          });
          assert.equal(retry.status(), 200, await retry.text());
          assert.equal((await retry.json()).id, outcome.id);
          if (variant === "build-array" && correct && theme === "light") {
            const old = await page.request.post(
              `${baseUrl}/api/v1/learners/${learner.id}/batches`,
              {
                headers,
                data: {
                  count: 1,
                  templateId: p.public.templateId,
                  responseCapabilities: ["single-choice-v1"],
                  figureCapabilities: ["scenes-v1"],
                },
              },
            );
            assert.equal(old.status(), 200, await old.text());
            assert.equal(
              (await old.json()).problems[0].response.kind,
              "choice",
            );
          }
          if (variant === "build-array" && correct && theme === "light") {
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
            assert.equal(saved.rows[0].response_kind, "equal-addends");
          }
          evidence.push({ variant, width, theme, correct, geometry: before });
        }
      await context.close();
    }
  assert.deepEqual(errors, []);
  if (engine === "chromium") {
    const print = await browser.newPage();
    await print.emulateMedia({ media: "print" });
    await print.setContent(publicationHtml(equalAddendsLesson, "lesson"));
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
    `Equal addends (${engine}): ${evidence.length} graded cases passed; stable geometry, no overflow, touch targets, keyboard, grouping, reset, grading, retry and legacy fallback.`,
  );
} catch (error) {
  const page = browser.contexts().at(-1)?.pages().at(-1);
  if (page) {
    await page.screenshot({ path: `${shots}/failure-${engine}.png` });
    await writeFile(
      `${shots}/failure-${engine}.txt`,
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
