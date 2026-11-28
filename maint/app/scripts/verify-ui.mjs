#!/usr/bin/env node
/**
 * Browser verification for the maintenance app.
 *
 * Every /design gallery state, at 320, 390, 768 and 1280 px, light and dark:
 *   - no horizontal overflow and nothing past the right edge;
 *   - zero layout shift while the screen loads;
 *   - every button at least 44 px tall, and no control label cut off;
 *   - no console errors.
 * Screenshots go to .screens/<width>-<theme>/<screen>-<state>.png (git-ignored),
 * or artifacts/ui/ in CI.
 *
 * Against a running server: MAINT_UI_BASE=http://127.0.0.1:4340 node scripts/verify-ui.mjs
 * Otherwise it serves dist/ (build it with VITE_DESIGN=1 so the gallery is in it).
 * --shots-only skips nothing but never fails on a check (for design review).
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../../../amp/browser-security.mjs";

const chromium = secureChromium(rawChromium);
const root = fileURLToPath(new URL("..", import.meta.url));
const shotsOnly = process.argv.includes("--shots-only");
const out = process.env.CI ? path.join(root, "artifacts", "ui") : path.join(root, ".screens");
const WIDTHS = (process.env.MAINT_UI_WIDTHS ?? "320,390,768,1280").split(",").map(Number);
const THEMES = ["light", "dark"];
const only = process.env.MAINT_UI_ONLY ? new RegExp(process.env.MAINT_UI_ONLY) : null;

let base = process.env.MAINT_UI_BASE;
let preview = null;
if (!base) {
  const port = Number(process.env.MAINT_UI_PORT || 4342);
  base = `http://127.0.0.1:${port}`;
  preview = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
}

async function waitUp() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server at ${base} did not answer`);
}

async function newPage(browser, width, theme) {
  const context = await browser.newContext({ viewport: { width, height: width >= 1024 ? 800 : 860 }, colorScheme: theme, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.__shift = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__shift += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return { context, page, errors };
}

async function measure(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const name = (el) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"`;
    return {
      sw: document.documentElement.scrollWidth,
      iw: window.innerWidth,
      shift: window.__shift,
      wide: [...document.querySelectorAll("body *")]
        .filter((el) => {
          if (!visible(el)) return false;
          for (let p = el.parentElement; p; p = p.parentElement) {
            const o = getComputedStyle(p).overflowX;
            if (o === "auto" || o === "scroll" || o === "hidden") return false;
          }
          return el.getBoundingClientRect().right > window.innerWidth + 0.5;
        })
        .slice(0, 3)
        .map((el) => `${el.tagName}.${String(el.className).slice(0, 60)}`),
      small: [...document.querySelectorAll("button, [role=radio]")]
        .filter((el) => visible(el) && el.getBoundingClientRect().height < 43.5)
        .slice(0, 3)
        .map((el) => `${name(el)} ${Math.round(el.getBoundingClientRect().height)}px`),
      // The rail column (tablet and up) runs to the bottom of the page, however long.
      railShort: (() => {
        const shell = document.querySelector("[data-shell]");
        if (!shell || window.innerWidth < 768) return null;
        const doc = document.documentElement.scrollHeight;
        const h = shell.getBoundingClientRect().height + window.scrollY;
        return getComputedStyle(shell).backgroundImage.includes("gradient") && h >= doc - 1 ? null : `${Math.round(h)} < ${doc}`;
      })(),
      clipped: [...document.querySelectorAll("button, a")]
        .filter((el) => visible(el) && getComputedStyle(el).whiteSpace === "nowrap" && el.scrollWidth > el.clientWidth + 1 && !el.querySelector(".truncate"))
        .slice(0, 3)
        .map((el) => `${name(el)} ${el.scrollWidth}>${el.clientWidth}`),
    };
  });
}

let browser;
let checks = 0;
const failures = [];
try {
  await waitUp();
  // Screenshots are regenerable output: start clean so no stale state lingers.
  if (!only) await rm(out, { recursive: true, force: true });
  browser = await chromium.launch();
  const index = await newPage(browser, 1280, "light");
  await index.page.goto(`${base}/design`);
  await index.page.waitForSelector("main a[href^='/design/']");
  let routes = await index.page.$$eval("main a[href^='/design/']", (as) => as.map((a) => a.getAttribute("href")));
  await index.context.close();
  if (only) routes = routes.filter((r) => only.test(r));
  assert.ok(routes.length > 0, "the gallery lists no states");

  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const dir = path.join(out, `${width}-${theme}`);
      await mkdir(dir, { recursive: true });
      const { context, page, errors } = await newPage(browser, width, theme);
      for (const route of routes) {
        const label = `${route} @${width} ${theme}`;
        await page.goto(`${base}${route}`);
        await page.evaluate(() => (window.__shift = 0));
        const m = await measure(page);
        const file = route.replace(/^\/design\//, "").replace(/[^a-z0-9]+/gi, "-");
        // Grow the viewport to the page so fixed bars sit where they do on a device, then shoot it.
        const vh = page.viewportSize().height;
        const full = await page.evaluate(() => document.documentElement.scrollHeight);
        if (full > vh) await page.setViewportSize({ width, height: full });
        await page.screenshot({ path: path.join(dir, `${file}.png`) });
        if (full > vh) await page.setViewportSize({ width, height: vh });
        const problems = [];
        if (m.sw > m.iw) problems.push(`horizontal overflow ${m.sw} > ${m.iw} (${m.wide.join(", ")})`);
        if (m.wide.length) problems.push(`past the right edge: ${m.wide.join(", ")}`);
        if (m.shift >= 0.001) problems.push(`layout shift ${m.shift.toFixed(4)}`);
        if (m.small.length) problems.push(`controls under 44 px: ${m.small.join(", ")}`);
        if (m.railShort) problems.push(`rail stops short of the page bottom: ${m.railShort}`);
        if (m.clipped.length) problems.push(`labels cut off: ${m.clipped.join(", ")}`);
        if (errors.length) problems.push(`console: ${errors.splice(0).join(" | ")}`);
        if (problems.length) failures.push(`${label}: ${problems.join("; ")}`);
        checks++;
      }
      await context.close();
    }
  }
  console.log(`${checks} screens checked, ${failures.length} with problems. Screenshots in ${out}`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  if (failures.length && !shotsOnly) process.exitCode = 1;
} finally {
  await browser?.close();
  preview?.kill();
}
