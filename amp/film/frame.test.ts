/**
 * The live player fits each figure once, to everything that shot will draw,
 * and draws no cast name tags. Text keeps its padding, wrapped lines keep
 * their leading, and a highlight grows in place without pushing a neighbour.
 * A handful of real exports, and a film whose shots draw scene specs of their
 * own (fixtures/scene-shot.ts), at phone and desktop, in both themes.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, expect, test } from "vitest";
import { secureChromium } from "../browser-security.mjs";
import { resolveCast, runsOf, TURN_GAP, voiceBindings } from "./cast";
import { scriptSchema, type Script, type Timing } from "./schema";
import { SCENE_FILM_ID, sceneFilm } from "./fixtures/scene-shot";


/** The same word-timing guess `make.ts --dry` uses, so a held highlight is the same moment. */
function dryTiming(script: Script): Timing {
  const cast = resolveCast(script, {});
  const runs = runsOf(script, cast);
  let t = 0.5;
  const shots: Timing["shots"] = [];
  for (const shot of script.shots) {
    const out: Timing["shots"][number] = [];
    shot.beats.forEach((b, bi) => {
      if (bi && runs.some((r) => r.shot === shots.length && r.from === bi)) t += TURN_GAP;
      const words: Timing["shots"][number][number]["words"] = [];
      for (const raw of b.say.split(/\s+/).filter(Boolean)) {
        const d = 0.087 + 0.0487 * raw.replace(/[^\p{L}\p{N}]/gu, "").length;
        words.push({ text: raw, start: t, end: t + d });
        t += d + 0.035 + (/[.?!:]$/.test(raw) ? 0.35 : /[,;]$/.test(raw) ? 0.14 : 0);
      }
      out.push({ start: words[0]!.start, end: words[words.length - 1]!.end, words });
      t += (b.pause ?? 0) + 0.25;
    });
    shots.push(out);
    t += 0.45;
  }
  return { duration: t + 1.8, shots, voices: voiceBindings(cast) };
}
const vaScript = scriptSchema.parse(JSON.parse(readFileSync(fileURLToPath(new URL("./lessons/count-out-objects--va.json", import.meta.url)), "utf8")));
const vaTiming = dryTiming(vaScript);
const vaPayload = JSON.stringify({ id: vaScript.id, title: vaScript.title, script: vaScript, timing: vaTiming, figure: null });

function targetsOf(action: { target?: unknown }): string[] {
  const target = action.target;
  if (typeof target === "string") return [target];
  if (Array.isArray(target)) return target.filter((x): x is string => typeof x === "string");
  return [];
}
/** Beat end, while a highlight is still fully held. */
function heldAt(say: string, includes: string[]): number {
  for (let si = 0; si < vaScript.shots.length; si++) {
    const shot = vaScript.shots[si]!;
    for (let bi = 0; bi < shot.beats.length; bi++) {
      const beat = shot.beats[bi]!;
      if (beat.say !== say) continue;
      const names = (beat.do ?? []).filter((a) => a.do === "highlight").flatMap(targetsOf);
      if (!includes.every((n) => names.includes(n))) continue;
      return vaTiming.shots[si]![bi]!.end - 0.08;
    }
  }
  throw new Error(`No held highlight for ${includes.join(", ")}`);
}
const FIX = fileURLToPath(new URL("./fixtures/frame/", import.meta.url));
/** Films built here rather than exported: shots that draw a scene spec of their own. */
const BUILT: Record<string, unknown> = { [SCENE_FILM_ID]: sceneFilm() };
const lessonOf = (id: string) => (BUILT[id] ?? JSON.parse(readFileSync(path.join(FIX, `${id}.json`), "utf8")));
const FILMS = ["frequency-table-build--pr", "line-slope", "bar-chart-total", "decimal-line-point", "count-out-objects--things", SCENE_FILM_ID];
const STABLE = [...FILMS, "divide-facts--pf", "count-sequence-missing--fn", "flat-or-solid-name--md", "pick-flat-or-solid--as"];
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
  const lesson = lessonOf(id) as {
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
          if (m[1] === "count-out-objects--va") {
            res.setHeader("content-type", "application/json");
            res.end(vaPayload);
            return;
          }
          if (BUILT[m[1]!]) {
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(BUILT[m[1]!]));
            return;
          }
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
            // The frame is the whole shot, so the ink of one moment need not sit in the middle.
            // The shot-extent test checks that the union does.
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
              const paint = [inline?.fill ?? "", inline?.stroke ?? "", el.getAttribute("data-em") ?? ""].join("|");
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

const MOTION = new Set(["move", "slide", "turn", "flip", "glide", "view", "zoom", "split", "draw", "partition", "shade", "cut"]);
const MOTION_DUR: Record<string, number> = {
  glide: 1.4, move: 1.2, turn: 2.2, flip: 2.2, slide: 1.1, view: 1.3,
  cut: 1, split: 0.9, zoom: 1.4, draw: 0.8, partition: 1.5, shade: 1.3,
};

