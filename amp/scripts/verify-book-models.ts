import { algebraModels } from "../tests/fixtures/algebra-models.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { BookScreenFigure } from "../src/web/BookScreenFigure.js";
import type { Diagram } from "../src/publishing/schema.js";
const models: Diagram[] = [
  ...algebraModels,
  {
    kind: "array",
    id: "split-array",
    rows: 3,
    columns: 8,
    splitAfterColumn: 5,
    splitAfterRow: 1,
    rowLabel: "3 rows",
    columnLabel: "8 in each row",
    alt: "Three rows of eight cells partitioned after one row and five columns.",
    caption: "The four regions fill the same rectangle.",
  },
  {
    kind: "number-line",
    id: "four-jumps",
    min: [0, 1],
    max: [20, 1],
    divisionsPerUnit: 1,
    integerLabelInterval: 5,
    marks: [],
    jumps: Array.from({ length: 4 }, (_, i) => ({
      from: [i * 5, 1],
      to: [(i + 1) * 5, 1],
      label: "+5",
    })),
    wholeLabel: "Each small interval is one unit",
    alt: "Four jumps of five reach twenty.",
    caption: "Four equal jumps reach twenty.",
  },
  {
    kind: "groups",
    id: "integer-remainder",
    total: [17, 1],
    groupSize: [5, 1],
    unitDivisions: 1,
    wholeLabel: "One item",
    alt: "Seventeen items grouped in fives.",
    caption: "Three complete groups of five, with two items left.",
  },
];
const output = resolve("artifacts/publisher-models");
await mkdir(output, { recursive: true });
const css = (
  await Promise.all(
    ["style.css", "book-reader.css"].map((name) =>
      readFile(
        fileURLToPath(new URL(`../src/web/${name}`, import.meta.url)),
        "utf8",
      ),
    ),
  )
).join("\n");
const browser = await chromium.launch({ headless: true });
const review: unknown[] = [];
try {
  for (const [width, height] of [
    [320, 568],
    [844, 390],
  ] as const) {
    const page = await browser.newPage({ viewport: { width, height } });
    for (const model of models) {
      await page.setContent(
        `<html><head><style>${css}\nbody{display:block;margin:0;padding:16px}main{max-width:600px;margin:auto}.book-screen-figure{margin:0}</style></head><body><main>${renderToStaticMarkup(React.createElement(BookScreenFigure, { diagram: model }))}</main></body></html>`,
      );
      await page.evaluate(() => document.fonts.ready);
      const findings = await page.locator("svg text").evaluateAll((nodes) =>
        nodes.flatMap((node) => {
          const text = node as SVGTextElement,
            rect = text.getBoundingClientRect(),
            svg = text.closest("svg")!,
            bound = svg.getBoundingClientRect();
          const matrix = svg.getScreenCTM()!;
          const pixels =
            parseFloat(getComputedStyle(text).fontSize) *
            Math.hypot(matrix.a, matrix.b);
          return rect.left < bound.left - 1 ||
            rect.right > bound.right + 1 ||
            rect.top < bound.top - 1 ||
            rect.bottom > bound.bottom + 1 ||
            pixels < 13
            ? [{ text: text.textContent, pixels, overflow: true }]
            : [];
        }),
      );
      const frame = await page.locator("figure").boundingBox();
      if (
        findings.length ||
        !frame ||
        frame.x < 0 ||
        frame.x + frame.width > width ||
        frame.y + frame.height > height
      )
        throw new Error(
          `Model ${model.id} fails ${width}×${height}: ${JSON.stringify({ findings, frame })}`,
        );
      await page.screenshot({
        path: resolve(output, `${model.id}-${width}.png`),
      });
      review.push({ model: model.id, width, height, findings });
    }
    await page.close();
  }
  await writeFile(
    resolve(output, "validation.json"),
    JSON.stringify(review, null, 2),
  );
  console.log(`Validated ${review.length} phone/landscape model frames.`);
} finally {
  await browser.close();
}
