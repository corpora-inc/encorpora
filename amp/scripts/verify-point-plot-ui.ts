/** Real-browser proof of point-plot practice: tap, click, keyboard and drag
 * placement, removal, Check gating, the live readout, server feedback drawn
 * over the learner's points, and zero layout shift, at 320/390/768/1280 px in
 * light and dark. Screenshots go to AMP_EVIDENCE_DIR (default
 * artifacts/point-plot-ui). Requires AMP_TEST_DATABASE_URL. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes";
import { generateProblem, type GeneratedProblem } from "../src/math/engine";
import {
  latticeOnLine,
  onCurve,
  plotPoints,
  pointLabelText,
  type LatticePoint,
} from "../src/math/point-plot";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { choose } from "./ui-controls";
import { startTopic } from "./ui-practice";

const database = process.env.AMP_TEST_DATABASE_URL;
if (!database) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(database);
const shots =
  process.env.AMP_EVIDENCE_DIR ??
  new URL("../artifacts/point-plot-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const origin = "http://127.0.0.1:4470";
await migrate(database);
const repository = new PostgresRepository(database, {
  development: true,
  freeProblems: 200,
});
const learner = await repository.create(
  "development-household",
  "Grid reviewer",
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
await app.listen({ host: "127.0.0.1", port: 4471 });
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4470,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4471" } },
  },
});
await vite.listen();
// WebKit is the iOS and native-shell engine; it lacks the layout-shift API,
// so there the bounding-box comparisons carry the no-shift proof.
const engine = process.env.AMP_BROWSER === "webkit" ? "webkit" : "chromium";
const browser = await (engine === "webkit" ? webkit : chromium).launch();
const errors: string[] = [];

const curveFamilies = [
  "graph-quadratic-points",
  "graph-absolute-value-points",
  "graph-exponential-points",
  "graph-sqrt-points",
] as const;
type Family =
  | "plot-points"
  | "graph-linear-equation"
  | "place-transformed-image"
  | (typeof curveFamilies)[number];
/** Narrow a run with AMP_UI_FAMILIES, AMP_UI_WIDTHS and AMP_UI_THEMES (comma lists). */
const only = (name: string) => process.env[name]?.split(",").filter(Boolean);
/** A representative instance: four plotted points (the widest readout), a
 * fractional-slope line, and an ordered triangle image. */
function instance(family: Family, key: string): GeneratedProblem {
  for (let i = 0; i < 400; i++) {
    const p = generateProblem(family, `${learner.id}:${key}:${i}`);
    const r = p.public.response;
    if (r.kind !== "point-plot") continue;
    if (family === "plot-points" && r.pointCount === 4) return p;
    if (
      family === "graph-linear-equation" &&
      /frac/.test(p.public.prompt) &&
      p.pointGrading?.mode === "on-line" &&
      latticeOnLine(r.grid, p.pointGrading).length >= 3
    )
      return p;
    if (family === "place-transformed-image" && r.pointCount === 3) return p;
  }
  if ((curveFamilies as readonly string[]).includes(family)) {
    // The longest equation and prompt is the widest the family draws.
    let widest: GeneratedProblem | null = null;
    for (let i = 0; i < 80; i++) {
      const p = generateProblem(family, `${learner.id}:${key}:${i}`);
      if (!widest || p.public.prompt.length > widest.public.prompt.length)
        widest = p;
    }
    return widest!;
  }
  throw new Error(`No representative ${family} instance`);
}

