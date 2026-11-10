/**
 * Things to count, drawn by the live player in Chrome: each thing lights as
 * its number is said, one at a time; a light is paint only (nothing moves or
 * resizes, and the picture is never re-framed); things arrive, move between
 * groups and leave; the count ticks with the voice; and the drawings wear the
 * theme's own paints in light and dark. Phone and desktop.
 */
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, expect, test } from "vitest";
import { secureChromium } from "../browser-security.mjs";
import { scriptSchema, type Script, type Timing } from "./schema";
import { thingsProblems } from "./things";

const script: Script = scriptSchema.parse({
  id: "things-demo",
  title: "Things demo",
  shots: [{
    figure: {
      view: [0, 0, 12, 11.4],
      points: { P: [1.5, 11.4], L: [0, 4.4] },
      parts: [
        { id: "pile", things: "apple", n: 4, slots: 6, at: "P", arrange: "scatter", perRow: 3, seed: "demo", start: true },
        { id: "row", things: "duck", n: 5, at: "L", count: true },
      ],
    },
    beats: [
      { say: "One, two, three, four, five.", do: [{ do: "count", target: "row" }] },
      { say: "Count again: one, two, three, four, five.", do: [{ do: "count", target: "row" }] },
      { say: "Two go to the pile.", do: [{ do: "send", target: ["row.4", "row.5"], to: "pile", at: "Two" }] },
      { say: "One leaves.", do: [{ do: "leave", target: "row3", at: "leaves" }] },
    ],
  }],
});
/** Words half a second apart, two seconds between beats: every motion has time to finish. */
function timingOf(s: Script): Timing {
  let t = 1;
  const shots = s.shots.map((shot) => shot.beats.map((b) => {
    const words = b.say.split(/\s+/).map((text) => { const w = { text, start: t, end: t + 0.3 }; t += 0.5; return w; });
    t += 2;
    return { start: words[0]!.start, end: words[words.length - 1]!.end, words };
  }));
  return { duration: t + 1, shots };
}
const timing = timingOf(script);
const beat = (i: number) => timing.shots[0]![i]!;
/** When the k-th number of a beat is said (the count's words are its last five). */
const said = (i: number, k: number) => beat(i).words[beat(i).words.length - 5 + k]!.start;

let server: ViteDevServer;
let browser: Browser;
let origin = "";

