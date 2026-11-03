import { secureChromium } from "../browser-security.mjs";
/**
 * Lesson reading rhythm in a real browser. The production components and the
 * app's global cascade render a problem type's short lesson in the practice
 * panel and on its own lesson page, and a full lesson in the library reader,
 * at 320/390/768/1280 px in light and dark (Chromium; WebKit at 390 and
 * 1280).
 *
 * Asserts: no horizontal overflow; body copy at a line height of at least
 * 1.6; a reading measure of at most 75 characters; one aligned definition
 * column (or a stacked term over its meaning); space between the principle
 * and the definitions; spaced example and method steps; glossary words that
 * leave the line box unchanged; and inline mathematics that never collides
 * with the text on the lines above or below it. Screenshots go to
 * AMP_LESSON_READING_OUTPUT (default /tmp/amp-lesson-reading).
 *
 *   npx tsx scripts/verify-lesson-reading-ui.ts [--widths 390,1280] [--engine chromium] [--only id,id]
 *   AMP_LESSON_READING_PORT=4622 npx tsx scripts/verify-lesson-reading-ui.ts --serve
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer as httpServer } from "node:http";
import { parseArgs } from "node:util";
import { chromium as rawChromium, webkit, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { lessons } from "../src/content/lessons";
import { problemLesson } from "../src/content/problem-lessons";

const { values } = parseArgs({
  options: {
    widths: { type: "string" },
    engine: { type: "string" },
    only: { type: "string" },
    serve: { type: "boolean" },
  },
});

/** Problem types chosen for what stresses a reading surface: the founder's
 * report (exclusions and a long definitions list), nine definitions, a
 * 30-letter term, a stack of fractions, radicals, a multi-part example, an
 * early-grade lesson, a lesson video and an animated model. */
const PROBLEMS = [
  "rational-expression-simplify",
  "quadrilateral-hierarchy-multiselect",
  "relative-frequency-percent",
  "mcas-fraction-rate-select",
  "rationalize-radical-denominator",
  "proportional-match-table",
  "name-flat-shape",
  "add-fractions",
  "unit-cube-volume",
];
/** Full lessons: heavy fractions with an illustration, a long illustrated
 * method, a graph in the worked example, and an early-grade lesson. */
const REFERENCES = [
  "complex-fraction",
  "nonmonic-quadratic-factorization",
  "plot-points",
  lessons.find((lesson) =>
    lesson.templateIds.some((id) => id === "name-flat-shape"),
  )?.id ?? lessons[0]!.id,
];
for (const id of REFERENCES)
  assert.ok(
    lessons.some((lesson) => lesson.id === id),
    `unknown lesson ${id}`,
  );

