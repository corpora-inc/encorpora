/**
 * A table beside a stretched graph, drawn by the live player in Chrome, phone
 * and desktop.
 *
 * A stretched graph scales x and y on their own, so one unit across is not one
 * unit up. A table on that figure must map each side of a cell on its own
 * scale: its shaded cells fill the grid, and its numbers keep their size
 * instead of shrinking to fit a cell measured on the smaller scale.
 *
 * A row becomes a point: a dot placed on the row's edge (a table anchor)
 * moves to its place on the graph.
 */
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { Browser } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, expect, test } from "vitest";
import { secureChromium } from "../browser-security.mjs";
import { scriptSchema, type Script, type Timing } from "./schema";

const script: Script = scriptSchema.parse({
  id: "stretched-table-demo",
  title: "Stretched table demo",
  shots: [{
    figure: {
      // x runs over 12 units and y over 120: one unit across is ten units up
      stretch: true,
      view: [-6.5, -12, 5.5, 108],
      points: { TL: [-6, 100], E: [5, 100], D: { anchor: ["t", "right:1"] }, P: [2, 40] },
      parts: [
        { id: "ax", axes: true, step: 1, every: 1, ystep: 10, yevery: 20, xrange: [0, 5.2], yrange: [0, 104], start: true },
        { id: "t", table: true, at: "TL", corner: "$x$", head: ["$y$"], rows: [{ label: "1", cells: ["20"] }, { label: "3", cells: ["60"] }], cell: [2.4, 24], size: "m", start: true },
        { id: "line", seg: ["TL", "E"], ink: "accent", start: true },
        { id: "p", dot: "P", ink: "ink", r: 6, start: true },
        { id: "d", dot: "D", ink: "violet", r: 12, start: true },
      ],
    },
    beats: [{ say: "A table beside a stretched graph.", do: [{ do: "move", points: { D: "P" }, at: "stretched", dur: 1 }] }],
  }],
});
const words = script.shots[0]!.beats[0]!.say.split(/\s+/).map((text, i) => ({ text, start: 1 + 0.4 * i, end: 1.3 + 0.4 * i }));
const timing: Timing = { duration: 6, shots: [[{ start: words[0]!.start, end: words[words.length - 1]!.end, words }]] };

let server: ViteDevServer;
let browser: Browser;
let origin = "";

beforeAll(async () => {
  server = await createServer({
    configFile: fileURLToPath(new URL("./vite.live.config.ts", import.meta.url)),
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
    plugins: [{
      name: "film-stretched-table-demo",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (((req.url ?? "").split("?")[0] ?? "") !== `/data/${script.id}.json`) return next();
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ id: script.id, title: script.title, script, timing, figure: null }));
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

const VIEWS = [{ width: 1280, height: 800, layout: "wide" }, { width: 390, height: 844, layout: "tall" }] as const;

test("a table on a stretched graph fills its grid, keeps its type size, and its row flies to the graph", async () => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    for (const view of VIEWS) {
      await page.setViewportSize({ width: view.width, height: view.height });
      await page.goto(`${origin}/live.html?id=${script.id}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".live.ready", { timeout: 60_000 });
      await page.waitForFunction((layout) => document.querySelector("#film")?.getAttribute("data-layout") === layout, view.layout);
      const where = (what: string) => `${view.layout}: ${what}`;
      const dots = (t: number) => page.evaluate((time) => {
        const scrub = document.querySelector<HTMLInputElement>(".live-scrub")!;
        scrub.value = String(time);
        scrub.dispatchEvent(new Event("input", { bubbles: true }));
        const at = (part: string) => { const r = document.querySelector(`.film-shot [data-part="${part}"]`)!.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
        const g = document.querySelector(".film-shot .film-table-grid")!.getBoundingClientRect();
        return { d: at("d"), p: at("p"), right: g.right, rowMid: g.top + (g.height / 3) * 1.5 };
      }, t);
      // before the move the dot sits on the first body row's right edge; after it, on its point
      const before = await dots(2), after = await dots(5);
      expect(Math.abs(before.d[0]! - before.right), where("the dot starts on the table's edge")).toBeLessThanOrEqual(2);
      expect(Math.abs(before.d[1]! - before.rowMid), where("the dot starts level with its row")).toBeLessThanOrEqual(2);
      expect(Math.hypot(after.d[0]! - after.p[0]!, after.d[1]! - after.p[1]!), where("the dot lands on its point")).toBeLessThanOrEqual(1);
      const got = await page.evaluate(() => {
        const box = (el: Element) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; };
        const grid = box(document.querySelector(".film-shot .film-table-grid")!);
        const cells = [...document.querySelectorAll<SVGPathElement>(".film-shot .film-table-bg")].map(box);
        const sizes = [...document.querySelectorAll<HTMLElement>(".film-shot .film-table-cell")].map((el) => ({ text: (el.textContent ?? "").trim(), px: parseFloat(el.style.fontSize || getComputedStyle(el).fontSize) }));
        const css = (() => {
          const probe = document.createElement("div");
          probe.className = "film-label size-m";
          document.querySelector(".film-shot")!.appendChild(probe);
          const px = parseFloat(getComputedStyle(probe).fontSize);
          probe.remove();
          return px;
        })();
        return { grid, cells, sizes, css };
      });
      // two columns and three rows (the header and two body rows): each shaded cell is one column wide and one row tall
      expect(got.cells.length, where("cells drawn")).toBe(6);
      for (const c of got.cells) {
        expect(c.w, where("a cell spans its column")).toBeGreaterThan(got.grid.w / 2 - 3);
        expect(c.h, where("a cell spans its row")).toBeGreaterThan(got.grid.h / 3 - 3);
      }
      // the cells are roomy, so the numbers keep the size the part asks for
      for (const s of got.sizes) expect(s.px, where(`"${s.text}" keeps its size`)).toBeGreaterThanOrEqual(got.css - 0.5);
    }
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}, 180_000);
