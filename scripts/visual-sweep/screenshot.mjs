#!/usr/bin/env node
// Visual evidence capture for a PR/batch. Screenshots one or more URLs at a few
// viewports so a worker can attach them to a PR. NOT a merge gate — it's the
// thin human practice that shrinks over time (see SWEEP.md).
//
// Usage:
//   node scripts/visual-sweep/screenshot.mjs <url> [<url> ...] [--out dir] [--full]
//   node scripts/visual-sweep/screenshot.mjs http://localhost:5173 --out /tmp/shots
//
// Requires Playwright's chromium once:  npx playwright install chromium
// (Playwright drives Chrome over CDP under the hood.)

import { mkdir } from "node:fs/promises";
import path from "node:path";

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },   // iPhone-ish
  { name: "tablet", width: 820, height: 1180 }, // iPad-ish
  { name: "desktop", width: 1440, height: 900 },
];

function parseArgs(argv) {
  const urls = [];
  let out = "./visual-sweep-out";
  let fullPage = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") out = argv[++i];
    else if (a === "--full") fullPage = true;
    else urls.push(a);
  }
  return { urls, out, fullPage };
}

const { urls, out, fullPage } = parseArgs(process.argv.slice(2));
if (urls.length === 0) {
  console.error("Usage: screenshot.mjs <url> [<url> ...] [--out dir] [--full]");
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "Playwright not found. Install it:\n  npm i -D playwright && npx playwright install chromium",
  );
  process.exit(1);
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
let failures = 0;

for (const url of urls) {
  const slug = url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const file = path.join(out, `${slug}__${vp.name}.png`);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      await page.screenshot({ path: file, fullPage });
      console.log(`captured  ${file}`);
    } catch (err) {
      console.error(`FAILED    ${url} @ ${vp.name}: ${err.message}`);
      failures++;
    } finally {
      await ctx.close();
    }
  }
}

await browser.close();
console.log(`\nDone. Screenshots in ${out}`);
process.exit(failures > 0 ? 1 : 0);
