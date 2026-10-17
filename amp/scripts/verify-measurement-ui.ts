import { startTopic } from "./ui-practice";
import { measurementTemplates } from "../src/math/measurement-practice.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { chromium, webkit } from "playwright";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { developmentAuth } from "../src/server/auth";
import { migrate } from "./migrate";
import { generateProblem } from "../src/math/engine";
import type { PublicProblem, SemanticFigure } from "../src/math/contracts";
import { lessons } from "../src/content/lessons";
import { publicationHtml } from "../src/content/publications";
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const account = "development-household";
const learner = await repository.create(account, "Browser verification", 2016);
const learnerIds = [learner.id];
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
await app.listen({ host: "127.0.0.1", port: 4443 });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4442,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4443" } },
  },
});
await vite.listen();
const browserName =
  process.env.AMP_MEASUREMENT_BROWSER === "webkit" ? "webkit" : "chromium";
const browser = await (browserName === "webkit" ? webkit : chromium).launch({
  headless: true,
});
const output = new URL(
  `../artifacts/measurement-review-${process.platform}-${browserName}/`,
  import.meta.url,
);
await mkdir(output, {
  recursive: true,
});
try {
  const page = await browser.newPage({ hasTouch: true });
  await page.goto("http://127.0.0.1:4442");
  await page
    .getByRole("combobox", { name: "Learner", exact: true })
    .selectOption(learner.id);
  const rows = [];
  const fixtures: {
    name: string;
    problem: PublicProblem;
    boundary?: boolean;
  }[] = [];
  for (const t of measurementTemplates)
    fixtures.push({
      name: t.id,
      problem: generateProblem(t.id, "measurement-readable").public,
    });
  function find(
    name: string,
    id: string,
    accept: (p: PublicProblem) => boolean,
  ) {
    for (let seed = 0; seed < 4096; seed++) {
      const problem = generateProblem(
        id,
        `measurement-boundary-${seed}`,
      ).public;
      if (accept(problem)) {
        fixtures.push({ name, problem, boundary: true });
        return;
      }
    }
    throw new Error(`Missing boundary ${name}`);
  }
  find(
    "adjacent-quarter",
    "fractional-ruler-length",
    (p) =>
      p.figure?.kind === "length-interval" &&
      p.figure.denominator === 4 &&
      p.figure.endNumerator - p.figure.startNumerator === 1,
  );
  find(
    "ruler-right-end",
    "shifted-ruler-length",
    (p) => p.figure?.kind === "length-interval" && p.figure.endNumerator === 12,
  );
  find(
    "long-side-label",
    "mixed-unit-border",
    (p) =>
      p.figure?.kind === "measure-rectangle" && p.figure.height!.value === 300,
  );
  find(
    "thin-comparison",
    "same-border-area-choice",
    (p) =>
      p.figure?.kind === "rectangle-comparison" &&
      p.figure.rectangles.some((r) => r.height === 12),
  );
  let fixture = fixtures[0]!;
  await page.route("**/batches", async (route) => {
    const response = await route.fetch(),
      body = await response.json();
    // Fixture substitution changes only the displayed problem. No attempts are made.
    body.problems = [fixture.problem];
    body.selection = [
      { problemId: fixture.problem.id, reason: "focus", strand: "math" },
    ];
    await route.fulfill({ response, json: body });
  });
  for (fixture of fixtures) {
    const id = fixture.problem.templateId;
    await startTopic(page, id);
    await page.locator(".problem-stage").waitFor();
    for (const size of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForFunction(
        () =>
          !!document.querySelector(".compact-answer-action") ===
          matchMedia("(max-width:650px) and (max-height:780px)").matches,
      );
      await page.waitForFunction(
        () =>
          Math.abs(
            parseFloat(
              document.documentElement.style.getPropertyValue(
                "--practice-height",
              ),
            ) - innerHeight,
          ) < 2,
      );
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      if (fixture.boundary && size.width !== 320) continue;
      const labels = await page
        .locator(".problem-content svg text")
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const t = node as SVGTextElement,
              m = t.getScreenCTM()!;
            return {
              text: t.textContent,
              size:
                Number.parseFloat(getComputedStyle(t).fontSize) *
                Math.hypot(m.c, m.d),
            };
          }),
        );
      rows.push({
        id: fixture.name,
        ...size,
        minText: labels.length ? Math.min(...labels.map((l) => l.size)) : null,
        labels,
      });
      const geometry = await page
        .locator(".problem-stage")
        .evaluate((stage) => ({
          height: stage.clientHeight,
          scroll: stage.scrollHeight,
        }));
      assert.ok(
        geometry.scroll <= geometry.height + 2,
        `${id} ${size.width}: scrolling ${JSON.stringify(geometry)}`,
      );
      assert.ok(
        labels.every((l) => l.size >= 13.99),
        `${id} ${size.width}: tiny labels ${JSON.stringify(labels)}`,
      );
      const clipped = await page
        .locator(".problem-content svg text")
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => {
              const t = node as SVGTextElement,
                b = t.getBBox(),
                v = t.ownerSVGElement!.viewBox.baseVal;
              return (
                b.x < v.x - 1 ||
                b.y < v.y - 1 ||
                b.x + b.width > v.x + v.width + 1 ||
                b.y + b.height > v.y + v.height + 1
              );
            })
            .map((n) => n.textContent),
        );
      assert.deepEqual(clipped, [], `${id} ${size.width}: clipped text`);
      const collisions = await page
        .locator(".problem-content svg text")
        .evaluateAll((nodes) => {
          const pairs: string[] = [];
          for (let i = 0; i < nodes.length; i++)
            for (let j = i + 1; j < nodes.length; j++) {
              const a = (nodes[i] as SVGTextElement).getBBox(),
                b = (nodes[j] as SVGTextElement).getBBox();
              if (
                Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) >
                  1 &&
                Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) >
                  1
              )
                pairs.push(`${nodes[i]!.textContent}/${nodes[j]!.textContent}`);
            }
          return pairs;
        });
      await page.screenshot({
        path: new URL(`${fixture.name}-${size.width}.png`, output).pathname,
      });
      assert.deepEqual(
        collisions,
        [],
        `${fixture.name} ${size.width}: overlapping labels`,
      );
    }
  }
  await page.unroute("**/batches");
  // Actual owned instances, grading, focused feedback and return focus.
  for (const id of [
    "rectangle-missing-border-side",
    "same-area-border-choice",
  ]) {
    await page.setViewportSize({ width: 320, height: 568 });
    const batchPromise = page.waitForResponse(
      (r) =>
        r.url().endsWith("/batches") &&
        r.request().method() === "POST" &&
        r.request().postDataJSON()?.templateId === id,
    );
    await startTopic(page, id);
    const batch = await (await batchPromise).json();
    const publicProblem: PublicProblem = batch.problems[0];
    const generated = generateProblem(id, publicProblem.seed);
    await page
      .getByRole("button", {
        name:
          publicProblem.response.kind === "choice"
            ? "Choose an answer"
            : "Enter your answer",
        exact: true,
      })
      .click();
    if (publicProblem.response.kind === "choice") {
      const wrong = publicProblem.response.options.find(
        (o) => o.id !== generated.answer,
      )!;
      await page.getByRole("radio", { name: wrong.label, exact: true }).check();
    } else
      await page
        .getByLabel(publicProblem.response.label, { exact: true })
        .fill("0");
    await page.getByRole("button", { name: /^Check$/ }).click();
    await page.locator(".feedback.incorrect").waitFor();
    assert.ok(
      (
        await page
          .locator(".solution-panel li")
          .evaluateAll((items) =>
            items.map((li) => li.getAttribute("data-text")),
          )
      ).includes(generated.explanation[0]!),
    );
    assert.equal(
      await page.locator(".problem-stage .solution-panel").count(),
      0,
    );
    // Feedback is inline and its Next action stays on screen.
    assert.ok(
      await page.locator(".feedback .next-action").evaluate((action) => {
        const r = action.getBoundingClientRect();
        return (
          r.top >= 0 &&
          r.bottom <= innerHeight + 1 &&
          r.left >= 0 &&
          r.right <= innerWidth + 1
        );
      }),
    );
    await page.screenshot({
      path: new URL(`${id}-feedback-320.png`, output).pathname,
    });
    await page.keyboard.press("Escape");
    assert.ok(
      await page
        .getByRole("button", { name: /^Next/ })
        .evaluate((b) => b === document.activeElement),
    );
    // Lesson opens the short lesson for this exact problem type, not a book.
    const opening = page.waitForResponse((response) =>
      response.url().endsWith("/lesson-support"),
    );
    await page.getByRole("button", { name: "Lesson", exact: true }).click();
    const opened = await (await opening).json();
    assert.equal(opened.lesson.templateId, id);
    await page.locator(".problem-lesson").waitFor();
    assert.ok(
      await page.locator("dialog[open]").evaluate((dialog) => {
        const r = dialog.getBoundingClientRect();
        return (
          r.top >= 0 &&
          r.bottom <= innerHeight + 1 &&
          document.documentElement.scrollWidth <= innerWidth
        );
      }),
    );
    await page.screenshot({
      path: new URL(`${id}-lesson-320.png`, output).pathname,
    });
    await page.getByRole("button", { name: "Back to the problem" }).click();
    assert.equal(await page.locator("dialog[open]").count(), 0);
    assert.equal(await page.locator(".practice-celebration").count(), 0);
  }
  await startTopic(page, "whole-pack-ribbon-choice");
  await page.locator(".problem-stage").waitFor();
  await page.evaluate(() => {
    const values = [
      ...document.querySelectorAll<HTMLElement>(
        ".practice-workspace h2, .practice-workspace button, .practice-workspace .workspace-topic, .practice-workspace .eyebrow, .practice-workspace .answer-status",
      ),
    ].map((element) => ({
      element,
      size: parseFloat(getComputedStyle(element).fontSize),
    }));
    for (const { element, size } of values)
      element.style.fontSize = `${size * 1.25}px`;
  });
  const enlargedAction = page.getByRole("button", {
    name: "Choose an answer",
    exact: true,
  });
  assert.ok(
    await enlargedAction.evaluate((button) => {
      const r = button.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight && r.height >= 44;
    }),
  );
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: new URL("whole-pack-enlarged-320.png", output).pathname,
  });
  await enlargedAction.click();
  await page.getByRole("radio").last().check();
  assert.ok(
    await page
      .getByRole("button", { name: "Check", exact: true })
      .evaluate((button) => {
        const r = button.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight;
      }),
  );
  await page.keyboard.press("Escape");
  // Printed choice exercises use the general figure renderer, so verify that
  // route independently of the compact choice renderer in the app.
  let printedFigures = 0;
  const printPage = await browser.newPage();
  for (const lesson of lessons) {
    if (
      !lesson.templateIds.some((id) =>
        fixtures.some((f) => f.problem.templateId === id),
      )
    )
      continue;
    for (const kind of ["lesson", "workbook", "solutions"] as const) {
      await printPage.setContent(publicationHtml(lesson, kind));
      const result = await printPage
        .locator(".measurement-figure")
        .evaluateAll((figures) => {
          const issues: string[] = [];
          figures.forEach((figure, index) => {
            const view = (figure as SVGSVGElement).viewBox.baseVal;
            const texts = [...figure.querySelectorAll("text")];
            for (let i = 0; i < texts.length; i++) {
              const a = texts[i]!.getBBox();
              if (
                a.x < view.x - 1 ||
                a.y < view.y - 1 ||
                a.x + a.width > view.x + view.width + 1 ||
                a.y + a.height > view.y + view.height + 1
              )
                issues.push(`${index}: clipped ${texts[i]!.textContent}`);
              for (let j = i + 1; j < texts.length; j++) {
                const b = texts[j]!.getBBox();
                if (
                  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) >
                    1 &&
                  Math.min(a.y + a.height, b.y + b.height) -
                    Math.max(a.y, b.y) >
                    1
                )
                  issues.push(
                    `${index}: overlapping ${texts[i]!.textContent}/${texts[j]!.textContent}`,
                  );
              }
            }
          });
          return { count: figures.length, issues };
        });
      assert.deepEqual(result.issues, [], `${lesson.id} ${kind}`);
      printedFigures += result.count;
    }
  }
  assert.ok(
    printedFigures >= 192,
    "All eight visual families need printed workbook and solution figures",
  );
  await printPage.close();
  await writeFile(
    new URL("validation.json", output),
    JSON.stringify(
      { fixtures: fixtures.length, printedFigures, frames: rows },
      null,
      2,
    ),
  );
  console.log(
    `Measurement readability passed ${rows.length} views across ${fixtures.length} deterministic fixtures and ${printedFigures} printed figures in ${browserName}.`,
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query(
    "DELETE FROM amp_learners WHERE id=ANY($1::text[])",
    [learnerIds],
  );
  await repository.close();
}
