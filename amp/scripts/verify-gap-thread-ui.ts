import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";
import { publicationHtml } from "../src/content/publications";
import { rationalEquationLessons } from "../src/content/rational-equation-lessons";

// Real figure and animation components in an isolated presentation harness.
import { geometryProofLessons } from "../src/content/geometry-proof-lessons";
const output = "artifacts/gap-thread";
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "rational-review",
      configureServer(s) {
        s.middlewares.use("/rational-review", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              "/rational-review",
              `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root" style="max-width:660px;margin:auto;padding:12px"></main><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';
import{Figure}from'/src/web/Figure.tsx';import{LessonIllustration}from'/src/content/LessonIllustration.tsx';import{PrintMathText}from'/src/content/PrintMathText.tsx';
import '/src/web/style.css';import '/src/web/theme.css';import '/node_modules/katex/dist/katex.min.css';
const problems=await fetch('/rational-case').then(r=>r.json());
createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,...problems.map((p,i)=>React.createElement('section',{key:i},React.createElement('h2',null,p.templateId),React.createElement('p',null,React.createElement(PrintMathText,{text:p.prompt})),p.response.options?React.createElement('ol',null,...p.response.options.map(option=>React.createElement('li',{key:option.id,style:{padding:'12px',lineHeight:2}},React.createElement(PrintMathText,{text:option.label})))):React.createElement('p',null,'Enter an exact fraction.'))),React.createElement(LessonIllustration,{kind:'rational-equation-crossing'}),React.createElement(LessonIllustration,{kind:'triangle-sum-line'})));
</script></body></html>`,
            ),
          );
        });
        s.middlewares.use("/rational-case", async (_req, res) => {
          const { generateProblem } = await import("../src/math/engine");
          res.setHeader("Content-Type", "application/json");
          const { rationalEquationCase } =
            await import("../src/math/rational-equation-practice");
          const { geometryProofCase } =
            await import("../src/math/geometry-proof-practice");
          const rows = [
            generateProblem("rational-equation-one-denominator", "visual-check")
              .public,
          ];
          for (const [id, make] of [
            ["rational-equation-check", rationalEquationCase],
            ["geometry-proof-step", geometryProofCase],
          ] as const) {
            const seen = new Set<string>();
            for (let i = 0; i < 256 && seen.size < 4; i++) {
              const item = make(id, `visual-${i}`),
                tag = item.tags[0]!;
              if (!seen.has(tag)) {
                seen.add(tag);
                rows.push(item.problem.public);
              }
            }
            assert.equal(seen.size, 4);
          }
          res.end(JSON.stringify(rows));
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
      await page.goto(`http://127.0.0.1:${address.port}/rational-review`);
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
  for (const lesson of [...rationalEquationLessons, ...geometryProofLessons]) {
    const html = publicationHtml(lesson, "lesson");
    await writeFile(`${output}/${lesson.id}.html`, html);
    for (const format of ["Letter", "A4"] as const) {
      const page = await browser.newPage();
      await page.setContent(html);
      await page.evaluate(() => document.fonts.ready);
      await page.pdf({
        path: `${output}/${lesson.id}-${format}.pdf`,
        format,
        printBackground: true,
      });
      await page.close();
    }
  }
  console.log(
    "Verified 8 viewport/theme cases and rendered both lessons on Letter/A4.",
  );
} finally {
  await browser.close();
  await server.close();
}
