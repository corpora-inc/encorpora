/** Real-browser proof of multi-part choice practice: blanks in a sentence,
 * a match table and labeled slots. Pointer and touch selection, changing a
 * choice, keyboard menus (Enter, arrows, Escape), Check gating, Clear, server
 * feedback marked on every part, and zero layout shift, at 320/390/768/1280
 * px in light and dark. Screenshots go to AMP_EVIDENCE_DIR (default
 * artifacts/multi-part-choice-ui). Requires AMP_TEST_DATABASE_URL. */
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
  multiPartMarks,
  normalizeMultiPart,
  type MultiPartChoiceResponse,
} from "../src/math/multi-part-choice";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { choose } from "./ui-controls";
import { startTopic } from "./ui-practice";

const database = process.env.AMP_TEST_DATABASE_URL;
if (!database) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(database);
const shots =
  process.env.AMP_EVIDENCE_DIR ??
  new URL("../artifacts/multi-part-choice-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const origin = "http://127.0.0.1:4480";
await migrate(database);
const repository = new PostgresRepository(database, {
  development: true,
  freeProblems: 200,
});
const learner = await repository.create(
  "development-household",
  "Blank reviewer",
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
await app.listen({ host: "127.0.0.1", port: 4481 });
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4480,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4481" } },
  },
});
await vite.listen();
// WebKit lacks the layout-shift API; there the box comparisons carry the proof.
const engine = process.env.AMP_BROWSER === "webkit" ? "webkit" : "chromium";
const browser = await (engine === "webkit" ? webkit : chromium).launch();
const errors: string[] = [];

type Family =
  | "inline-linear-features"
  | "proportional-match-table"
  | "label-expression-parts";
const families: Family[] = [
  "inline-linear-features",
  "proportional-match-table",
  "label-expression-parts",
];
/** The fullest instance of each layout: a graphed line with three blanks,
 * a five-row table, and four slots with six options each. */
function instance(family: Family, key: string): GeneratedProblem {
  for (let i = 0; i < 400; i++) {
    const p = generateProblem(family, `${learner.id}:${key}:${i}`);
    const r = p.public.response;
    if (r.kind !== "multi-part-choice") continue;
    if (
      family === "inline-linear-features" &&
      r.blanks.length === 3 &&
      p.public.figure?.kind === "scene" &&
      p.public.prompt.startsWith("The graph")
    )
      return p;
    if (family === "proportional-match-table" && r.blanks.length === 5)
      return p;
    if (family === "label-expression-parts" && r.blanks.length === 4) return p;
  }
  throw new Error(`No representative ${family} instance`);
}
const parts = (p: GeneratedProblem) => {
  const r = p.public.response;
  if (r.kind !== "multi-part-choice") throw new Error("Expected multi-part");
  return r;
};
/** Each blank's correct option index, from the server's answer key. */
const keyIndexes = (r: MultiPartChoiceResponse, answer: string) =>
  multiPartMarks(r, answer, answer).map((m) =>
    m.blank.options.findIndex((o) => o.id === m.expected.id),
  );

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
      parts: at(".multi-part"),
      controls: [
        ...document.querySelectorAll(".multi-part-blank, .multi-part-cell"),
      ].map(box),
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
const blank = (page: Page, i: number) =>
  page.locator(".multi-part-blank").nth(i);
const menuItems = (page: Page) =>
  page.locator(".multi-part-menu [role=menuitemradio]");
