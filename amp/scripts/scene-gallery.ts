/**
 * Scene gallery: every reference scene, and every ported legacy figure beside
 * its old renderer, at 320, 390, 768 and 1280 px in light and dark.
 *
 *   npx tsx scripts/scene-gallery.ts      screenshots in artifacts/scene-gallery/
 *   npx tsx scripts/scene-gallery.ts Tiles   only cases whose name contains
 *                                            "Tiles", each card at every width
 *
 * Fails on horizontal overflow, a label outside its view box, two labels that
 * overlap, or a label wider than the layout's estimate (fonts must never
 * outgrow the metrics the layout reserved). No database or API.
 */
import assert from "node:assert/strict";
import { createServer as httpServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";

const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import '/src/web/style.css';import '/src/web/theme.css';import '/node_modules/katex/dist/katex.min.css';
import {galleryCases, parityFigures} from '/src/math/scene/gallery.ts';
import {legacyScene} from '/src/math/scene/legacy.ts';
import {layoutScene} from '/src/math/scene/index.ts';
import {SceneFigure} from '/src/web/scene/SceneFigure.tsx';
import {Figure} from '/src/web/Figure.tsx';
import {GraphicalFigure} from '/src/web/GraphicalFigure.tsx';
import {ElementaryFigure} from '/src/web/ElementaryFigure.tsx';
const theme = new URLSearchParams(location.search).get('theme');
document.documentElement.dataset.theme = theme || 'light';
const h = React.createElement;
const legacy = (f) => f.kind === 'ten-frame' ? h(ElementaryFigure,{figure:f}) : h(GraphicalFigure,{figure:f});
window.__layouts = {};
const only = new URLSearchParams(location.search).get('only');
const shown = (c) => !only || c.name.includes(only);
galleryCases.forEach((c, i) => { if (shown(c)) window.__layouts['case-'+i] = layoutScene(c.scene, {reveal: !!c.reveal}); });
if (!only) parityFigures.forEach((f, i) => { window.__layouts['parity-'+i] = layoutScene(legacyScene(f)); });
const card = (id, title, body) => h('section',{id, key:id, className:'gallery-card', style:{background:'var(--color-surface-raised)', color:'var(--color-on-surface-raised)', border:'1px solid var(--color-border)', borderRadius:16, padding:12, margin:'12px 0'}}, h('h2',{style:{fontSize:15, margin:'0 0 8px'}}, title), body);
function App(){
  return h('main',{style:{maxWidth:720, margin:'0 auto', padding:'8px 16px 40px', background:'var(--color-surface)'}},
    h('h1',{key:'t1',style:{fontSize:20}},'Scene gallery'),
    h(React.Fragment,{key:'c'},galleryCases.map((c,i)=>shown(c) && card('case-'+i, c.name, h(SceneFigure,{scene:c.scene, reveal:!!c.reveal})))),
    h('h1',{key:'t2',style:{fontSize:20}},'Legacy parity'),
    h(React.Fragment,{key:'p'},(only ? [] : parityFigures).map((f,i)=>card('parity-'+i, f.kind + ': legacy, then scene', h('div',{style:{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:12, alignItems:'center'}}, h('div',{className:'legacy'}, legacy(f)), h('div',{className:'ported'}, h(Figure,{figure:f})))))),
  );
}
createRoot(document.getElementById('root')).render(h(App));
`;
const server = httpServer();
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  server: { middlewareMode: true, hmr: { server }, fs: { strict: false } },
  appType: "custom",
  logLevel: "error",
  plugins: [
    {
      name: "scene-gallery",
      resolveId(id) {
        if (id === "/scene-gallery-entry.tsx") return id;
      },
      load(id) {
        if (id === "/scene-gallery-entry.tsx") return entry;
      },
      configureServer(server) {
        server.middlewares.use("/scene-gallery", async (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end(
            await server.transformIndexHtml(
              "/scene-gallery",
              `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:var(--color-surface)"><div id="root"></div><script type="module" src="/scene-gallery-entry.tsx"></script></body></html>`,
            ),
          );
        });
      },
    },
  ],
});
server.on("request", vite.middlewares);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const out = new URL("../artifacts/scene-gallery/", import.meta.url);
await mkdir(out, { recursive: true });
const only = process.argv[2];
const browser = await chromium.launch();
const failures: string[] = [];
const report: unknown[] = [];
try {
  for (const theme of ["light", "dark"])
    for (const width of [320, 390, 768, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.addInitScript("window.__name = (f) => f");
      page.on("pageerror", (e) =>
        failures.push(`${theme} ${width}: ${e.message}`),
      );
      page.on(
        "console",
        (m) =>
          m.type() === "error" &&
          failures.push(`${theme} ${width}: ${m.text()}`),
      );
      await page.goto(
        `http://127.0.0.1:${address.port}/scene-gallery?theme=${theme}${only ? `&only=${encodeURIComponent(only)}` : ""}`,
      );
      await page.locator(".gallery-card").first().waitFor();
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const f of ["KaTeX_Main", "KaTeX_Math"])
          await document.fonts.load(`17px ${f}`);
        await document.fonts.load("italic 17px KaTeX_Math");
        await document.fonts.load("bold 17px KaTeX_Main");
      });
      const issues = await page.evaluate(() => {
        const found: string[] = [];
        if (document.documentElement.scrollWidth > innerWidth + 0.5)
          found.push(
            `horizontal overflow ${document.documentElement.scrollWidth} > ${innerWidth}`,
          );
        const layouts = (
          window as unknown as {
            __layouts: Record<
              string,
              {
                items: {
                  k: string;
                  id: string;
                  box?: { x0: number; x1: number };
                }[];
              }
            >;
          }
        ).__layouts;
        for (const card of document.querySelectorAll<HTMLElement>(
          ".gallery-card",
        )) {
          const svg = card.querySelector<SVGSVGElement>(
            ".ported svg.scene-figure, :scope > svg.scene-figure",
          );
          if (!svg) {
            found.push(`${card.id}: no scene svg`);
            continue;
          }
          if (
            svg.getBoundingClientRect().right >
            card.getBoundingClientRect().right + 0.5
          )
            found.push(`${card.id}: figure wider than its card`);
          const v = svg.viewBox.baseVal;
          const estimate = new Map(
            layouts[card.id]!.items.filter((d) => d.k === "text").map((d) => [
              d.id,
              d.box!.x1 - d.box!.x0,
            ]),
          );
          const boxes: { id: string; b: DOMRect }[] = [];
          // Glyph boxes: the text (and fraction bars), not a label's backing.
          const glyphs = (g: SVGGElement) => {
            const parts = [
              ...g.querySelectorAll<SVGGraphicsElement>("text, line"),
            ].map((e) => e.getBBox());
            const x0 = Math.min(...parts.map((p) => p.x)),
              y0 = Math.min(...parts.map((p) => p.y)),
              x1 = Math.max(...parts.map((p) => p.x + p.width)),
              y1 = Math.max(...parts.map((p) => p.y + p.height));
            return new DOMRect(x0, y0, x1 - x0, y1 - y0);
          };
          for (const g of svg.querySelectorAll<SVGGElement>("g[data-label]")) {
            const b = glyphs(g);
            // Math runs sit at TeX spacing: no gap wider than a thick space.
            const spans = [...g.querySelectorAll<SVGTSpanElement>("tspan")];
            for (let i = 0; i + 1 < spans.length; i++) {
              const a = spans[i]!,
                c = spans[i + 1]!;
              const size = parseFloat(getComputedStyle(a).fontSize);
              const gap =
                c.getStartPositionOfChar(0).x -
                a.getEndPositionOfChar(a.getNumberOfChars() - 1).x;
              if (
                Math.abs(a.y.baseVal[0]!.value - c.y.baseVal[0]!.value) < 0.5 &&
                (gap > 0.3 * size + 1 || gap < -1)
              )
                found.push(
                  `${card.id}: label ${g.getAttribute("data-id")} "${g.textContent}" has a ${gap.toFixed(1)} px gap before "${c.textContent}"`,
                );
            }
            const id = g.getAttribute("data-id")!;
            if (
              b.x < v.x - 1 ||
              b.y < v.y - 1 ||
              b.x + b.width > v.x + v.width + 1 ||
              b.y + b.height > v.y + v.height + 1
            )
              found.push(
                `${card.id}: label ${id} "${g.textContent}" crosses the view box`,
              );
            const est = estimate.get(id);
            if (est !== undefined && b.width > est + 0.75)
              found.push(
                `${card.id}: label ${id} "${g.textContent}" measures ${b.width.toFixed(1)} > estimate ${est.toFixed(1)}`,
              );
            boxes.push({ id, b });
          }
          // No stroke (axis, arrowhead, line, curve, boundary) crosses a label.
          const strokes = [
            ...svg.querySelectorAll<SVGGeometryElement>("line, path"),
          ].filter(
            (e) =>
              !e.closest("g[data-label]") &&
              !/\.grid\.|region/.test(e.getAttribute("data-id") ?? "") &&
              (e.getAttribute("stroke") ?? "none") !== "none",
          );
          const samples: [number, number][] = [];
          for (const e of strokes) {
            const len = e.getTotalLength();
            const n = Math.min(800, Math.ceil(len / 1.5));
            for (let i = 0; i <= n; i++) {
              const p = e.getPointAtLength((len * i) / n);
              samples.push([p.x, p.y]);
            }
          }
          for (const g of svg.querySelectorAll<SVGGElement>("g[data-label]")) {
            // A label on a paper backing hides the stroke beneath it.
            if (g.querySelector("rect")) continue;
            const t = g.querySelector("text")!.getBBox();
            const x0 = t.x + 1,
              x1 = t.x + t.width - 1,
              y0 = t.y + t.height * 0.22,
              y1 = t.y + t.height * 0.86;
            if (samples.some(([x, y]) => x > x0 && x < x1 && y > y0 && y < y1))
              found.push(
                `${card.id}: a stroke crosses label ${g.getAttribute("data-id")} "${g.textContent}"`,
              );
          }
          // A coordinate plane fills most of its figure: labels do not starve it.
          const xAxis = svg.querySelector<SVGLineElement>(
            'line[data-id$=".axis.x"]',
          );
          if (xAxis && card.id.startsWith("case-")) {
            const span = Math.abs(
              xAxis.x2.baseVal.value - xAxis.x1.baseVal.value,
            );
            if (span < 0.55 * v.width)
              found.push(
                `${card.id}: plot spans ${((span / v.width) * 100).toFixed(0)}% of the figure width`,
              );
          }
          // Ink boxes: getBBox includes the font's internal leading, so trim it.
          const ink = (b: DOMRect) => ({
            x0: b.x + 1,
            x1: b.x + b.width - 1,
            y0: b.y + b.height * 0.22,
            y1: b.y + b.height * 0.86,
          });
          for (let i = 0; i < boxes.length; i++)
            for (let j = i + 1; j < boxes.length; j++) {
              const a = ink(boxes[i]!.b),
                c = ink(boxes[j]!.b);
              if (a.x0 < c.x1 && c.x0 < a.x1 && a.y0 < c.y1 && c.y0 < a.y1)
                found.push(
                  `${card.id}: labels ${boxes[i]!.id} and ${boxes[j]!.id} overlap`,
                );
            }
        }
        return found;
      });
      failures.push(...issues.map((i) => `${theme} ${width}: ${i}`));
      await page.screenshot({
        path: new URL(`gallery-${theme}-${width}.png`, out).pathname,
        fullPage: true,
      });
      if (width === 390 || only)
        for (const card of await page.locator(".gallery-card").all()) {
          const id = await card.getAttribute("id");
          await card.screenshot({
            path: new URL(`${id}-${theme}-${width}.png`, out).pathname,
          });
        }
      report.push({ theme, width, issues: issues.length });
      await page.close();
    }
} finally {
  await browser.close();
  server.close();
  await vite.close();
}
await writeFile(
  new URL("report.json", out),
  JSON.stringify({ report, failures }, null, 2),
);
if (failures.length) {
  console.error(failures.slice(0, 60).join("\n"));
  process.exit(1);
}
console.log(JSON.stringify(report));