/** Times when an authored motion can change a figure element's place. */
function motionWindows(id: string) {
  const lesson = lessonOf(id) as {
    script: { shots: { beats: { do?: { do: string; at?: string; nth?: number; dur?: number }[] }[] }[] };
    timing: { shots: { start: number; words: { text: string; start: number }[] }[][] };
  };
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const out: { shot: number; t0: number; t1: number }[] = [];
  lesson.script.shots.forEach((shot, si) => {
    const beats = lesson.timing.shots[si] ?? [];
    shot.beats.forEach((b, i) => {
      const beat = beats[i];
      if (!beat) return;
      let stagger = 0;
      for (const a of b.do ?? []) {
        let t0 = beat.start + stagger;
        if (a.at) {
          const hits = beat.words.filter((w) => norm(w.text) === norm(a.at!));
          const hit = hits[(a.nth ?? 1) - 1];
          if (hit) t0 = hit.start;
        } else stagger += 0.1;
        if (!MOTION.has(a.do)) continue;
        const dur = a.dur ?? MOTION_DUR[a.do] ?? 0.5;
        // A split can run longer than its first step. Pad so the gap between samples still counts.
        const pad = a.do === "split" ? 4 : 0.15;
        out.push({ shot: si, t0: t0 - 0.1, t1: t0 + dur + pad });
      }
    });
  });
  return out;
}

function shotSpans(id: string) {
  const lesson = lessonOf(id) as {
    script: { shots: { figure?: unknown }[] };
    timing: { duration: number; shots: { start: number }[][] };
  };
  const spans: { start: number; end: number; index: number }[] = [];
  lesson.script.shots.forEach((shot, i) => {
    const beats = lesson.timing.shots[i];
    if (!shot.figure || !beats?.length) return;
    const start = i === 0 ? 0 : beats[0]!.start - 0.5;
    const next = lesson.timing.shots[i + 1]?.[0]?.start;
    const end = next === undefined ? lesson.timing.duration : next - 0.5;
    if (end - start < 0.4) return;
    spans.push({ start: start + 0.08, end: end - 0.08, index: i });
  });
  return spans;
}

