/**
 * Two things a figure does with a point that travels, drawn by the live
 * player in Chrome, phone and desktop.
 *
 * A label that `flies` rides a moving point (a letter flying to its place on
 * a number path) and passes over other labels on the way. It must not shove
 * them: a shot keeps one set of label nudges for its whole length, so a shove
 * measured in mid-flight would leave both labels off their marks for good.
 * Labels that rest on each other are still pushed apart.
 *
 * A segment whose ends are things (a balloon's string, a line joining a pair)
 * follows them wherever they are sent.
 */
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, expect, test } from "vitest";
import { secureChromium } from "../browser-security.mjs";
import { scriptSchema, type Script, type Timing } from "./schema";

/** The stage's ease, a third of the way through a move: where the shot's frame is measured in mid-flight. */
const THIRD = 0.20988;
const script: Script = scriptSchema.parse({
  id: "label-flight-demo",
  title: "Label flight demo",
  shots: [{
    figure: {
      view: [-1, 0, 13, 12],
      points: { Y: [0, 6], X: [12 * THIRD, 6], R: [12 * THIRD, 2], A: [6, 10], B: [6.1, 10], Z: [12, 6] },
      parts: [
        { id: "ly", label: "\\text{Y}", at: "Y", dir: "c", size: "l", start: true, flies: true },
        { id: "lx", label: "\\text{X}", at: "X", dir: "c", size: "l", start: true },
        { id: "lr", label: "\\text{R}", at: "R", dir: "c", size: "l", start: true },
        { id: "la", label: "\\text{A}", at: "A", dir: "c", size: "l", start: true },
        { id: "lb", label: "\\text{B}", at: "B", dir: "c", size: "l", start: true },
      ],
    },
    beats: [
      { say: "Y waits here." },
      { say: "Go across now.", do: [{ do: "move", points: { Y: "Z" }, at: "Go", dur: 2 }] },
    ],
  }],
});
const pairs: Script = scriptSchema.parse({
  id: "pair-line-demo",
  title: "Pair line demo",
  shots: [{
    figure: {
      view: [0, 0, 12, 10],
      points: { A: [0, 2.4], B: [4.8, 10], C: [9.6, 6] },
      parts: [
        { id: "string", seg: ["a1", "b1"], ink: "muted", w: 4, start: true },
        { id: "a", things: "bear", n: 2, at: "A", start: true },
        { id: "b", things: "balloon", n: 1, at: "B", start: true },
        { id: "c", things: "balloon", n: 0, slots: 1, at: "C" },
      ],
    },
    beats: [
      { say: "A bear holds a balloon." },
      { say: "The balloon drifts away.", do: [{ do: "send", target: "b1", to: "c", at: "drifts", dur: 2 }] },
    ],
  }],
});
/** Words half a second apart, three seconds between beats: the move has time to finish. */
function timingOf(s: Script): Timing {
  let t = 1;
  const shots = s.shots.map((shot) => shot.beats.map((b) => {
    const words = b.say.split(/\s+/).map((text) => { const w = { text, start: t, end: t + 0.3 }; t += 0.5; return w; });
    t += 3;
    return { start: words[0]!.start, end: words[words.length - 1]!.end, words };
  }));
  return { duration: t + 1, shots };
}
const timing = timingOf(script);
const go = timing.shots[0]![1]!.words[0]!.start;
const pairsTiming = timingOf(pairs);
const drift = pairsTiming.shots[0]![1]!.words[2]!.start;
const demos: Record<string, { script: Script; timing: Timing }> = {
  "label-flight-demo": { script, timing },
  "pair-line-demo": { script: pairs, timing: pairsTiming },
};

let server: ViteDevServer;
let browser: Browser;
let origin = "";

beforeAll(async () => {
  server = await createServer({
    configFile: fileURLToPath(new URL("./vite.live.config.ts", import.meta.url)),
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
    plugins: [{
      name: "film-flight-demos",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          const demo = demos[((req.url ?? "").split("?")[0] ?? "").replace(/^\/data\/|\.json$/g, "")];
          if (!demo) return next();
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ id: demo.script.id, title: demo.script.title, script: demo.script, timing: demo.timing, figure: null }));
        });
      },
    }],
  });
  await server.listen();
  const addr = server.httpServer?.address();
  origin = `http://127.0.0.1:${addr && typeof addr === "object" ? addr.port : 0}`;
  browser = await secureChromium(chromium).launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
}, 60_000);

type Box = { l: number; t: number; r: number; b: number };
/** Seek, then read where each label was drawn, by its letter. */
async function at(page: Page, t: number): Promise<Record<string, Box>> {
  return page.evaluate((time) => {
    const scrub = document.querySelector<HTMLInputElement>(".live-scrub")!;
    scrub.value = String(time);
    scrub.dispatchEvent(new Event("input", { bubbles: true }));
    const out: Record<string, { l: number; t: number; r: number; b: number }> = {};
    for (const el of document.querySelectorAll<HTMLElement>(".film-shot .film-label")) {
      const r = el.getBoundingClientRect();
      out[(el.textContent ?? "").trim()] = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    }
    return out;
  }, t);
}
const cx = (b: Box) => (b.l + b.r) / 2;
const cy = (b: Box) => (b.t + b.b) / 2;
const meet = (a: Box, b: Box) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5;

