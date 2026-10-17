import { registerFamilyRoutes } from "../src/family/routes.js";
import { chromium, webkit } from "playwright";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { developmentAuth } from "../src/server/auth";
import { migrate } from "./test-database";
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
const learner = await repository.create(account, "Browser verification");
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
await app.listen({ host: "127.0.0.1", port: 4435 });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4434,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4435" } },
  },
});
await vite.listen();
const browserName =
  process.env.AMP_GRAPH_BROWSER === "webkit" ? "webkit" : "chromium";
const browser = await (browserName === "webkit" ? webkit : chromium).launch({
  headless: true,
});
const output = new URL(
  `../artifacts/graph-review-${process.platform}-${browserName}/`,
  import.meta.url,
);
await mkdir(output, {
  recursive: true,
});
try {
  const page = await browser.newPage({ hasTouch: true });
  await page.goto("http://127.0.0.1:4434");
  await page
    .getByRole("combobox", { name: "Learner", exact: true })
    .selectOption(learner.id);
  const rows = [];
  const fixtures: {
    name: string;
    problem: PublicProblem;
    boundary?: boolean;
  }[] = [];
  for (const id of [
    "coordinate-point-reading",
    "graphed-line-slope",
    "graph-equation-choice",
    "distance-graph-meaning",
    "bar-chart-total",
    "bar-chart-difference",
    "clock-elapsed-minutes",
    "number-line-distance",
    "comparison-factor",
  ])
    fixtures.push({
      name: id,
      problem: generateProblem(id, "graph-readable").public,
    });
  function find(
    name: string,
    id: string,
    accept: (f: SemanticFigure) => boolean,
  ) {
    for (let seed = 0; seed < 4096; seed++) {
      const problem = generateProblem(id, `graph-boundary-${seed}`).public;
      if (problem.figure && accept(problem.figure)) {
        fixtures.push({ name, problem, boundary: true });
        return;
      }
    }
    throw new Error(`Missing boundary fixture ${name}`);
  }
  for (const [x, y] of [
    [-4, -4],
    [-4, 4],
    [4, -4],
    [4, 4],
    [-1, 4],
    [0, 4],
    [1, 4],
  ])
    find(
      `point-${x}-${y}`,
      "coordinate-point-reading",
      (f) =>
        f.kind === "coordinate-plane" &&
        f.points[0]?.x === x &&
        f.points[0]?.y === y,
    );
  find(
    "slope-top",
    "graphed-line-slope",
    (f) =>
      f.kind === "coordinate-plane" &&
      f.points[0]?.x === -1 &&
      f.points[0]?.y === 4,
  );
  for (const minute of [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
    find(
      `clock-${minute}`,
      "clock-elapsed-minutes",
      (f) => f.kind === "clock" && f.minute === minute,
    );
  find(
    "adjacent-negative",
    "number-line-distance",
    (f) => f.kind === "number-line" && f.points[0] === -8 && f.points[1] === -7,
  );
  find(
    "adjacent-positive",
    "number-line-distance",
    (f) => f.kind === "number-line" && f.points[0] === 3 && f.points[1] === 4,
  );
  find(
    "wide-distance",
    "number-line-distance",
    (f) => f.kind === "number-line" && f.points[0] === -8 && f.points[1] === 8,
  );
  find(
    "tall-comparison",
    "comparison-factor",
    (f) => f.kind === "bar-chart" && f.values[1] === 54,
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
    const change = page.getByRole("button", {
      name: "Change topic",
      exact: true,
    });
    if (await change.count()) await change.click();
    await page
      .getByText("Looking for a particular idea?", { exact: true })
      .click();
    await page.getByLabel("Choose your practice").selectOption(id);
    await page
      .getByRole("button", { name: "Try this idea", exact: true })
      .click();
    await page.locator(".problem-content svg").waitFor();
    for (const size of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForFunction(
        () =>
          !!document.querySelector(".compact-answer-action") ===
          matchMedia("(max-width:650px) and (max-height:780px)").matches,
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
        minText: Math.min(...labels.map((l) => l.size)),
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
        labels.every((l) => l.size >= 11.99),
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
        .locator(".graphical-figure")
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
  assert.equal(printedFigures, 199, "Reference-print graph coverage changed");
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
    `Graph readability passed ${rows.length} views across ${fixtures.length} deterministic fixtures and ${printedFigures} printed figures in ${browserName}.`,
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
