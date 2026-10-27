/** Real-browser proof of figure-choice practice: choosing among drawn
 * graphs and number lines. Whole-card pointer and touch selection, changing
 * a choice, arrow keys between cards, Check gating, server feedback marking
 * the correct and the chosen card, legible figure labels (at least 12 px),
 * one column on phones and two on wider stages, and zero layout shift, at
 * 320/390/768/1280 px in light and dark. Also screenshots the lesson and
 * the printed workbook and solutions. Screenshots go to AMP_EVIDENCE_DIR
 * (default artifacts/figure-choice-ui). Requires AMP_TEST_DATABASE_URL. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, webkit, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes";
import { generateProblem, type GeneratedProblem } from "../src/math/engine";
import type { FigureChoiceResponse } from "../src/math/figure-choice";
import { lessons } from "../src/content/lessons";
import { publicationHtml } from "../src/content/publications";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { choose } from "./ui-controls";
import { startTopic } from "./ui-practice";

const database = process.env.AMP_TEST_DATABASE_URL;
if (!database) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(database);
const shots =
  process.env.AMP_EVIDENCE_DIR ??
  new URL("../artifacts/figure-choice-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const origin = "http://127.0.0.1:4490";
await migrate(database);
const repository = new PostgresRepository(database, {
  development: true,
  freeProblems: 200,
});
const learner = await repository.create(
  "development-household",
  "Figure reviewer",
  2011,
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
await app.listen({ host: "127.0.0.1", port: 4491 });
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4490,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4491" } },
  },
});
await vite.listen();
// WebKit lacks the layout-shift API; there the box comparisons carry the proof.
const engine = process.env.AMP_BROWSER === "webkit" ? "webkit" : "chromium";
const browser = await (engine === "webkit" ? webkit : chromium).launch();
const errors: string[] = [];

const families = [
  "graph-of-linear-rule",
  "graph-of-proportional-rate",
  "graph-of-inequality-number-line",
  "graph-of-quadratic-or-exponential",
] as const;
type Family = (typeof families)[number];
/** The fullest instance of each family: a table or a given graph above the
 * cards where the family has one. */
function instance(family: Family, key: string): GeneratedProblem {
  for (let i = 0; i < 400; i++) {
    const p = generateProblem(family, `${learner.id}:${key}:${i}`);
    if (
      (family === "graph-of-linear-rule" ||
        family === "graph-of-quadratic-or-exponential") &&
      !p.public.figure
    )
      continue;
    return p;
  }
  throw new Error(`No representative ${family} instance`);
}
const figuresOf = (p: GeneratedProblem): FigureChoiceResponse => {
  const r = p.public.response;
  if (r.kind !== "figure-choice") throw new Error("Expected figure choice");
  return r;
};

/** Positions in the stage's scroll content, so a scroll is not a shift. */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>(".problem-stage")!;
    const box = (node: Element) => {
      const b = node.getBoundingClientRect();
      const inStage = stage.contains(node);
      return [
        Math.round(b.x * 10) / 10,
        Math.round((b.y + (inStage ? stage.scrollTop : 0)) * 10) / 10,
        Math.round(b.width * 10) / 10,
        Math.round(b.height * 10) / 10,
      ];
    };
    const at = (selector: string) => {
      const node = document.querySelector(selector);
      return node ? box(node) : null;
    };
    return {
      prompt: at("#problem-prompt"),
      grid: at(".figure-choice-grid"),
      cards: [...document.querySelectorAll(".figure-choice-card")].map(box),
      figures: [...document.querySelectorAll(".figure-choice-figure svg")].map(
        box,
      ),
      dock: at(".answer-dock"),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}
/** The smallest rendered label in any option figure, in CSS pixels. */
async function smallestLabel(page: Page) {
  return page.evaluate(() => {
    let smallest = Infinity;
    for (const svg of document.querySelectorAll<SVGSVGElement>(
      ".figure-choice-figure svg",
    )) {
      const scale =
        svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      for (const text of svg.querySelectorAll("text")) {
        const size = parseFloat(getComputedStyle(text).fontSize);
        smallest = Math.min(smallest, size * scale);
      }
    }
    return smallest;
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
async function observeShifts(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __shift: number; __sources: string[] };
    w.__shift = 0;
    w.__sources = [];
    if (!PerformanceObserver.supportedEntryTypes?.includes("layout-shift"))
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
        for (const source of shift.sources ?? [])
          w.__sources.push(
            `${(source.node as Element | undefined)?.className ?? source.node?.nodeName} ${JSON.stringify(source.previousRect)} -> ${JSON.stringify(source.currentRect)}`,
          );
      }
    }).observe({ type: "layout-shift", buffered: false });
  });
}
const card = (page: Page, i: number) =>
  page.locator(".figure-choice-card").nth(i);
