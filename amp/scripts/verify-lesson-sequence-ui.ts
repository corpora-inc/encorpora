import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium, firefox, webkit } from "playwright";
import { lessons } from "../src/content/lessons";
import { problemLesson } from "../src/content/problem-lessons";
import { publicationHtml } from "../src/content/publications";

const ids = [
  "counting",
  "fraction-addition",
  "rational-equations-and-original-domain",
];
const samples = ids.map((id) => lessons.find((lesson) => lesson.id === id)!);
assert(samples.every(Boolean));
const output = "artifacts/lesson-sequence";
await mkdir(output, { recursive: true });
const server = await createServer({
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "lesson-sequence-proof",
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url ?? "/", "http://localhost");
          if (!url.pathname.startsWith("/__lesson-sequence/")) return next();
          const lesson = samples[Number(url.searchParams.get("sample") ?? 0)]!;
          const reference = url.searchParams.has("reference");
          const payload = reference
            ? lesson
            : problemLesson(lesson.templateIds[0]!, "lesson-sequence-proof");
          const json = JSON.stringify(payload).replace(/</g, "\\u003c");
          res.setHeader("Content-Type", "text/html");
          res.end(
            await vite.transformIndexHtml(
              url.pathname,
              `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import{${reference ? "ReferenceLesson" : "ProblemLesson"}}from'${reference ? "/src/content/ReferenceLesson.tsx" : "/src/web/ProblemLesson.tsx"}';import'/src/web/style.css';import'/src/web/theme.css';import'/src/web/practice.css';import'/src/web/scene/scene-player.css';import'katex/dist/katex.min.css';
document.documentElement.dataset.theme=${JSON.stringify(url.searchParams.get("theme") ?? "light")};
createRoot(document.getElementById('root')).render(React.createElement('main',{style:{padding:16,maxWidth:760,margin:'0 auto'}},React.createElement('article',{className:'card lesson-reader'},React.createElement('h2',null,${JSON.stringify(lesson.title)}),React.createElement(${reference ? "ReferenceLesson" : "ProblemLesson"},{lesson:${json}}))));
</script></body></html>`,
            ),
          );
        });
      },
    },
  ],
});
await server.listen();
const address = server.httpServer!.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const results: unknown[] = [];
try {
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    try {
      for (const width of engine === chromium ? [320, 390, 768, 1280] : [390]) {
        for (const theme of ["light", "dark"]) {
          const page = await browser.newPage({
            viewport: { width, height: 844 },
            reducedMotion: "reduce",
          });
          const errors: string[] = [];
          page.on("pageerror", (error) => {
            errors.push(error.message);
            console.error(error.message);
          });
          for (let sample = 0; sample < samples.length; sample++) {
            for (const reference of [false, true]) {
              await page.goto(
                `${origin}/__lesson-sequence/${sample}-${reference}-${theme}?sample=${sample}&theme=${theme}${reference ? "&reference" : ""}`,
              );
              await page
                .locator(reference ? ".reference-lesson" : ".problem-lesson")
                .waitFor();
              await page.evaluate(() => document.fonts.ready);
              const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - innerWidth,
              );
              assert(
                overflow <= 1,
                `${engine.name()} ${width} ${ids[sample]} overflow ${overflow}`,
              );
              assert.equal(await page.locator(".katex-error").count(), 0);
              const headings = await page
                .locator(
                  reference ? "[data-lesson-stage]" : ".problem-lesson h3",
                )
                .allTextContents();
              assert(headings.length >= 3);
              if (width === 390 && engine === chromium)
                await page.screenshot({
                  path: `${output}/${ids[sample]}-${reference ? "reference" : "problem"}-${theme}.png`,
                  fullPage: true,
                });
              results.push({
                browser: engine.name(),
                width,
                theme,
                lesson: ids[sample],
                reference,
                overflow,
              });
            }
          }
          assert.deepEqual(errors, []);
          await page.close();
        }
      }
      if (engine === chromium) {
        const page = await browser.newPage();
        for (const lesson of samples) {
          await page.setContent(publicationHtml(lesson, "lesson"));
          await page.evaluate(() => document.fonts.ready);
          assert.equal(await page.locator(".katex-error").count(), 0);
          for (const format of ["Letter", "A4"] as const)
            await page.pdf({
              path: `${output}/${lesson.id}-${format}.pdf`,
              format,
              printBackground: true,
            });
        }
      }
    } finally {
      await browser.close();
    }
  }
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    `${results.length} lesson views passed; Letter/A4 PDFs exported.`,
  );
} finally {
  await server.close();
}
