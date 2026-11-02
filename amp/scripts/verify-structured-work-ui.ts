/** Real-browser proof of structured-work practice: a derivation built line
 * by line (an open list of steps), a two-column proof from statement and
 * reason banks, labeled values with some given, an ordering, and a
 * quadratic typed on the on-screen keypad. Typing (keyboard or keypad),
 * typeset previews, inline entry errors, menus (pointer, touch, keyboard,
 * Escape), adding and removing steps, Clear, Check gating, per-step marks
 * from the server, and zero layout shift, at 320/390/768/1280 px in light
 * and dark. Screenshots go to AMP_EVIDENCE_DIR (default
 * artifacts/structured-work-ui). Requires AMP_TEST_DATABASE_URL. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes";
import type { GeneratedProblem } from "../src/math/engine";
import {
  normalizeStructuredWork,
  type StructuredWorkResponse,
} from "../src/math/structured-work";
import { solveJustifyCases } from "../src/math/solve-and-justify-practice";
import { twoColumnProofCases } from "../src/math/two-column-proof-practice";
import { showWorkCases } from "../src/math/show-work-word-problem-practice";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { choose } from "./ui-controls";
import { startTopic } from "./ui-practice";
import {
  assertPhoneLandscapeSmoke,
  assertProblemReachable,
  problemInView,
} from "./ui-viewports";

const database = process.env.AMP_TEST_DATABASE_URL;
if (!database) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(database);
const shots =
  process.env.AMP_EVIDENCE_DIR ??
  new URL("../artifacts/structured-work-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const origin = "http://127.0.0.1:4490";
await migrate(database);
const repository = new PostgresRepository(database, {
  development: true,
  freeProblems: 400,
});
const learner = await repository.create(
  "development-household",
  "Work reviewer",
  2010,
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

type Run = {
  family: string;
  problem: (key: string) => GeneratedProblem;
  /** Rows to enter, by row; null for given fields. */
  expectCorrect: boolean;
};
const runs: Run[] = [
  {
    family: "solve-justify-linear",
    problem: (k) =>
      solveJustifyCases["solve-justify-linear"](`ui-${k}`, {
        mode: "build",
        form: "grouped",
        fill: "reasons",
      }).problem,
    expectCorrect: false,
  },
  {
    family: "two-column-congruence-proof",
    problem: (k) =>
      twoColumnProofCases["two-column-congruence-proof"](`ui-${k}`, {
        mode: "build",
        config: "parallelogram",
      }).problem,
    expectCorrect: true,
  },
  {
    family: "show-work-box-cost",
    problem: (k) =>
      showWorkCases["show-work-box-cost"](`ui-${k}`, { mode: "fill" }).problem,
    expectCorrect: false,
  },
  {
    family: "two-column-angle-proof",
    problem: (k) =>
      twoColumnProofCases["two-column-angle-proof"](`ui-${k}`, {
        mode: "order",
        proof: "supplementary",
      }).problem,
    expectCorrect: true,
  },
  {
    family: "solve-justify-quadratic",
    problem: (k) =>
      solveJustifyCases["solve-justify-quadratic"](`ui-${k}`, {
        mode: "build",
        form: "standard",
        fill: "reasons",
      }).problem,
    expectCorrect: true,
  },
];
const workOf = (p: GeneratedProblem) => {
  const r = p.public.response;
  if (r.kind !== "structured-work") throw new Error("Expected structured work");
  return r;
};

/** Positions in the stage's scroll content, so a scroll is not a shift. */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const box = (node: Element) => {
      const b = node.getBoundingClientRect();
      const scroller = node.closest<HTMLElement>(
        ".answer-editor, .problem-stage",
      );
      return [
        Math.round(b.x * 10) / 10,
        Math.round((b.y + (scroller?.scrollTop ?? 0)) * 10) / 10,
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
      start: at(".work-start"),
      rows: [...document.querySelectorAll(".work-row")].map(box),
      controls: [
        ...document.querySelectorAll(
          ".work-input, .work-choice, .work-move-button, .work-list-actions button",
        ),
      ].map(box),
      dock: at(".answer-dock"),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}
/** Layout shift not caused by recent input (typing or a tap that adds a
 * row is the learner's own change). */
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
          hadRecentInput: boolean;
          sources?: {
            node?: Node;
            previousRect: DOMRect;
            currentRect: DOMRect;
          }[];
        };
        if (shift.hadRecentInput) continue;
        w.__shift += shift.value;
        for (const source of shift.sources ?? [])
          w.__sources.push(
            `${(source.node as Element | undefined)?.outerHTML ?? source.node?.nodeName} ${JSON.stringify(source.previousRect)} -> ${JSON.stringify(source.currentRect)}`,
          );
      }
    }).observe({ type: "layout-shift", buffered: false });
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

