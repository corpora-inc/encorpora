/**
 * Term cards in a real browser: a lesson on its own and inside a practice
 * panel, an answer's explanation, and a hint, in Chromium and WebKit at
 * 320/390/768/1024/1280 px, light and dark.
 *
 * Asserts 44 px targets (a term's hit area by hit-testing around the word),
 * no horizontal overflow, no layout shift when a card opens, drills down,
 * goes back and closes (every element on the page keeps its box; Chromium's
 * layout-shift entries sum to 0), the card inside the viewport, Escape
 * closing only the card, focus returning to the word, a clean axe scan, and
 * no console errors. Screenshots: AMP_GLOSSARY_UI_OUTPUT (default
 * /tmp/amp-glossary-ui); review copies live in docs/reviews/glossary/.
 */
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer as httpServer } from "node:http";
import { chromium, webkit, type Page } from "playwright";
import { createServer } from "vite";
import {
  lessonGlossaryContext,
  problemLesson,
  screenBand,
} from "../src/content/problem-lessons";
import { glossary } from "../src/glossary/index";
import { glossaryPayload } from "../src/glossary/resolve";
import { generateProblem } from "../src/math/engine";

const TEMPLATE = "pythagorean-converse";
const lesson = problemLesson(TEMPLATE, "glossary-review");
const problem = generateProblem(TEMPLATE, "glossary-review");
const context = lessonGlossaryContext(TEMPLATE);
const band = screenBand(TEMPLATE);
const explanation = {
  explanation: problem.explanation,
  ...glossaryPayload(problem.explanation, context, [], band),
};
// This lesson's hints use only words a grade 8 learner knows, so the hint
// view uses a problem type whose hint names a word it teaches.
const HINT_TEMPLATE = "add-fractions";
const hintProblem = generateProblem(HINT_TEMPLATE, "glossary-review");
const hint = {
  hint: hintProblem.hint,
  ...glossaryPayload(
    [hintProblem.hint],
    lessonGlossaryContext(HINT_TEMPLATE),
    [],
    screenBand(HINT_TEMPLATE),
  ),
};
// Words a grade 3+ screen already knows: never linked on it, only in cards.
const known = glossary
  .filter((entry) => ["K", "1", "2"].includes(entry.band))
  .map((entry) => entry.id);