/** Open a blank's menu by pointer or touch and pick an option. */
async function pick(page: Page, i: number, option: number, touch: boolean) {
  const trigger = blank(page, i);
  await trigger.scrollIntoViewIfNeeded();
  if (touch) await trigger.tap();
  else await trigger.click();
  await page.locator(".multi-part-menu").waitFor();
  const item = menuItems(page).nth(option);
  if (touch) await item.tap();
  else await item.click();
  await page.locator(".multi-part-menu").waitFor({ state: "detached" });
}
/** Keyboard: Enter opens, arrows move, Enter chooses; focus returns. */
async function pickByKeyboard(page: Page, i: number, option: number) {
  // A resting mouse pointer over the menu would take focus as it hovers.
  await page.mouse.move(0, 0);
  await blank(page, i).focus();
  await page.keyboard.press("Enter");
  await page.locator(".multi-part-menu").waitFor();
  // Arrow down until the wanted option has focus, from the top.
  const focused = () =>
    page.evaluate(() =>
      [
        ...document.querySelectorAll(".multi-part-menu [role=menuitemradio]"),
      ].indexOf(document.activeElement!),
    );
  await page.keyboard.press("Home");
  for (let k = 0; k < 8 && (await focused()) !== option; k++) {
    await page.keyboard.press("ArrowDown");
    // Roving focus moves on the next task.
    await page.waitForTimeout(50);
  }
  assert.equal(await focused(), option, "arrows reach the option");
  await page.keyboard.press("Enter");
  await page.locator(".multi-part-menu").waitFor({ state: "detached" });
  await blank(page, i).evaluate(
    (n) =>
      new Promise<void>((done, fail) => {
        const start = performance.now();
        const poll = () =>
          n === document.activeElement
            ? done()
            : performance.now() - start > 2000
              ? fail(
                  new Error(
                    `Focus is on ${document.activeElement?.className || document.activeElement?.tagName}, not the blank`,
                  ),
                )
              : requestAnimationFrame(poll);
        poll();
      }),
  );
}
const shown = (page: Page, i: number) =>
  blank(page, i)
    .locator(".multi-part-blank-value[data-shown]")
    .evaluate((n) => (n as HTMLElement).innerText.trim());

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
        if (reply.status() === 404) console.log("404", reply.url());
      });
      await page.goto(origin);
      await choose(
        page.getByRole("button", { name: "Learner", exact: true }),
        learner.id,
      );
      for (const family of families) {
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
        await page.locator(".multi-part").waitFor();
        assert.ok(
          capabilities.includes("multi-part-choice-v1"),
          "The client declares multi-part choices",
        );
        const response = parts(problem);
        const keyed = keyIndexes(response, problem.answer);
        // The inline family is answered with one wrong blank, the table with
        // one wrong row; the slots are answered correctly.
        const wrongAt = family === "label-expression-parts" ? -1 : 1;
        const plan = keyed.map((k, i) =>
          i === wrongAt ? (k + 1) % response.blanks[i]!.options.length : k,
        );
        const expectCorrect = wrongAt < 0;

        // Math fonts settle before the first measurement.
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        await observeShifts(page);
        const before = await geometry(page);
        assert.ok(before.overflow <= 0, `${tag}: overflow ${before.overflow}`);
        const check = page.getByRole("button", { name: "Check", exact: true });
        const clear = page.getByRole("button", { name: "Clear", exact: true });
        assert.ok(
          await check.isDisabled(),
          `${tag}: Check waits for every part`,
        );
        assert.ok(await clear.isDisabled(), `${tag}: nothing to clear yet`);
        for (const control of [check, clear]) {
          const box = (await control.boundingBox())!;
          assert.ok(
            box.height >= 44 && box.width >= 44,
            `${tag}: ${JSON.stringify(box)}`,
          );
        }
        for (const [x, , w, h] of before.controls) {
          assert.ok(w! >= 44 && h! >= 44, `${tag}: target ${w}×${h}`);
          assert.ok(
            x! >= 0 && x! + w! <= width,
            `${tag}: control inside the screen`,
          );
        }
        // Nothing overflows its box (labels never truncate or spill).
        const spill = await page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              ".multi-part-blank, .multi-part-slots li, .multi-part-table th, .multi-part-table td",
            ),
          ]
            .filter((n) => n.scrollWidth > n.clientWidth + 1)
            .map((n) => n.className || n.tagName),
        );
        assert.deepEqual(spill, [], `${tag}: content spills its box`);
        // Column and slot labels wrap only between words.
        const split = await page.evaluate(() => {
          const broken: string[] = [];
          for (const node of document.querySelectorAll(
            ".multi-part-table thead th, .multi-part-slot-label, .multi-part-cell-text",
          )) {
            const walker = document.createTreeWalker(
              node,
              NodeFilter.SHOW_TEXT,
            );
            for (let text = walker.nextNode(); text; text = walker.nextNode()) {
              if (text.parentElement?.closest(".katex")) continue;
              for (const match of (text.textContent ?? "").matchAll(/\S+/g)) {
                const range = document.createRange();
                range.setStart(text, match.index!);
                range.setEnd(text, match.index! + match[0].length);
                const lines = new Set(
                  [...range.getClientRects()].map((r) => Math.round(r.top)),
                );
                if (lines.size > 1) broken.push(match[0]);
              }
            }
          }
          return broken;
        });
        assert.deepEqual(split, [], `${tag}: a label wraps mid-word`);
        await page.screenshot({ path: `${shots}/${tag}-empty.png` });

        if (response.layout === "table") {
          const row = (i: number) =>
            page.locator(".multi-part-table tbody tr").nth(i);
          const cell = (i: number, c: number) =>
            row(i).locator(".multi-part-cell").nth(c);
          // Pointer or touch: choose, then change a row's choice.
          for (const [i, c] of plan.entries()) {
            const target = cell(i, (c + 1) % 2);
            await target.scrollIntoViewIfNeeded();
            if (touch) await target.tap();
            else await target.click();
          }
          assert.match(
            (await page.locator(".multi-part-count").textContent()) ?? "",
            new RegExp(`${plan.length} of ${plan.length}`),
          );
          // Keyboard: arrows move a row's choice; Space keeps it.
          await cell(0, (plan[0]! + 1) % 2)
            .locator("input")
            .focus();
          await page.keyboard.press(plan[0] === 0 ? "ArrowLeft" : "ArrowRight");
          for (let i = 1; i < plan.length; i++) {
            const target = cell(i, plan[i]!);
            if (touch) await target.tap();
            else await target.click();
          }
          assert.equal(
            await cell(0, plan[0]!).locator("input").isChecked(),
            true,
            `${tag}: keyboard moved the first row`,
          );
        } else {
          // Pointer or touch: choose a wrong option first, then change it.
          await pick(
            page,
            0,
            (plan[0]! + 1) % response.blanks[0]!.options.length,
            touch,
          );
          const first = await shown(page, 0);
          await pick(page, 0, plan[0]!, touch);
          assert.notEqual(
            await shown(page, 0),
            first,
            `${tag}: choice changed`,
          );
          if (width === 390 && theme === "light") {
            await blank(page, 1).scrollIntoViewIfNeeded();
            await (touch ? blank(page, 1).tap() : blank(page, 1).click());
            await page.locator(".multi-part-menu").waitFor();
            await page.waitForTimeout(300);
            await page.screenshot({ path: `${shots}/${tag}-menu.png` });
            await page.keyboard.press("Escape");
            await page
              .locator(".multi-part-menu")
              .waitFor({ state: "detached" });
          }
          // Keyboard: Escape closes without choosing.
          await blank(page, 1).focus();
          await page.keyboard.press("Enter");
          await page.locator(".multi-part-menu").waitFor();
          if (width === 1280 && theme === "light") {
            await page.waitForTimeout(300);
            await page.screenshot({ path: `${shots}/${tag}-keyboard.png` });
          }
          await page.keyboard.press("Escape");
          await page.locator(".multi-part-menu").waitFor({ state: "detached" });
          assert.equal(
            await blank(page, 1).getAttribute("data-filled"),
            null,
            `${tag}: Escape chooses nothing`,
          );
          for (let i = 1; i < plan.length; i++)
            await pickByKeyboard(page, i, plan[i]!);
        }
        assert.match(
          (await page.locator(".multi-part-count").textContent()) ?? "",
          new RegExp(`${plan.length} of ${plan.length} chosen`),
        );
        assert.ok(
          await check.isEnabled(),
          `${tag}: complete answers can be checked`,
        );
        const chosenGeometry = await geometry(page);
        assert.deepEqual(
          chosenGeometry,
          before,
          `${tag}: choosing moved nothing`,
        );
        await page.screenshot({ path: `${shots}/${tag}-chosen.png` });

        // Clear empties every part, without moving anything; choose again.
        if (family === "label-expression-parts") {
          await clear.click();
          assert.match(
            (await page.locator(".multi-part-count").textContent()) ?? "",
            /0 of/,
          );
          assert.ok(await check.isDisabled());
          assert.deepEqual(
            await geometry(page),
            before,
            `${tag}: Clear moved nothing`,
          );
          for (const [i, option] of plan.entries())
            await pick(page, i, option, touch);
        }

        const sent = page.waitForRequest(
          (request) =>
            request.url().endsWith("/attempts") && request.method() === "POST",
        );
        await check.click();
        const body = (await sent).postDataJSON();
        assert.equal(
          normalizeMultiPart(response, body.response),
          body.response,
        );
        await page
          .locator(`.feedback.${expectCorrect ? "correct" : "incorrect"}`)
          .waitFor();
        await page.waitForTimeout(300);
        const sheet = page.locator(".solution-panel");
        const text = (await sheet.textContent()) ?? "";
        assert.ok(
          !/\{"|"[a-z0-9]+":/.test(text),
          `${tag}: transport format shown`,
        );
        if (!expectCorrect) {
          assert.match(
            text,
            new RegExp(`${plan.length - 1} of ${plan.length} parts correct`),
          );
          const marked =
            response.layout === "table"
              ? await page
                  .locator('.multi-part-cell[data-mark="answer"]')
                  .count()
              : await page
                  .locator('.multi-part-blank[data-mark="incorrect"]')
                  .count();
          assert.equal(marked, 1, `${tag}: the wrong part is marked`);
        }
        const correctMarks =
          response.layout === "table"
            ? '.multi-part-cell[data-mark="correct"]'
            : '.multi-part-blank[data-mark="correct"]';
        assert.equal(
          await page.locator(correctMarks).count(),
          expectCorrect ? plan.length : plan.length - 1,
          `${tag}: each right part is marked`,
        );
        const after = await geometry(page);
        assert.deepEqual(
          { ...after, dock: null },
          { ...before, dock: null },
          `${tag}: feedback moved the problem`,
        );
        assert.deepEqual(
          after.dock,
          before.dock,
          `${tag}: the dock keeps its box`,
        );
        assert.equal(await shifts(page), 0, `${tag}: cumulative layout shift`);
        await page.screenshot({ path: `${shots}/${tag}-feedback.png` });
        const why = page.getByRole("button", { name: "See why", exact: true });
        if (await why.count()) {
          await why.click();
          await page.locator(".feedback-steps").waitFor();
        } else await page.locator(".feedback-steps").waitFor();
        if (!expectCorrect)
          assert.match(
            (await page.locator(".feedback-steps").textContent()) ?? "",
            /parts are correct\. Recheck/,
          );
        await page.screenshot({ path: `${shots}/${tag}-explanation.png` });
        checked++;
      }
      await context.close();
    }

  // The lesson for a multi-part problem works another instance.
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
  await startTopic(page, "inline-linear-features");
  await page.locator(".multi-part").waitFor();
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  const lesson = page.getByRole("dialog");
  await lesson.getByText("Back to the problem").waitFor();
  await page.screenshot({
    path: `${shots}/inline-linear-features-390-light-lesson.png`,
  });
  assert.ok(!/\{"|"[a-z0-9]+":/.test((await lesson.textContent()) ?? ""));
  await context.close();

  assert.deepEqual(errors, [], "No browser page errors");
  console.log(
    `Multi-part choice: ${checked} family × width × theme runs passed pointer, touch and keyboard choice, change, Escape, Clear, Check gating, marked server feedback and zero layout shift; screenshots in ${shots}`,
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