test("elements stay put unless a motion is authored, and a highlight does not cover a neighbour", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    for (const id of STABLE) {
      await page.goto(`${origin}/live.html?id=${encodeURIComponent(id)}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".live.ready", { timeout: 60_000 });
      await page.waitForFunction(() => document.querySelector("#film")?.getAttribute("data-layout") === "wide");
      await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
      const plan = shotSpans(id).flatMap((span) => {
        const step = Math.max(0.4, (span.end - span.start) / 32);
        const glideUntil = span.index === 0 ? span.start : span.start + 0.52;
        const times: { t: number; glide: boolean }[] = [];
        for (let t = span.start; t <= span.end + 1e-6; t += step) times.push({ t, glide: t < glideUntil });
        const last = times[times.length - 1];
        if (!last || span.end - last.t > 0.05) times.push({ t: span.end, glide: span.end < glideUntil });
        return times.map((sample) => ({ ...sample, shot: span.index }));
      });
      const snaps = await page.evaluate((samples) => {
        const meet = (a: { l: number; t: number; r: number; b: number }, b: { l: number; t: number; r: number; b: number }) =>
          Math.min(a.r, b.r) - Math.max(a.l, b.l) > 2 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 2;
        return samples.map((sample) => {
          const scrub = document.querySelector<HTMLInputElement>(".live-scrub");
          if (!scrub) return { error: "no scrubber" };
          scrub.value = String(sample.t);
          scrub.dispatchEvent(new Event("input", { bubbles: true }));
          const shots = [...document.querySelectorAll<HTMLElement>(".film-shot")];
          let fit: HTMLElement | null = null, best = 0, dom = -1;
          for (let i = 0; i < shots.length; i++) {
            const shot = shots[i]!;
            const o = Number.parseFloat(getComputedStyle(shot).opacity);
            const host = shot.querySelector<HTMLElement>(".film-fit");
            if (!host || o < 0.8 || getComputedStyle(shot).visibility === "hidden") continue;
            if (o >= best) { fit = host; best = o; dom = i; }
          }
          if (!fit || dom !== sample.shot) return { t: sample.t, shot: sample.shot, glide: sample.glide, moving: false, items: [], hits: [], ink: null, card: null };
          const cardEl = fit.parentElement;
          const cardBox = cardEl?.getBoundingClientRect();
          const card = cardBox ? { l: cardBox.left, t: cardBox.top, r: cardBox.right, b: cardBox.bottom, w: cardBox.width, h: cardBox.height } : null;
          const shown = (el: Element) => {
            let o = 1;
            let n: Element | null = el;
            while (n && n !== document.body) {
              const cs = getComputedStyle(n);
              if (cs.display === "none" || cs.visibility === "hidden") return 0;
              o *= Number.parseFloat(cs.opacity) || 0;
              n = n.parentElement;
            }
            return o;
          };
          const paint = (el: Element) => {
            if (el.classList.contains("film-em")) return false;
            if (el instanceof SVGSVGElement || el instanceof SVGGElement) return false;
            if (el instanceof SVGGraphicsElement) return true;
            if (!(el instanceof HTMLElement)) return false;
            if (el.classList.contains("film-label")) return true;
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
          const ink = Number.isFinite(l) ? { l, t: top, r, b } : null;
          const nodes = [...fit.querySelectorAll<Element>("path, circle, rect, ellipse, polygon, polyline, .film-label")];
          const items: { i: number; x: number; y: number }[] = [];
          nodes.forEach((el, i) => {
            if (el.classList.contains("film-em") || shown(el) < 0.45) return;
            if (el instanceof SVGGraphicsElement) {
              let box: { x: number; y: number; width: number; height: number };
              try { box = el.getBBox(); } catch { return; }
              if (box.width + box.height < 0.5) return;
              items.push({ i, x: box.x + box.width / 2, y: box.y + box.height / 2 });
            } else if (el instanceof HTMLElement) {
              const m = el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
              if (!m || el.offsetWidth + el.offsetHeight < 1) return;
              items.push({ i, x: parseFloat(m[1]!) + el.offsetWidth / 2, y: parseFloat(m[2]!) + el.offsetHeight / 2 });
            }
          });
          const hits: string[] = [];
          const hot = [...fit.querySelectorAll<Element>("[data-em]")].filter((el) => !el.classList.contains("film-em") && shown(el) > 0.45 && Number(el.getAttribute("data-em") || 0) > 0.35);
          const others: { el: Element; box: DOMRect }[] = [];
          const collect = (el: Element, opac: number) => {
            if (el.classList.contains("film-em")) return;
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") return;
            const o = opac * (Number.parseFloat(cs.opacity) || 0);
            if (o < 0.45) return;
            if (paint(el)) {
              const box = el.getBoundingClientRect();
              if (box.width >= 0.5 || box.height >= 0.5) others.push({ el, box });
            }
            if (el instanceof HTMLElement && el.classList.contains("film-label")) return;
            for (const c of el.children) collect(c, o);
          };
          for (const c of fit.children) collect(c, 1);
          for (const el of hot) {
            const grown = el.getBoundingClientRect();
            const em = Number(el.getAttribute("data-em") || 0);
            const k = 1 + 0.15 * em;
            const cx = (grown.left + grown.right) / 2, cy = (grown.top + grown.bottom) / 2;
            const rest = { l: cx - grown.width / k / 2, t: cy - grown.height / k / 2, r: cx + grown.width / k / 2, b: cy + grown.height / k / 2 };
            const gb = { l: grown.left, t: grown.top, r: grown.right, b: grown.bottom };
            for (const other of others) {
              if (other.el === el || el.contains(other.el) || other.el.contains(el) || other.el.classList.contains("film-things-extent")) continue;
              const o = other.box;
              const ocx = (o.left + o.right) / 2, ocy = (o.top + o.bottom) / 2;
              if (ocx > rest.l && ocx < rest.r && ocy > rest.t && ocy < rest.b) continue;
              if (!meet(gb, { l: o.left, t: o.top, r: o.right, b: o.bottom })) continue;
              const label = ((el.textContent || el.getAttribute("class") || el.tagName) + " ∩ " + (other.el.textContent || other.el.getAttribute("class") || other.el.tagName)).replace(/\s+/g, " ").trim().slice(0, 80);
              if (hits.length < 4) hits.push(label);
            }
          }
          return { t: sample.t, shot: sample.shot, glide: sample.glide, moving: fit.dataset.moving === "1", items, hits, ink, card };
        });
      }, plan);
      let shot = -1;
      const windows = motionWindows(id);
      const busy = (shotN: number, a: number, b: number) => windows.some((w) => w.shot === shotN && w.t1 > a && w.t0 < b);
      let prev: { t: number; shot: number; moving: boolean; items: { i: number; x: number; y: number }[] } | null = null;
      for (const snap of snaps) {
        if (!snap || "error" in snap) throw new Error(`${id}: ${snap && "error" in snap ? snap.error : "no sample"}`);
        if (snap.shot !== shot) { shot = snap.shot; prev = null; }
        expect(snap.hits, `${id} shot ${snap.shot} t=${snap.t.toFixed(2)}`).toEqual([]);
        if (!snap.glide && snap.ink && snap.card) {
          const need = Math.max(Math.min(snap.card.w, snap.card.h) * 0.06, 16) - 1;
          const where = `${id} shot ${snap.shot} t=${snap.t.toFixed(2)} margin`;
          expect(snap.ink.l - snap.card.l, where).toBeGreaterThanOrEqual(need);
          expect(snap.card.r - snap.ink.r, where).toBeGreaterThanOrEqual(need);
          expect(snap.ink.t - snap.card.t, where).toBeGreaterThanOrEqual(need);
          expect(snap.card.b - snap.ink.b, where).toBeGreaterThanOrEqual(need);
        }
        if (prev && prev.shot === snap.shot && !prev.moving && !snap.moving && !busy(snap.shot, prev.t, snap.t)) {
          const at = new Map(snap.items.map((item) => [item.i, item]));
          for (const item of prev.items) {
            const next = at.get(item.i);
            if (!next) continue;
            const where = `${id} shot ${snap.shot} t=${snap.t.toFixed(2)} #${item.i}`;
            expect(Math.abs(item.x - next.x), where).toBeLessThanOrEqual(1);
            expect(Math.abs(item.y - next.y), where).toBeLessThanOrEqual(1);
          }
        }
        prev = snap;
      }
    }
  } finally {
    await page.close();
  }
}, 180_000);