assert.ok(band && !["K", "1", "2"].includes(band), "a grade 3+ lesson");
assert.ok(
  lesson.keyWords && lesson.keyWords.length > 6,
  "the lesson has more key words than the strip shows",
);
for (const [name, payload] of [
  ["lesson", lesson],
  ["explanation", explanation],
  ["hint", hint],
] as const)
  assert.ok(payload.glossary.length > 0, `${name} has no term cards`);

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ProblemLesson} from '/src/web/ProblemLesson.tsx';
import {FocusDialog} from '/src/web/PracticeWorkspace.tsx';
import {MathText} from '/src/web/MathText.tsx';
import {Glossary} from '/src/web/ui/Glossary.tsx';
import '/src/web/app/styles.ts';
const lesson=${JSON.stringify(lesson)};
const explanation=${JSON.stringify(explanation)};
const hint=${JSON.stringify(hint)};
const mode=new URLSearchParams(location.search).get('mode');
function App(){
  const close=()=>{};
  if(mode==='lesson') return <main style={{maxWidth:720,margin:'auto',padding:12}}><section className="lesson-sheet"><h2>{lesson.title}</h2><ProblemLesson lesson={lesson}/></section></main>;
  return <main style={{maxWidth:720,margin:'auto',padding:12}}><p>Practice</p>
    {mode==='modal' && <FocusDialog title={lesson.title} close={close}><ProblemLesson lesson={lesson}/></FocusDialog>}
    {mode==='explanation' && <FocusDialog title="Explanation" close={close}><Glossary payload={explanation} texts={explanation.explanation}><ol className="feedback-steps" aria-label="Explanation">{explanation.explanation.map((s,i)=><li key={i}><MathText text={s}/></li>)}</ol></Glossary></FocusDialog>}
    {mode==='hint' && <FocusDialog title="Hint" close={close}><Glossary payload={hint} texts={[hint.hint]}><p className="hint"><MathText text={hint.hint}/></p></Glossary></FocusDialog>}
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;

const server = httpServer();
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  server: { middlewareMode: true, hmr: { server } },
  appType: "custom",
  logLevel: "warn",
  plugins: [
    {
      name: "glossary-review",
      resolveId(id) {
        if (id === "/glossary-review-entry.tsx") return id;
      },
      load(id) {
        if (id === "/glossary-review-entry.tsx") return entry;
      },
      configureServer(vite) {
        vite.middlewares.use("/glossary-review", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await vite.transformIndexHtml(
              "/glossary-review",
              '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Glossary review</title></head><body><div id="root"></div><script type="module" src="/glossary-review-entry.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
});
server.on("request", vite.middlewares);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const output = process.env.AMP_GLOSSARY_UI_OUTPUT ?? "/tmp/amp-glossary-ui";
await mkdir(output, { recursive: true });

const WIDTHS = process.env.AMP_GLOSSARY_UI_WIDTHS?.split(",").map(Number) ?? [
  320, 390, 768, 1024, 1280,
];
const MODES = ["lesson", "modal", "explanation", "hint"] as const;
/** The screenshots kept for review: every width with a lesson card open in
 * Chromium, the rest at a phone and a desktop width. */
const kept = (
  engine: string,
  width: number,
  scheme: string,
  mode: string,
  step: string,
) =>
  (engine === "chromium" && mode === "modal" && step === "open") ||
  (engine === "chromium" && mode === "lesson" && step === "page") ||
  (engine === "chromium" &&
    mode === "lesson" &&
    step === "list" &&
    [390, 1280].includes(width)) ||
  ([390, 1280].includes(width) &&
    ((engine === "chromium" &&
      ((mode === "modal" && step === "drill") ||
        (mode !== "modal" && step === "open") ||
        (mode === "lesson" && step === "page"))) ||
      (engine === "webkit" &&
        mode === "modal" &&
        step === "open" &&
        scheme === "light")));

/** Every element's box outside the card: equal snapshots mean nothing on
 * the page moved. */
const snapshot = (page: Page) =>
  page.evaluate(() =>
    [...document.body.querySelectorAll("*")]
      .filter((el) => !el.closest(".term-dialog"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}`;
      })
      .join(";"),
  );
const shifts = (page: Page) =>
  page.evaluate(() => (window as unknown as { cls?: number }).cls ?? 0);

async function assertTargets(page: Page, label: string) {
  const small = await page.evaluate(() => {
    const out: string[] = [];
    // Card controls and key-word chips are boxes of at least 44 px.
    for (const el of document.querySelectorAll<HTMLElement>(
      ".term-dialog[open] .term-card-back, .term-dialog[open] .term-card-close, .key-word",
    )) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.width < 44 || r.height < 44))
        out.push(`${el.className} ${r.width}x${r.height}`);
    }
    // A word's hit area reaches 22 px from its center in each direction.
    const scope = document.querySelector(".term-dialog[open]") ?? document;
    for (const el of scope.querySelectorAll<HTMLElement>(".glossary-term")) {
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
      // A scrolling panel clips what it scrolls: test only inside it.
      let clip = el.parentElement;
      while (
        clip &&
        !/(auto|scroll|hidden)/.test(getComputedStyle(clip).overflowY)
      )
        clip = clip.parentElement;
      const box = clip?.getBoundingClientRect() ?? {
        left: 0,
        top: 0,
        right: innerWidth,
        bottom: innerHeight,
      };
      const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      for (const [dx, dy] of [
        [0, -21],
        [0, 21],
        [-21, 0],
        [21, 0],
      ]) {
        const x = cx + dx!,
          y = cy + dy!;
        if (x < box.left || y < box.top || x >= box.right || y >= box.bottom)
          continue;
        const hit = document.elementFromPoint(x, y)?.closest(".glossary-term");
        // A neighbouring word's own area may win the overlap; open text never.
        if (!hit) out.push(`${el.textContent} misses (${dx},${dy})`);
      }
    }
    return out;
  });
  assert.deepEqual(small, [], `${label}: targets under 44 px`);
}

async function assertCard(page: Page, label: string, width: number) {
  const card = await page.evaluate(() => {
    const panel = document.querySelector(".term-dialog[open] .term-card")!;
    const r = panel.getBoundingClientRect();
    return {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      vw: document.documentElement.clientWidth,
      vh: innerHeight,
    };
  });
  assert.ok(
    card.left >= -0.5 &&
      card.top >= -0.5 &&
      card.right <= card.vw + 0.5 &&
      card.bottom <= card.vh + 0.5,
    `${label}: card outside the viewport ${JSON.stringify(card)}`,
  );
  if (width < 768)
    assert.ok(
      Math.abs(card.bottom - card.vh) < 1 && card.left < 1,
      `${label}: a phone shows a bottom sheet`,
    );
  else assert.ok(card.right - card.left <= 401, `${label}: an anchored card`);
}

async function assertNoOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() =>
    [
      document.documentElement,
      ...document.querySelectorAll(
        ".dialog-content, .term-card, .problem-lesson",
      ),
    ]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map(
        (el) =>
          `${el.className || el.tagName} ${el.scrollWidth}>${el.clientWidth}`,
      ),
  );
  assert.deepEqual(overflow, [], `${label}: horizontal overflow`);
}

/** Only words the screen is teaching are linked; the key-word strip shows at
 * most six words in at most two rows, none clipped. */
async function assertDensity(page: Page, label: string, mode: string) {
  const found = await page.evaluate((known) => {
    const linked = [
      ...document.querySelectorAll<HTMLElement>(".glossary-term"),
    ].map((el) => el.dataset.termId!);
    const chips = [
      ...document.querySelectorAll<HTMLElement>(
        ".key-words .key-word:not(.key-word-more)",
      ),
    ];
    const more = document.querySelector<HTMLElement>(".key-word-more");
    const strip = document.querySelector(".key-words ul");
    const box = strip?.getBoundingClientRect();
    const items = [...(strip?.children ?? [])] as HTMLElement[];
    return {
      known: linked.filter((id) => known.includes(id)),
      linked: linked.length,
      chips: chips.length,
      ids: chips.map((c) => c.dataset.termId!),
      more: more?.textContent ?? null,
      rows: new Set(items.map((i) => Math.round(i.getBoundingClientRect().top)))
        .size,
      clipped: [...chips, ...(more ? [more] : [])]
        .filter((c) => {
          const r = c.getBoundingClientRect();
          return (
            !box ||
            r.left < box.left - 0.5 ||
            r.right > box.right + 0.5 ||
            c.scrollWidth > c.clientWidth + 1
          );
        })
        .map((c) => c.textContent),
    };
  }, known);
  assert.deepEqual(found.known, [], `${label}: known words are linked`);
  assert.ok(found.linked > 0, `${label}: no words linked`);
  if (mode !== "lesson" && mode !== "modal") return;
  const words = lesson.keyWords!;
  assert.ok(
    found.chips >= 1 && found.chips <= 6,
    `${label}: ${found.chips} chips`,
  );
  assert.ok(found.rows <= 2, `${label}: key words take ${found.rows} rows`);
  assert.deepEqual(found.ids, words.slice(0, found.chips), `${label}: order`);
  assert.equal(found.more, `+${words.length - found.chips} more`);
  assert.deepEqual(found.clipped, [], `${label}: clipped key words`);
}

/** "+N more" opens every key word as a card; a word drills down and Back
 * returns to the list. */
async function assertMoreList(
  page: Page,
  label: string,
  shot: (step: string) => Promise<void>,
) {
  const more = page.locator(".key-word-more");
  const before = await snapshot(page);
  await more.click();
  const dialog = page.locator(".term-dialog[open]");
  await dialog.getByRole("heading", { name: "Key words" }).waitFor();
  await page.waitForTimeout(350); // let the sheet finish rising
  const listed = await dialog
    .locator(".term-card-list .key-word")
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.termId));
  assert.deepEqual(listed, lesson.keyWords, `${label}: the full list`);
  await shot("list");
  await assertCard(page, `${label} list`, page.viewportSize()!.width);
  await dialog.locator(".term-card-list .key-word").last().click();
  await dialog.getByRole("button", { name: "Back to Key words" }).click();
  await dialog.getByRole("heading", { name: "Key words" }).waitFor();
  assert.equal(await snapshot(page), before, `${label}: list shifts`);
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.ok(
    await more.evaluate((el) => el === document.activeElement),
    `${label}: the list returns focus to "+N more"`,
  );
}

const metrics: unknown[] = [];
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch();
    try {
      for (const width of WIDTHS)
        for (const colorScheme of ["light", "dark"] as const)
          for (const mode of MODES) {
            const label = `${engine.name()} ${width} ${colorScheme} ${mode}`;
            console.log(label);
            const browserContext = await browser.newContext({
              viewport: { width, height: width < 768 ? 844 : 900 },
              colorScheme,
            });
            const page = await browserContext.newPage();
            const errors: string[] = [];
            page.on("pageerror", (e) => errors.push(e.message));
            page.on("console", (m) => {
              if (m.type() === "error") errors.push(m.text());
            });
            await page.addInitScript(() => {
              const w = window as unknown as { cls: number };
              w.cls = 0;
              try {
                new PerformanceObserver((list) => {
                  for (const e of list.getEntries() as unknown as {
                    value: number;
                    hadRecentInput: boolean;
                  }[])
                    if (!e.hadRecentInput) w.cls += e.value;
                }).observe({ type: "layout-shift", buffered: false });
              } catch {
                // WebKit has no layout-shift entries; box snapshots cover it.
              }
            });
            await page.goto(
              `http://127.0.0.1:${address.port}/glossary-review?mode=${mode}`,
            );
            await page.locator(".glossary-term").first().waitFor();
            await page.evaluate(() => document.fonts.ready);
            const shot = async (step: string) => {
              if (kept(engine.name(), width, colorScheme, mode, step))
                await page.screenshot({
                  path: `${output}/${mode}-${step}-${width}-${colorScheme}-${engine.name()}.png`,
                });
            };
            await assertNoOverflow(page, label);
            await assertTargets(page, label);
            await assertDensity(page, label, mode);
            await shot("page");
            if (mode === "lesson" || mode === "modal")
              await assertMoreList(page, label, shot);

            // The word to open: hypotenuse where it is linked, else the first.
            const origin = (await page
              .locator('.glossary-term[data-term-id="hypotenuse"]')
              .count())
              ? page
                  .locator('.glossary-term[data-term-id="hypotenuse"]')
                  .first()
              : page.locator(".glossary-term").first();
            await origin.scrollIntoViewIfNeeded();
            await page.waitForTimeout(50);
            const termId = await origin.getAttribute("data-term-id");
            const before = await snapshot(page);
            const clsBefore = await shifts(page);

            await origin.click();
            const dialog = page.locator(".term-dialog[open]");
            await dialog.waitFor();
            await page.waitForTimeout(350); // let the opening motion finish
            const heading = dialog.getByRole("heading", { level: 2 });
            const title = await heading.innerText();
            assert.ok(
              await heading.evaluate((h) => h === document.activeElement),
              `${label}: focus moves to the card`,
            );
            assert.equal(await snapshot(page), before, `${label}: open shifts`);
            await assertCard(page, label, width);
            await assertTargets(page, `${label} card`);
            await assertNoOverflow(page, `${label} card`);
            const axe = await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa"])
              .analyze();
            assert.deepEqual(
              axe.violations.map(
                (v) => `${v.id}: ${v.nodes.map((n) => n.target).join(" ")}`,
              ),
              [],
              `${label}: axe`,
            );
            await shot("open");

            // Drill into a word of the definition, then come back.
            const inner = dialog
              .locator(".term-card-body .glossary-term")
              .first();
            const drilled = (await inner.count())
              ? await inner.getAttribute("data-term-id")
              : null;
            if (drilled) {
              const dialogBox = await dialog.boundingBox();
              await inner.click();
              await dialog
                .getByRole("button", { name: `Back to ${title}` })
                .waitFor();
              await page.waitForTimeout(300);
              assert.notEqual(await heading.innerText(), title);
              assert.deepEqual(await dialog.boundingBox(), dialogBox);
              assert.equal(
                await snapshot(page),
                before,
                `${label}: drill shifts`,
              );
              await assertCard(page, `${label} drill`, width);
              await assertTargets(page, `${label} drill`);
              await shot("drill");
              await dialog
                .getByRole("button", { name: `Back to ${title}` })
                .click();
              await page.waitForTimeout(300);
              assert.equal(await heading.innerText(), title);
              assert.equal(
                await page.evaluate(
                  () => (document.activeElement as HTMLElement)?.dataset.termId,
                ),
                drilled,
                `${label}: Back refocuses the word drilled from`,
              );
              assert.equal(
                await snapshot(page),
                before,
                `${label}: back shifts`,
              );
            }

            // Escape closes the card only, and the word takes focus back.
            await page.keyboard.press("Escape");
            await dialog.waitFor({ state: "detached" });
            assert.equal(
              await page.evaluate(
                () => (document.activeElement as HTMLElement)?.dataset.termId,
              ),
              termId,
              `${label}: Escape returns focus`,
            );
            if (mode !== "lesson")
              assert.equal(
                await page.locator("dialog.practice-dialog[open]").count(),
                1,
                `${label}: the panel beneath stays open`,
              );
            assert.equal(
              await snapshot(page),
              before,
              `${label}: close shifts`,
            );

            // From the keyboard: Enter opens, Close closes, focus returns.
            await origin.focus();
            await page.keyboard.press("Enter");
            await dialog.waitFor();
            await dialog.getByRole("button", { name: "Close" }).click();
            await dialog.waitFor({ state: "detached" });
            assert.ok(
              await origin.evaluate((el) => el === document.activeElement),
              `${label}: Close returns focus`,
            );

            // A phone's sheet closes when dragged down by its grab area.
            if (width === 390 && mode === "lesson") {
              await origin.click();
              await dialog.waitFor();
              await page.waitForTimeout(350);
              const grab = (await dialog
                .locator(".term-card-grab")
                .boundingBox())!;
              assert.ok(grab.height >= 44, `${label}: grab area`);
              await page.mouse.move(grab.x + grab.width / 2, grab.y + 22);
              await page.mouse.down();
              await page.mouse.move(grab.x + grab.width / 2, grab.y + 160, {
                steps: 6,
              });
              await page.mouse.up();
              await dialog.waitFor({ state: "detached" });
            }

            const cls = (await shifts(page)) - clsBefore;
            assert.equal(cls, 0, `${label}: cumulative layout shift`);
            assert.deepEqual(errors, [], `${label}: console errors`);
            metrics.push({
              browser: engine.name(),
              width,
              colorScheme,
              mode,
              term: termId,
              drilled,
              cls,
            });
            await browserContext.close();
          }
    } finally {
      await browser.close();
    }
  }
  await writeFile(`${output}/metrics.json`, JSON.stringify(metrics, null, 2));
  console.log(`Verified ${metrics.length} glossary views; evidence: ${output}`);
} finally {
  await vite.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