type View = { mode: "dialog" | "sheet" | "reader"; id: string };
const only = values.only?.split(",");
const VIEWS: View[] = [
  ...PROBLEMS.flatMap((id) => [
    { mode: "dialog" as const, id },
    { mode: "sheet" as const, id },
  ]),
  ...REFERENCES.map((id) => ({ mode: "reader" as const, id })),
].filter((view) => !only || only.includes(view.id));

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ProblemLesson} from '/src/web/ProblemLesson.tsx';
import {FocusDialog} from '/src/web/PracticeWorkspace.tsx';
import {ReferenceLesson} from '/src/content/ReferenceLesson.tsx';
import {printMathStyles} from '/src/content/PrintMathText.tsx';
import '/src/web/app/styles.ts';
const query=new URLSearchParams(location.search);
const mode=query.get('mode');
const lesson=await (await fetch('/lesson-reading-data?'+query)).json();
function App(){
  if(mode==='reader') return <div className="shell app-shell"><main className="library-main"><article className="card lesson-reader"><style>{printMathStyles+'.lesson-reader .worked-example li{padding:5px 0;line-height:1.6}'}</style><div className="card-top"><button className="text-button">← All lessons</button><button className="text-button">Print lesson</button></div><h2>{lesson.title}</h2><ReferenceLesson lesson={lesson}/></article></main></div>;
  if(mode==='sheet') return <div className="shell app-shell"><main className="library-main"><section className="lesson-sheet"><div className="lesson-sheet-bar"><button className="text-button">← All lessons</button></div><h2>{lesson.title}</h2><ProblemLesson lesson={lesson}/><button className="lesson-practice">Practice this</button></section></main></div>;
  return <div className="shell app-shell"><main className="practice-workspace"><p>Practice</p><FocusDialog title={lesson.title} close={()=>{}}><ProblemLesson lesson={lesson}/><button className="lesson-return">Back to the problem</button></FocusDialog></main></div>;
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
      name: "lesson-reading",
      resolveId(id) {
        if (id === "/lesson-reading-entry.tsx") return id;
      },
      load(id) {
        if (id === "/lesson-reading-entry.tsx") return entry;
      },
      configureServer(vite) {
        vite.middlewares.use("/lesson-reading-data", (req, res) => {
          const query = new URL(req.url ?? "/", "http://localhost")
            .searchParams;
          const id = query.get("id") ?? "";
          const payload =
            query.get("mode") === "reader"
              ? lessons.find((lesson) => lesson.id === id)
              : problemLesson(id, "lesson-reading");
          if (!payload) {
            console.error(`Unknown lesson ${id}`);
            res.statusCode = 404;
            res.end("Unknown lesson");
            return;
          }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        });
        vite.middlewares.use("/lesson-reading", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await vite.transformIndexHtml(
              "/lesson-reading",
              '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Lesson reading</title></head><body><div id="root"></div><script type="module" src="/lesson-reading-entry.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
});
server.on("request", vite.middlewares);
await new Promise<void>((resolve) =>
  server.listen(
    Number(process.env.AMP_LESSON_READING_PORT ?? 0),
    "127.0.0.1",
    resolve,
  ),
);
const address = server.address();
assert(address && typeof address !== "string");
if (values.serve) {
  // Browse the views by hand: ?mode=dialog|sheet|reader&id=<lesson>.
  console.log(
    `http://127.0.0.1:${address.port}/lesson-reading?mode=dialog&id=${PROBLEMS[0]}`,
  );
  await new Promise(() => {});
}
const output =
  process.env.AMP_LESSON_READING_OUTPUT ?? "/tmp/amp-lesson-reading";
await mkdir(output, { recursive: true });

const WIDTHS = values.widths?.split(",").map(Number) ?? [320, 390, 768, 1280];

/** Every reading measurement for the page, as a list of failures. */
const measure = (page: Page) =>
  page.evaluate(() => {
    const failures: string[] = [];
    const root =
      document.querySelector(".problem-lesson, .reference-lesson") ??
      document.body;
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""} "${(el.textContent ?? "").trim().slice(0, 40)}"`;

    for (const el of [
      document.documentElement,
      ...document.querySelectorAll(
        ".dialog-content, .problem-lesson, .reference-lesson, .lesson-terms",
      ),
    ])
      if (el.scrollWidth > el.clientWidth + 1)
        failures.push(
          `overflow ${name(el)} ${el.scrollWidth}>${el.clientWidth}`,
        );

    // Body copy: line height and measure.
    const prose = [...root.querySelectorAll<HTMLElement>("p, li, dd")].filter(
      (el) =>
        el.getClientRects().length &&
        !el.closest(
          ".key-words, .figure, .scene-player, .lesson-video, .lesson-blank, .lesson-example-blanks, svg",
        ),
    );
    for (const el of prose) {
      const style = getComputedStyle(el);
      const size = parseFloat(style.fontSize);
      const line = parseFloat(style.lineHeight);
      if (!(line / size >= 1.595))
        failures.push(
          `line-height ${name(el)} ${style.lineHeight}/${style.fontSize}`,
        );
      const width =
        el.getBoundingClientRect().width -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight) -
        parseFloat(style.borderLeftWidth) -
        parseFloat(style.borderRightWidth);
      // About 75 characters of body text at an average glyph of 0.5 em.
      if (width / size > 38.5)
        failures.push(`measure ${name(el)} ${Math.round(width / size)}em`);
    }

    // Definitions: one column of meanings, or a term over its meaning.
    for (const list of root.querySelectorAll(".lesson-terms")) {
      const rows = [...list.querySelectorAll(":scope > div")].map((row) => ({
        dt: row.querySelector("dt")!.getBoundingClientRect(),
        dd: row.querySelector("dd")!.getBoundingClientRect(),
        term: row.querySelector("dt")!,
      }));
      const stacked = rows.every((r) => r.dd.top >= r.dt.bottom - 1);
      const lefts = new Set(rows.map((r) => Math.round(r.dd.left)));
      const termLefts = new Set(rows.map((r) => Math.round(r.dt.left)));
      if (lefts.size > 1 || termLefts.size > 1)
        failures.push(`definitions misaligned ${[...lefts].join(",")}`);
      if (!stacked && rows.some((r) => r.dd.left < r.dt.right + 12))
        failures.push("definitions crowd their terms");
      for (const r of rows)
        if (r.term.scrollWidth > r.term.clientWidth + 1)
          failures.push(`term clipped ${name(r.term)}`);
      // Every term reads whole: no word breaks across lines.
      for (const r of rows) {
        const words = (r.term.textContent ?? "").trim().split(/\s+/);
        const range = document.createRange();
        range.selectNodeContents(r.term);
        const lines = new Set(
          [...range.getClientRects()].map((rect) => Math.round(rect.top)),
        ).size;
        if (lines > words.length)
          failures.push(`term breaks inside a word ${name(r.term)}`);
      }
    }
    for (const principle of root.querySelectorAll(".lesson-principle")) {
      const next = principle.nextElementSibling;
      if (!next) continue;
      const gap =
        next.getBoundingClientRect().top -
        principle.getBoundingClientRect().bottom;
      if (gap < 12) failures.push(`principle touches definitions (${gap}px)`);
    }

    // Steps: each one reads as its own item.
    for (const list of root.querySelectorAll("ol, ul")) {
      if (list.closest(".key-words, .lesson-example-blanks")) continue;
      const items = [...list.children].filter(
        (el) => el.tagName === "LI" && el.getClientRects().length,
      );
      for (let i = 1; i < items.length; i++) {
        const gap =
          items[i]!.getBoundingClientRect().top -
          items[i - 1]!.getBoundingClientRect().bottom;
        if (gap < 6) failures.push(`steps touch ${name(items[i]!)} ${gap}px`);
      }
    }

    // Lines and their contents.
    const textRects = (block: Element) => {
      const rects: DOMRect[] = [];
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (
          !parent ||
          parent.closest(".katex, .glossary-term-mark, .print-math") ||
          !node.textContent?.trim()
        )
          continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        rects.push(...[...range.getClientRects()].filter((r) => r.width > 1));
      }
      return rects;
    };
    for (const block of prose) {
      const style = getComputedStyle(block);
      const line = parseFloat(style.lineHeight);
      const maths = [...block.querySelectorAll(".katex-html")].filter(
        (m) => !m.closest(".katex-display"),
      );
      const texts = textRects(block);
      // A glossary word and its "?" never change the line box: a block of
      // plain text and words is a whole number of lines tall.
      if (!maths.length && block.querySelector(".glossary-term")) {
        const box = block.getBoundingClientRect();
        const content =
          box.height -
          parseFloat(style.paddingTop) -
          parseFloat(style.paddingBottom) -
          parseFloat(style.borderTopWidth) -
          parseFloat(style.borderBottomWidth) -
          // A block label (a callout's "Watch for") is not a line of text.
          [...block.children]
            .filter((child) => getComputedStyle(child).display === "block")
            .reduce((sum, child) => {
              const own = getComputedStyle(child);
              return (
                sum +
                child.getBoundingClientRect().height +
                parseFloat(own.marginTop) +
                parseFloat(own.marginBottom)
              );
            }, 0);
        const lines = Math.round(content / line);
        if (Math.abs(content - lines * line) > 1.5)
          failures.push(
            `glossary word changes a line ${name(block)} ${content}/${line}`,
          );
      }
      // Mathematics clears the lines above and below it.
      for (const math of maths) {
        // The formula's extent is the union of its glyph boxes: a numerator
        // or root can reach past the box KaTeX reserves for it.
        const box = math.getBoundingClientRect();
        if (!box.width) continue;
        const m = {
          top: box.top,
          bottom: box.bottom,
          left: box.left,
          right: box.right,
        };
        for (const part of math.querySelectorAll(
          ".mord, .mop, .mbin, .mrel, .mpunct, .frac-line, .svg-align",
        )) {
          const r = part.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          m.top = Math.min(m.top, r.top);
          m.bottom = Math.max(m.bottom, r.bottom);
        }
        for (const t of texts) {
          const centre = (t.top + t.bottom) / 2;
          const sameLine = centre >= m.top && centre <= m.bottom;
          const horizontal = t.right > m.left + 1 && t.left < m.right - 1;
          const vertical = t.bottom > m.top + 1 && t.top < m.bottom - 1;
          if (!sameLine && horizontal && vertical)
            failures.push(
              `math collides with a neighbouring line ${name(block)}`,
            );
        }
      }
    }
    return [...new Set(failures)];
  });

const metrics: string[] = [];
const engines =
  values.engine === "webkit"
    ? [webkit]
    : values.engine === "chromium"
      ? [chromium]
      : [chromium, webkit];
let failed = 0;
try {
  for (const engine of engines) {
    const browser = await engine.launch();
    try {
      const widths =
        engine === webkit && !values.widths
          ? WIDTHS.filter((w) => w === 390 || w === 1280)
          : WIDTHS;
      for (const width of widths)
        for (const colorScheme of ["light", "dark"] as const) {
          const context = await browser.newContext({
            viewport: { width, height: width < 768 ? 844 : 900 },
            colorScheme,
            reducedMotion: "reduce",
          });
          // tsx names the measuring functions with a helper the page lacks.
          await context.addInitScript(
            "globalThis.__name = (target) => target;",
          );
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (e) => errors.push(e.message));
          page.on("console", (m) => {
            if (m.type() === "error") errors.push(m.text());
          });
          for (const view of VIEWS) {
            const label = `${engine.name()} ${width} ${colorScheme} ${view.mode} ${view.id}`;
            await page.goto(
              `http://127.0.0.1:${address.port}/lesson-reading?mode=${view.mode}&id=${view.id}`,
            );
            await page
              .locator(
                view.mode === "reader"
                  ? ".reference-lesson"
                  : ".problem-lesson",
              )
              .waitFor();
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(150);
            const found = await measure(page);
            if (found.length) {
              failed++;
              console.error(`${label}\n  ${found.join("\n  ")}`);
            }
            const shot = `${output}/${view.mode}-${view.id}-${width}-${colorScheme}-${engine.name()}.png`;
            // Panels and the app's main area scroll inside themselves: grow
            // the window to show all of the lesson, capture, then restore it.
            const height = await page.evaluate(() => {
              const dialog =
                document.querySelector<HTMLElement>(".practice-dialog");
              // A tablet or desktop panel is a card with a capped height; a
              // phone's fills the screen, which the window grows with.
              if (dialog && innerWidth > 840) {
                dialog.style.maxHeight = "none";
                return Math.ceil(dialog.getBoundingClientRect().height) + 48;
              }
              let extra = 0;
              for (const el of document.querySelectorAll("*"))
                if (/(auto|scroll)/.test(getComputedStyle(el).overflowY))
                  extra = Math.max(extra, el.scrollHeight - el.clientHeight);
              return Math.max(
                document.documentElement.scrollHeight,
                innerHeight + extra,
              );
            });
            const viewport = page.viewportSize()!;
            await page.setViewportSize({
              width: viewport.width,
              height: Math.max(viewport.height, height),
            });
            // Let the larger window lay out and paint before the capture.
            await page.evaluate(
              () =>
                new Promise((done) =>
                  requestAnimationFrame(() => requestAnimationFrame(done)),
                ),
            );
            await page.screenshot({ path: shot });
            await page.setViewportSize(viewport);
            metrics.push(label);
          }
          assert.deepEqual(errors, [], `${width} ${colorScheme} page errors`);
          await context.close();
        }
    } finally {
      await browser.close();
    }
  }
} finally {
  await vite.close();
  server.close();
}
assert.equal(failed, 0, `${failed} lesson views failed; see above`);
console.log(`${metrics.length} lesson views checked; screenshots in ${output}`);
