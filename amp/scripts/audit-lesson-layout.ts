/** Render every reference and short problem lesson with production components.
 * This audit needs no API or database. Set AMP_LESSON_AUDIT_OUTPUT to an
 * external evidence directory before running it. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, firefox, webkit } from "playwright";
import { createServer } from "vite";
import { lessons } from "../src/content/lessons";
import { problemLesson } from "../src/content/problem-lessons";
import { templates } from "../src/math/engine";

const output = process.env.AMP_LESSON_AUDIT_OUTPUT;
if (!output) throw new Error("AMP_LESSON_AUDIT_OUTPUT is required");
if (process.env.NODE_ENV === "production")
  throw new Error("Lesson layout audit is local development only");
const browserName = process.env.AMP_LESSON_AUDIT_BROWSER ?? "chromium";
assert(
  browserName === "chromium" ||
    browserName === "firefox" ||
    browserName === "webkit",
  "AMP_LESSON_AUDIT_BROWSER must be chromium, firefox, or webkit",
);
await mkdir(output, { recursive: true });
const ampRoot = new URL("../", import.meta.url).pathname;
const sourceState = () => ({
  head: execFileSync("git", ["-C", ampRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  sourceDiffSha256: createHash("sha256")
    .update(execFileSync("git", ["-C", ampRoot, "diff", "HEAD", "--", "src"]))
    .digest("hex"),
});
const initialSource = sourceState();

const items = [
  ...lessons.map((lesson) => ({
    id: lesson.id,
    kind: "reference" as const,
    title: lesson.title,
    lesson,
  })),
  ...templates.map((template) => ({
    id: template.id,
    kind: "problem" as const,
    title: template.title,
    lesson: problemLesson(template.id, "lesson-layout-audit"),
  })),
];
assert.equal(
  new Set(
    items.filter((item) => item.kind === "reference").map((item) => item.id),
  ).size,
  lessons.length,
);
assert.equal(
  new Set(
    items.filter((item) => item.kind === "problem").map((item) => item.id),
  ).size,
  templates.length,
);
const selectedIds = new Set(
  (process.env.AMP_LESSON_AUDIT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);
const selected = selectedIds.size
  ? items.filter((item) => selectedIds.has(item.id))
  : items;
assert.equal(
  new Set(selected.map((item) => `${item.kind}:${item.id}`)).size,
  selected.length,
);
for (const id of selectedIds)
  assert(
    selected.some((item) => item.id === id),
    `Unknown lesson ID: ${id}`,
  );
const limit = Number(process.env.AMP_LESSON_AUDIT_LIMIT ?? selected.length);
assert(Number.isInteger(limit) && limit > 0 && limit <= selected.length);

const vite = await createServer({
  server: { host: "127.0.0.1", port: 0, cors: false, hmr: false },
  plugins: [
    {
      name: "all-lesson-layout-audit",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const host = request.headers.host;
          const requestOrigin = request.headers.origin;
          if (
            !host?.startsWith("127.0.0.1:") ||
            request.headers["sec-fetch-site"] === "cross-site" ||
            (requestOrigin && requestOrigin !== `http://${host}`)
          ) {
            response.statusCode = 403;
            response.end("Open the loopback lesson audit directly.");
            return;
          }
          if (request.url !== "/__all-lesson-layout") return next();
          response.setHeader("Cache-Control", "no-store");
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(
            await server.transformIndexHtml(
              request.url,
              `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {ReferenceLesson} from '/src/content/ReferenceLesson.tsx';
import {ProblemLesson} from '/src/web/ProblemLesson.tsx';
import '/src/web/app/styles.ts';
const root=createRoot(document.getElementById('root'));
window.renderAuditLesson=(item,theme)=>{
  document.documentElement.dataset.theme=theme;
  const Component=item.kind==='reference'?ReferenceLesson:ProblemLesson;
  flushSync(()=>root.render(React.createElement('main',{style:{padding:12,maxWidth:760,margin:'0 auto'}},
    React.createElement('article',{className:'card lesson-reader','data-audit-id':item.id},
      React.createElement('h2',null,item.title),React.createElement(Component,{lesson:item.lesson})))));
};
</script></body></html>`,
            ),
          );
        });
      },
    },
  ],
});
await vite.listen();
const address = vite.httpServer?.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}/__all-lesson-layout`;
const browser = await { chromium, firefox, webkit }[browserName].launch();
type Finding = {
  id: string;
  kind: "reference" | "problem";
  width: number;
  theme: "light" | "dark";
  issues: string[];
};
const findings: Finding[] = [];
const views = [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
];
let checked = 0;
let screenshots = 0;
try {
  for (const { width, height } of views)
    for (const theme of ["light", "dark"] as const) {
      const page = await browser.newPage({
        viewport: { width, height },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(origin);
      await page.evaluate("globalThis.__name ??= (f) => f");
      await page.waitForFunction(
        () => typeof (window as any).renderAuditLesson === "function",
      );
      for (const item of selected.slice(0, limit)) {
        await page.evaluate(
          ({ item, theme }) => {
            (window as any).renderAuditLesson(item, theme);
          },
          { item, theme },
        );
        await page.locator("[data-audit-id]").waitFor();
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
        });
        if (await page.locator('[aria-label="Loading example model"]').count())
          await page.locator('[aria-label="Loading example model"]').waitFor({
            state: "detached",
            timeout: 8000,
          });
        const issues = await page.evaluate((kind) => {
          const found: string[] = [];
          const card = document.querySelector<HTMLElement>("[data-audit-id]");
          if (!card) return ["Lesson did not render"];
          const bounds = card.getBoundingClientRect();
          if (document.documentElement.scrollWidth > innerWidth + 1)
            found.push(
              `Document horizontal overflow ${document.documentElement.scrollWidth - innerWidth}px`,
            );
          if (card.scrollWidth > card.clientWidth + 1)
            found.push(
              `Lesson card horizontal overflow ${card.scrollWidth - card.clientWidth}px`,
            );
          if (bounds.left < -1 || bounds.right > innerWidth + 1)
            found.push("Lesson card extends beyond viewport");
          const stages =
            kind === "reference"
              ? [
                  ...card.querySelectorAll<HTMLElement>("[data-lesson-stage]"),
                ].map((element) => element.dataset.lessonStage)
              : [
                  ".lesson-goal",
                  ".lesson-example",
                  ".lesson-method",
                  ".lesson-watch",
                  ".lesson-formal",
                ]
                  .filter((selector) => card.querySelector(selector))
                  .map((selector) => selector.slice(1));
          const expected =
            kind === "reference"
              ? ["intuition", "example", "method", "watch", "formal"]
              : [
                  "lesson-goal",
                  "lesson-example",
                  "lesson-method",
                  "lesson-watch",
                  "lesson-formal",
                ];
          if (JSON.stringify(stages) !== JSON.stringify(expected))
            found.push(`Teaching stages: ${stages.join(" > ")}`);
          const example = card.querySelector(
            kind === "reference" ? ".worked-example" : ".lesson-example",
          );
          if (!example || !example.querySelector("ol li"))
            found.push("Worked example or its steps are missing");
          if (card.querySelector(".katex-error"))
            found.push("KaTeX parse error");
          const visible = (element: Element) => {
            // Screen-reader transcripts are clipped to a 1px region. Their
            // mathematical descendants have large DOM rects but no pixels in
            // the lesson card.
            if (element.closest(".animation-transcript")) return false;
            const rect = element.getBoundingClientRect();
            for (
              let node: Element | null = element;
              node && node !== card;
              node = node.parentElement
            ) {
              const style = getComputedStyle(node);
              if (
                style.display === "none" ||
                style.visibility === "hidden" ||
                Number(style.opacity) < 0.01
              )
                return false;
            }
            return (
              rect.width > 1 &&
              rect.height > 1 &&
              !element.closest("[aria-hidden='true']")
            );
          };
          for (const element of card.querySelectorAll(
            ".math, .print-math, .katex, .scene-figure svg, .figure svg, svg text, table, img, canvas",
          )) {
            if (!visible(element)) continue;
            const rect = element.getBoundingClientRect();
            if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2)
              found.push(
                `${element.tagName.toLowerCase()}.${(element.getAttribute("class") ?? "").split(" ")[0]} extends ${Math.ceil(Math.max(bounds.left - rect.left, rect.right - bounds.right))}px beyond card: ${(element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 100)}`,
              );
            if (element.tagName.toLowerCase() === "text") {
              const svg = element.closest("svg");
              const viewport = svg?.getBoundingClientRect();
              if (
                viewport &&
                (rect.left < viewport.left - 2 ||
                  rect.right > viewport.right + 2 ||
                  rect.top < viewport.top - 2 ||
                  rect.bottom > viewport.bottom + 2)
              )
                found.push(
                  `SVG text label outside its figure: ${(element.textContent ?? "").trim().slice(0, 24)}`,
                );
            }
            if (found.length >= 8) break;
          }
          return found;
        }, item.kind);
        if (pageErrors.length)
          issues.push(`Browser errors: ${pageErrors.splice(0).join(" | ")}`);
        checked++;
        if (issues.length) {
          findings.push({ id: item.id, kind: item.kind, width, theme, issues });
          if (width === 320 && theme === "light" && screenshots < 10) {
            const name = `${item.kind}-${item.id}`.replace(/[^a-z0-9-]/gi, "-");
            await page.screenshot({
              path: join(output, `${name}-320-light.png`),
              fullPage: true,
            });
            screenshots++;
          }
        }
        if (checked % 200 === 0)
          console.log(
            `${checked}/${limit * views.length * 2} lesson views checked; ${findings.length} findings`,
          );
      }
      await page.close();
    }
} finally {
  await browser.close();
  await vite.close();
}
const result = {
  browser: browserName,
  source: initialSource,
  finalSource: sourceState(),
  referenceLessons: lessons.length,
  problemLessons: templates.length,
  checked,
  expected: limit * views.length * 2,
  findings,
};
await writeFile(
  join(output, "layout-results.json"),
  JSON.stringify(result, null, 2),
);
assert.deepEqual(
  result.finalSource,
  result.source,
  "Source changed during lesson layout audit",
);
console.log(`${checked} lesson views checked; ${findings.length} findings`);
if (findings.length) process.exitCode = 1;
