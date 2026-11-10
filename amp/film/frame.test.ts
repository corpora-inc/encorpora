/**
 * The live player centres each figure's ink and draws no cast name tags.
 * Text keeps its padding, wrapped lines keep their leading, and a highlight
 * does not move anything it is not painting.
 * A handful of real exports, at phone and desktop, in both themes.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, expect, test } from "vitest";
import { secureChromium } from "../browser-security.mjs";

const FIX = fileURLToPath(new URL("./fixtures/frame/", import.meta.url));
const FILMS = ["frequency-table-build--pr", "line-slope", "bar-chart-total", "decimal-line-point"];
const VIEWS = [
  { width: 390, height: 844, layout: "tall" },
  { width: 1280, height: 800, layout: "wide" },
] as const;
const THEMES = ["light", "dark"] as const;

let server: ViteDevServer;
let browser: Browser;
let origin = "";
const worst = { centre: 0, margin: Infinity, pad: Infinity, line: Infinity, where: "" };

function timesOf(id: string): number[] {
  const lesson = JSON.parse(readFileSync(path.join(FIX, `${id}.json`), "utf8")) as {
    script: { shots: { figure?: unknown }[] };
    timing: { shots: { start: number; end: number }[][] };
  };
  const at: number[] = [];
  lesson.script.shots.forEach((shot, i) => {
    const beats = lesson.timing.shots[i];
    if (!shot.figure || !beats?.length) return;
    const a = beats[0]!.start, b = beats[beats.length - 1]!.end;
    at.push(a + (b - a) * 0.72);
  });
  if (at.length <= 3) return at;
  return [at[0]!, at[Math.floor(at.length / 2)]!, at[at.length - 1]!];
}

beforeAll(async () => {
  server = await createServer({
    configFile: fileURLToPath(new URL("./vite.live.config.ts", import.meta.url)),
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
    plugins: [{
      name: "film-frame-fixtures",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          const m = (req.url ?? "").split("?")[0]?.match(/^\/data\/([^/]+)\.json$/);
          if (!m) return next();
          const file = path.join(FIX, `${m[1]}.json`);
          if (!existsSync(file)) { res.statusCode = 404; res.end(); return; }
          res.setHeader("content-type", "application/json");
          res.end(readFileSync(file));
        });
      },
    }],
  });
  await server.listen();
  const addr = server.httpServer?.address();
  const port = addr && typeof addr === "object" ? addr.port : 0;
  origin = `http://127.0.0.1:${port}`;
  browser = await secureChromium(chromium).launch();
}, 120_000);

afterAll(async () => {
  console.log(`frame fit: worst centre ${(worst.centre * 100).toFixed(3)}% (${worst.where}), smallest margin ${Number.isFinite(worst.margin) ? worst.margin.toFixed(2) : "n/a"}px, text pad ${Number.isFinite(worst.pad) ? worst.pad.toFixed(1) : "n/a"}px, line ${Number.isFinite(worst.line) ? worst.line.toFixed(2) : "n/a"}`);
  await browser?.close();
  await server?.close();
}, 30_000);

async function measure(page: Page, t: number) {
  return page.evaluate((time) => {
    const scrub = document.querySelector<HTMLInputElement>(".live-scrub");
    if (!scrub) return { error: "no scrubber" };
    scrub.value = String(time);
    scrub.dispatchEvent(new Event("input", { bubbles: true }));
    if (document.querySelector(".film-cast, .film-cast-tag")) return { error: "name tag" };
    const shots = [...document.querySelectorAll<HTMLElement>(".film-shot")];
    let fit: HTMLElement | null = null, best = 0;
    for (const shot of shots) {
      const o = Number.parseFloat(getComputedStyle(shot).opacity);
      const host = shot.querySelector<HTMLElement>(".film-fit");
      if (!host || o < 0.5 || getComputedStyle(shot).visibility === "hidden") continue;
      if (o >= best) { fit = host; best = o; }
    }
    if (!fit) return { error: "no figure" };
    const card = fit.parentElement;
    if (!card) return { error: "no card" };
    const area = card.getBoundingClientRect();
    const paint = (el: Element) => {
      if (el instanceof SVGSVGElement || el instanceof SVGGElement) return false;
      if (el instanceof SVGGraphicsElement) return true;
      if (!(el instanceof HTMLElement)) return false;
      if (el.classList.contains("film-label")) return true;
      const bg = getComputedStyle(el).backgroundColor;
      if (bg && bg !== "transparent" && !/rgba?\([^)]*,\s*0(?:\.0+)?\)/.test(bg) && !bg.endsWith("/ 0)") && !bg.endsWith("/0)")) return true;
      return el.childElementCount === 0 && (el.textContent ?? "").trim() !== "";
    };
    let l = Infinity, top = Infinity, r = -Infinity, b = -Infinity;
    const walk = (el: Element, opac: number) => {
      if (el.classList.contains("film-em")) return;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      const o = opac * (Number.parseFloat(cs.opacity) || 0);
      if (o < 0.04) return;
      if (paint(el)) {
        const box = el.getBoundingClientRect();
        if (box.width >= 0.5 || box.height >= 0.5) {
          l = Math.min(l, box.left); top = Math.min(top, box.top); r = Math.max(r, box.right); b = Math.max(b, box.bottom);
        }
      }
      if (el instanceof HTMLElement && el.classList.contains("film-label")) return;
      for (const c of el.children) walk(c, o);
    };
    for (const c of fit.children) walk(c, 1);
    if (!Number.isFinite(l)) return { error: "no ink" };
    const dx = Math.abs((l + r) / 2 - (area.left + area.right) / 2) / area.width;
    const dy = Math.abs((top + b) / 2 - (area.top + area.bottom) / 2) / area.height;
    const need = Math.max(Math.min(area.width, area.height) * 0.06, 16);
    const margins = [l - area.left, area.right - r, top - area.top, area.bottom - b];
    const shown = (el: Element) => {
      let o = 1;
      let n: Element | null = el;
      while (n && n !== document.body) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden") return 0;
        o *= Number.parseFloat(cs.opacity) || 0;
        if (o < 0.45) return 0;
        n = n.parentElement;
      }
      return o;
    };
    const boxes: { l: number; t: number; r: number; b: number; name: string; host: HTMLElement | null; src: number }[] = [];
    let pad = Infinity;
    // A line the camera has scrolled out of the board is clipped, so its layout box must not count as overlapping the figure.
    const clip = (el: HTMLElement, box: DOMRect) => {
      let l = box.left, t = box.top, r = box.right, b = box.bottom;
      let n: HTMLElement | null = el.parentElement;
      while (n && n !== document.body) {
        const cs = getComputedStyle(n);
        if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
          const h = n.getBoundingClientRect();
          l = Math.max(l, h.left); t = Math.max(t, h.top); r = Math.min(r, h.right); b = Math.min(b, h.bottom);
        }
        n = n.parentElement;
      }
      return { l, t, r, b };
    };
    let src = 0;
    const textOf = (el: HTMLElement) => {
      const mine = src++;
      const rects = el.matches(".film-line.watch, .film-line.text")
        ? (() => { const range = document.createRange(); range.selectNodeContents(el); return [...range.getClientRects()]; })()
        : [...el.getClientRects()];
      const host = el.closest<HTMLElement>(".film-line.problem, .film-line.term, .film-line.watch, .film-line.answer, .film-recap-list, .film-figure");
      const name = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 32);
      for (const box of rects) {
        if (host) {
          const h = host.getBoundingClientRect();
          pad = Math.min(pad, box.left - h.left, h.right - box.right, box.top - h.top, h.bottom - box.bottom);
        }
        const v = clip(el, box);
        if (v.r - v.l < 2 || v.b - v.t < 2) continue;
        boxes.push({ ...v, name, host, src: mine });
      }
    };
    for (const el of document.querySelectorAll<HTMLElement>(".film-label, .film-prose, .film-math, .film-display, .film-note, .film-stack-cell, .film-line.term > b, .film-line.term > span, .film-choices > span, .film-recap-item > b, .film-recap-item > span, .film-line.watch, .film-line.text")) {
      if (shown(el) < 0.45) continue;
      textOf(el);
    }
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i]!;
      for (let j = i + 1; j < boxes.length; j++) {
        const c = boxes[j]!;
        if (a.src === c.src) continue;
        const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l);
        const oy = Math.min(a.b, c.b) - Math.max(a.t, c.t);
        if (ox > 2 && oy > 2 && overlaps.length < 4) overlaps.push(`"${a.name}" ∩ "${c.name}"`);
      }
    }
    let line = Infinity;
    for (const el of document.querySelectorAll<HTMLElement>(".film-line.problem, .film-line.term, .film-line.term > b, .film-line.term > span, .film-line.watch, .film-line.text, .film-recap-item, .film-recap-item > span, .film-choices > span, .film-prose")) {
      if (shown(el) < 0.45) continue;
      const cs = getComputedStyle(el);
      const fs = Number.parseFloat(cs.fontSize);
      const lh = cs.lineHeight === "normal" ? fs * 1.2 : Number.parseFloat(cs.lineHeight);
      if (!Number.isFinite(fs) || !Number.isFinite(lh) || fs < 1) continue;
      const padY = Number.parseFloat(cs.paddingTop) + Number.parseFloat(cs.paddingBottom);
      const borderY = Number.parseFloat(cs.borderTopWidth) + Number.parseFloat(cs.borderBottomWidth);
      const inner = el.getBoundingClientRect().height - padY - borderY;
      if (inner > lh * 1.55) line = Math.min(line, lh / fs);
    }
    return { dx, dy, need, margins, tags: 0, overlaps, pad, line };
  }, t);
}

test("review actions keep the displayed edition when using the shared player", async () => {
  const page = await browser.newPage();
  const id = "frequency-table-build--pr", added = "2026-01-01T00:00:00Z";
  let submitted: unknown;
  try {
    await page.route("**/data/index.json?*", (route) => route.fulfill({ json: [{ id, title: "Review fixture", added }] }));
    await page.route("**/data/grades.json?*", (route) => route.fulfill({ json: {} }));
    await page.route("**/grade", async (route) => {
      submitted = route.request().postDataJSON();
      await route.fulfill({ json: { ...(submitted as object), at: added } });
    });
    await page.goto(`${origin}/live.html?id=${id}`);
    await page.waitForSelector(".live.ready");
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
    expect(await page.locator(".live.ready").count()).toBe(1);
    await page.waitForFunction(() => document.querySelector<HTMLButtonElement>('.live-grade-btn.is-approve')?.disabled === false);
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByRole("textbox", { name: "Note", exact: true }).fill("Synthetic review");
    await page.locator(".live-sheet-save").click();
    await page.waitForFunction(() => document.querySelector('.live-grade-btn.is-approve')?.getAttribute("aria-pressed") === "true");
    expect(submitted).toEqual({ id, grade: "approved", note: "Synthetic review", added });
    await page.getByRole("button", { name: /Playback speed/ }).click();
    await page.getByRole("menuitemradio", { name: "1.25×", exact: true }).click();
    expect(await page.locator("audio").evaluate((audio: HTMLAudioElement) => audio.playbackRate)).toBe(1.25);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
    expect(await page.locator(".live").count()).toBe(0);
  } finally {
    await page.close();
  }
}, 60_000);

