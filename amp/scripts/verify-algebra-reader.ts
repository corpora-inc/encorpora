import { secureChromium } from "../browser-security.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium as rawChromium } from "playwright";
const chromium = secureChromium(rawChromium);
import { PDFDocument } from "pdf-lib";
import { algebraModels } from "../tests/fixtures/algebra-models.js";
import { renderBook } from "../src/publishing/book.js";
import { assertPhoneLandscapeSmoke, isPhoneLandscape } from "./ui-viewports";
import type { MathBook } from "../src/publishing/schema.js";
import { readerProofPage } from "./reader-proof-page";
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
const output = resolve(
  process.env.AMP_EVIDENCE_DIR ?? "artifacts/algebra-reader",
);
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
              readerProofPage(book),
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
  for (const theme of ["light", "dark"] as const) {
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1024, 768],
      [1280, 800],
      [844, 390],
    ] as const) {
      const page = await browser.newPage({
        viewport: { width, height },
        colorScheme: theme,
      });
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
          const notes = document
            .querySelector(".algebra-notes")!
            .getBoundingClientRect();
          const artwork = document
            .querySelector(".algebra-art > svg, .algebra-art > table")!
            .getBoundingClientRect();
          const labels = Array.from(
            document.querySelectorAll<SVGTextElement>("figure svg text"),
          ).map((label) => {
            const matrix = label.getScreenCTM()!;
            return (
              parseFloat(getComputedStyle(label).fontSize) *
              Math.hypot(matrix.a, matrix.b)
            );
          });
          return {
            scroll: stage.scrollHeight - stage.clientHeight,
            overflow:
              figure.bottom > bound.bottom + 1 ||
              figure.left < bound.left ||
              figure.right > bound.right,
            body: document.documentElement.scrollHeight - innerHeight,
            stageHeight: bound.height,
            stageWidth: bound.width,
            stageClientWidth: stage.clientWidth,
            overlappingNotes: artwork.bottom > notes.top + 1,
            clippedNotes: notes.bottom > figure.bottom + 1,
            smallestLabel: labels.length ? Math.min(...labels) : null,
            figureHeight: figure.height,
            svgHeight: document
              .querySelector("figure svg")
              ?.getBoundingClientRect().height,
          };
        });
        // Phone landscape only has to stay usable: the reader scrolls there.
        if (isPhoneLandscape([width, height]))
          await assertPhoneLandscapeSmoke(
            page,
            `Reader ${algebraModels[i]!.id}`,
          );
        else if (
          result.scroll > 1 ||
          result.overflow ||
          result.body > 1 ||
          result.overlappingNotes ||
          result.clippedNotes ||
          (result.smallestLabel !== null && result.smallestLabel < 12)
        ) {
          await page.screenshot({
            path: resolve(
              output,
              `failure-${algebraModels[i]!.id}-${width}-${theme}.png`,
            ),
          });
          throw new Error(
            `Reader ${algebraModels[i]!.id} ${width}x${height} ${theme}: ${JSON.stringify(result)}`,
          );
        }
        await page.screenshot({
          path: resolve(
            output,
            `${algebraModels[i]!.id}-${width}-${theme}.png`,
          ),
        });
        review.push({
          model: algebraModels[i]!.id,
          width,
          height,
          theme,
          ...result,
        });
      }
      await page.close();
    }
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