const rowAt = (page: Page, i: number) => page.locator(".work-row").nth(i);
/** Type a line: the keyboard on wide screens, the keypad on touch. */
async function typeLine(
  page: Page,
  i: number,
  j: number,
  text: string,
  touch: boolean,
) {
  const input = rowAt(page, i).locator(".work-input").nth(j);
  await input.scrollIntoViewIfNeeded();
  if (!touch) {
    await input.click();
    await input.fill("");
    await page.keyboard.type(text, { delay: 5 });
    return;
  }
  await input.tap();
  await page.locator(".work-keypad").waitFor();
  const key = (k: string) => page.locator(`.work-keypad [data-key="${k}"]`);
  for (let n = 0; n < text.length; n++) {
    const c = text[n]!;
    if (text.startsWith(" or ", n)) {
      await key("or").tap();
      n += 3;
      continue;
    }
    const k =
      c === "-" ? "−" : c === "*" ? "×" : c === "/" ? "÷" : c === "^" ? "²" : c;
    if (c === "^") n++; // "^2" is the squared key
    await key(k).tap();
  }
}
/** Choose a bank option for a row's choice field by label text. */
async function chooseIn(
  page: Page,
  i: number,
  j: number,
  index: number,
  how: "pointer" | "touch" | "keyboard",
) {
  const trigger = rowAt(page, i).locator(".work-choice").nth(j);
  await trigger.scrollIntoViewIfNeeded();
  if (how === "keyboard") {
    await page.mouse.move(0, 0);
    await trigger.focus();
    await page.keyboard.press("Enter");
  } else if (how === "touch") await trigger.tap();
  else await trigger.click();
  await page.locator(".work-menu").waitFor();
  const items = page.locator(".work-menu [role=menuitemradio]");
  assert.ok(index >= 0 && index < (await items.count()), `option ${index}`);
  if (how === "keyboard") {
    const focused = () =>
      page.evaluate(() =>
        [
          ...document.querySelectorAll(".work-menu [role=menuitemradio]"),
        ].indexOf(document.activeElement!),
      );
    await page.keyboard.press("Home");
    for (let k = 0; k < 14 && (await focused()) !== index; k++) {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(40);
    }
    assert.equal(await focused(), index, "arrows reach the option");
    await page.keyboard.press("Enter");
  } else if (how === "touch") await items.nth(index).tap();
  else await items.nth(index).click();
  await page.locator(".work-menu").waitFor({ state: "detached" });
}
/** An option's position in its bank (the menu lists the bank in order). */
const optionIndex = (r: StructuredWorkResponse, bank: string, id: string) =>
  r.banks.find((b) => b.id === bank)!.options.findIndex((o) => o.id === id);