beforeAll(async () => {
  expect(thingsProblems(script)).toEqual([]);
  server = await createServer({
    configFile: fileURLToPath(new URL("./vite.live.config.ts", import.meta.url)),
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
    plugins: [{
      name: "film-things-demo",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if ((req.url ?? "").split("?")[0] !== "/data/things-demo.json") return next();
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

type Snap = {
  fit: string;
  card: { l: number; t: number; r: number; b: number };
  count: { text: string; o: number };
  order: string[];
  things: Record<string, { shown: boolean; o: number; at: string; glow: number; ring: number; tick: number; box: { l: number; t: number; r: number; b: number }; fill: string }>;
};
/** Seek, then read every thing as the browser drew it. */
async function at(page: Page, t: number): Promise<Snap> {
  return page.evaluate((time) => {
    const scrub = document.querySelector<HTMLInputElement>(".live-scrub")!;
    scrub.value = String(time);
    scrub.dispatchEvent(new Event("input", { bubbles: true }));
    const rect = (r: DOMRect) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
    const things: Snap["things"] = {};
    const order: string[] = [];
    for (const g of document.querySelectorAll<SVGGElement>(".film-thing")) {
      const name = g.dataset.name!;
      order.push(name);
      const shown = g.style.display !== "none";
      const art = [...g.querySelectorAll<SVGPathElement>("path:not(.film-thing-tick)")];
      let l = Infinity, t0 = Infinity, r = -Infinity, b = -Infinity;
      if (shown) for (const p of art) { const q = p.getBoundingClientRect(); l = Math.min(l, q.left); t0 = Math.min(t0, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
      const part = (cls: string) => Number(g.querySelector<SVGElement>(cls)!.style.opacity || "0");
      things[name] = {
        shown, o: shown ? Number(g.style.opacity || "1") : 0, at: g.getAttribute("transform") ?? "",
        glow: part(".film-thing-glow"), ring: part(".film-thing-ring"), tick: part(".film-thing-tick"),
        box: { l, t: t0, r, b }, fill: getComputedStyle(art[0]!).fill,
      };
    }
    const count = document.querySelector<HTMLElement>(".film-things-count")!;
    return {
      fit: document.querySelector<HTMLElement>(".film-shot .film-fit")!.style.transform,
      card: rect(document.querySelector(".film-shot .film-figure")!.getBoundingClientRect()),
      count: { text: (count.textContent ?? "").trim(), o: Number(count.style.opacity || "1") },
      order, things,
    };
  }, t);
}
const ducks = ["row1", "row2", "row3", "row4", "row5"];
const apples = ["pile1", "pile2", "pile3", "pile4"];
const lit = (s: Snap) => Object.entries(s.things).filter(([, v]) => v.shown && (v.glow > 0.5 || v.ring > 0.5)).map(([n]) => n);
const places = (s: Snap, names: string[]) => names.map((n) => s.things[n]!.at);
const apart = (a: Snap["things"][string]["box"], b: Snap["things"][string]["box"]) => a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t;

const VIEWS = [{ width: 1280, height: 800, layout: "wide" }, { width: 390, height: 844, layout: "tall" }] as const;

test("things light on their numbers, paint only, in a picture that never re-frames", async () => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    for (const view of VIEWS) {
      await page.setViewportSize({ width: view.width, height: view.height });
      await page.goto(`${origin}/live.html?id=things-demo`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".live.ready", { timeout: 60_000 });
      await page.waitForFunction((layout) => document.querySelector("#film")?.getAttribute("data-layout") === layout, view.layout);
      const where = (what: string) => `${view.layout}: ${what}`;

      // before a word is said: the pile is there, the ducks are not, the count shows nothing
      const start = await at(page, 0.6);
      expect(apples.every((n) => start.things[n]!.shown), where("pile at the start")).toBe(true);
      expect(ducks.some((n) => start.things[n]!.shown), where("ducks at the start")).toBe(false);
      expect(start.count.o, where("count at the start")).toBe(0);

      // counting out: each duck arrives on its number, the count ticks with the voice, and nothing already there moves
      for (let k = 0; k < 5; k++) {
        const before = await at(page, said(0, k) - 0.03);
        expect(before.things[ducks[k]!]!.shown, where(`duck ${k + 1} before its number`)).toBe(false);
        const on = await at(page, said(0, k) + 0.3);
        expect(lit(on), where(`lit as ${k + 1} is said`)).toEqual([ducks[k]]);
        expect(on.count, where(`count as ${k + 1} is said`)).toEqual({ text: String(k + 1), o: 1 });
        const landed = await at(page, said(0, k) + 0.45);
        expect(ducks.map((n) => landed.things[n]!.shown), where(`ducks after ${k + 1}`)).toEqual(ducks.map((_, i) => i <= k));
        expect(landed.fit, where(`frame after ${k + 1}`)).toBe(start.fit);
        expect(places(landed, apples), where(`pile after ${k + 1}`)).toEqual(places(start, apples));
        expect(places(landed, ducks.slice(0, k)), where(`earlier ducks after ${k + 1}`)).toEqual(places(before, ducks.slice(0, k)));
      }

      // counting things where they sit: one light at a time, exactly on the word; only paint changes
      const rest = await at(page, beat(1).start - 0.5);
      expect(lit(rest), where("no light between beats")).toEqual([]);
      for (let k = 0; k < 5; k++) {
        const before = await at(page, said(1, k) - 0.03);
        expect(before.things[ducks[k]!]!.glow, where(`duck ${k + 1} just before its number`)).toBe(0);
        const on = await at(page, said(1, k) + 0.3);
        expect(lit(on), where(`lit as ${k + 1} is said`)).toEqual([ducks[k]]);
        expect(on.things[ducks[k]!]!.ring, where(`light on duck ${k + 1}`)).toBe(1);
        // a counted duck keeps a tick; the one being counted and those not yet counted have none
        expect(ducks.map((n) => on.things[n]!.tick), where(`ticks as ${k + 1} is said`)).toEqual(ducks.map((_, i) => (i < k ? 1 : 0)));
        // paint only: every thing sits exactly where it sat, at the size it had, in the same frame
        expect(on.fit, where(`frame as ${k + 1} is lit`)).toBe(rest.fit);
        expect(places(on, [...apples, ...ducks]), where(`places as ${k + 1} is lit`)).toEqual(places(rest, [...apples, ...ducks]));
        for (const n of [...apples, ...ducks]) expect(on.things[n]!.box, where(`${n} as ${k + 1} is lit`)).toEqual(rest.things[n]!.box);
        expect(on.count, where(`count as ${k + 1} is lit`)).toEqual({ text: "5", o: 1 });
      }
      // the last number tells how many: the last duck keeps the light to the end of the beat, then everything is plain again
      expect(lit(await at(page, beat(1).end + 0.2)), where("the last duck holds the light")).toEqual(["row5"]);
      const plain = await at(page, beat(1).end + 1.2);
      expect(lit(plain), where("lights out after the beat")).toEqual([]);
      expect(ducks.map((n) => plain.things[n]!.tick), where("ticks gone after the beat")).toEqual([0, 0, 0, 0, 0]);

      // two ducks join the pile: in flight they pass over the others; they land in free places, touching nothing
      const go = beat(2).words[0]!.start;
      const first = await at(page, go + 0.2);
      expect(first.order[first.order.length - 1], where("the duck in flight is on top")).toBe("row4");
      expect(first.count.text, where("count as the first duck sets off")).toBe("4");
      const flying = await at(page, go + 0.5);
      expect(flying.order.slice(-2), where("the duck that set off last is on top")).toEqual(["row4", "row5"]);
      expect(flying.count.text, where("count as both ducks are on their way")).toBe("3");
      const joined = await at(page, beat(2).end + 1.5);
      expect(joined.fit, where("frame after the move")).toBe(start.fit);
      const all = [...apples, ...ducks];
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
        expect(apart(joined.things[all[i]!]!.box, joined.things[all[j]!]!.box), where(`${all[i]} and ${all[j]} after the move`)).toBe(true);
      const pileBottom = Math.max(...apples.map((n) => joined.things[n]!.box.b)), rowTop = Math.min(...ducks.slice(0, 3).map((n) => joined.things[n]!.box.t));
      for (const n of ["row4", "row5"]) expect(joined.things[n]!.box.b, where(`${n} is up in the pile`)).toBeLessThan(rowTop);
      expect(pileBottom, where("the pile stays above the row")).toBeLessThan(rowTop);

      // one leaves: gone, and the count follows
      const left = await at(page, beat(3).end + 1);
      expect(left.things.row3!.shown, where("the duck that left")).toBe(false);
      expect(left.count, where("count after one leaves")).toEqual({ text: "2", o: 1 });
      expect(places(left, ["row1", "row2", ...apples]), where("the others after one leaves")).toEqual(places(joined, ["row1", "row2", ...apples]));

      // every thing stays inside its card with a margin, start to end
      for (const s of [start, rest, joined, left]) for (const [n, v] of Object.entries(s.things)) {
        if (!v.shown) continue;
        const m = Math.min(v.box.l - s.card.l, s.card.r - v.box.r, v.box.t - s.card.t, s.card.b - v.box.b);
        expect(m, where(`${n} inside the card`)).toBeGreaterThanOrEqual(Math.min(s.card.r - s.card.l, s.card.b - s.card.t) * 0.04);
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}, 180_000);

test("things wear the theme's own paints in light and dark", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(`${origin}/live.html?id=things-demo`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".live.ready", { timeout: 60_000 });
    const paints = async (theme: string) => {
      await page.evaluate((name) => { document.documentElement.dataset.theme = name; }, theme);
      const snap = await at(page, said(1, 2) + 0.25);
      const tokens = await page.evaluate(() => {
        const read = (token: string) => {
          const probe = document.createElement("div");
          probe.style.color = `var(${token})`;
          document.body.appendChild(probe);
          const c = getComputedStyle(probe).color;
          probe.remove();
          return c;
        };
        const lit = document.querySelector<SVGElement>('.film-thing[data-name="row3"]')!;
        return {
          warmFill: read("--color-figure-warm-fill"), warm: read("--color-figure-warm"), goldFill: read("--color-figure-gold-fill"), gold: read("--color-figure-gold"), muted: read("--color-muted-text"),
          glow: getComputedStyle(lit.querySelector(".film-thing-glow")!).fill, ring: getComputedStyle(lit.querySelector(".film-thing-ring")!).stroke,
          tick: getComputedStyle(lit.querySelector(".film-thing-tick")!).stroke,
        };
      });
      return { apple: snap.things.pile1!.fill, duck: snap.things.row1!.fill, ...tokens };
    };
    const light = await paints("light"), dark = await paints("dark");
    for (const p of [light, dark]) {
      // an apple's first layer is its body, a duck's its beak
      expect(p.apple).toBe(p.warmFill);
      expect(p.duck).toBe(p.warm);
      expect(p.glow).toBe(p.goldFill);
      expect(p.ring).toBe(p.gold);
      expect(p.tick).toBe(p.muted);
    }
    expect(dark.apple).not.toBe(light.apple);
    expect(dark.ring).not.toBe(light.ring);
  } finally {
    await page.close();
  }
}, 120_000);
