import { choose } from "./ui-controls";
import { startTopic } from "./ui-practice";
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
import { layoutScene } from "../src/math/scene/index";
import { isPorted, legacyScene } from "../src/math/scene/legacy";
import { typeSizes } from "../src/math/scene/type";
import { FIGURE_TEXT_MAX_PX } from "../src/web/FigureTextCap";
import {
  assertFigureTextScale,
  figureTextScale,
  assertPhoneLandscapeSmoke,
  assertProblemReachable,
  isPhoneLandscape,
  PHONE_ANDROID_CHROME,
  PHONE_IPHONE_SE,
  PHONE_LANDSCAPE,
  PHONE_REAL_BROWSERS,
  PHONE_SMALL_ANDROID,
  problemInView,
  TABLETS,
} from "./ui-viewports";
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
/** Every data display a learner practices: dot, line and double dot plots,
 * box plots, histograms, bar and picture graphs, scatter plots and two-way
 * tables. */
const DATA_TEMPLATES = [
  "line-plot-whole",
  "fraction-line-plot",
  "fraction-plot-difference",
  "fraction-plot-equal-share",
  "dot-plot-mean",
  "dot-plot-mad",
  "dot-plot-iqr",
  "typical-value-choice",
  "sample-estimates-plot",
  "means-in-mads",
  "box-plot-read",
  "double-box-compare",
  "compare-distributions-choice",
  "histogram-read",
  "bar-chart-total",
  "bar-chart-difference",
  "scaled-bar-graph",
  "picture-graph-questions",
  "scaled-picture-graph",
  "scatter-association-choice",
  "trend-line-predict",
  "trend-slope-meaning",
  "two-way-missing",
  "two-way-row-percent",
  "two-way-association-choice",
];
/** Phone portrait sizes where a data figure's labels must read at 12 px or
 * more (phone landscape is smoke-only, #1206). */
const DATA_PHONES = [
  { width: 320, height: 568 },
  PHONE_SMALL_ANDROID,
  PHONE_IPHONE_SE,
  PHONE_ANDROID_CHROME,
  { width: 390, height: 844 },
];
/** Tablets in both orientations, the two-column landscape layout, and a
 * desktop: sizes that give a figure more room than it needs. */
const DATA_WIDE = [
  PHONE_ANDROID_CHROME,
  ...TABLETS,
  { width: 1280, height: 800 },
];
/** Per template, the seeds that stress legibility most: the figure whose
 * smallest label shrinks most when fitted to a narrow phone (widest layout
 * per label size) and the tallest figure. */
