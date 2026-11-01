/**
 * Render lessons in the app's reading view (ReferenceLesson) and practice view
 * (ProblemLesson) for a rewrite review.
 *
 *   npx tsx scripts/capture-lesson-screens.ts --lesson id,id --out docs/reviews/<topic>
 *
 * Every lesson and each of its templates is checked in Chromium at 320, 390,
 * 768 and 1280 px, light and dark: no horizontal overflow, no KaTeX error and
 * no page error. Full-page screenshots are written at 390 and 1280 px (light),
 * plus 390 px dark.
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createServer } from "vite";
import { chromium } from "playwright";
import { lessons } from "../src/content/lessons";
import { problemLesson } from "../src/content/problem-lessons";

const { values } = parseArgs({
  options: { lesson: { type: "string" }, out: { type: "string" } },
});
if (!values.lesson || !values.out)
  throw new Error("Usage: --lesson id,id --out docs/reviews/<topic>");
const ids = values.lesson.split(",").filter(Boolean);
const samples = ids.map((id) => {
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) throw new Error(`Unknown lesson ${id}`);
  return lesson;
});
const views = samples.flatMap((lesson, sample) => [
  { sample, name: `${lesson.id}-lesson`, template: undefined },
  ...lesson.templateIds.map((template) => ({
    sample,
    name: `${lesson.id}-practice-${template}`,
    template,
  })),
]);
const output = values.out;
await mkdir(output, { recursive: true });

const server = await createServer({
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "lesson-screens",
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url ?? "/", "http://localhost");
          if (!url.pathname.startsWith("/__lesson-screens/")) return next();
          const lesson = samples[Number(url.searchParams.get("sample"))]!;
          const template = url.searchParams.get("template");
          const payload = template
            ? problemLesson(template, "lesson-screens")
            : lesson;
          const component = template ? "ProblemLesson" : "ReferenceLesson";
          const module = template
            ? "/src/web/ProblemLesson.tsx"
            : "/src/content/ReferenceLesson.tsx";
          const json = JSON.stringify(payload).replace(/</g, "\\u003c");
          res.setHeader("Content-Type", "text/html");
          res.end(
            await vite.transformIndexHtml(
              url.pathname,
              `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import{${component}}from'${module}';import'/src/web/style.css';import'/src/web/theme.css';import'/src/web/practice.css';import'/src/web/scene/scene-player.css';import'katex/dist/katex.min.css';
document.documentElement.dataset.theme=${JSON.stringify(url.searchParams.get("theme") ?? "light")};
createRoot(document.getElementById('root')).render(React.createElement('main',{style:{padding:16,maxWidth:760,margin:'0 auto'}},React.createElement('article',{className:'card lesson-reader'},React.createElement('h2',null,${JSON.stringify(lesson.title)}),React.createElement(${component},{lesson:${json}}))));
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
const browser = await chromium.launch();
let checked = 0;
try {
  for (const width of [320, 390, 768, 1280]) {
    for (const theme of ["light", "dark"]) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        colorScheme: theme as "light" | "dark",
        reducedMotion: "reduce",
      });
      const errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
        console.error(error.message);
      });
      for (const view of views) {
        await page.goto(
          // Vite caches the inline module by path, so the path names the theme.
          `${origin}/__lesson-screens/${view.name}-${theme}?sample=${view.sample}&theme=${theme}${view.template ? `&template=${view.template}` : ""}`,
        );
        await page
          .locator(view.template ? ".problem-lesson" : ".reference-lesson")
          .waitFor();
        await page.evaluate(() => document.fonts.ready);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        );
        assert(overflow <= 1, `${view.name} ${width} overflow ${overflow}`);
        assert.equal(
          await page.locator(".katex-error").count(),
          0,
          `${view.name} ${width} has a KaTeX error`,
        );
        if (
          (theme === "light" && (width === 390 || width === 1280)) ||
          (theme === "dark" && width === 390)
        )
          await page.screenshot({
            path: `${output}/${view.name}-${width}-${theme}.png`,
            fullPage: true,
          });
        checked++;
      }
      assert.deepEqual(errors, [], `${width} ${theme} page errors`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(
  `${views.length} views checked ${checked} times; screenshots in ${output}`,
);
