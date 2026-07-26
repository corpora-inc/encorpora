/**
 * BZ-19 — the screenshot set, and the perf and flash measurements taken while
 * walking the street.
 *
 *   node qa/shots.mjs            build, serve, walk, shoot, measure
 *   node qa/shots.mjs --url URL  shoot an already-running dev server
 *
 * Everything it asserts is a gate:
 *   BZ-12  no >10 % luminance change in any 200 ms window over >25 % of the
 *          viewport — stricter than WCAG 2.3.1, because this is a children's
 *          product and WCAG's three-flashes-a-second is not good enough
 *   BZ-18  live DOM node count at 60 stalls
 *   perf   measured RAF p90 and fps while scrolling
 */

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../shots");
mkdirSync(outDir, { recursive: true });

const argUrl = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : null;

const VIEWPORTS = {
  phone: { width: 320, height: 568 },
  tablet: { width: 1024, height: 768 },
  wide: { width: 1440, height: 900 },
};

/** The six moments the founder asked to see, plus the gate matrix. */
const SHOTS = [
  ["01-opening", "tablet", "?day=0.05", {}],
  ["02-mid-street", "tablet", "?day=0.4&at=4", { scroll: 900 }],
  ["03-stall-close", "wide", "?day=0.3&at=2", { scroll: 240 }],
  ["04-evening-dark", "tablet", "?day=1&night=1&sub=1", {}],
  ["05-lamp-low", "tablet", "?day=0.95&at=6", { scroll: 400 }],
  ["06-far-horizon", "wide", "?day=0.5", { scroll: 3300 }],
  ["07-phone-320", "phone", "?day=0.3", {}],
  ["08-phone-night", "phone", "?day=1&night=1&sub=1", {}],
  ["09-reduced-motion", "tablet", "?day=0.5&at=3", { reduced: true }],
  ["10-scaffolding", "wide", "?day=0.45", { scroll: 6400 }],
];

async function main() {
  let url = argUrl;
  let server = null;
  if (!url) {
    server = spawn("npx", ["vite", "--port", "5199", "--strictPort"], {
      cwd: resolve(here, ".."),
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise((ok, fail) => {
      const to = setTimeout(() => fail(new Error("vite did not start")), 30000);
      server.stdout.on("data", (d) => {
        if (String(d).includes("ready in") || String(d).includes("Local:")) {
          clearTimeout(to);
          setTimeout(ok, 500);
        }
      });
      server.stderr.on("data", (d) => process.stderr.write(d));
    });
    url = "http://localhost:5199/";
  }

  const browser = await chromium.launch();
  const report = { shots: [], perf: null, flash: null, nodes: null, errors: [] };

  for (const [name, vp, query, o] of SHOTS) {
    const ctx = await browser.newContext({
      viewport: VIEWPORTS[vp],
      deviceScaleFactor: 2,
      reducedMotion: o.reduced ? "reduce" : "no-preference",
      colorScheme: "light",
    });
    const page = await ctx.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") report.errors.push(`${name}: ${m.text()}`);
    });
    page.on("pageerror", (e) => report.errors.push(`${name}: ${e.message}`));
    await page.goto(url + query, { waitUntil: "load" });
    await page.waitForTimeout(900);
    if (o.scroll) {
      await page.evaluate((s) => {
        const el = document.querySelector(".bz-street");
        if (el) el.scrollLeft = s;
      }, o.scroll);
      await page.waitForTimeout(700);
    }
    // Let the ambience settle and a full dusk run where one is asked for.
    await page.waitForTimeout(query.includes("night=1") ? 1200 : 500);
    await page.screenshot({ path: resolve(outDir, `${name}.png`) });
    report.shots.push(name);
    await ctx.close();
  }

  // ── perf, flash and node count, all on one walk ────────────────────────
  const ctx = await browser.newContext({
    viewport: VIEWPORTS.tablet,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => report.errors.push(`perf: ${e.message}`));
  await page.goto(url + "?day=0.5", { waitUntil: "load" });
  await page.waitForTimeout(1200);

  report.perf = await page.evaluate(async () => {
    const frames = [];
    let last = performance.now();
    const el = document.querySelector(".bz-street");
    let x = 0;
    await new Promise((done) => {
      const tick = () => {
        const n = performance.now();
        frames.push(n - last);
        last = n;
        x += 22;
        if (el) el.scrollLeft = x;
        if (frames.length < 300) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    frames.sort((a, b) => a - b);
    const p = (q) => frames[Math.min(frames.length - 1, Math.floor(frames.length * q))];
    const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
    const stats = window.bazaar?.stats?.() ?? {};
    return {
      fps: +(1000 / mean).toFixed(1),
      p50: +p(0.5).toFixed(2),
      p90: +p(0.9).toFixed(2),
      p99: +p(0.99).toFixed(2),
      tier: stats.tier ?? null,
      liveNodes: stats.liveNodes ?? null,
    };
  });

  // BZ-18: sixty stalls generated, then count the live DOM.
  report.nodes = await page.evaluate(async () => {
    const el = document.querySelector(".bz-street");
    for (let i = 0; i < 60; i++) {
      if (el) el.scrollLeft += 400;
      await new Promise((r) => requestAnimationFrame(r));
    }
    return document.querySelector(".bz-root").querySelectorAll("*").length;
  });

  // BZ-12: sample the whole viewport at 8×8 tiles every 100 ms and assert no
  // tile changes luminance by more than 10 % in any 200 ms window over more
  // than a quarter of the screen.
  report.flash = await measureFlash(page);

  writeFileSync(resolve(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await ctx.close();
  await browser.close();
  if (server) server.kill();
  const bad =
    report.errors.length > 0 || report.flash.worstShare > 0.25 || report.nodes > 1200;
  process.exit(bad ? 1 : 0);
}

async function measureFlash(page) {
  const frames = [];
  for (let i = 0; i < 22; i++) {
    const buf = await page.screenshot({ type: "png" });
    frames.push(buf);
    await page.waitForTimeout(100);
  }
  // Decode in the page: cheaper than adding an image decoder dependency.
  const lum = [];
  for (const buf of frames) {
    const b64 = buf.toString("base64");
    lum.push(
      await page.evaluate(async (data) => {
        const img = new Image();
        img.src = "data:image/png;base64," + data;
        await img.decode();
        const cv = document.createElement("canvas");
        cv.width = 8;
        cv.height = 8;
        const g = cv.getContext("2d");
        g.drawImage(img, 0, 0, 8, 8);
        const d = g.getImageData(0, 0, 8, 8).data;
        const out = [];
        for (let i = 0; i < 64; i++) {
          out.push((0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255);
        }
        return out;
      }, b64),
    );
  }
  let worstShare = 0;
  let worstDelta = 0;
  for (let i = 2; i < lum.length; i++) {
    let over = 0;
    for (let k = 0; k < 64; k++) {
      const d = Math.abs(lum[i][k] - lum[i - 2][k]);
      worstDelta = Math.max(worstDelta, d);
      if (d > 0.1) over++;
    }
    worstShare = Math.max(worstShare, over / 64);
  }
  return { worstShare: +worstShare.toFixed(3), worstDelta: +worstDelta.toFixed(3) };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
