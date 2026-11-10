/**
 * The live player centres each figure's ink and draws no cast name tags.
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
const worst = { centre: 0, margin: Infinity, where: "" };

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
  console.log(`frame fit: worst centre ${(worst.centre * 100).toFixed(3)}% (${worst.where}), smallest margin ${Number.isFinite(worst.margin) ? worst.margin.toFixed(2) : "n/a"}px`);
  await browser?.close();
  await server?.close();
});

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
    return { dx, dy, need, margins, tags: 0 };
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
    await page.waitForFunction(() => document.querySelector<HTMLButtonElement>('.live-grade-btn.is-approve')?.disabled === false);
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByRole("textbox", { name: "Note", exact: true }).fill("Synthetic review");
    await page.locator(".live-sheet-save").click();
    await page.waitForFunction(() => document.querySelector('.live-grade-btn.is-approve')?.getAttribute("aria-pressed") === "true");
    expect(submitted).toEqual({ id, grade: "approved", note: "Synthetic review", added });
    await page.getByRole("button", { name: /Playback speed/ }).click();
    await page.getByRole("menuitemradio", { name: "1.25×", exact: true }).click();
    expect(await page.locator("audio").evaluate((audio: HTMLAudioElement) => audio.playbackRate)).toBe(1.25);
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
          }
        }
      }
    }
  } finally {
    await page.close();
  }
}, 180_000);
