import { secureChromium } from "../browser-security.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium as rawChromium } from "playwright";
const chromium = secureChromium(rawChromium);
import { PDFDocument } from "pdf-lib";
import { earlyNumberModels } from "../tests/fixtures/early-number-models.js";
import { renderBook } from "../src/publishing/book.js";
import { assertPhoneLandscapeSmoke, isPhoneLandscape } from "./ui-viewports";
import type { MathBook } from "../src/publishing/schema.js";
import { readerProofPage } from "./reader-proof-page";
const book: MathBook = {
  id: "early-number-model-proof",
  version: "1",
  title: "Early Number Models",
  subtitle: "Exact mathematical models",
  audience: "Model validation fixture",
  description: "A layout fixture, not a published curriculum book.",
  presentation: "early-number",
  pages: earlyNumberModels.map((diagram, i) => ({
    id: `proof-${i}`,
    kind: "lesson",
    eyebrow: "Explore the model",
    title: "Build and notice",
    blocks: [{ kind: "diagram", diagram }],
  })),
};
const output = resolve(
  process.env.AMP_EVIDENCE_DIR ?? "artifacts/early-number-reader",
);
await mkdir(output, { recursive: true });
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { host: "127.0.0.1", port: 4410, strictPort: true },
  plugins: [
    {
      name: "early-number-proof",
      configureServer(s) {
        s.middlewares.use("/__early-number-proof", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              "/__early-number-proof",
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
      for (let i = 0; i < earlyNumberModels.length; i++) {
        await page.goto(
          `http://127.0.0.1:${address.port}/__early-number-proof?frame=${i}`,
        );
        await page.locator(".early-number-figure").waitFor();
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
        // Phone landscape only has to stay usable: the reader scrolls there.
        if (isPhoneLandscape([width, height]))
          await assertPhoneLandscapeSmoke(
            page,
            `Reader ${earlyNumberModels[i]!.id}`,
          );
        else if (result.scroll > 1 || result.overflow || result.body > 1) {
          await page.screenshot({
            path: resolve(
              output,
              `failure-${earlyNumberModels[i]!.id}-${width}-${theme}.png`,
            ),
          });
          throw new Error(
            `Reader ${earlyNumberModels[i]!.id} ${width}x${height}: ${JSON.stringify(result)}`,
          );
        }
        const readability = await page.evaluate(() => ({
          smallUnits: Array.from(
            document.querySelectorAll("[data-unit]"),
          ).filter(
            (e) =>
              e.getBoundingClientRect().width <
              (e.closest(".early-base-ten") ? 14 : 7),
          ).length,
          smallLabels: Array.from(
            document.querySelectorAll(
              ".early-unit,.early-panel-label,.early-emphasis",
            ),
          ).filter((e) => parseFloat(getComputedStyle(e).fontSize) < 14).length,
          clippedUnits: Array.from(
            document.querySelectorAll("[data-unit]"),
          ).filter((e) => {
            const r = e.getBoundingClientRect(),
              b = e.closest("svg")!.getBoundingClientRect();
            return (
              r.left < b.left ||
              r.right > b.right ||
              r.top < b.top ||
              r.bottom > b.bottom
            );
          }).length,
        }));
        if (Object.values(readability).some(Boolean)) {
          const geometry = await page
            .locator("[data-unit]")
            .evaluateAll((units) =>
              units.slice(0, 3).map((unit) => ({
                width: unit.getBoundingClientRect().width,
                svg: unit.closest("svg")!.getBoundingClientRect().toJSON(),
                art: unit
                  .closest(".early-number-art")!
                  .getBoundingClientRect()
                  .toJSON(),
              })),
            );
          await page.screenshot({
            path: resolve(
              output,
              `failure-${earlyNumberModels[i]!.id}-${width}-${theme}.png`,
            ),
          });
          throw new Error(
            `Unreadable ${earlyNumberModels[i]!.id} ${width}: ${JSON.stringify({ readability, geometry })}`,
          );
        }
        const palette = await page.evaluate<{
          background: number;
          boundary: number;
          units: { edge: number; cells: number }[];
        }>(String.raw`(() => {
          const luminance = (color) => {
            const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255);
            const linear = rgb.map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
            return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
          };
          const contrast = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
          const board = getComputedStyle(document.querySelector('.early-number-art rect:not([data-unit])'));
          const background = luminance(board.fill);
          const units = [...document.querySelectorAll('[data-unit]')].map((el) => {
            const style = getComputedStyle(el), fill = luminance(style.fill), stroke = luminance(style.stroke);
            return { edge: Math.max(contrast(fill, background), contrast(stroke, background)), cells: contrast(fill, stroke) };
          });
          return { background, boundary: contrast(background, luminance(board.stroke)), units };
        })()`);
        if (
          !Number.isFinite(palette.background) ||
          !Number.isFinite(palette.boundary) ||
          (theme === "dark" && palette.background > 0.2) ||
          palette.boundary < 3 ||
          palette.units.some(
            (u) =>
              !Number.isFinite(u.edge) ||
              !Number.isFinite(u.cells) ||
              u.edge < 3 ||
              u.cells < 3,
          )
        )
          throw new Error(
            `Early-number palette ${earlyNumberModels[i]!.id} ${theme}: ${JSON.stringify(palette)}`,
          );
        await page.screenshot({
          path: resolve(
            output,
            `${earlyNumberModels[i]!.id}-${width}-${theme}.png`,
          ),
        });
        review.push({
          model: earlyNumberModels[i]!.id,
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
          if (child.closest("svg") && child.tagName.toLowerCase() !== "svg")
            return false;
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
  const labels = await page
    .locator("svg text, svg [data-unit]")
    .evaluateAll((nodes) =>
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
    path: resolve(output, "early-number-model-proof.pdf"),
    format: "Letter",
    preferCSSPageSize: true,
    printBackground: true,
    tagged: true,
  });
  if (pdf.length > 2 * 1024 * 1024)
    throw new Error("Early-number proof PDF exceeds the 2MiB fixture budget");
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
      {
        readerFrames: review,
        print: { physicalPages, bytes: pdf.length, overflow, labels },
      },
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
