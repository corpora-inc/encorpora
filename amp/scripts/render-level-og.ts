import { readFileSync } from "node:fs";
import { chromium } from "playwright";

/**
 * Renders `public/og/level.png`, the Open Graph image on `/level` (the link
 * on a shared level card). It is the same for everyone: no learner's levels,
 * only illustrative bars, in the light theme's tokens. Run after changing
 * the look: `npx tsx scripts/render-level-og.ts`.
 */
const tokens = readFileSync(
  new URL("../src/web/ui/tokens.css", import.meta.url),
  "utf8",
);
const bars = [
  ["number", 18, 46, 34],
  ["fractions", 30, 64, 47],
  ["geometry", 24, 52, 40],
  ["algebra", 40, 78, 58],
]
  .map(
    ([strand, from, to, dot]) =>
      `<div class="track"><span class="band" style="left:${from}%;width:${(to as number) - (from as number)}%;background:color-mix(in srgb, var(--color-strand-${strand}) 34%, transparent)"></span><span class="dot" style="left:${dot}%;background:var(--color-strand-${strand});box-shadow:0 0 0 2px var(--color-strand-${strand})"></span></div>`,
  )
  .join("");
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${tokens}
:root{color-scheme:light}
html,body{margin:0}
body{width:1200px;height:630px;box-sizing:border-box;padding:72px 84px;background:var(--color-surface-raised);color:var(--color-on-surface-raised);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif;display:grid;grid-template-columns:1fr 420px;gap:64px;align-items:center;border-top:14px solid var(--color-primary)}
.brand{font-size:44px;font-weight:800;letter-spacing:-0.04em;color:var(--color-primary)}
h1{margin:28px 0 20px;font-family:"Iowan Old Style","Palatino Linotype",Georgia,serif;font-weight:400;font-size:84px;line-height:1.05;letter-spacing:-0.02em}
p{margin:0;font-size:30px;line-height:1.4;color:var(--color-muted-text)}
.chart{display:grid;gap:40px;padding:44px 40px;border-radius:28px;background:var(--color-surface-sunken)}
.track{position:relative;height:18px;border-radius:999px;background:var(--color-surface-raised);box-shadow:inset 0 0 0 2px var(--color-border)}
.band{position:absolute;top:0;bottom:0;border-radius:999px}
.dot{position:absolute;top:50%;width:30px;height:30px;box-sizing:border-box;border:6px solid var(--color-surface-raised);border-radius:50%;transform:translate(-50%,-50%)}
</style></head><body><div><div class="brand">AMP</div><h1>What’s your level?</h1><p>A free math level check. Your best guess sharpens with every answer.</p></div><div class="chart">${bars}</div></body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  colorScheme: "light",
});
await page.setContent(html);
await page.screenshot({
  path: new URL("../public/og/level.png", import.meta.url).pathname,
});
await browser.close();
console.log("Wrote public/og/level.png");