const radio = (page: Page, i: number) =>
  page.locator(".figure-choice-radio").nth(i);

let checked = 0;
try {
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1280, 800],
    ] as const) {
      const touch = width <= 390;
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
        hasTouch: touch,
        reducedMotion: width === 768 ? "reduce" : "no-preference",
      });
      await context.addInitScript("globalThis.__name = (f) => f");
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (reply) => {
        if (reply.url().endsWith("/attempts") && reply.status() !== 200)
          errors.push(`attempt ${reply.status()}`);
      });
      await page.goto(origin);
      await choose(
        page.getByRole("button", { name: "Learner", exact: true }),
        learner.id,
      );
      for (const [f, family] of families.entries()) {
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
                    strand: "algebra",
                  },
                ],
                lesson: null,
              },
            });
          },
        );
        await startTopic(page, family);
        await page.locator(".figure-choice").waitFor();
        assert.ok(
          capabilities.includes("figure-choice-v1"),
          "The client declares figure choices",
        );
        const response = figuresOf(problem);
        const answerAt = response.options.findIndex(
          (o) => o.id === problem.answer,
        );
        // Alternate families answer wrong, so both review marks are shown.
        const expectCorrect = (f + (theme === "dark" ? 1 : 0)) % 2 === 0;
        const finalAt = expectCorrect
          ? answerAt
          : (answerAt + 1) % response.options.length;
        const firstAt = (finalAt + 2) % response.options.length;

        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        await observeShifts(page);
        const before = await geometry(page);
        assert.ok(before.overflow <= 0, `${tag}: overflow ${before.overflow}`);
        assert.equal(before.cards.length, response.options.length);
        // Phones stack the cards; tablets and desktops show two across.
        const columns = new Set(before.cards.map(([x]) => x)).size;
        assert.equal(
          columns,
          width <= 390 ? 1 : 2,
          `${tag}: ${columns} columns`,
        );
        for (const [x, , w, h] of before.cards) {
          assert.ok(w! >= 44 && h! >= 44, `${tag}: target ${w}×${h}`);
          assert.ok(x! >= 0 && x! + w! <= width, `${tag}: card inside`);
        }
        const smallest = await smallestLabel(page);
        assert.ok(smallest >= 12, `${tag}: a figure label is ${smallest} px`);
        const check = page.getByRole("button", { name: "Check", exact: true });
        assert.ok(await check.isDisabled(), `${tag}: Check waits for a choice`);
        const checkBox = (await check.boundingBox())!;
        assert.ok(checkBox.height >= 44, `${tag}: Check ${checkBox.height}`);
        // The figures are hidden from screen readers; each radio names its
        // letter and the figure's description.
        for (const [i, option] of response.options.entries()) {
          const name = (await radio(page, i).getAttribute("aria-label")) ?? "";
          assert.ok(
            name.startsWith(`${response.noun} ${"ABCD"[i]}.`),
            `${tag}: ${name}`,
          );
          assert.ok(
            name.includes(option.label.slice(0, 12)),
            `${tag}: ${name}`,
          );
        }
        await page.screenshot({ path: `${shots}/${tag}-empty.png` });

        // Pointer or touch selects a whole card; choosing again changes it.
        for (const at of [firstAt, finalAt]) {
          // The card's centre lies on its figure: the whole card is the target.
          const target = card(page, at);
          await target.scrollIntoViewIfNeeded();
          if (touch) await target.tap();
          else await target.click();
          assert.ok(await radio(page, at).isChecked(), `${tag}: card ${at}`);
        }
        assert.equal(
          await page.locator(".figure-choice-card[data-selected]").count(),
          1,
          `${tag}: one card is selected`,
        );
        // Keyboard: arrows move between cards, as a radio group.
        if (!touch) {
          await radio(page, finalAt).focus();
          await page.keyboard.press("ArrowDown");
          const moved = (finalAt + 1) % response.options.length;
          assert.ok(await radio(page, moved).isChecked(), `${tag}: arrow`);
          if (width === 1280 && theme === "light")
            await page.screenshot({ path: `${shots}/${tag}-keyboard.png` });
          await page.keyboard.press("ArrowUp");
          assert.ok(await radio(page, finalAt).isChecked(), `${tag}: back`);
        }
        assert.match(
          (await page.locator(".figure-choice-status").textContent()) ?? "",
          new RegExp(`${response.noun} ${"ABCD"[finalAt]} selected`),
        );
        assert.ok(await check.isEnabled(), `${tag}: a choice can be checked`);
        assert.deepEqual(
          await geometry(page),
          before,
          `${tag}: choosing moved nothing`,
        );
        assert.equal(await shifts(page), 0, `${tag}: choosing shifted layout`);
        await page.screenshot({ path: `${shots}/${tag}-chosen.png` });

        const sent = page.waitForRequest(
          (request) =>
            request.url().endsWith("/attempts") && request.method() === "POST",
        );
        await check.click();
        const body = (await sent).postDataJSON();
        assert.equal(body.response, response.options[finalAt]!.id);
        await page
          .locator(`.feedback.${expectCorrect ? "correct" : "incorrect"}`)
          .waitFor();
        await page.waitForTimeout(300);
        const sheet =
          (await page.locator(".solution-panel").textContent()) ?? "";
        if (!expectCorrect)
          assert.match(
            sheet,
            new RegExp(
              `Answer: ${response.noun} ${"ABCD"[answerAt]}.*You chose ${response.noun} ${"ABCD"[finalAt]}`,
            ),
          );
        assert.equal(
          await card(page, answerAt).getAttribute("data-mark"),
          "correct",
          `${tag}: the correct card is marked`,
        );
        if (!expectCorrect)
          assert.equal(
            await card(page, finalAt).getAttribute("data-mark"),
            "chosen",
            `${tag}: the chosen card is marked`,
          );
        assert.equal(
          await page.locator(".figure-choice-card[data-mark]").count(),
          expectCorrect ? 1 : 2,
        );
        const after = await geometry(page);
        assert.deepEqual(
          { ...after, dock: null },
          { ...before, dock: null },
          `${tag}: feedback moved the problem`,
        );
        assert.deepEqual(after.dock, before.dock, `${tag}: the dock box`);
        assert.equal(await shifts(page), 0, `${tag}: cumulative layout shift`);
        // The marked cards, scrolled into view.
        await card(page, answerAt).scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${shots}/${tag}-feedback.png` });
        const why = page.getByRole("button", { name: "See why", exact: true });
        if (await why.count()) await why.click();
        await page.locator(".feedback-steps").waitFor();
        const steps =
          (await page.locator(".feedback-steps").textContent()) ?? "";
        assert.match(
          steps,
          new RegExp(`${response.noun} ${"ABCD"[answerAt]}`),
          `${tag}: the explanation names the answer`,
        );
        if (!expectCorrect)
          assert.match(
            steps,
            new RegExp(`^${response.noun} ${"ABCD"[finalAt]}`),
            `${tag}: distractor feedback leads`,
          );
        await page.screenshot({ path: `${shots}/${tag}-explanation.png` });
        checked++;
      }
      await context.close();
    }

  // The lesson for a figure-choice problem draws another instance's figure.
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
  await startTopic(page, "graph-of-linear-rule");
  await page.locator(".figure-choice").waitFor();
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  const lesson = page.getByRole("dialog");
  await lesson.getByText("Back to the problem").waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `${shots}/graph-of-linear-rule-390-lesson.png`,
  });
  assert.ok(!/option-[a-d]/.test((await lesson.textContent()) ?? ""));
  // Printed workbook and solutions: lettered figures; the key rings one.
  for (const kind of ["workbook", "solutions"] as const) {
    const html = publicationHtml(
      lessons.find((l) => l.templateIds.includes("graph-of-linear-rule"))!,
      kind,
    );
    const file = `${shots}/graph-of-linear-rule-${kind}.html`;
    await writeFile(file, html);
    const print = await context.newPage();
    await print.setViewportSize({ width: 800, height: 1100 });
    await print.goto(`file://${file}`);
    await print.locator(".print-figures").first().scrollIntoViewIfNeeded();
    await print.screenshot({
      path: `${shots}/graph-of-linear-rule-${kind}.png`,
    });
    await print.close();
  }
  await context.close();

  assert.deepEqual(errors, [], "No browser page errors");
  console.log(
    `Figure choice: ${checked} family × width × theme runs passed whole-card pointer, touch and keyboard choice, Check gating, legible labels, marked server feedback and zero layout shift; screenshots in ${shots}`,
  );
} catch (failure) {
  if (errors.length) console.error("Browser page errors:", errors);
  throw failure;
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
    learner.id,
  ]);
  await repository.close();
}