/** Client coordinates of a lattice point, read from the drawn gridlines. */
async function clientPoint(page: Page, [x, y]: LatticePoint) {
  return page.evaluate(
    ([x, y]) => {
      const base = document.querySelector<SVGSVGElement>(
        ".point-plot-canvas svg.scene-figure",
      )!;
      const layer = document.querySelector<SVGSVGElement>(".point-plot-layer")!;
      const fit = (axis: "x" | "y") => {
        const pairs = [
          ...base.querySelectorAll<SVGLineElement>(
            `[data-id^="plot.grid.${axis}."]`,
          ),
        ].map((line) => [
          Number(line.dataset.id!.split(".").pop()),
          Number(line.getAttribute(axis === "x" ? "x1" : "y1")),
        ]);
        pairs.sort((a, b) => a[0]! - b[0]!);
        const [v0, p0] = pairs[0]!,
          [v1, p1] = pairs.at(-1)!;
        return (v: number) => p0! + ((v - v0!) * (p1! - p0!)) / (v1! - v0!);
      };
      const point = new DOMPoint(fit("x")(x), fit("y")(y)).matrixTransform(
        layer.getScreenCTM()!,
      );
      return { x: point.x, y: point.y };
    },
    [x, y] as [number, number],
  );
}
/** Keep the target inside the stage's visible area (short phones scroll). */
async function reveal(page: Page, p: LatticePoint) {
  for (let i = 0; i < 3; i++) {
    const at = await clientPoint(page, p);
    const stage = await page
      .locator(".problem-stage")
      .evaluate((node) => node.getBoundingClientRect().toJSON());
    if (at.y > stage.top + 14 && at.y < stage.bottom - 14) return at;
    await page
      .locator(".problem-stage")
      .evaluate(
        (node, dy) => (node.scrollTop += dy),
        at.y - (stage.top + stage.bottom) / 2,
      );
  }
  return clientPoint(page, p);
}
async function tap(page: Page, p: LatticePoint, touch: boolean) {
  const at = await reveal(page, p);
  if (touch) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
}
async function drag(page: Page, from: LatticePoint, to: LatticePoint) {
  const a = await reveal(page, from);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  const b = await clientPoint(page, to);
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  // The live coordinate tag follows the drag before release.
  assert.match(
    (await page.locator(".point-plot-coordinate").textContent()) ?? "",
    new RegExp(escape(pointLabelText(to))),
  );
  await page.mouse.up();
}
const escape = (text: string) => text.replace(/[()]/g, "\\$&");
async function chips(page: Page) {
  return (await page.locator(".point-plot-chips li").allTextContents()).map(
    (text) => text.replace("not placed", "").trim(),
  );
}
/** Positions in the stage's scroll content, so a scroll is not a shift. */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".problem-stage")!;
    const at = (selector: string) => {
      const node = document.querySelector<HTMLElement | SVGElement>(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      const inStage = stage.contains(node);
      return {
        x: Math.round(box.x * 10) / 10,
        y: Math.round((box.y + (inStage ? stage.scrollTop : 0)) * 10) / 10,
        w: Math.round(box.width * 10) / 10,
        h: Math.round(box.height * 10) / 10,
      };
    };
    return {
      prompt: at("#problem-prompt"),
      canvas: at(".point-plot-canvas"),
      legend: at(".point-plot-legend"),
      dock: at(".answer-dock"),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}
async function shifts(page: Page) {
  const { shift, sources } = await page.evaluate(() => ({
    shift: (window as unknown as { __shift: number }).__shift ?? Number.NaN,
    sources: (window as unknown as { __sources?: string[] }).__sources ?? [],
  }));
  if (shift) console.error(sources.join("\n"));
  return shift;
}

let checked = 0;
try {
  for (const theme of (only("AMP_UI_THEMES") ?? ["light", "dark"]) as (
    "light" | "dark"
  )[])
    for (const [width, height] of (
      [
        [320, 568],
        [390, 844],
        [768, 1024],
        [1280, 800],
      ] as const
    ).filter(
      ([w]) =>
        !only("AMP_UI_WIDTHS") || only("AMP_UI_WIDTHS")!.includes(String(w)),
    )) {
      const touch = width <= 390;
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
        hasTouch: touch,
        reducedMotion: width === 768 ? "reduce" : "no-preference",
      });
      // tsx names inner arrow functions with a helper the page lacks.
      await context.addInitScript("globalThis.__name = (f) => f");
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(origin);
      await choose(
        page.getByRole("button", { name: "Learner", exact: true }),
        learner.id,
      );
      for (const family of (only("AMP_UI_FAMILIES") ?? [
        "plot-points",
        "graph-linear-equation",
        "place-transformed-image",
        ...curveFamilies,
      ]) as Family[]) {
        const tag = `${engine === "webkit" ? "webkit-" : ""}${family}-${width}-${theme}`;
        const problem = instance(family, `${theme}:${width}`);
        await repository.transaction(
          "development-household",
          learner.id,
          (tx) => tx.saveProblem(problem),
        );
        await page.unroute(`**/api/v1/learners/${learner.id}/batches`);
        let capabilities: string[] = [];
        await page.route(
          `**/api/v1/learners/${learner.id}/batches`,
          (route) => {
            const request = route.request();
            if (
              request.method() !== "POST" ||
              request.postDataJSON()?.templateId !== family
            )
              return route.continue();
            capabilities = request.postDataJSON().responseCapabilities;
            return route.fulfill({
              json: {
                problems: [problem.public],
                hints: { [problem.public.id]: { hint: problem.hint } },
                selection: [
                  {
                    problemId: problem.public.id,
                    reason: "focus",
                    strand: "geometry",
                  },
                ],
                lesson: null,
              },
            });
          },
        );
        await startTopic(page, family);
        await page.locator(".point-plot-layer").waitFor();
        assert.ok(
          capabilities.includes("point-plot-v1"),
          "The client declares point plots",
        );
        const response = problem.public.response;
        if (response.kind !== "point-plot")
          throw new Error("Expected a point plot");
        const answer = plotPoints(problem.answer);
        const placed: LatticePoint[] =
          family === "graph-linear-equation" &&
          problem.pointGrading?.mode === "on-line"
            ? (() => {
                // Any two points of the line: use the two farthest apart.
                const all = latticeOnLine(response.grid, problem.pointGrading!);
                return [all[0]!, all.at(-1)!];
              })()
            : answer;
        // A point no answer uses and off any graphed line.
        const stray = ((): LatticePoint => {
          const g = response.grid;
          for (let x = g.xMin + 1; x < g.xMax; x++)
            for (let y = g.yMin + 1; y < g.yMax; y++) {
              const p: LatticePoint = [x, y];
              const used = answer.some((q) => q[0] === x && q[1] === y);
              const onLine =
                problem.pointGrading?.mode === "on-line" &&
                problem.pointGrading.a * x + problem.pointGrading.b * y ===
                  problem.pointGrading.c;
              const onGraph =
                problem.pointGrading?.mode === "on-curve" &&
                onCurve(problem.pointGrading.curve, p);
              if (!used && !onLine && !onGraph) return p;
            }
          throw new Error("No stray point");
        })();

        await page.evaluate(() => {
          const w = window as unknown as { __shift: number };
          w.__shift = 0;
          if (
            !PerformanceObserver.supportedEntryTypes?.includes("layout-shift")
          )
            return;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const shift = entry as unknown as {
                value: number;
                sources?: {
                  node?: Node;
                  previousRect: DOMRect;
                  currentRect: DOMRect;
                }[];
              };
              w.__shift += shift.value;
              (w as unknown as { __sources: string[] }).__sources ??= [];
              for (const source of shift.sources ?? [])
                (w as unknown as { __sources: string[] }).__sources.push(
                  `${(source.node as Element | undefined)?.className ?? source.node?.nodeName} ${JSON.stringify(source.previousRect)} -> ${JSON.stringify(source.currentRect)}`,
                );
            }
          }).observe({ type: "layout-shift", buffered: false });
        });
        await page.locator(".point-plot-canvas").scrollIntoViewIfNeeded();
        const before = await geometry(page);
        assert.ok(
          before.overflow <= 0,
          `${tag}: horizontal overflow ${before.overflow}`,
        );
        const check = page.getByRole("button", { name: "Check", exact: true });
        const clear = page.getByRole("button", { name: "Clear", exact: true });
        assert.ok(
          await check.isDisabled(),
          `${tag}: Check waits for every point`,
        );
        assert.ok(await clear.isDisabled(), `${tag}: nothing to clear yet`);
        for (const control of [check, clear]) {
          const box = (await control.boundingBox())!;
          assert.ok(
            box.height >= 44 && box.width >= 44,
            `${tag}: ${JSON.stringify(box)}`,
          );
        }
        assert.deepEqual(
          await chips(page),
          Array(response.pointCount)
            .fill(response.ordered ? "" : "—")
            .map((empty, i) =>
              response.ordered ? `${response.pointLabels![i]}—` : empty,
            ),
        );
        const legend = (await page
          .locator(".point-plot-legend")
          .boundingBox())!;
        assert.ok(
          legend.height <= 24,
          `${tag}: one legend line ${legend.height}`,
        );

        // Tap (or click) places; tapping the same point removes it.
        await tap(page, stray, touch);
        assert.ok(
          (await chips(page)).join(" ").includes(pointLabelText(stray)),
          `${tag}: placed`,
        );
        assert.match(
          (await page.locator(".point-plot-count").textContent()) ?? "",
          /1 of/,
        );
        await tap(page, stray, touch);
        assert.ok(
          !(await chips(page)).join(" ").includes(pointLabelText(stray)),
          `${tag}: removed`,
        );

        // Keyboard: arrows move the cursor from the origin; Enter places.
        const layer = page.locator(".point-plot-layer");
        await layer.focus();
        // The cursor follows the last tap; Home returns it to the origin.
        await page.keyboard.press("Home");
        const [kx, ky] = placed[0]!;
        for (let i = 0; i < Math.abs(kx); i++)
          await page.keyboard.press(kx > 0 ? "ArrowRight" : "ArrowLeft");
        for (let i = 0; i < Math.abs(ky); i++)
          await page.keyboard.press(ky > 0 ? "ArrowUp" : "ArrowDown");
        assert.match(
          (await page.locator(".point-plot-coordinate").textContent()) ?? "",
          new RegExp(escape(pointLabelText(placed[0]!))),
          `${tag}: the cursor shows its coordinates`,
        );
        if (width === 1280 && theme === "light")
          await page.screenshot({ path: `${shots}/${tag}-keyboard.png` });
        await page.keyboard.press("Enter");
        assert.match(
          (await page.locator(".point-plot [role=status]").textContent()) ?? "",
          /Placed/,
        );
        assert.ok(
          (await chips(page)).join(" ").includes(pointLabelText(placed[0]!)),
        );

        // Drag: place the next point off target, then slide it into place.
        await tap(page, stray, touch);
        await drag(page, stray, placed[1]!);
        const afterDrag = (await chips(page)).join(" ");
        assert.ok(
          afterDrag.includes(pointLabelText(placed[1]!)),
          `${tag}: dragged ${afterDrag}`,
        );
        assert.ok(
          !afterDrag.includes(pointLabelText(stray)),
          `${tag}: moved, not copied`,
        );
        for (const p of placed.slice(2)) await tap(page, p, touch);

        // The ordered family is answered with two labels swapped: the right
        // points in the wrong slots. Plot-points misses one point by a unit.
        let expectCorrect = true;
        if (family === "place-transformed-image") {
          expectCorrect = false;
          // Clear, then place B′ first and A′ second.
          await clear.click();
          assert.deepEqual(
            await chips(page),
            response.pointLabels!.map((l) => `${l}—`),
          );
          for (const p of [placed[1]!, placed[0]!, ...placed.slice(2)])
            await tap(page, p, touch);
        }
        if (family === "graph-quadratic-points") {
          // The parabola with one point a unit off the curve is wrong, and
          // the correct points are then drawn over it.
          expectCorrect = false;
          const grading = problem.pointGrading;
          const last = placed.at(-1)!;
          const off = [0, 1, -1]
            .map((d): LatticePoint => [last[0], last[1] + d])
            .find(
              (q) =>
                !(grading?.mode === "on-curve" && onCurve(grading.curve, q)) &&
                q[1] > response.grid.yMin &&
                q[1] < response.grid.yMax &&
                !placed.some((o) => o[0] === q[0] && o[1] === q[1]),
            )!;
          await tap(page, last, touch);
          await tap(page, off, touch);
        }
        if (family === "plot-points") {
          expectCorrect = false;
          const last = placed.at(-1)!;
          const near: LatticePoint = [
            last[0] + (last[0] < 6 ? 1 : -1),
            last[1],
          ];
          if (!placed.some((q) => q[0] === near[0] && q[1] === near[1])) {
            await tap(page, last, touch);
            await tap(page, near, touch);
          } else expectCorrect = true;
        }
        assert.match(
          (await page.locator(".point-plot-count").textContent()) ?? "",
          new RegExp(`${response.pointCount} of ${response.pointCount}`),
        );
        assert.ok(
          await check.isEnabled(),
          `${tag}: complete answers can be checked`,
        );
        // Placing more than asked is refused and announced.
        await tap(page, stray, touch);
        assert.match(
          (await page.locator(".point-plot [role=status]").textContent()) ?? "",
          /All \d points are placed/,
        );
        if (width === 768)
          assert.equal(
            await page
              .locator(".point-plot-dot")
              .first()
              .evaluate((n) => getComputedStyle(n).animationName),
            "none",
            "Reduced motion places points without animation",
          );
        const placedGeometry = await geometry(page);
        assert.deepEqual(
          placedGeometry,
          before,
          `${tag}: placing moved nothing`,
        );
        await page.screenshot({ path: `${shots}/${tag}-placed.png` });

        const sent = page.waitForRequest(
          (request) =>
            request.url().endsWith("/attempts") && request.method() === "POST",
        );
        await check.click();
        const body = (await sent).postDataJSON();
        assert.equal(plotPoints(body.response).length, response.pointCount);
        await page
          .locator(`.feedback.${expectCorrect ? "correct" : "incorrect"}`)
          .waitFor();
        await page.waitForTimeout(300);
        const feedback = page.locator(".solution-panel");
        const text = (await feedback.textContent()) ?? "";
        assert.ok(
          !text.includes("[["),
          `${tag}: no transport format in feedback`,
        );
        if (!expectCorrect) {
          assert.match(text, /You placed/);
          assert.equal(
            await page.locator(".point-plot-ring").count(),
            answer.length,
            `${tag}: the correct points are drawn over the learner's`,
          );
        }
        if (family === "graph-linear-equation") {
          assert.equal(
            await page.locator(".point-plot-line").count(),
            1,
            `${tag}: the learner's line`,
          );
        }
        assert.equal(
          await page.locator(".point-plot-dot").count(),
          response.pointCount,
        );
        const after = await geometry(page);
        assert.deepEqual(
          { ...after, dock: null, legend: null },
          { ...before, dock: null, legend: null },
          `${tag}: feedback moved the problem`,
        );
        assert.deepEqual(
          after.dock,
          before.dock,
          `${tag}: the dock keeps its box under the sheet`,
        );
        assert.deepEqual(
          after.legend,
          before.legend,
          `${tag}: the legend line is reserved`,
        );
        // The sheet covers the dock only, so the grid and its feedback stay in view.
        const sheet = (await page.locator(".feedback").boundingBox())!;
        const canvas = await page
          .locator(".point-plot-canvas")
          .evaluate((n) => n.getBoundingClientRect().toJSON());
        await page.screenshot({ path: `${shots}/${tag}-feedback.png` });
        // Stacked, an incorrect answer's sheet covers the dock only, so the
        // correct points drawn on the grid stay in view.
        if (width < 900 && !expectCorrect)
          assert.ok(
            sheet.y >= canvas.bottom - 1 ||
              sheet.y >= (before.dock?.y ?? 0) - 1,
            `${tag}: the sheet leaves the grid visible: sheet ${sheet.y}, grid bottom ${canvas.bottom}, dock ${before.dock?.y}`,
          );
        assert.equal(await shifts(page), 0, `${tag}: cumulative layout shift`);
        if (!expectCorrect) {
          const why = page.getByRole("button", {
            name: "See why",
            exact: true,
          });
          if (await why.count()) {
            await why.click();
            await page.locator(".feedback-steps").waitFor();
            await page.screenshot({ path: `${shots}/${tag}-explanation.png` });
          } else await page.locator(".feedback-steps").waitFor();
        }
        checked++;
      }
      if (width < 900 && !only("AMP_UI_FAMILIES")) {
        // A skip shows the answer and a second line; the sheet still fits.
        const problem = instance(
          "place-transformed-image",
          `${theme}:${width}:skip`,
        );
        await repository.transaction(
          "development-household",
          learner.id,
          (tx) => tx.saveProblem(problem),
        );
        await page.unroute(`**/api/v1/learners/${learner.id}/batches`);
        await page.route(`**/api/v1/learners/${learner.id}/batches`, (route) =>
          route.request().method() !== "POST"
            ? route.continue()
            : route.fulfill({
                json: {
                  problems: [problem.public],
                  hints: { [problem.public.id]: { hint: problem.hint } },
                  selection: [
                    {
                      problemId: problem.public.id,
                      reason: "focus",
                      strand: "geometry",
                    },
                  ],
                  lesson: null,
                },
              }),
        );
        await startTopic(page, "place-transformed-image");
        await page.locator(".point-plot-layer").waitFor();
        const dock = (await page.locator(".answer-dock").boundingBox())!;
        await page
          .getByRole("button", { name: "Skip this problem and see its answer" })
          .click();
        await page.locator(".feedback.skipped").waitFor();
        await page.waitForTimeout(300);
        const sheet = (await page.locator(".feedback").boundingBox())!;
        await page.screenshot({
          path: `${shots}/place-transformed-image-${width}-${theme}-skipped.png`,
        });
        assert.ok(
          sheet.y >= dock.y - 1,
          `${width} ${theme}: skipped sheet ${sheet.y} covers the grid above dock ${dock.y}`,
        );
        assert.equal(await page.locator(".point-plot-ring").count(), 3);
        assert.equal(await page.locator(".point-plot-dot").count(), 0);
      }
      await context.close();
    }

  // The lesson for a plotted problem shows a solved example grid.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await choose(
    page.getByRole("button", { name: "Learner", exact: true }),
    learner.id,
  );
  await startTopic(page, "place-transformed-image");
  await page.locator(".point-plot-layer").waitFor();
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  const lesson = page.getByRole("dialog");
  await lesson.locator("svg.scene-figure").first().waitFor();
  await page.screenshot({
    path: `${shots}/place-transformed-image-390-light-lesson.png`,
  });
  assert.ok(!((await lesson.textContent()) ?? "").includes("[["));
  await context.close();

  assert.deepEqual(errors, [], "No browser page errors");
  console.log(
    `Point plot: ${checked} family × width × theme runs passed tap/click, keyboard, drag, removal, Check gating, server feedback overlay and zero layout shift; screenshots in ${shots}`,
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
    learner.id,
  ]);
  await repository.close();
}