const VIEWS = [{ width: 1280, height: 800, layout: "wide" }, { width: 390, height: 844, layout: "tall" }] as const;

test("a label in flight passes over the others without shoving them", async () => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    for (const view of VIEWS) {
      await page.setViewportSize({ width: view.width, height: view.height });
      await page.goto(`${origin}/live.html?id=label-flight-demo`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".live.ready", { timeout: 60_000 });
      await page.waitForFunction((layout) => document.querySelector("#film")?.getAttribute("data-layout") === layout, view.layout);
      const where = (what: string) => `${view.layout}: ${what}`;

      const before = await at(page, go - 0.4);
      // R sits straight below X and near nothing: X on its mark is X over R
      expect(Math.abs(cx(before.X!) - cx(before.R!)), where("X on its mark before the flight")).toBeLessThanOrEqual(0.6);
      expect(Math.abs(cy(before.Y!) - cy(before.X!)), where("Y level with X before the flight")).toBeLessThanOrEqual(0.6);

      // a third of the way through its move, Y is right on top of X; neither gives way
      const over = await at(page, go + 2 / 3);
      expect(meet(over.Y!, over.X!), where("Y passes over X")).toBe(true);
      expect(over.X, where("X as Y passes over it")).toEqual(before.X);
      expect(Math.abs(cy(over.Y!) - cy(before.Y!)), where("Y flies level")).toBeLessThanOrEqual(0.6);

      // landed: X never moved, and Y kept its height all the way
      const after = await at(page, go + 3);
      expect(after.X, where("X after the flight")).toEqual(before.X);
      expect(Math.abs(cy(after.Y!) - cy(before.Y!)), where("Y lands level")).toBeLessThanOrEqual(0.6);
      expect(cx(after.Y!), where("Y has crossed")).toBeGreaterThan(before.X!.r);
      // two labels that rest on each other from the start are apart for the whole shot
      for (const s of [before, over, after]) expect(meet(s.A!, s.B!), where("A and B")).toBe(false);
      expect(after.A, where("A after the flight")).toEqual(before.A);
      expect(after.B, where("B after the flight")).toEqual(before.B);
    }
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}, 180_000);

/** Seek, then read the one segment's ends and each thing's centre, in the figure's own pixels. */
async function line(page: Page, t: number): Promise<{ ends: number[]; things: Record<string, [number, number]> }> {
  return page.evaluate((time) => {
    const scrub = document.querySelector<HTMLInputElement>(".live-scrub")!;
    scrub.value = String(time);
    scrub.dispatchEvent(new Event("input", { bubbles: true }));
    const seg = [...document.querySelectorAll<SVGPathElement>(".film-shot svg.film-geo > path")].find((p) => /^M[-\d. ]+L[-\d. ]+$/.test(p.getAttribute("d") ?? ""))!;
    const ends = (seg.getAttribute("d") ?? "").match(/-?[\d.]+/g)!.map(Number);
    const things: Record<string, [number, number]> = {};
    for (const g of document.querySelectorAll<SVGGElement>(".film-thing")) {
      const m = (g.getAttribute("transform") ?? "").match(/translate\((-?[\d.]+) (-?[\d.]+)\)/);
      if (m) things[g.dataset.name!] = [Number(m[1]), Number(m[2])];
    }
    return { ends, things };
  }, t);
}

test("a line between two things follows them wherever they go", async () => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    for (const view of VIEWS) {
      await page.setViewportSize({ width: view.width, height: view.height });
      await page.goto(`${origin}/live.html?id=pair-line-demo`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".live.ready", { timeout: 60_000 });
      await page.waitForFunction((layout) => document.querySelector("#film")?.getAttribute("data-layout") === layout, view.layout);
      const where = (what: string) => `${view.layout}: ${what}`;
      const joined = (s: Awaited<ReturnType<typeof line>>, what: string) => {
        const [x1, y1, x2, y2] = s.ends as [number, number, number, number];
        const a = s.things.a1!, b = s.things.b1!;
        expect(Math.hypot(x1 - a[0], y1 - a[1]), where(`${what}: the line starts at the bear`)).toBeLessThanOrEqual(0.6);
        expect(Math.hypot(x2 - b[0], y2 - b[1]), where(`${what}: the line ends at the balloon`)).toBeLessThanOrEqual(0.6);
      };
      const before = await line(page, drift - 0.4), mid = await line(page, drift + 1), after = await line(page, drift + 3);
      joined(before, "at rest");
      joined(mid, "in flight");
      joined(after, "landed");
      // the balloon really went somewhere, and the bear did not
      expect(Math.hypot(after.things.b1![0] - before.things.b1![0], after.things.b1![1] - before.things.b1![1]), where("the balloon moved")).toBeGreaterThan(40);
      expect(mid.things.b1, where("the balloon in mid-flight")).not.toEqual(before.things.b1);
      expect(mid.things.b1, where("the balloon in mid-flight")).not.toEqual(after.things.b1);
      expect(after.things.a1, where("the bear")).toEqual(before.things.a1);
    }
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}, 180_000);