const PHONE = [
  { width: 390, height: 844 },
  { width: 412, height: 892 },
] as const;

/** Times across the whole film, plus the founder's phone frame at 11:31. */
function phoneSamples(id: string): number[] {
  const lesson = lessonOf(id) as { timing: { duration: number } };
  const times: number[] = [];
  for (let t = 0.4; t <= lesson.timing.duration; t += 2) times.push(Math.round(t * 10) / 10);
  const at = 11 * 60 + 31;
  if (at <= lesson.timing.duration + 0.2) times.push(at);
  return times;
}

test("on a phone, no text sits behind a card or is cut in half", async () => {
  const id = "standard-algorithm-rows--aq";
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/live.html?id=${encodeURIComponent(id)}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".live.ready", { timeout: 60_000 });
    const samples = phoneSamples(id);
    expect(samples).toContain(11 * 60 + 31);
    for (const view of PHONE) {
      await page.setViewportSize({ width: view.width, height: view.height });
      await page.waitForFunction(() => document.querySelector("#film")?.getAttribute("data-layout") === "tall");
      for (const theme of THEMES) {
        await page.evaluate((name) => { document.documentElement.dataset.theme = name; }, theme);
        const bad = await page.evaluate((times) => {
          const TEXT = ".film-label, .film-prose, .film-math, .film-display, .film-note, .film-stack-cell, .film-line.term > b, .film-line.term > span, .film-choices > span, .film-recap-item > b, .film-recap-item > span, .film-line.watch, .film-line.text";
          const CARD = ".film-figure, .film-recap-list, .film-line.problem, .film-line.term, .film-line.watch, .film-line.answer";
          const shown = (el: Element) => {
            let o = 1;
            let n: Element | null = el;
            while (n && n !== document.body) {
              const cs = getComputedStyle(n);
              if (cs.display === "none" || cs.visibility === "hidden") return 0;
              o *= Number.parseFloat(cs.opacity) || 0;
              if (o < 0.04) return 0;
              n = n.parentElement;
            }
            return o;
          };
          const problems: string[] = [];
          const note = (m: string) => { if (problems.length < 8) problems.push(m); };
          for (const time of times) {
            const scrub = document.querySelector<HTMLInputElement>(".live-scrub");
            if (!scrub) return { problems: ["no scrubber"], recap: 0, first: "" };
            scrub.value = String(time);
            scrub.dispatchEvent(new Event("input", { bubbles: true }));
            const cards = [...document.querySelectorAll<HTMLElement>(CARD)].flatMap((el) => {
              if (shown(el) < 0.04) return [];
              const b = el.getBoundingClientRect();
              if (b.width < 2 || b.height < 2) return [];
              return [{ el, l: b.left, t: b.top, r: b.right, b: b.bottom }];
            });
            for (const el of document.querySelectorAll<HTMLElement>(TEXT)) {
              if (shown(el) < 0.04) continue;
              const label = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 42);
              for (const box of el.getClientRects()) {
                if (box.width < 1 || box.height < 1) continue;
                let l = box.left, t = box.top, r = box.right, b = box.bottom;
                let hidden = false, partial = false;
                let n: HTMLElement | null = el.parentElement;
                while (n && n !== document.body) {
                  const cs = getComputedStyle(n);
                  if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
                    const h = n.getBoundingClientRect();
                    const nl = Math.max(l, h.left), nt = Math.max(t, h.top), nr = Math.min(r, h.right), nb = Math.min(b, h.bottom);
                    if (box.width - (nr - nl) > 3 || box.height - (nb - nt) > 3) {
                      if (nr - nl <= 2 || nb - nt <= 2) hidden = true;
                      else partial = true;
                    }
                    l = nl; t = nt; r = nr; b = nb;
                  }
                  n = n.parentElement;
                }
                if (hidden) continue;
                if (partial) { note(`cut "${label}" @ ${time}s`); continue; }
                for (const card of cards) {
                  if (card.el.contains(el) || el.contains(card.el)) continue;
                  const ox = Math.min(r, card.r) - Math.max(l, card.l);
                  const oy = Math.min(b, card.b) - Math.max(t, card.t);
                  if (ox > 2 && oy > 2) note(`"${label}" behind a card @ ${time}s`);
                }
              }
            }
          }
          const scrub = document.querySelector<HTMLInputElement>(".live-scrub");
          if (scrub) {
            scrub.value = "691";
            scrub.dispatchEvent(new Event("input", { bubbles: true }));
          }
          const recap = [...document.querySelectorAll(".film-recap-item span")].map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim());
          const visible = recap.filter((_, i) => shown(document.querySelectorAll(".film-recap-item span")[i]!) >= 0.04);
          return { problems, recap: visible.length, first: visible[0] ?? "" };
        }, samples);
        expect(bad.problems, `${id} ${view.width} ${theme}`).toEqual([]);
        expect(bad.recap, `${id} ${view.width} ${theme} recap steps`).toBeGreaterThanOrEqual(5);
        expect(bad.first, `${id} ${view.width} ${theme} first step`).toMatch(/Ones row/);
      }
    }
  } finally {
    await page.close();
  }
}, 240_000);

