import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import { algebraModels } from "../tests/fixtures/algebra-models.js";
import { renderBook } from "../src/publishing/book.js";
import type { MathBook } from "../src/publishing/schema.js";
const book: MathBook = {
  id: "algebra-model-proof",
  version: "1",
  title: "Balance and Change",
  subtitle: "Exact mathematical models",
  audience: "Model validation fixture",
  description: "A layout fixture, not a published curriculum book.",
  pages: algebraModels.map((diagram, i) => ({
    id: `proof-${i}`,
    kind: "lesson",
    eyebrow: "Explore the model",
    title:
      diagram.kind === "balance"
        ? "Keep both sides equal"
        : diagram.kind === "value-table"
          ? "Compare inputs and outputs"
          : "Read what changes",
    blocks: [{ kind: "diagram", diagram }],
  })),
};
const output = resolve("artifacts/algebra-reader");
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { host: "127.0.0.1", port: 4396, strictPort: true },
  plugins: [
    {
      name: "algebra-proof",
      configureServer(s) {
        s.middlewares.use("/__algebra-proof", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              "/__algebra-proof",
              `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body><div id="root"></div><script type="module">
import React from 'react';import{createRoot}from'react-dom/client';import{BookReader}from'/src/web/BookReader.tsx';import'/src/web/style.css';const book=${JSON.stringify(book)};createRoot(document.getElementById('root')).render(React.createElement('div',{className:'shell app-shell'},React.createElement(BookReader,{book,initialFrame:Number(new URLSearchParams(location.search).get('frame')||0),onClose(){},onPosition(){},async download(){}})));
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
if (!address || typeof address === "string") throw new Error("No proof server");
const browser = await chromium.launch({ headless: true });
const review: unknown[] = [];
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
  ] as const) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", (e) => console.error(e));
    page.on("console", (m) => {
      if (m.type() === "error") console.error(m.text());
    });
    for (let i = 0; i < algebraModels.length; i++) {
      await page.goto(
        `http://127.0.0.1:${address.port}/__algebra-proof?frame=${i}`,
      );
      await page.locator(".algebra-figure").waitFor();
      await page.evaluate(() => document.fonts.ready);
      const result = await page.evaluate(() => {
        const stage = document.querySelector<HTMLElement>(".reader-stage")!;
        const figure = document
          .querySelector("figure")!
          .getBoundingClientRect();
        const bound = stage.getBoundingClientRect();
        return {
          scroll: stage.scrollHeight - stage.clientHeight,
          overflow:
            figure.bottom > bound.bottom + 1 ||
            figure.left < bound.left ||
            figure.right > bound.right,
          body: document.documentElement.scrollHeight - innerHeight,
        };
      });
      if (result.scroll > 1 || result.overflow || result.body > 1)
        throw new Error(
          `Reader ${algebraModels[i]!.id} ${width}x${height}: ${JSON.stringify(result)}`,
        );
      await page.screenshot({
        path: resolve(output, `${algebraModels[i]!.id}-${width}.png`),
      });
      review.push({ model: algebraModels[i]!.id, width, height, ...result });
    }
    await page.close();
  }
  const page = await browser.newPage({
    viewport: { width: 1000, height: 1200 },
  });
  const html = renderBook(book);
  await writeFile(resolve(output, "index.html"), html);
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".page-content")).flatMap(
      (content) => {
        const bound = content.getBoundingClientRect();
        return Array.from(content.querySelectorAll("*")).some((child) => {
          const r = child.getBoundingClientRect();
          return (
            r.left < bound.left - 1 ||
            r.right > bound.right + 1 ||
            r.bottom > bound.bottom + 1
          );
        })
          ? [content.parentElement!.id]
          : [];
      },
    ),
  );
  const labels = await page.locator("svg text").evaluateAll((nodes) =>
    nodes.flatMap((node) => {
      const r = node.getBoundingClientRect(),
        b = node.closest("svg")!.getBoundingClientRect();
      return r.left < b.left - 1 ||
        r.right > b.right + 1 ||
        r.top < b.top - 1 ||
        r.bottom > b.bottom + 1
        ? [node.textContent]
        : [];
    }),
  );
  if (overflow.length || labels.length)
    throw new Error(`Print overflow ${JSON.stringify({ overflow, labels })}`);
  const pdf = await page.pdf({
    path: resolve(output, "algebra-model-proof.pdf"),
    format: "Letter",
    preferCSSPageSize: true,
    printBackground: true,
    tagged: true,
  });
  const physicalPages = (await PDFDocument.load(pdf)).getPageCount();
  if (physicalPages !== book.pages.length)
    throw new Error("Unexpected print page count");
  for (let i = 0; i < book.pages.length; i++)
    await page
      .locator("article")
      .nth(i)
      .screenshot({ path: resolve(output, `print-${i + 1}.png`) });
  await writeFile(
    resolve(output, "validation.json"),
    JSON.stringify(
      { readerFrames: review, print: { physicalPages, overflow, labels } },
      null,
      2,
    ),
  );
  console.log(
    `Validated ${review.length} full-reader frames and ${physicalPages} physical proof pages.`,
  );
} finally {
  await browser.close();
  await server.close();
}
