/**
 * The scenes-v2 components inside real practice problems: each component's
 * migrated family (and the new thermometer family) rendered by the practice
 * workspace at 320, 390, 768 and 1280 px in light and dark, then printed on
 * Letter and A4 through the print layout oracle. No database or account data.
 *
 *   npx tsx scripts/verify-scene-components-ui.ts [output-dir]
 *
 * Fails on a layout probe issue (overflow, clipped or unreachable text or
 * controls), a figure label under 12 px or overlapping another, a figure
 * that moves after fonts settle, or a print oracle issue. Screenshots of
 * every state are written to the output directory (default
 * artifacts/scene-components-review/).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { createServer } from "vite";
import { generateProblem, templates } from "../src/math/engine";
import type { GeneratedProblem } from "../src/math/contracts";
import { describeScene, sceneCapabilitiesIn } from "../src/math/scene/index";
import { printMathCss } from "../src/content/print-fonts";
import { SceneFigure } from "../src/web/scene/SceneFigure";
import { probePracticeLayout } from "./practice-layout-probe";

const out = `${resolve(
  process.argv[2] ??
    fileURLToPath(
      new URL("../artifacts/scene-components-review/", import.meta.url),
    ),
)}/`;
mkdirSync(out, { recursive: true });

type Element = { type: string; solid?: { form: string } };
const elements = (p: GeneratedProblem): Element[] =>
  p.public.figure?.kind === "scene"
    ? (p.public.figure.scene.elements as Element[])
    : [];
const has = (type: string, form?: string) => (p: GeneratedProblem) =>
  elements(p).some((e) => e.type === type && (!form || e.solid?.form === form));
const fixtures: {
  name: string;
  template: string;
  accept: (p: GeneratedProblem) => boolean;
}[] = [
  {
    name: "circle-graph-inside",
    template: "circle-graph-read",
    accept: (p) => has("circleGraph")(p) && sceneLabels(p) === "inside",
  },
  {
    name: "circle-graph-key",
    template: "circle-graph-read",
    accept: (p) => has("circleGraph")(p) && sceneLabels(p) === "key",
  },
  {
    name: "thermometer",
    template: "thermometer-reading",
    accept: has("thermometer"),
  },
  {
    name: "thermometer-below-zero",
    template: "thermometer-reading",
    accept: (p) => has("thermometer")(p) && Number(p.answer) < 0,
  },
  {
    name: "ruler-eighths",
    template: "fractional-ruler-length",
    accept: (p) =>
      has("ruler")(p) && JSON.stringify(p.public.figure).includes('"parts":8'),
  },
  {
    name: "coins-picture-choice",
    template: "coin-name-and-cent-value",
    accept: (p) =>
      has("coins")(p) &&
      JSON.stringify(p.public.figure).includes('"label":"C"'),
  },
  {
    name: "coin-single",
    template: "coin-name-and-cent-value",
    accept: (p) =>
      has("coins")(p) &&
      !JSON.stringify(p.public.figure).includes('"label":'),
  },
  {
    name: "cube-steps",
    template: "unit-cube-volume",
    accept: has("isoSolid", "steps"),
  },
  {
    name: "cube-prisms-select",
    template: "mcas-prism-range-select",
    accept: has("isoSolid", "cubes"),
  },
  {
    name: "fraction-cube-prism",
    template: "mcas-cube-prism-statements",
    accept: has("isoSolid", "cubes"),
  },
  {
    name: "protractor",
    template: "protractor-reading",
    accept: has("protractor"),
  },
];
const sceneOf = (p: GeneratedProblem) => {
  const figure = p.public.figure;
  assert.ok(figure?.kind === "scene", `${p.public.templateId} has a scene`);
  return figure.scene;
};
/** Which label layout a circle graph took (inside or the numbered key). */
function sceneLabels(p: GeneratedProblem) {
  const svg = renderToStaticMarkup(
    React.createElement(SceneFigure, {
      scene: sceneOf(p),
    }),
  );
  return svg.includes('.legend.0.name"') ? "key" : "inside";
}
const cases = fixtures.map((f) => {
  const meta = templates.find((t) => t.id === f.template);
  assert.ok(meta, `unknown template ${f.template}`);
  for (let i = 0; i < 400; i++) {
    const seed = `scene-v2-${i}`;
    const problem = generateProblem(f.template, seed);
    if (f.accept(problem)) return { name: f.name, meta, seed, problem };
  }
  throw new Error(`No ${f.name} instance in 400 seeds`);
});