/** One moment per shot where a run of steps is showing its reason labels. */
function stackTimes(id: string): number[] {
  const lesson = lessonOf(id) as {
    script: { shots: { beats: { do?: { do: string; note?: string }[] }[] }[] };
    timing: { shots: { end: number }[][] };
  };
  const times: number[] = [];
  lesson.script.shots.forEach((shot, si) => {
    let notes = 0;
    let at = -1;
    shot.beats.forEach((beat, bi) => {
      for (const action of beat.do ?? []) {
        if (action.do === "clear") notes = 0;
        if ((action.do === "write" || action.do === "answer") && action.note) notes++;
      }
      const end = lesson.timing.shots[si]?.[bi]?.end;
      if (notes >= 2 && end) at = end - 0.08;
    });
    if (at > 0) times.push(at);
  });
  return times;
}

test("derivation labels share one edge and equations do not overlap", async () => {
  const id = "parabola-derivation-check--sg";
  const views = [
    { width: 390, height: 844, layout: "tall" },
    { width: 412, height: 892, layout: "tall" },
    { width: 1280, height: 800, layout: "wide" },
  ] as const;
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/live.html?id=${encodeURIComponent(id)}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".live.ready", { timeout: 60_000 });
    const times = stackTimes(id);
    expect(times.length).toBeGreaterThan(0);
    for (const view of views) {
      await page.setViewportSize({ width: view.width, height: view.height });
      await page.waitForFunction((layout) => document.querySelector("#film")?.getAttribute("data-layout") === layout, view.layout);
      const got = await page.evaluate((samples) => {
        const TEXT = ".film-label, .film-prose, .film-math, .film-display, .film-note, .film-stack-cell, .film-line.term > b, .film-line.term > span, .film-choices > span, .film-recap-item > b, .film-recap-item > span, .film-line.watch, .film-line.text";
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
        const problems: string[] = [];
        const note = (m: string) => { if (problems.length < 6) problems.push(m); };
        let stacks = 0;
        for (const time of samples) {
          const scrub = document.querySelector<HTMLInputElement>(".live-scrub");
          if (!scrub) return { problems: ["no scrubber"], stacks: 0 };
          scrub.value = String(time);
          scrub.dispatchEvent(new Event("input", { bubbles: true }));
          for (const col of document.querySelectorAll<HTMLElement>(".film-col")) {
            if (shown(col) < 0.45) continue;
            let notes: DOMRect[] = [];
            let eqs: number[] = [];
            const flush = () => {
              if (notes.length >= 2) {
                stacks++;
                const lefts = notes.map((b) => b.left);
                const rights = notes.map((b) => b.right);
                const span = Math.min(Math.max(...lefts) - Math.min(...lefts), Math.max(...rights) - Math.min(...rights));
                if (span > 1) note(`labels differ by ${span.toFixed(1)}px @ ${time}s`);
              }
              if (eqs.length >= 2) {
                const span = Math.max(...eqs) - Math.min(...eqs);
                if (span > 1) note(`equals differ by ${span.toFixed(1)}px @ ${time}s`);
              }
              notes = [];
              eqs = [];
            };
            for (const line of col.querySelectorAll<HTMLElement>(":scope > .film-line")) {
              if (shown(line) < 0.45) continue;
              if (!line.classList.contains("write")) { flush(); continue; }
              const label = line.querySelector<HTMLElement>(".film-note");
              if (label && shown(label) >= 0.45) notes.push(label.getBoundingClientRect());
              const math = line.querySelector<HTMLElement>(".film-math");
              const rel = math ? [...math.querySelectorAll<HTMLElement>(".mrel")].find((el) => (el.textContent ?? "").trim() === "=") : undefined;
              if (rel && math && shown(math) >= 0.45) eqs.push(rel.getBoundingClientRect().left);
            }
            flush();
          }
          const boxes: { l: number; t: number; r: number; b: number; name: string }[] = [];
          for (const el of document.querySelectorAll<HTMLElement>(TEXT)) {
            if (shown(el) < 0.45) continue;
            const raw = el.getBoundingClientRect();
            const v = clip(el, raw);
            if (v.r - v.l < 2 || v.b - v.t < 2) continue;
            boxes.push({ ...v, name: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 32) });
          }
          for (let i = 0; i < boxes.length; i++) {
            const a = boxes[i]!;
            for (let j = i + 1; j < boxes.length; j++) {
              const c = boxes[j]!;
              const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l);
              const oy = Math.min(a.b, c.b) - Math.max(a.t, c.t);
              if (ox > 2 && oy > 2) note(`"${a.name}" ∩ "${c.name}" @ ${time}s`);
            }
          }
        }
        return { problems, stacks };
      }, times);
      expect(got.stacks, `${id} ${view.width}`).toBeGreaterThan(0);
      expect(got.problems, `${id} ${view.width}`).toEqual([]);
    }
  } finally {
    await page.close();
  }
}, 180_000);