let checked = 0;
try {
  // AMP_SW_ONLY (family ids) and AMP_SW_WIDTHS narrow a local rerun.
  const only = process.env.AMP_SW_ONLY?.split(",");
  const widths = process.env.AMP_SW_WIDTHS?.split(",").map(Number);
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of (
      [
        [320, 568],
        [390, 844],
        [768, 1024],
        [1024, 768],
        [1280, 800],
      ] as const
    ).filter(([w]) => !widths || widths.includes(w))) {
      const touch = width <= 1024;
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
        hasTouch: touch,
        isMobile: width <= 390,
        reducedMotion: width === 768 ? "reduce" : "no-preference",
      });
      await context.addInitScript("globalThis.__name = (f) => f");
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        // Missing optional routes of this test server (auth config, events)
        // are network noise, logged above; script errors are not.
        if (
          message.type() === "error" &&
          !/Failed to load resource/.test(message.text())
        )
          errors.push(`console: ${message.text()}`);
      });
      page.on("response", (reply) => {
        if (reply.url().endsWith("/attempts") && reply.status() !== 200)
          errors.push(`attempt ${reply.status()}`);
        if (
          reply.status() === 404 &&
          !/auth-config|\/events$/.test(reply.url())
        )
          console.log("404", reply.url());
      });
      await page.goto(origin);
      await choose(
        page.getByRole("button", { name: "Learner", exact: true }),
        learner.id,
      );
      for (const run of runs.filter((x) => !only || only.includes(x.family))) {
        const tag = `${engine === "webkit" ? "webkit-" : ""}${run.family}-${width}-${theme}`;
        const problem = run.problem(`${theme}:${width}`);
        const r = workOf(problem);
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
              request.postDataJSON()?.templateId !== run.family
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
        await startTopic(page, run.family);
        await page.locator(".work").waitFor();
        assert.ok(
          capabilities.includes("structured-work-v1"),
          "The client declares structured work",
        );
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        if (width === 768 || width === 1024) {
          await assertProblemReachable(page, tag);
          assert.deepEqual(
            await problemInView(page, { allowStructuredWorkScroll: true }),
            [],
            `${tag}: the question and figure fit before scrolling the answer`,
          );
        }
        await observeShifts(page);
        const before = await geometry(page);
        assert.ok(before.overflow <= 0, `${tag}: overflow ${before.overflow}`);
        const check = page.getByRole("button", { name: "Check", exact: true });
        // Entries must all be valid before Check; an ordering is always a
        // complete answer, so its Check is ready from the start.
        assert.equal(
          await check.isDisabled(),
          r.mode !== "order",
          `${tag}: Check waits for every step`,
        );
        for (const [x, , w, h] of before.controls) {
          assert.ok(h! >= 44 && w! >= 44, `${tag}: target ${w}×${h}`);
          assert.ok(
            x! >= 0 && x! + w! <= width + 0.5,
            `${tag}: control inside the screen`,
          );
        }
        const spill = await page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              ".work-choice, .work-given, .work-label, .work-row",
            ),
          ]
            .filter((n) => n.scrollWidth > n.clientWidth + 1)
            .map((n) => n.className),
        );
        assert.deepEqual(spill, [], `${tag}: content spills its box`);
        await page.screenshot({ path: `${shots}/${tag}-empty.png` });

        const key = JSON.parse(problem.answer) as string[][] | string[];
        const how = (n: number): "pointer" | "touch" | "keyboard" =>
          touch ? "touch" : n % 2 ? "keyboard" : "pointer";

        if (r.mode === "order") {
          // Move rows into the key order with the arrow buttons: taps on
          // touch, keyboard (focus, Enter) and pointer on wide screens.
          const want = key as string[];
          const shownOrder = () =>
            page.evaluate(() =>
              [...document.querySelectorAll(".work-row")].map(
                (row) => (row as HTMLElement).dataset.row!,
              ),
            );
          const start = await shownOrder();
          for (let target = 0; target < want.length; target++) {
            const at = (await shownOrder()).indexOf(want[target]!);
            assert.ok(at >= target, `${tag}: row ${want[target]} at ${at}`);
            for (let k = at; k > target; k--) {
              const up = rowAt(page, k).getByRole("button", { name: /up$/ });
              if (touch) await up.tap();
              else if (k % 2) {
                await up.focus();
                await page.keyboard.press("Enter");
              } else await up.click();
            }
          }
          assert.deepEqual(await shownOrder(), want, `${tag}: ordered`);
          assert.notDeepEqual(start, want, `${tag}: shown out of order`);
          // The first row cannot move up; the last cannot move down.
          assert.ok(
            await rowAt(page, 0)
              .getByRole("button", { name: /up$/ })
              .isDisabled(),
          );
        } else {
          const rows = key as string[][];
          // The plan: the key, with one deliberate error for an incorrect run.
          const plan = rows.map((row) => [...row]);
          if (!run.expectCorrect) {
            if (run.family === "solve-justify-linear") {
              // A right line with the wrong reason in step 2.
              plan[1]![1] = plan[1]![1] === "cl" ? "dp" : "cl";
            } else {
              // A wrong value in the last learner row.
              const last = plan.length - 1;
              plan[last]![0] = String(Number(plan[last]![0]) + 1);
            }
          }
          for (let i = 0; i < plan.length; i++) {
            if (r.open && i > 0) {
              const add = page.getByRole("button", {
                name: "Add a step",
                exact: true,
              });
              const rowsBefore = await geometry(page);
              if (touch) await add.tap();
              else await add.click();
              await rowAt(page, i).waitFor();
              const rowsAfter = await geometry(page);
              assert.deepEqual(
                rowsAfter.rows.slice(0, i),
                rowsBefore.rows.slice(0, i),
                `${tag}: adding a step moved the steps above`,
              );
            }
            const shape = r.open ? r.rows[0]! : r.rows[i]!;
            for (let j = 0; j < shape.fields.length; j++) {
              const f = shape.fields[j]!;
              if (f.given !== undefined) continue;
              const v = plan[i]![j]!;
              const fieldIndex = shape.fields
                .slice(0, j)
                .filter(
                  (g) => g.given === undefined && g.kind === f.kind,
                ).length;
              if (f.kind === "choice") {
                await chooseIn(
                  page,
                  i,
                  fieldIndex,
                  optionIndex(r, f.bank!, v),
                  how(i + j),
                );
              } else {
                // One malformed entry first, to see its inline note, then fix.
                if (i === 0 && j === 0 && !touch) {
                  const input = rowAt(page, i)
                    .locator(".work-input")
                    .nth(fieldIndex);
                  await input.click();
                  await page.keyboard.type("((", { delay: 5 });
                  await page.keyboard.press("Tab");
                  await page
                    .locator('.work-note[data-tone="error"]')
                    .first()
                    .waitFor();
                  if (theme === "light")
                    await page.screenshot({
                      path: `${shots}/${tag}-entry-error.png`,
                    });
                }
                await typeLine(page, i, fieldIndex, v, touch);
                if (touch && i === 0 && j === 0) {
                  await page.locator(".work-keypad").waitFor();
                  const pad = (await page
                    .locator(".work-keypad")
                    .boundingBox())!;
                  assert.ok(
                    pad.x >= 0 && pad.x + pad.width <= width + 0.5,
                    `${tag}: keypad inside`,
                  );
                  const keys = await page
                    .locator(".work-key")
                    .evaluateAll((nodes) =>
                      nodes.map((n) => {
                        const b = n.getBoundingClientRect();
                        return [b.width, b.height];
                      }),
                    );
                  for (const [w, h] of keys)
                    assert.ok(w! >= 40 && h! >= 44, `${tag}: key ${w}×${h}`);
                  await page.screenshot({ path: `${shots}/${tag}-keypad.png` });
                  // The entry stays above the keypad.
                  const field = (await rowAt(page, i)
                    .locator(".work-input")
                    .nth(fieldIndex)
                    .boundingBox())!;
                  assert.ok(
                    field.y + field.height <= pad.y,
                    `${tag}: entry hidden by keypad`,
                  );
                }
                // The typeset preview shows the entry.
                const note = rowAt(page, i)
                  .locator(".work-note")
                  .nth(fieldIndex);
                assert.ok(
                  (await note.locator(".katex").count()) > 0,
                  `${tag}: preview of ${v}`,
                );
              }
            }
            // Close the keypad between rows on touch, as a learner taps Done.
            if (touch && (await page.locator(".work-keypad").count()))
              await page.locator('.work-keypad [data-key="done"]').tap();
          }
          // Removing and re-adding the last step of an open list.
          if (r.open && plan.length > 1 && width === 1280) {
            await page
              .getByRole("button", { name: "Remove last step", exact: true })
              .click();
            assert.equal(
              await page.locator(".work-row").count(),
              plan.length - 1,
            );
            await page
              .getByRole("button", { name: "Add a step", exact: true })
              .click();
            const last = plan.length - 1;
            await typeLine(page, last, 0, plan[last]![0]!, false);
            await chooseIn(
              page,
              last,
              0,
              optionIndex(r, "reasons", plan[last]![1]!),
              "pointer",
            );
          }
        }
        if (touch && (await page.locator(".work-keypad").count()))
          await page.locator('.work-keypad [data-key="done"]').tap();
        await page.locator(".work-keypad").waitFor({ state: "detached" });
        assert.ok(
          await check.isEnabled(),
          `${tag}: complete work can be checked`,
        );
        const filled = await geometry(page);
        assert.ok(filled.overflow <= 0, `${tag}: overflow after entry`);
        // Rows that existed at the start kept their boxes while filling (an
        // ordering moves rows on purpose; its list keeps its box).
        if (r.mode !== "order")
          assert.deepEqual(
            filled.rows.slice(0, before.rows.length),
            before.rows,
            `${tag}: filling moved a step`,
          );
        else {
          const span = (rows: number[][]) => [
            rows[0]![1],
            rows.at(-1)![1]! + rows.at(-1)![3]!,
          ];
          assert.deepEqual(
            span(filled.rows),
            span(before.rows),
            `${tag}: the list moved`,
          );
        }
        if (r.mode !== "order") assert.deepEqual(filled.prompt, before.prompt);
        await page.screenshot({ path: `${shots}/${tag}-filled.png` });

        if (width === 1024) {
          const draft = () =>
            page
              .locator(".work-input, .work-choice")
              .evaluateAll((fields) =>
                fields.map((field) =>
                  field instanceof HTMLInputElement
                    ? field.value
                    : field.getAttribute("aria-label"),
                ),
              );
          const entered = await draft();
          await page.setViewportSize({ width: 768, height: 1024 });
          await page.locator(".answer-editor").waitFor({ state: "detached" });
          assert.deepEqual(
            await draft(),
            entered,
            `${tag}: portrait retained draft`,
          );
          await page.setViewportSize({ width: 1024, height: 768 });
          await page.locator(".answer-editor").waitFor();
          assert.deepEqual(
            await draft(),
            entered,
            `${tag}: landscape retained draft`,
          );
          assert.deepEqual(
            (await geometry(page)).rows,
            filled.rows,
            `${tag}: rotation restored row geometry`,
          );
        }

        const sent = page.waitForRequest(
          (request) =>
            request.url().endsWith("/attempts") && request.method() === "POST",
        );
        await (touch ? check.tap() : check.click());
        const body = (await sent).postDataJSON();
        assert.notEqual(
          normalizeStructuredWork(r, body.response),
          null,
          `${tag}: valid response`,
        );
        await page
          .locator(`.feedback.${run.expectCorrect ? "correct" : "incorrect"}`)
          .waitFor();
        if (process.env.AMP_SW_DEBUG)
          console.log(
            await page.evaluate(() =>
              [...document.querySelectorAll(".solution-panel > *")].map(
                (n) =>
                  `${n.className}:${Math.round(n.getBoundingClientRect().height)}`,
              ),
            ),
          );
        await page.waitForTimeout(300);
        const sheet = page.locator(".solution-panel");
        const text = (await sheet.textContent()) ?? "";
        assert.ok(!/\[\[|\["r\d/.test(text), `${tag}: transport format shown`);
        const marks = await page
          .locator(".work-row")
          .evaluateAll((rows) =>
            rows.map((row) => row.getAttribute("data-mark")),
          );
        if (run.expectCorrect)
          assert.ok(
            marks.every((m) => m === "correct"),
            `${tag}: ${marks}`,
          );
        else {
          assert.equal(
            marks.filter((m) => m === "incorrect").length,
            1,
            `${tag}: ${marks}`,
          );
          assert.match(text, /of \d+ steps correct/);
        }
        if (await page.locator(".answer-editor").count())
          await assertPhoneLandscapeSmoke(page, `${tag}: marked answer editor`);
        const after = await geometry(page);
        assert.deepEqual(
          after.rows,
          filled.rows,
          `${tag}: feedback moved a step`,
        );
        assert.deepEqual(
          after.dock,
          before.dock,
          `${tag}: the dock keeps its box`,
        );
        if (process.env.AMP_SW_DEBUG)
          console.log(
            await page.evaluate(() =>
              [...document.querySelectorAll(".solution-panel > *")].map(
                (n) =>
                  `${n.className}:${Math.round(n.getBoundingClientRect().height)}`,
              ),
            ),
          );
        assert.equal(await shifts(page), 0, `${tag}: cumulative layout shift`);
        await page.screenshot({ path: `${shots}/${tag}-feedback.png` });
        if (await page.locator(".feedback-details").count()) {
          await page.locator(".feedback-details").evaluate((node) => {
            node.scrollTop = node.scrollHeight;
          });
          await page.screenshot({
            path: `${shots}/${tag}-feedback-details.png`,
          });
          await page.locator(".feedback-details").evaluate((node) => {
            node.scrollTop = 0;
          });
        }
        const why = page.getByRole("button", { name: "See why", exact: true });
        if (await why.count()) await why.click();
        await page.locator(".feedback-steps").waitFor();
        if (!run.expectCorrect)
          assert.match(
            (await page.locator(".feedback-steps").textContent()) ?? "",
            /Recheck step/,
          );
        await page.screenshot({ path: `${shots}/${tag}-explanation.png` });
        if (width === 1024 && run.family === "solve-justify-linear") {
          const explanation = page.getByRole("dialog", {
            name: "Explanation",
            exact: true,
          });
          const builds = explanation.getByRole("button", {
            name: "Builds on",
            exact: true,
          });
          await builds.click();
          const connected = page.getByRole("dialog", {
            name: "Builds on",
            exact: true,
          });
          await connected.waitFor();
          const ids = await page
            .locator("dialog[open]")
            .evaluateAll((dialogs) =>
              dialogs.map((dialog) => dialog.getAttribute("aria-labelledby")),
            );
          assert.equal(
            new Set(ids).size,
            2,
            `${tag}: nested dialogs have distinct accessible names`,
          );
          await connected
            .getByRole("button", { name: "Close panel", exact: true })
            .click();
          await connected.waitFor({ state: "detached" });
          assert.ok(
            await builds.evaluate((node) => node === document.activeElement),
          );
          await builds.click();
          await connected.waitFor();
          await page.keyboard.press("Escape");
          await connected.waitFor({ state: "detached" });
          assert.ok(
            await explanation.isVisible(),
            `${tag}: Escape returns to explanation`,
          );
          assert.ok(
            await builds.evaluate((node) => node === document.activeElement),
          );
          await builds.click();
          await connected.waitFor();
          await page.unroute(`**/api/v1/learners/${learner.id}/batches`);
          await connected.locator(".dialog-content li button").first().click();
          await page.locator("dialog[open]").waitFor({ state: "detached" });
          await page.locator(".feedback").waitFor({ state: "detached" });
        }
        if (await page.locator("dialog[open]").count()) {
          await page.keyboard.press("Escape");
          await page.locator("dialog[open]").waitFor({ state: "detached" });
          if (width >= 1024)
            assert.ok(
              await why.evaluate((node) => node === document.activeElement),
              `${tag}: explanation restores trigger focus`,
            );
        }
        checked++;
      }
      await context.close();
    }

  // The lesson for a structured problem works another instance.
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
  await startTopic(page, "two-column-congruence-proof");
  await page.locator(".work").waitFor();
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  const lesson = page.getByRole("dialog");
  await lesson.getByText("Back to the problem").waitFor();
  await page.screenshot({
    path: `${shots}/two-column-congruence-proof-390-light-lesson.png`,
  });
  assert.ok(!/\[\[/.test((await lesson.textContent()) ?? ""));
  await context.close();

  assert.deepEqual(errors, [], "No browser page errors");
  console.log(
    `Structured work: ${checked} family × width × theme runs passed typing (keyboard and keypad), previews, inline errors, menus, ordering, adding steps, Check gating, per-step server marks and zero layout shift; screenshots in ${shots}`,
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