const port = Number(process.env.AMP_SCENE_V2_PORT ?? 4461);
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: { host: "127.0.0.1", port, strictPort: true, hmr: false },
  logLevel: "error",
  plugins: [
    {
      name: "scene-v2-practice",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/layout")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              "/layout",
              '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/practice-layout-harness.tsx"></script></body></html>',
            ),
          );
        });
      },
    },
  ],
});
await vite.listen();
const browser = await chromium.launch();
const failures: string[] = [];
const rows: unknown[] = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => failures.push(`page error: ${e.message}`));
  await page.goto(`http://127.0.0.1:${port}/layout`);
  await page.waitForFunction(() => typeof window.layoutCase === "function");
  await page.evaluate("globalThis.__name ??= (f) => f");
  for (const c of cases)
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1280, 900],
    ] as const)
      for (const theme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await page.evaluate(
          ({ value, theme }) => {
            document.documentElement.dataset.theme = theme;
            window.layoutReady = "";
            window.layoutCase(value);
          },
          { value: c, theme },
        );
        await page.waitForFunction(
          (id) => window.layoutReady === id,
          c.problem.public.id,
        );
        const figure = page.locator(".problem-content svg.scene-figure").first();
        await figure.waitFor();
        const first = await figure.boundingBox();
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise<void>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r())),
          );
        });
        const settled = await figure.boundingBox();
        const where = `${c.name} ${width} ${theme}`;
        if (
          !first ||
          !settled ||
          Math.abs(first.x - settled.x) > 0.5 ||
          Math.abs(first.y - settled.y) > 0.5 ||
          Math.abs(first.width - settled.width) > 0.5 ||
          Math.abs(first.height - settled.height) > 0.5
        )
          failures.push(`${where}: figure moved after fonts settled`);
        const issues = await probePracticeLayout(page);
        for (const i of issues) failures.push(`${where}: ${i.kind} ${i.detail}`);
        const labels = await figure.evaluate((svg) => {
          const items = [...svg.querySelectorAll("g[data-label]")].map((g) => {
            const t = g.querySelector("text")!;
            const m = t.getScreenCTM()!;
            const b = g.getBoundingClientRect();
            return {
              id: g.getAttribute("data-id"),
              text: g.textContent,
              px: parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.c, m.d),
              box: { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom },
            };
          });
          const overlaps: string[] = [];
          for (let i = 0; i < items.length; i++)
            for (let j = i + 1; j < items.length; j++) {
              const a = items[i]!.box,
                b = items[j]!.box;
              // Ink boxes: trim the font's internal leading.
              const h = (q: typeof a) => (q.y1 - q.y0) * 0.2;
              if (
                Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1 &&
                Math.min(a.y1 - h(a), b.y1 - h(b)) -
                  Math.max(a.y0 + h(a), b.y0 + h(b)) >
                  1
              )
                overlaps.push(`${items[i]!.text}/${items[j]!.text}`);
            }
          return { items, overlaps };
        });
        const smallest = Math.min(...labels.items.map((l) => l.px));
        if (labels.items.length && smallest < 11.99)
          failures.push(`${where}: a figure label is ${smallest.toFixed(1)} px`);
        if (labels.overlaps.length)
          failures.push(`${where}: overlapping labels ${labels.overlaps.join(", ")}`);
        rows.push({
          case: c.name,
          template: c.meta.id,
          seed: c.seed,
          width,
          theme,
          smallestLabelPx: +smallest.toFixed(2),
          figure: settled,
          issues: issues.length,
        });
        await page.screenshot({ path: `${out}${c.name}-${width}-${theme}.png` });
      }
} finally {
  await browser.close();
  await vite.close();
}

// Print: each figure as a worksheet exercise, Letter and A4.
const tokens =
  /:root\s*\{[^}]*\}/.exec(
    readFileSync(new URL("../src/web/ui/tokens.css", import.meta.url), "utf8"),
  )?.[0] ?? "";
const body = cases
  .map((c) => {
    const scene = sceneOf(c.problem);
    if (describeScene(scene).length < 20) failures.push(`${c.name}: no description`);
    return `<section class="exercise"><h2>${c.name}</h2><p>${c.problem.public.prompt.replace(/[<&]/g, "")}</p>${renderToStaticMarkup(
      React.createElement(SceneFigure, { scene, medium: "print" }),
    )}</section>`;
  })
  .join("");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Scene components print review</title><style>${printMathCss()}</style><style>${tokens}</style><style>@page{margin:18mm}:root{--scene-sans:Arial,Helvetica,sans-serif}body{font-family:Arial,sans-serif;color:#18332f;font-size:10.5pt}h2{font-size:12pt}.exercise{break-inside:avoid;border-bottom:1px solid #ccd;padding-bottom:12px}.figure{display:block;margin:12px auto}</style></head><body><article>${body}</article></body></html>`;
const file = `${out}print.html`;
writeFileSync(file, html);
const oracle = spawnSync(
  "node",
  ["--import", "tsx", new URL("print-layout-oracle.ts", import.meta.url).pathname],
  {
    input: JSON.stringify([
      { file, format: "Letter" },
      { file, format: "A4" },
    ]),
    encoding: "utf8",
  },
);
if (oracle.status !== 0) failures.push(`print: ${oracle.stderr || oracle.stdout}`);
const printer = await chromium.launch();
try {
  const page = await printer.newPage();
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  for (const format of ["Letter", "A4"] as const)
    writeFileSync(
      `${out}print-${format}.pdf`,
      await page.pdf({ format, printBackground: true }),
    );
  await page.emulateMedia({ media: "print" });
  await page.setViewportSize({ width: 680, height: 1000 });
  await page.screenshot({ path: `${out}print.png`, fullPage: true });
} finally {
  await printer.close();
}
for (const c of cases)
  assert.ok(
    sceneCapabilitiesIn(c.problem.public).length ||
      c.meta.id === "protractor-reading" ||
      c.meta.id.startsWith("mcas-"),
    `${c.name} draws a scenes-v2 component`,
  );
writeFileSync(
  `${out}report.json`,
  JSON.stringify({ rows, failures, print: oracle.stdout.trim() }, null, 2),
);
if (failures.length) {
  console.error(failures.slice(0, 80).join("\n"));
  process.exit(1);
}
console.log(
  `scene components: ${cases.length} cases × 4 widths × 2 themes, print ${oracle.stdout.trim()}; ${out}`,
);