/** One time near the end of every beat, when that beat's marks are on screen. */
function beatEnds(id: string): number[] {
  const lesson = lessonOf(id) as {
    timing: { shots: { start: number; end: number }[][] };
  };
  const times: number[] = [];
  for (const beats of lesson.timing.shots) {
    for (const beat of beats) times.push(Math.max(beat.start + 0.35, beat.end - 0.12));
  }
  return times;
}

test("a shaded or boxed region keeps half a line around what it holds", async () => {
  const id = "standard-algorithm-rows--aq";
  const times = beatEnds(id);
  expect(times.length).toBeGreaterThan(10);
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/live.html?id=${encodeURIComponent(id)}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".live.ready", { timeout: 60_000 });
    let checked = 0;
    for (const view of VIEWS) {
      await page.setViewportSize({ width: view.width, height: view.height });
      await page.waitForFunction((layout) => document.querySelector("#film")?.getAttribute("data-layout") === layout, view.layout);
      for (const theme of THEMES) {
        await page.evaluate((name) => { document.documentElement.dataset.theme = name; }, theme);
        const failures = await page.evaluate((samples) => {
          const shown = (el: Element) => {
            let o = 1;
            let n: Element | null = el;
            while (n && n !== document.body) {
              const cs = getComputedStyle(n);
              if (cs.display === "none" || cs.visibility === "hidden") return 0;
              o *= Number.parseFloat(cs.opacity) || 0;
              n = n.parentElement;
            }
            return o;
          };
          const scaleOf = (el: Element) => {
            const box = el.getBoundingClientRect();
            if (el instanceof HTMLElement && el.offsetWidth > 1) return box.width / el.offsetWidth;
            if (el instanceof SVGGraphicsElement) {
              try {
                const local = el.getBBox().width;
                if (local > 1) return box.width / local;
              } catch { /* not laid out */ }
            }
            return 1;
          };
          const halfLine = (el: Element, scale: number) => {
            const cs = getComputedStyle(el);
            const fs = Number.parseFloat(cs.fontSize);
            const lh = cs.lineHeight === "normal" ? fs * 1.2 : Number.parseFloat(cs.lineHeight);
            return 0.5 * (Number.isFinite(lh) && lh > 0 ? lh : fs) * scale;
          };
          const inkOf = (el: HTMLElement) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            const boxes = [...range.getClientRects()].filter((r) => r.width >= 0.5 && r.height >= 0.5);
            if (!boxes.length) return null;
            let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
            for (const box of boxes) {
              l = Math.min(l, box.left); t = Math.min(t, box.top); r = Math.max(r, box.right); b = Math.max(b, box.bottom);
            }
            return { l, t, r, b };
          };
          const paint = (cs: CSSStyleDeclaration) => {
            const bg = cs.backgroundColor;
            const filled = !!bg && bg !== "transparent" && !/rgba?\([^)]*,\s*0(?:\.0+)?\)/.test(bg) && !bg.endsWith("/ 0)") && !bg.endsWith("/0)");
            return filled;
          };
          const problems: string[] = [];
          const note = (msg: string) => { if (problems.length < 6) problems.push(msg); };
          let saw = 0;
          for (const time of samples) {
            const scrub = document.querySelector<HTMLInputElement>(".live-scrub");
            if (!scrub) return ["no scrubber"];
            scrub.value = String(time);
            scrub.dispatchEvent(new Event("input", { bubbles: true }));
            const regions: { el: HTMLElement; kind: string }[] = [];
            for (const band of document.querySelectorAll<HTMLElement>(".film-stack-band")) {
              if (shown(band) < 0.45) continue;
              const box = band.getBoundingClientRect();
              if (box.width < 2 || box.height < 2) continue;
              regions.push({ el: band, kind: "column" });
            }
            for (const card of document.querySelectorAll<HTMLElement>(".film-line.problem, .film-line.term, .film-line.watch, .film-line.answer, .film-recap-list, .film-choices > span")) {
              if (shown(card) < 0.45 || !paint(getComputedStyle(card))) continue;
              regions.push({ el: card, kind: "card" });
            }
            for (const cell of document.querySelectorAll<HTMLElement>(".film-table-bg")) {
              if (shown(cell) < 0.45) continue;
              const box = cell.getBoundingClientRect();
              if (box.width < 2 || box.height < 2) continue;
              regions.push({ el: cell, kind: "cell" });
            }
            for (const region of regions) {
              const box = region.el.getBoundingClientRect();
              const scale = scaleOf(region.el);
              const held: { l: number; t: number; r: number; b: number; el: HTMLElement }[] = [];
              const texts = region.kind === "column"
                ? [...region.el.parentElement!.querySelectorAll<HTMLElement>(".film-stack-cell")]
                : region.kind === "card"
                  ? [...region.el.querySelectorAll<HTMLElement>("*")]
                  : [...document.querySelectorAll<HTMLElement>(".film-table-cell")];
              for (const el of texts) {
                if (shown(el) < 0.45) continue;
                if (!(el.textContent ?? "").trim()) continue;
                const ink = inkOf(el);
                if (!ink) continue;
                const cx = (ink.l + ink.r) / 2, cy = (ink.t + ink.b) / 2;
                if (cx < box.left || cx > box.right || cy < box.top || cy > box.bottom) continue;
                held.push({ ...ink, el });
              }
              if (!held.length) continue;
              saw++;
              let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, margin = 0;
              for (const piece of held) {
                l = Math.min(l, piece.l); t = Math.min(t, piece.t); r = Math.max(r, piece.r); b = Math.max(b, piece.b);
                margin = Math.max(margin, halfLine(piece.el, scale));
              }
              const slack = 1;
              const sides = [
                ["left", l - box.left],
                ["right", box.right - r],
                ["top", t - box.top],
                ["bottom", box.bottom - b],
              ] as const;
              for (const [side, gap] of sides) {
                if (gap < margin - slack) note(`${region.kind} ${side} ${gap.toFixed(1)}px < ${margin.toFixed(1)}px at ${time.toFixed(1)}s`);
              }
              if (region.kind === "column") {
                const rule = region.el.parentElement!.querySelector<HTMLElement>(".film-stack-rule");
                if (rule && shown(rule) >= 0.45) {
                  const line = rule.getBoundingClientRect();
                  const over = line.bottom > box.top && line.top < box.bottom && line.right > box.left && line.left < box.right;
                  if (over) {
                    let above = Infinity, below = Infinity;
                    for (const piece of held) {
                      if (piece.b <= line.bottom + slack) above = Math.min(above, line.top - piece.b);
                      if (piece.t >= line.top - slack) below = Math.min(below, piece.t - line.bottom);
                    }
                    if (Number.isFinite(above) && above < margin - slack) note(`rule meets the digit above (${above.toFixed(1)}px) at ${time.toFixed(1)}s`);
                    if (Number.isFinite(below) && below < margin - slack) note(`rule meets the answer (${below.toFixed(1)}px) at ${time.toFixed(1)}s`);
                    if (line.top - box.top < margin - slack) note(`rule meets the top of the column at ${time.toFixed(1)}s`);
                    if (box.bottom - line.bottom < margin - slack) note(`rule meets the bottom of the column at ${time.toFixed(1)}s`);
                  }
                }
              }
            }
          }
          (window as unknown as { __boxChecks?: number }).__boxChecks = saw;
          return problems;
        }, times);
        checked += await page.evaluate(() => (window as unknown as { __boxChecks?: number }).__boxChecks ?? 0);
        expect(failures, `${id} ${view.width} ${theme}`).toEqual([]);
      }
    }
    expect(checked).toBeGreaterThan(0);
  } finally {
    await page.close();
  }
}, 180_000);

