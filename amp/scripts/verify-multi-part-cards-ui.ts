/** Real-browser proof of equations built from cards: the equation is
 * centered under the question, a tapped card fills the box it is aimed at,
 * a placed card leaves its outline, tapping a filled box takes the card
 * back, reused symbol cards stay in the tray, the keyboard places cards, and
 * nothing moves while placing, checking or marking, at 320/390/768/1280 px
 * in light and dark. Screenshots go to AMP_EVIDENCE_DIR (default
 * artifacts/multi-part-cards-ui). Requires AMP_TEST_DATABASE_URL. */
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
  cardRows,
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
  new URL("../artifacts/multi-part-cards-ui/", import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const origin = "http://127.0.0.1:4490";
await migrate(database);
const repository = new PostgresRepository(database, {
  development: true,
  freeProblems: 200,
});
const learner = await repository.create(
  "development-household",
  "Card reviewer",
  2016,
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

/** One family per shape: a drawn array with one row of number cards used
 * once, an equation with number and operation rows, reused operation cards,
 * and two comparisons on two lines. */
const families = [
  "array-division-slots",
  "booth-equation-slots",
  "story-operations-slots",
  "compare-symbol-blanks",
] as const;
type Family = (typeof families)[number];
/** The widest instance a family makes, so narrow screens see the worst. */
function instance(family: Family, key: string): GeneratedProblem {
  let best: GeneratedProblem | undefined;
  let widest = -1;
  for (let i = 0; i < 60; i++) {
    const p = generateProblem(family, `${learner.id}:${key}:${i}`);
    const width = JSON.stringify(p.public.response).length;
    if (width > widest) [best, widest] = [p, width];
  }
  return best!;
}
const parts = (p: GeneratedProblem) =>
  p.public.response as MultiPartChoiceResponse;

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
      boxes: [...document.querySelectorAll(".multi-part-box")].map(box),
      cards: [...document.querySelectorAll(".multi-part-card")].map(box),
      tray: at(".multi-part-tray"),
      dock: at(".answer-dock"),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
}
/** Each line of the equation: its left and right margins in the sentence. */
async function lineMargins(page: Page) {
  return page.evaluate(() => {
    const sentence = document.querySelector(
      ".multi-part[data-layout=cards] .multi-part-sentence",
    )!;
    const outer = sentence.getBoundingClientRect();
    const lines = new Map<number, [number, number]>();
    const add = (r: DOMRect) => {
      if (!r.width) return;
      const key = Math.round(r.top + r.height / 2);
      const near = [...lines.keys()].find((k) => Math.abs(k - key) < 14);
      const [l, rr] = lines.get(near ?? key) ?? [Infinity, -Infinity];
      lines.set(near ?? key, [Math.min(l, r.left), Math.max(rr, r.right)]);
    };
    for (const node of sentence.querySelectorAll(".multi-part-box, .katex"))
      add(node.getBoundingClientRect());
    return [...lines.values()].map(([l, r]) => [
      Math.round(l - outer.left),
      Math.round(outer.right - r),
    ]);
  });
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
          sources?: { node?: Node }[];
        };
        w.__shift += shift.value;
        for (const source of shift.sources ?? [])
          w.__sources.push(
            `${(source.node as Element | undefined)?.className ?? source.node?.nodeName}`,
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

const box = (page: Page, i: number) => page.locator(".multi-part-box").nth(i);
/** The card with this label in the tray row of box `i`. */
function card(
  page: Page,
  response: MultiPartChoiceResponse,
  i: number,
  optionId: string,
) {
  const rows = cardRows(response);
  const r = rows.findIndex((row) => row.blanks.includes(response.blanks[i]!));
  const o = rows[r]!.options.findIndex((x) => x.id === optionId);
  return page
    .locator(".multi-part-tray-row")
    .nth(r)
    .locator(".multi-part-card")
    .nth(o);
}
async function press(
  page: Page,
  target: ReturnType<Page["locator"]>,
  touch: boolean,
) {
  await target.scrollIntoViewIfNeeded();
  if (touch) await target.tap();
  else await target.click();
}
const shown = (page: Page, i: number) =>
  box(page, i).evaluate(
    (n) =>
      (
        n.querySelector(
          ".multi-part-blank-value[data-shown]",
        ) as HTMLElement | null
      )?.innerText.trim() ?? "",
  );

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
        await page.locator(".multi-part[data-layout=cards]").waitFor();
        assert.ok(
          capabilities.includes("multi-part-cards-v1"),
          "The client declares cards",
        );
        const response = parts(problem);
        const marks = multiPartMarks(response, problem.answer, problem.answer);
        const key = marks.map((m) => m.expected.id);
        // The array is answered with one wrong card (the sum of the sides),
        // the comparisons with one wrong symbol; the others correctly.
        const wrongAt =
          family === "array-division-slots" ||
          family === "compare-symbol-blanks"
            ? 0
            : -1;
        const rows = cardRows(response);
        const rowOf = (i: number) =>
          rows.find((row) => row.blanks.includes(response.blanks[i]!))!;
        const unused = (i: number) =>
          rowOf(i).options.find(
            (o) =>
              !rowOf(i).blanks.some(
                (b) => key[response.blanks.indexOf(b)] === o.id,
              ),
          ) ?? rowOf(i).options.find((o) => o.id !== key[i])!;
        const plan = key.map((k, i) => (i === wrongAt ? unused(i).id : k));
        const expectCorrect = wrongAt < 0;

        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        await observeShifts(page);
        const before = await geometry(page);
        assert.ok(before.overflow <= 0, `${tag}: overflow ${before.overflow}`);
        for (const [x, , w, h] of [...before.boxes, ...before.cards]) {
          assert.ok(w! >= 44 && h! >= 44, `${tag}: target ${w}×${h}`);
          assert.ok(
            x! >= 0 && x! + w! <= width,
            `${tag}: control inside the screen`,
          );
        }
        for (const [left, right] of await lineMargins(page))
          assert.ok(
            Math.abs(left! - right!) <= 3,
            `${tag}: the equation is centered (${left} vs ${right})`,
          );
        const spill = await page.evaluate(() =>
          [
            ...document.querySelectorAll<HTMLElement>(
              ".multi-part-box, .multi-part-card",
            ),
          ]
            .filter((n) => n.scrollWidth > n.clientWidth + 1)
            .map((n) => n.className),
        );
        assert.deepEqual(spill, [], `${tag}: content spills its box`);
        const check = page.getByRole("button", { name: "Check", exact: true });
        assert.ok(
          await check.isDisabled(),
          `${tag}: Check waits for every box`,
        );
        assert.equal(
          await box(page, 0).getAttribute("data-current"),
          "",
          `${tag}: the first box is next`,
        );
        await page.screenshot({ path: `${shots}/${tag}-empty.png` });

        // A wrong card first, then take it back by tapping its box.
        const wrong = unused(0).id === plan[0] ? key[0]! : unused(0).id;
        await press(page, card(page, response, 0, wrong), touch);
        const placed = await shown(page, 0);
        assert.ok(placed, `${tag}: the card went into the first box`);
        if (!response.reuse)
          assert.equal(
            await card(page, response, 0, wrong).getAttribute("data-used"),
            "",
            `${tag}: a placed card leaves its outline`,
          );
        assert.deepEqual(
          await geometry(page),
          before,
          `${tag}: placing moved nothing`,
        );
        await press(page, box(page, 0), touch);
        assert.equal(
          await shown(page, 0),
          "",
          `${tag}: tapping the box took the card back`,
        );
        assert.equal(
          await card(page, response, 0, wrong).getAttribute("data-used"),
          null,
          `${tag}: the card is back in the tray`,
        );
        assert.equal(await box(page, 0).getAttribute("data-current"), "");
        // A card from another row fills its own row's box; the aimed box
        // stays aimed at.
        const other = response.blanks.findIndex(
          (b) => !rowOf(0).blanks.includes(b),
        );
        if (other >= 0) {
          await press(page, card(page, response, other, plan[other]!), touch);
          assert.notEqual(await shown(page, other), "", `${tag}: other row`);
          assert.equal(
            await box(page, 0).getAttribute("data-current"),
            "",
            `${tag}: the aimed box is still next`,
          );
        }

        if (plan.length >= 3) {
          // Aim at the last box first: the next card goes there.
          const last = plan.length - 1;
          await press(page, box(page, last), touch);
          assert.equal(await box(page, last).getAttribute("data-current"), "");
          await press(page, card(page, response, last, plan[last]!), touch);
          assert.notEqual(
            await shown(page, last),
            "",
            `${tag}: the aimed box filled`,
          );
          assert.equal(
            await shown(page, 0),
            "",
            `${tag}: the first box still waits`,
          );
        }
        // The rest in order; the keyboard places one card.
        for (let i = 0; i < plan.length; i++) {
          if ((await shown(page, i)) !== "") continue;
          const target = card(page, response, i, plan[i]!);
          if (i === 1 && width === 1280) {
            await target.focus();
            await page.keyboard.press("Enter");
            // The placed card is disabled; focus moves on, never to <body>.
            assert.ok(
              await page.evaluate(
                () =>
                  document.activeElement?.matches(
                    ".multi-part-card:not(:disabled), .multi-part-box",
                  ) ?? false,
              ),
              `${tag}: keyboard focus stays in the problem`,
            );
          } else await press(page, target, touch);
          assert.notEqual(
            await shown(page, i),
            "",
            `${tag}: box ${i + 1} filled`,
          );
        }
        if (response.reuse)
          assert.equal(
            await page.locator(".multi-part-card[data-used]").count(),
            0,
            `${tag}: reused cards stay in the tray`,
          );
        assert.match(
          (await page.locator(".multi-part-count").textContent()) ?? "",
          new RegExp(`${plan.length} of ${plan.length} chosen`),
        );
        assert.ok(
          await check.isEnabled(),
          `${tag}: a full equation can be checked`,
        );
        assert.deepEqual(
          await geometry(page),
          before,
          `${tag}: placing moved nothing`,
        );
        // Button fills fade for 120 ms (theme.css); let the last one settle.
        await page.waitForTimeout(200);
        await page.screenshot({ path: `${shots}/${tag}-chosen.png` });

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
        assert.deepEqual(
          JSON.parse(body.response),
          Object.fromEntries(response.blanks.map((b, i) => [b.id, plan[i]])),
          `${tag}: the boxes sent what they show`,
        );
        await page
          .locator(`.feedback.${expectCorrect ? "correct" : "incorrect"}`)
          .waitFor();
        await page.waitForTimeout(300);
        assert.equal(
          await page.locator('.multi-part-box[data-mark="correct"]').count(),
          expectCorrect ? plan.length : plan.length - 1,
          `${tag}: each right box is marked`,
        );
        if (!expectCorrect)
          assert.equal(
            await page
              .locator('.multi-part-box[data-mark="incorrect"]')
              .count(),
            1,
            `${tag}: the wrong box is marked`,
          );
        assert.equal(
          await page
            .locator(
              ".multi-part-card:not(:disabled), .multi-part-box:not(:disabled)",
            )
            .count(),
          0,
          `${tag}: nothing can be placed after checking`,
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
        checked++;
      }
      await context.close();
    }
  assert.deepEqual(errors, [], "No browser page errors");
  console.log(
    `Multi-part cards: ${checked} family × width × theme runs passed centering, aimed and next-box placement, take-back, reuse, keyboard placement, Check gating, marked feedback and zero layout shift; screenshots in ${shots}`,
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
