import "./test-database-preflight.js";
import { entryTemplates } from "../src/math/entry-practice.js";
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
await app.listen({ host: "127.0.0.1", port: 4463 });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4462,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4463" } },
  },
});
await vite.listen();
const browserName =
  process.env.AMP_ENTRY_BROWSER === "webkit" ? "webkit" : "chromium";
const browser = await (browserName === "webkit" ? webkit : chromium).launch({
  headless: true,
});
const output = new URL(
  `../artifacts/entry-review-${process.platform}-${browserName}/`,
  import.meta.url,
);
await mkdir(output, {
  recursive: true,
});
try {
  const page = await browser.newPage({ hasTouch: true });
  await page.goto("http://127.0.0.1:4462");
  await page
    .getByRole("combobox", { name: "Learner", exact: true })
    .selectOption(learner.id);
  const rows = [];
  const fixtures: {
    name: string;
    problem: PublicProblem;
    boundary?: boolean;
  }[] = [];
  for (const t of entryTemplates)
    fixtures.push({
      name: t.id,
      problem: generateProblem(t.id, "entry-readable").public,
    });
  function find(
    name: string,
    id: string,
    accept: (p: PublicProblem) => boolean,
  ) {
    for (let seed = 0; seed < 4096; seed++) {
      const problem = generateProblem(id, `entry-boundary-${seed}`).public;
      if (accept(problem)) {
        fixtures.push({ name, problem, boundary: true });
        return;
      }
    }
    throw new Error(`Missing boundary ${name}`);
  }
  for (const [name, relation] of [
    ["equal", 0],
    ["a-longer", 1],
    ["b-longer", -1],
  ] as const) {
    find(
      name,
      "compare-aligned-lengths",
      (p) =>
        p.figure?.kind === "aligned-strips" &&
        Math.sign(p.figure.lengths[0] - p.figure.lengths[1]) === relation,
    );
  }
  for (const [name, corners] of [
    ["circle", 0],
    ["triangle", 3],
    ["square", 4],
  ] as const) {
    find(
      name,
      "identify-basic-shape",
      (p) =>
        p.figure?.kind === "shape-outline" &&
        (p.figure.outline.form === "round"
          ? 0
          : p.figure.outline.vertices.length) === corners,
    );
  }
  find("turned-square", "identify-basic-shape", (p) => {
    const f = p.figure;
    return (
      f?.kind === "shape-outline" &&
      f.outline.form === "polygon" &&
      f.outline.vertices.length === 4 &&
      Math.abs(f.outline.vertices[0]![1] - f.outline.vertices[1]![1]) > 20 &&
      Math.abs(f.outline.vertices[0]![0] - f.outline.vertices[1]![0]) > 20
    );
  });
  find("scalene-triangle", "identify-basic-shape", (p) => {
    const f = p.figure;
    if (
      f?.kind !== "shape-outline" ||
      f.outline.form !== "polygon" ||
      f.outline.vertices.length !== 3
    )
      return false;
    const vs = f.outline.vertices,
      lengths = vs.map((a, i) => {
        const b = vs[(i + 1) % 3]!;
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
      });
    return lengths.every((l, i) =>
      lengths.every((m, j) => i === j || Math.abs(l - m) > 1),
    );
  });
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
  for (const id of ["compare-aligned-lengths", "identify-basic-shape"]) {
    await page.setViewportSize({ width: 320, height: 568 });
    await page
      .getByRole("button", { name: "Change topic", exact: true })
      .click();
    await page
      .getByText("Looking for a particular idea?", { exact: true })
      .click();
    await page.getByLabel("Choose your practice").selectOption(id);
    const batchPromise = page.waitForResponse(
      (r) => r.url().endsWith("/batches") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Try this idea", exact: true })
      .click();
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
    await page.getByRole("button", { name: /^Check answer/ }).click();
    await page
      .getByRole("heading", { name: "Let’s work through it.", exact: true })
      .waitFor();
    assert.ok(
      (await page.locator(".solution-panel").innerText()).includes(
        generated.explanation[0]!,
      ),
    );
    assert.equal(
      await page.locator(".problem-stage .solution-panel").count(),
      0,
    );
    assert.ok(
      await page.locator("dialog[open]").evaluate((dialog) => {
        const r = dialog.getBoundingClientRect();
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
        .getByRole("button", { name: /^Continue/ })
        .evaluate((b) => b === document.activeElement),
    );
    await page.getByRole("button", { name: "The idea", exact: true }).click();
    await page.locator(".workspace-lesson").waitFor();
    assert.ok(
      await page.locator("dialog[open]").evaluate((dialog) => {
        const b = dialog.getBoundingClientRect();
        return b.top >= 0 && b.bottom <= innerHeight + 1;
      }),
    );
    await page.screenshot({
      path: new URL(`${id}-lesson-320.png`, output).pathname,
    });
    await page.keyboard.press("Escape");
    assert.ok(
      await page
        .getByRole("button", { name: "The idea", exact: true })
        .evaluate((b) => b === document.activeElement),
    );
    assert.equal(await page.locator("dialog[open]").count(), 0);
    assert.equal(await page.locator(".practice-celebration").count(), 0);
  }

  await page.getByRole("button", { name: "Change topic", exact: true }).click();
  await page
    .getByText("Looking for a particular idea?", { exact: true })
    .click();
  await page
    .getByLabel("Choose your practice")
    .selectOption("identify-basic-shape");
  await page
    .getByRole("button", { name: "Try this idea", exact: true })
    .click();
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
    path: new URL("shape-enlarged-320.png", output).pathname,
  });
  await enlargedAction.click();
  await page.getByRole("radio").last().check();
  assert.ok(
    await page
      .getByRole("button", { name: "Check answer", exact: true })
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
        .locator(".entry-figure")
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
    printedFigures >= 48,
    "Both visual families need printed workbook and solution figures",
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
    `Entry readability passed ${rows.length} views across ${fixtures.length} deterministic fixtures and ${printedFigures} printed figures in ${browserName}.`,
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