test("a lit ten-frame keeps every counter in the middle of its cell and off its neighbour", async () => {
  const moments = [
    { name: "f1", ids: ["f1"], t: heldAt("The last number is ten, so this frame shows ten. A full frame is ten.", ["f1"]) },
    { name: "seconds", ids: ["fA2", "fB2", "fD2"], t: heldAt("It does not fit in one frame. Seventeen needs a second frame.", ["fA2", "fB2", "fD2"]) },
  ];
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/live.html?id=${encodeURIComponent("count-out-objects--va")}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".live.ready", { timeout: 60_000 });
    for (const view of VIEWS) {
      await page.setViewportSize({ width: view.width, height: view.height });
      await page.waitForFunction((layout) => document.querySelector("#film")?.getAttribute("data-layout") === layout, view.layout);
      await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
      for (const moment of moments) {
        const got = await page.evaluate(({ ids, t }) => {
          const scrub = document.querySelector<HTMLInputElement>(".live-scrub");
          if (!scrub) return { error: "no scrubber" };
          scrub.value = String(t);
          scrub.dispatchEvent(new Event("input", { bubbles: true }));
          const shots = [...document.querySelectorAll<HTMLElement>(".film-shot")];
          let fit: HTMLElement | null = null, best = 0;
          for (const shot of shots) {
            const o = Number.parseFloat(getComputedStyle(shot).opacity);
            const host = shot.querySelector<HTMLElement>(".film-fit");
            if (!host || o < 0.5 || getComputedStyle(shot).visibility === "hidden") continue;
            if (o >= best) { fit = host; best = o; }
          }
          if (!fit) return { error: "no figure" };
          const shown = (el: Element) => {
            let o = 1;
            let n: Element | null = el;
            while (n && n !== document.body) {
              const cs = getComputedStyle(n);
              if (cs.display === "none" || cs.visibility === "hidden") return 0;
              o *= Number.parseFloat(cs.opacity) || 0;
              n = n.parentElement;
            }
            return o;
          };
          const at = (el: SVGGraphicsElement, x: number, y: number) => {
            const svg = el.ownerSVGElement;
            const ctm = el.getScreenCTM();
            if (!svg || !ctm) return null;
            const pt = svg.createSVGPoint();
            pt.x = x; pt.y = y;
            const p = pt.matrixTransform(ctm);
            return { x: p.x, y: p.y };
          };
          const problems: string[] = [];
          const grids = [...fit.querySelectorAll<SVGGraphicsElement>('[data-kind="grid"]')].filter((el) => shown(el) > 0.45);
          const byId = new Map(grids.map((el) => [el.dataset.part ?? "", el]));
          for (const id of ids) {
            const grid = byId.get(id);
            if (!grid) { problems.push(`${id} is not on screen`); continue; }
            const box = grid.getBBox();
            const cols = Number(grid.dataset.cols || 0), rows = Number(grid.dataset.rows || 0);
            if (cols < 1 || rows < 1 || box.width < 1) { problems.push(`${id} has no cells`); continue; }
            const cellW = box.width / cols, cellH = box.height / rows;
            const cells: { x: number; y: number; l: number; t: number; r: number; b: number }[] = [];
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
              const x0 = box.x + c * cellW, y0 = box.y + r * cellH;
              const corners = [[x0, y0], [x0 + cellW, y0], [x0, y0 + cellH], [x0 + cellW, y0 + cellH]].map(([x, y]) => at(grid, x!, y!));
              if (corners.some((p) => !p)) { problems.push(`${id} cell did not map`); continue; }
              const xs = corners.map((p) => p!.x), ys = corners.map((p) => p!.y);
              const mid = at(grid, x0 + cellW / 2, y0 + cellH / 2);
              if (!mid) continue;
              cells.push({ x: mid.x, y: mid.y, l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) });
            }
            const ctm = grid.getScreenCTM();
            const stroke = (parseFloat(grid.style.strokeWidth || "0") || 0) * (ctm ? Math.hypot(ctm.a, ctm.b) : 1);
            const inset = stroke / 2;
            let counters = 0;
            const inside = (x: number, y: number) => cells.some((cell) => x > cell.l && x < cell.r && y > cell.t && y < cell.b);
            const pieces = [
              ...fit.querySelectorAll<SVGGraphicsElement>('[data-kind="counter"]'),
              ...fit.querySelectorAll<HTMLElement>(".film-label"),
            ];
            for (const el of pieces) {
              if (shown(el) < 0.45) continue;
              const rect = el.getBoundingClientRect();
              if (rect.width < 1 || rect.height < 1) continue;
              const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
              if (!inside(cx, cy)) continue;
              counters++;
              let best = cells[0]!, dist = Infinity;
              for (const cell of cells) {
                const d = Math.hypot(cell.x - cx, cell.y - cy);
                if (d < dist) { best = cell; dist = d; }
              }
              const span = Math.min(best.r - best.l, best.b - best.t);
              if (dist > Math.max(1.25, span * 0.04)) problems.push(`${el.dataset.part ?? "label"} sits ${dist.toFixed(1)}px off the middle of a ${id} cell`);
              if (el.dataset.kind === "counter") {
                const cut = rect.left < best.l + inset - 0.5 || rect.right > best.r - inset + 0.5 || rect.top < best.t + inset - 0.5 || rect.bottom > best.b - inset + 0.5;
                if (cut) problems.push(`${el.dataset.part} is cut by a line of ${id}`);
              }
            }
            if (counters < 1) problems.push(`${id} has no counter in its cells`);
            const mine = grid.getBoundingClientRect();
            for (const other of grids) {
              if (other === grid) continue;
              const o = other.getBoundingClientRect();
              const ox = Math.min(mine.right, o.right) - Math.max(mine.left, o.left);
              const oy = Math.min(mine.bottom, o.bottom) - Math.max(mine.top, o.top);
              if (ox > 1 && oy > 1) problems.push(`${id} covers ${other.dataset.part} by ${ox.toFixed(1)}×${oy.toFixed(1)}px`);
            }
          }
          return { problems };
        }, { ids: moment.ids, t: moment.t });
        const where = `${moment.name} ${view.layout} t=${moment.t.toFixed(2)}`;
        if (!got || "error" in got) throw new Error(`${where}: ${got && "error" in got ? got.error : "no measurement"}`);
        expect(got.problems, where).toEqual([]);
      }
    }
  } finally {
    await page.close();
  }
}, 120_000);
