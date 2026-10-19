/**
 * Every reference scene on printed pages: problem figures at their start
 * frame, lesson figures revealed at their final frame, on Letter and A4,
 * through the independent print layout oracle (labels inside each view box,
 * nothing clipped or wider than the page, no external requests).
 *
 *   npx tsx scripts/scene-print.ts   pages in artifacts/scene-print/
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { printMathCss } from "../src/content/print-fonts";
import { galleryCases } from "../src/math/scene/gallery";
import { makeTenHops, partialProducts } from "../src/math/scene/explanations";
import { describeScene } from "../src/math/scene";
import { SceneFigure } from "../src/web/scene/SceneFigure";
import type { Scene } from "../src/math/scene";

const out = new URL("../artifacts/scene-print/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const tokens =
  /:root\s*\{[^}]*\}/.exec(
    readFileSync(new URL("../src/web/ui/tokens.css", import.meta.url), "utf8"),
  )?.[0] ?? "";
const cases: {
  name: string;
  scene: Scene;
  reveal: boolean;
  frame: "start" | "end";
}[] = [
  ...galleryCases.map((c) => ({
    name: c.name,
    scene: c.scene,
    reveal: !!c.reveal,
    frame: "start" as const,
  })),
  {
    name: "Make ten, problem",
    scene: makeTenHops(8, 5),
    reveal: false,
    frame: "start",
  },
  {
    name: "Make ten, solution",
    scene: makeTenHops(8, 5),
    reveal: true,
    frame: "end",
  },
  {
    name: "Partial products, problem",
    scene: partialProducts(34, 6),
    reveal: false,
    frame: "start",
  },
  {
    name: "Partial products, solution",
    scene: partialProducts(34, 6),
    reveal: true,
    frame: "end",
  },
];
for (const c of cases)
  if (describeScene(c.scene, c.reveal).length < 20)
    throw Error(`${c.name}: no description`);
const body = cases
  .map(
    (c) =>
      `<section class="exercise"><h2>${c.name.replace(/[<&]/g, "")}</h2>${renderToStaticMarkup(
        React.createElement(SceneFigure, {
          scene: c.scene,
          reveal: c.reveal,
          frame: c.frame,
          medium: "print",
        }),
      )}</section>`,
  )
  .join("");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Scene print review</title><style>${printMathCss()}</style><style>${tokens}</style><style>@page{margin:18mm}:root{--scene-sans:Arial,Helvetica,sans-serif}body{font-family:Arial,sans-serif;color:#18332f;font-size:10.5pt}h2{font-size:12pt}.exercise{break-inside:avoid;border-bottom:1px solid #ccd;padding-bottom:12px}.figure{display:block;margin:12px auto}</style></head><body><article>${body}</article></body></html>`;
const file = `${out}scenes.html`;
writeFileSync(file, html);
const oracle = spawnSync(
  "node",
  [
    "--import",
    "tsx",
    new URL("print-layout-oracle.ts", import.meta.url).pathname,
  ],
  {
    input: JSON.stringify([
      { file, format: "Letter" },
      { file, format: "A4" },
    ]),
    encoding: "utf8",
  },
);
if (oracle.status !== 0) {
  console.error(oracle.stderr || oracle.stdout);
  process.exit(1);
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(
    `${out}scenes-Letter.pdf`,
    await page.pdf({ format: "Letter", printBackground: true }),
  );
  await page.emulateMedia({ media: "print" });
  await page.setViewportSize({ width: 680, height: 1000 });
  await page.screenshot({ path: `${out}scenes.png`, fullPage: true });
} finally {
  await browser.close();
}
console.log(`scene print: ${cases.length} scenes, ${oracle.stdout.trim()}`);