function dataFixtures(id: string) {
  let narrow: { seed: string; ratio: number } | undefined,
    tall: { seed: string; height: number } | undefined;
  for (let i = 0; i < 64; i++) {
    const seed = `data-legibility-${i}`,
      f = generateProblem(id, seed).public.figure;
    const scene =
      f?.kind === "scene" ? f.scene : f && isPorted(f) ? legacyScene(f) : null;
    if (!scene) return [seed];
    const l = layoutScene(scene),
      smallest = Math.min(
        ...l.items.flatMap((d) =>
          d.k === "text" ? d.t.runs.map((r) => r.size) : [],
        ),
      ),
      ratio = l.width / smallest;
    if (!narrow || ratio > narrow.ratio) narrow = { seed, ratio };
    if (!tall || l.height > tall.height) tall = { seed, height: l.height };
  }
  return [...new Set([narrow!.seed, tall!.seed])];
}
/** On-screen size, in CSS px, of every label in the practice figure. */
async function labelSizes(page: import("playwright").Page) {
  return page.locator(".problem-content svg text").evaluateAll((nodes) =>
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
}
const rows: unknown[] = [];
try {
  // Data figures on a phone-emulated page (mobile viewport, touch, 3x).
  {
    const phone = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      deviceScaleFactor: 3,
      ...(browserName === "chromium" ? { isMobile: true } : {}),
    });
    await phone.goto("http://127.0.0.1:4434");
    await choose(
      phone.getByRole("button", { name: "Learner", exact: true }),
      learner.id,
    );
    let shown: PublicProblem | undefined;
    await phone.route("**/batches", async (route) => {
      const response = await route.fetch(),
        body = await response.json();
      // Fixture substitution changes only the displayed problem. No attempts are made.
      body.problems = [shown];
      body.selection = [
        { problemId: shown!.id, reason: "focus", strand: "math" },
      ];
      await route.fulfill({ response, json: body });
    });
    const smallest: Record<string, Record<string, number>> = {};
    const failures: string[] = [];
    for (const id of DATA_TEMPLATES)
      for (const seed of dataFixtures(id)) {
        shown = generateProblem(id, seed).public;
        await phone.setViewportSize(DATA_PHONES[DATA_PHONES.length - 1]!);
        await startTopic(phone, id);
        await phone.locator(".problem-content svg").first().waitFor();
        for (const size of [...DATA_PHONES, PHONE_LANDSCAPE]) {
          await phone.setViewportSize(size);
          await phone.waitForFunction(
            () =>
              !!document.querySelector(".compact-answer-action") ===
              matchMedia("(max-width: 650px) and (max-height: 640px)").matches,
          );
          const label = `${id} ${seed} ${size.width}×${size.height}`;
          if (isPhoneLandscape(size)) {
            await assertPhoneLandscapeSmoke(phone, label);
            continue;
          }
          // Reachability on these sizes is verify-ui's per-template sweep.
          assertFigureTextScale(
            await figureTextScale(phone),
            label,
            FIGURE_TEXT_MAX_PX,
          );
          const labels = await labelSizes(phone),
            min = Math.min(...labels.map((l) => l.size));
          const key = `${size.width}×${size.height}`;
          smallest[id] ??= {};
          smallest[id][key] = Math.min(smallest[id][key] ?? 99, min);
          rows.push({
            id: `data ${id} ${seed}`,
            ...size,
            minText: min,
            labels,
          });
          if (min < 11.99) {
            failures.push(
              `${label}: ${labels
                .filter((l) => l.size < 11.99)
                .map((l) => `${l.text} ${l.size.toFixed(1)}px`)
                .join(", ")}`,
            );
            await phone.screenshot({
              path: new URL(`data-${id}-${seed}-${size.width}.png`, output)
                .pathname,
            });
          }
        }
      }
    console.table(
      Object.fromEntries(
        Object.entries(smallest).map(([id, sizes]) => [
          id,
          Object.fromEntries(
            Object.entries(sizes).map(([k, v]) => [k, Number(v.toFixed(1))]),
          ),
        ]),
      ),
    );
    await phone.close();
    assert.deepEqual(failures, [], "data figure labels under 12 px on a phone");
  }
  // The same data figures on tablets and desktops, where the layout offers a
  // figure far more room than it needs: labels keep the figure type sizes,
  // below the prompt, instead of growing with the box.
  {
    const wide = await browser.newPage({ hasTouch: true });
    await wide.goto("http://127.0.0.1:4434");
    await choose(
      wide.getByRole("button", { name: "Learner", exact: true }),
      learner.id,
    );
    let shown: PublicProblem | undefined;
    await wide.route("**/batches", async (route) => {
      const response = await route.fetch(),
        body = await response.json();
      // Fixture substitution changes only the displayed problem. No attempts are made.
      body.problems = [shown];
      body.selection = [
        { problemId: shown!.id, reason: "focus", strand: "math" },
      ];
      await route.fulfill({ response, json: body });
    });
    for (const id of DATA_TEMPLATES) {
      shown = generateProblem(id, dataFixtures(id)[0]!).public;
      await wide.setViewportSize(DATA_WIDE[0]!);
      await startTopic(wide, id);
      await wide.locator(".problem-content svg").first().waitFor();
      for (const size of DATA_WIDE) {
        await wide.setViewportSize(size);
        const label = `${id} ${size.width}×${size.height}`;
        const scale = await figureTextScale(wide);
        rows.push({ id: `data-wide ${id}`, ...size, ...scale });
        assertFigureTextScale(scale, label, FIGURE_TEXT_MAX_PX);
      }
    }
    await wide.close();
  }
  const page = await browser.newPage({ hasTouch: true });
  await page.goto("http://127.0.0.1:4434");
  await choose(
    page.getByRole("button", { name: "Learner", exact: true }),
    learner.id,
  );
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
    await startTopic(page, id);
    await page.locator(".problem-content svg").waitFor();
    for (const size of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      ...PHONE_REAL_BROWSERS,
      ...TABLETS,
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForFunction(
        () =>
          !!document.querySelector(".compact-answer-action") ===
          matchMedia("(max-width: 650px) and (max-height: 640px)").matches,
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
      // Phone landscape only has to stay usable (#1206). Everywhere else the
      // graph fits or scrolls cleanly (never clipped, never under the dock)
      // with labels at a readable on-screen size: a figure shrinks to fit
      // only down to that size, then the stage scrolls. Clipping and overlap
      // below are in figure units and apply everywhere.
      if (isPhoneLandscape(size)) await assertPhoneLandscapeSmoke(page, id);
      else {
        await assertProblemReachable(
          page,
          `${fixture.name} ${size.width}×${size.height}`,
        );
        assert.ok(
          labels.every((l) => l.size >= 11.99),
          `${id} ${size.width}: tiny labels ${JSON.stringify(labels)}`,
        );
        assertFigureTextScale(
          await figureTextScale(page),
          `${fixture.name} ${size.width}×${size.height}`,
          typeSizes.lg,
          size.width >= 768,
        );
        // A tablet, in either orientation, shows the prompt and the whole
        // graph at once: no scrolling to find the figure.
        if (TABLETS.some((t) => t.width === size.width))
          assert.deepEqual(
            await problemInView(page),
            [],
            `${fixture.name} ${size.width}×${size.height}: graph out of view`,
          );
      }
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
      // Coordinate planes, clocks and number lines now draw through the scene
      // renderer (#1177); they are the same printed graphs (99 + 25 + 25 of
      // the 199) and get the same clipping and overlap checks.
      const result = await printPage
        .locator(
          [
            ".graphical-figure",
            ...["coordinate-plane", "clock", "number-line"].map(
              (kind) => `.scene-figure[data-kind="${kind}"]`,
            ),
          ].join(", "),
        )
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
