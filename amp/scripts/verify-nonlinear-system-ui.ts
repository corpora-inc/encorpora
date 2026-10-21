import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";
import { publicationHtml } from "../src/content/publications";
import { nonlinearSystemLessons } from "../src/content/nonlinear-system-lessons";

// Real figure and animation components in an isolated presentation harness.
const output = "artifacts/nonlinear-system";
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "nonlinear-review",
      configureServer(s) {
        s.middlewares.use("/nonlinear-review", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              "/nonlinear-review",
              `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root" style="max-width:660px;margin:auto;padding:12px"></main><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';
import{Figure}from'/src/web/Figure.tsx';import{LessonIllustration}from'/src/content/LessonIllustration.tsx';import{PrintMathText}from'/src/content/PrintMathText.tsx';
import '/src/web/style.css';import '/src/web/theme.css';import '/node_modules/katex/dist/katex.min.css';
const {prompt,figure}=await fetch('/nonlinear-case').then(r=>r.json());
createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement('h1',null,'Where a line meets a parabola'),React.createElement('p',null,React.createElement(PrintMathText,{text:prompt})),React.createElement(Figure,{figure}),React.createElement('h2',null,'See the worked example'),React.createElement(LessonIllustration,{kind:'nonlinear-system-example'})));
</script></body></html>`,
            ),
          );
        });
        s.middlewares.use("/nonlinear-case", async (_req, res) => {
          const { generateProblem } = await import("../src/math/engine");
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify(
              generateProblem("nonlinear-system-read", "visual-check").public,
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
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      const page = await browser.newPage({
        viewport: { width, height: 1000 },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${address.port}/nonlinear-review`);
      await page.locator("svg").first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(
        (theme) => document.documentElement.setAttribute("data-theme", theme),
        theme,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `${width}/${theme} overflow`,
      );
      assert.deepEqual(errors, []);
      await page.screenshot({
        path: `${output}/${width}-${theme}.png`,
        fullPage: true,
      });
      await page.close();
    }
  const html = publicationHtml(nonlinearSystemLessons[0]!, "lesson");
  await writeFile(`${output}/lesson.html`, html);
  for (const format of ["Letter", "A4"] as const) {
    const page = await browser.newPage();
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: `${output}/lesson-${format}.pdf`,
      format,
      printBackground: true,
    });
    await page.close();
  }
  console.log(
    "Verified 8 viewport/theme cases and rendered Letter/A4 lessons.",
  );
} finally {
  await browser.close();
  await server.close();
}