test("centres figure ink, keeps a margin, and draws no name tags", async () => {
  const page = await browser.newPage();
  try {
    for (const id of FILMS) {
      await page.goto(`${origin}/live.html?id=${encodeURIComponent(id)}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".live.ready", { timeout: 60_000 });
      const times = timesOf(id);
      expect(times.length).toBeGreaterThan(0);
      for (const view of VIEWS) {
        await page.setViewportSize({ width: view.width, height: view.height });
        await page.waitForFunction((layout) => document.querySelector("#film")?.getAttribute("data-layout") === layout, view.layout);
        for (const theme of THEMES) {
          await page.evaluate((name) => { document.documentElement.dataset.theme = name; }, theme);
          for (const t of times) {
            const got = await measure(page, t);
            const where = `${id} ${view.width} ${theme} t=${t.toFixed(1)}`;
            if (!got || "error" in got) throw new Error(`${where}: ${got && "error" in got ? got.error : "no measurement"}`);
            const hit = got;
            const centre = Math.max(hit.dx, hit.dy);
            const margin = Math.min(...hit.margins);
            if (centre > worst.centre) { worst.centre = centre; worst.where = where; }
            if (margin < worst.margin) worst.margin = margin;
            expect(hit.dx, where).toBeLessThanOrEqual(0.02);
            expect(hit.dy, where).toBeLessThanOrEqual(0.02);
            for (const m of hit.margins) expect(m, where).toBeGreaterThanOrEqual(hit.need);
            expect(hit.overlaps, where).toEqual([]);
            if (Number.isFinite(hit.pad)) {
              if (hit.pad < worst.pad) worst.pad = hit.pad;
              expect(hit.pad, where).toBeGreaterThanOrEqual(8);
            }
            if (Number.isFinite(hit.line)) {
              if (hit.line < worst.line) worst.line = hit.line;
              expect(hit.line, where).toBeGreaterThanOrEqual(1.3);
            }
          }
        }
      }
    }
  } finally {
    await page.close();
  }
}, 180_000);

test("a highlight does not move the other elements", async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/live.html?id=${encodeURIComponent("divide-facts--pf")}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".live.ready", { timeout: 60_000 });
    // A beat whose only actions are highlights, after the camera has settled and while the highlight is fully on.
    // Before the column highlight (it starts on the word "six") and while that highlight is held.
    const beforeT = 55.2, duringT = 58.0;
    for (const view of VIEWS) {
      await page.setViewportSize({ width: view.width, height: view.height });
      await page.waitForFunction((layout) => document.querySelector("#film")?.getAttribute("data-layout") === layout, view.layout);
      for (const theme of THEMES) {
        await page.evaluate((name) => { document.documentElement.dataset.theme = name; }, theme);
        const where = `divide-facts--pf ${view.width} ${theme}`;
        let note = `${where}: no settled highlight`;
        for (let attempt = 0; attempt < 3 && note; attempt++) {
        const pair = await page.evaluate(({ beforeT: t0, duringT: t1 }) => {
          const snap = (time: number) => {
            const scrub = document.querySelector<HTMLInputElement>(".live-scrub");
            if (!scrub) return [];
            scrub.value = String(time);
            scrub.dispatchEvent(new Event("input", { bubbles: true }));
            const nodes = [...document.querySelectorAll<Element>("#film path, #film circle, #film rect, #film .film-label, #film .film-line, #film .film-recap-item")];
            return nodes.map((el) => {
              const r = el.getBoundingClientRect();
              let o = 1;
              let n: Element | null = el;
              while (n && n !== document.body) {
                const cs = getComputedStyle(n);
                if (cs.display === "none" || cs.visibility === "hidden") { o = 0; break; }
                o *= Number.parseFloat(cs.opacity) || 0;
                n = n.parentElement;
              }
              const cs = getComputedStyle(el);
              const inline = (el as HTMLElement).style;
              const paint = [inline?.fill ?? "", inline?.stroke ?? "", inline?.textShadow ?? ""].join("|");
              return { x: r.x, y: r.y, w: r.width, h: r.height, o, paint };
            });
          };
          return { before: snap(t0), during: snap(t1) };
        }, { beforeT, duringT });
        const before = pair.before, during = pair.during;
        if (during.length !== before.length || during.length === 0) { note = `${where}: ${before.length} vs ${during.length}`; await page.waitForTimeout(200); continue; }
        let painted = 0, held = 0, shift = 0;
        for (let i = 0; i < before.length; i++) {
          const a = before[i]!, b = during[i]!;
          if (a.paint !== b.paint) { painted++; continue; }
          if (a.o < 0.2 || b.o < 0.2 || (a.w < 0.5 && a.h < 0.5)) continue;
          held++;
          shift = Math.max(shift, Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
        }
        note = painted > 0 && held > 0 && shift <= 1 ? "" : `${where}: painted ${painted}, held ${held}, shift ${shift.toFixed(1)}`;
        if (note) await page.waitForTimeout(250);
        }
        expect(note, note).toBe("");
      }
    }
  } finally {
    await page.close();
  }
}, 120_000);
