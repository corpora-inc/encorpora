/**
 * Base-ten blocks drawn by the live player in Chrome, phone and desktop.
 *
 * A join: ten rods close up, fuse and travel; the flat they make lands where
 * a third flat of the hundreds belongs, and nothing else in the chart moves
 * before, during or after. A lit pile lights every piece where it stands: no
 * piece changes size or reaches the piece beside it. A lit digit turns gold
 * and grows from its own baseline, clear of the digits and names around it.
 * Digits that wait take the same room hidden as shown.
 */
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, expect, test } from "vitest";
import { secureChromium } from "../browser-security.mjs";
import { scriptSchema, type Script, type Timing } from "./schema";

const chart = (digits: boolean | "later") => ({
  points: {},
  parts: [{ id: "b", blocks: ["hundreds", "tens", "ones"], rows: [{ id: "n", pieces: { hundreds: 2, tens: 13 } }], counts: true, digits, start: true }],
});
/** Each beat with the time its first word is said. Words follow every 0.4 s. */
const SHOTS: { figure: unknown; beats: { t: number; say: string; do?: Record<string, unknown>[] }[] }[] = [
  {
    figure: chart("later"),
    beats: [
      { t: 1, say: "Two flats and thirteen rods here." },
      { t: 4, say: "Join ten rods into one flat.", do: [{ do: "join", target: "b.n.tens", at: "Join" }] },
      { t: 8, say: "Three hundreds are here now.", do: [{ do: "highlight", target: "b.n.hundreds", at: "Three" }] },
      { t: 11, say: "Three tens are left over.", do: [{ do: "highlight", target: "b.n.tens", at: "Three" }] },
      { t: 14, say: "One flat stands alone here.", do: [{ do: "highlight", target: "b.n.hundreds.2", at: "One" }] },
      { t: 17, say: "Write three three zero now.", do: [{ do: "show", target: "b.digit.hundreds", at: "Write" }, { do: "show", target: "b.digit.tens", at: "three" }, { do: "show", target: "b.digit.ones", at: "zero" }] },
      { t: 20, say: "First digit means three hundreds.", do: [{ do: "highlight", target: "b.digit.hundreds", at: "First" }] },
      { t: 23, say: "Middle digit means three tens.", do: [{ do: "highlight", target: "b.digit.tens", at: "Middle" }] },
      { t: 26, say: "All of the numeral together.", do: [{ do: "highlight", target: "b.digits", at: "All" }] },
    ],
  },
  { figure: chart(true), beats: [{ t: 30, say: "The same chart with digits." }] },
  {
    figure: chart("later"),
    beats: [{ t: 34, say: "The same chart again here." }, { t: 37, say: "Now show the whole numeral.", do: [{ do: "show", target: "b.digits", at: "show" }] }],
  },
];
const script: Script = scriptSchema.parse({
  id: "blocks-join-demo",
  title: "Blocks join demo",
  shots: SHOTS.map((s) => ({ figure: s.figure, beats: s.beats.map(({ say, do: acts }) => ({ say, ...(acts ? { do: acts } : {}) })) })),
});
const timing: Timing = {
  duration: 42,
  shots: SHOTS.map((s) => s.beats.map((b) => {
    const words = b.say.split(/\s+/).map((text, i) => ({ text, start: b.t + 0.4 * i, end: b.t + 0.4 * i + 0.3 }));
    return { start: b.t, end: words[words.length - 1]!.end, words };
  })),
};
const JOIN_T0 = 4, JOIN_DUR = 1.4;

let server: ViteDevServer;
let browser: Browser;
let origin = "";

beforeAll(async () => {
  server = await createServer({
    configFile: fileURLToPath(new URL("./vite.live.config.ts", import.meta.url)),
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0 },
    plugins: [{
      name: "film-blocks-join-demo",
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
type Rect = { l: number; t: number; r: number; b: number };
type Piece = Rect & { id: string; on: boolean; lit: boolean; pad: number; ring: (Rect & { on: boolean }) };
/** `glyph`: the digit itself, from its baseline to its top and side to side, which is smaller than its label's box. */
type Mark = Rect & { place: string; on: boolean; text: string; glyph: Rect; color: string; stroke: string };
type Frame = { pieces: Piece[]; heads: Mark[]; digits: Mark[]; counts: Mark[]; gold: string };

/** Everything the chart of shot `shot` draws at time t, in pixels from its card's corner. */
const frame = (page: Page, shot: number, t: number) => page.evaluate(([i, time]) => {
  const scrub = document.querySelector<HTMLInputElement>(".live-scrub")!;
  // the player's bar moves in tenths of a second; a join is measured more finely than that
  scrub.step = "0.001";
  scrub.value = String(time);
  scrub.dispatchEvent(new Event("input", { bubbles: true }));
  const root = document.querySelectorAll<HTMLElement>(".film-shot")[i!]!;
  const card = root.querySelector(".film-figure")!.getBoundingClientRect();
  const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { l: r.left - card.left, t: r.top - card.top, r: r.right - card.left, b: r.bottom - card.top }; };
  const on = (el: HTMLElement | SVGElement) => el.style.display !== "none" && Number(el.style.opacity || 1) > 0.5;
  const rings = [...root.querySelectorAll<SVGGraphicsElement>(".film-block-ring")];
  const pieces = [...root.querySelectorAll<SVGGraphicsElement>("[data-piece]")].map((el, k) => {
    const r = el.getBoundingClientRect();
    // the outline is drawn half outside the piece: count it, at the size the card shows it
    const wide = on(el) ? el.getBBox().width : 0;
    const pad = wide > 0 ? (parseFloat(el.style.strokeWidth || "0") / 2) * (r.width / wide) : 0;
    return { id: el.dataset.piece!, on: on(el), lit: !!el.dataset.lit, pad, ...rect(el), ring: { on: on(rings[k]!), ...rect(rings[k]!) } };
  });
  const mark = (key: "place" | "digit" | "count") => [...root.querySelectorAll<HTMLElement>(`[data-${key}]`)].map((el) => {
    const strut = el.querySelector(".strut"), mord = el.querySelector(".mord");
    const cs = getComputedStyle(el);
    const glyph = strut && mord ? { l: rect(mord).l, r: rect(mord).r, t: rect(strut).t, b: rect(strut).b } : rect(el);
    return { place: el.dataset[key]!, on: on(el), text: (el.textContent ?? "").trim(), glyph, color: cs.color, stroke: cs.getPropertyValue("-webkit-text-stroke-width"), ...rect(el) };
  });
  const probe = document.createElement("div");
  probe.style.color = "var(--color-figure-gold)";
  root.appendChild(probe);
  const gold = getComputedStyle(probe).color;
  probe.remove();
  return { pieces, heads: mark("place"), digits: mark("digit"), counts: mark("count"), gold };
}, [shot, t] as const) as Promise<Frame>;

const same = (a: Rect, b: Rect, what: string, tol = 0.5) => {
  for (const k of ["l", "t", "r", "b"] as const) expect(Math.abs(a[k] - b[k]), `${what}: ${k} moved from ${b[k].toFixed(2)} to ${a[k].toFixed(2)}`).toBeLessThanOrEqual(tol);
};
/** A computed colour as red, green and blue from 0 to 1, whichever way the browser writes it. */
const rgb = (css: string) => {
  const n = (css.match(/-?[\d.]+/g) ?? []).slice(0, 3).map(Number);
  return css.startsWith("rgb") ? n.map((v) => v / 255) : n;
};
const sameInk = (a: string, b: string) => rgb(a).every((v, i) => Math.abs(v - rgb(b)[i]!) < 0.01);
const meet = (a: Rect, b: Rect, gap = 0) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > gap && Math.min(a.b, b.b) - Math.max(a.t, b.t) > gap;
const piece = (f: Frame, id: string) => f.pieces.find((p) => p.id === id)!;
const by = (list: Mark[], place: string) => list.find((m) => m.place === place)!;

test("a join, the lights and the digits of a place-value chart keep everything else where it is", async () => {
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
      const flats = ["b.n.hundreds.1", "b.n.hundreds.2"], flat3 = "b.n.hundreds.3";
      const rods = Array.from({ length: 10 }, (_, k) => `b.n.tens.${k + 1}`);

      // ---- the join
      const rest = await frame(page, 0, 3);
      expect(rest.pieces.filter((p) => p.on).length, where("two flats and thirteen rods")).toBe(15);
      expect(piece(rest, flat3).on, where("no third flat yet")).toBe(false);
      expect(rest.counts.filter((c) => c.on).map((c) => c.text), where("counts before")).toEqual(["2", "13"]);
      expect(rest.digits.every((d) => !d.on), where("the digits wait")).toBe(true);
      const unit = (piece(rest, flats[0]!).r - piece(rest, flats[0]!).l) / 10;
      const span = (f: Frame) => piece(f, rods[9]!).r - piece(f, rods[0]!).l;
      let lastSpan = span(rest), lastLeft = Infinity, flew = 0;
      for (let k = 1; k <= 27; k++) {
        const t = JOIN_T0 + (JOIN_DUR * k) / 28;
        const f = await frame(page, 0, t);
        const at = where(`${(t - JOIN_T0).toFixed(2)} s into the join`);
        // the chart's frame and the flats already there never move
        for (const id of flats) same(piece(f, id), piece(rest, id), `${at}, ${id}`);
        for (const h of f.heads) same(h, by(rest.heads, h.place), `${at}, the name ${h.place}`);
        expect(f.counts.filter((c) => c.on).map((c) => c.text), `${at}, counts`).toEqual(["2", "13"]);
        const rodsOn = rods.filter((id) => piece(f, id).on).length, flatOn = piece(f, flat3).on;
        // never a cross-fade: the ten rods, or the one flat
        expect([rodsOn, flatOn], `${at}, ten rods or one flat`).toEqual(flatOn ? [0, true] : [10, false]);
        if (!flatOn) {
          // closing up, side by side
          expect(span(f), `${at}, the rods close up`).toBeLessThan(lastSpan + 0.01);
          lastSpan = span(f);
        } else {
          // one flat, travelling left to the hundreds
          const p = piece(f, flat3);
          expect(Math.abs(p.r - p.l - 10 * unit), `${at}, the flat is a flat's size`).toBeLessThanOrEqual(0.6);
          expect(p.l, `${at}, the flat travels`).toBeLessThanOrEqual(lastLeft + 0.01);
          if (lastLeft !== Infinity && lastLeft - p.l > 1) flew++;
          lastLeft = p.l;
        }
      }
      expect(lastSpan, where("the rods closed up to one flat's width")).toBeLessThan(10.6 * unit);
      expect(flew, where("frames in which the flat is seen travelling")).toBeGreaterThanOrEqual(6);
      const after = await frame(page, 0, JOIN_T0 + JOIN_DUR + 0.6);
      for (const id of flats) same(piece(after, id), piece(rest, id), where(`after the join, ${id}`));
      for (const h of after.heads) same(h, by(rest.heads, h.place), where(`after the join, the name ${h.place}`));
      expect(after.counts.filter((c) => c.on).map((c) => c.text), where("counts after")).toEqual(["3", "3"]);
      // the third flat of a pile sits above the first, one flat-gap up: where the hundreds keep it
      const f1 = piece(after, flats[0]!), f3 = piece(after, flat3);
      expect(f3.on, where("the fused flat")).toBe(true);
      expect(Math.abs(f3.l - f1.l), where("the fused flat's left edge")).toBeLessThanOrEqual(0.5);
      expect(Math.abs(f3.r - f1.r), where("the fused flat's right edge")).toBeLessThanOrEqual(0.5);
      expect(Math.abs(f1.t - f3.b - 0.6 * unit), where("the fused flat's foot")).toBeLessThanOrEqual(0.5);
      expect(Math.abs((f3.b - f3.t) - (f1.b - f1.t)), where("the fused flat's height")).toBeLessThanOrEqual(0.5);
      // the three rods left stand on the baseline, in their own column
      const left = ["b.n.tens.11", "b.n.tens.12", "b.n.tens.13"].map((id) => piece(after, id));
      for (const r of left) expect(Math.abs(r.b - f1.b), where("a rod left behind stands on the baseline")).toBeLessThanOrEqual(0.5);
      const tens = by(after.heads, "tens");
      expect(Math.abs((left[0]!.l + left[2]!.r) / 2 - (tens.l + tens.r) / 2), where("the rods left behind are centred over their name")).toBeLessThanOrEqual(1);

      // ---- lit piles: every piece of the pile, none of them bigger, none reaching a neighbour
      const litPile = async (t: number, ids: string[], what: string) => {
        const f = await frame(page, 0, t);
        const shown = f.pieces.filter((p) => p.on);
        expect(shown.filter((p) => p.lit).map((p) => p.id).sort(), where(`${what}: the lit pieces`)).toEqual([...ids].sort());
        for (const p of shown) {
          same(p, piece(after, p.id), where(`${what}: ${p.id} keeps its size and place`), 0.1);
          expect(p.ring.on, where(`${what}: ${p.id} outline`)).toBe(p.lit);
          if (!p.lit) continue;
          // the gold outline lies inside the piece's own edge
          expect(p.ring.l >= p.l - 0.1 && p.ring.t >= p.t - 0.1 && p.ring.r <= p.r + 0.1 && p.ring.b <= p.b + 0.1, where(`${what}: ${p.id}'s light stays inside it`)).toBe(true);
          const box = { l: p.l - p.pad, t: p.t - p.pad, r: p.r + p.pad, b: p.b + p.pad };
          for (const q of shown) if (q.id !== p.id) expect(meet(box, q), where(`${what}: ${p.id} reaches ${q.id}`)).toBe(false);
        }
        for (const h of f.heads) same(h, by(rest.heads, h.place), where(`${what}: the name ${h.place}`));
        for (const c of f.counts.filter((x) => x.on)) same(c, by(after.counts, c.place), where(`${what}: the count over the ${c.place}`));
      };
      await litPile(8.4, [...flats, flat3], "the hundreds lit");
      await litPile(11.4, ["b.n.tens.11", "b.n.tens.12", "b.n.tens.13"], "the tens lit");
      await litPile(14.4, ["b.n.hundreds.2"], "one flat lit");

      // ---- digits come in on their words, into room that was kept for them
      const one = await frame(page, 0, 17.35);
      expect(one.digits.map((d) => d.on), where("the first digit only")).toEqual([true, false, false]);
      const all = await frame(page, 0, 19.7);
      expect(all.digits.map((d) => [d.on, d.text]), where("the digits shown")).toEqual([[true, "3"], [true, "3"], [true, "0"]]);
      for (const id of [...flats, flat3]) same(piece(all, id), piece(after, id), where(`the digits shown, ${id}`));
      for (const h of all.heads) same(h, by(rest.heads, h.place), where(`the digits shown, the name ${h.place}`));
      for (const d of all.digits) {
        const h = by(all.heads, d.place);
        expect(Math.abs((d.l + d.r) / 2 - (h.l + h.r) / 2), where(`the digit under ${d.place}`)).toBeLessThanOrEqual(1);
        expect(d.t, where(`the digit under ${d.place} is below its name`)).toBeGreaterThanOrEqual(h.b - 1);
      }

      // ---- a lit digit: gold, thicker, a little bigger, on the same baseline, clear of everything around it
      const litDigits = async (t: number, places: string[], what: string) => {
        const f = await frame(page, 0, t);
        for (const d of f.digits) {
          const was = by(all.digits, d.place);
          // lit or not, a digit's label keeps its box and the digit keeps its baseline and its middle
          same(d, was, where(`${what}: the ${d.place} digit's box`), 0.1);
          expect(Math.abs(d.glyph.b - was.glyph.b), where(`${what}: the baseline of the ${d.place} digit`)).toBeLessThanOrEqual(0.25);
          expect(Math.abs((d.glyph.l + d.glyph.r) / 2 - (was.glyph.l + was.glyph.r) / 2), where(`${what}: the ${d.place} digit stays centred`)).toBeLessThanOrEqual(0.25);
          const tall = d.glyph.b - d.glyph.t, wasTall = was.glyph.b - was.glyph.t;
          if (!places.includes(d.place)) {
            expect(Math.abs(tall - wasTall), where(`${what}: the ${d.place} digit is not lit`)).toBeLessThanOrEqual(0.1);
            expect(d.color, where(`${what}: the ${d.place} digit's ink`)).toBe(was.color);
            continue;
          }
          expect(sameInk(d.color, f.gold), where(`${what}: the ${d.place} digit is gold (${d.color})`)).toBe(true);
          expect(sameInk(was.color, f.gold), where(`${what}: the ${d.place} digit was not gold before`)).toBe(false);
          expect(parseFloat(d.stroke), where(`${what}: the ${d.place} digit is thicker`)).toBeGreaterThan(0.4);
          expect(tall / wasTall, where(`${what}: the ${d.place} digit grows a little`)).toBeGreaterThan(1.1);
          expect(tall / wasTall, where(`${what}: the ${d.place} digit grows only a little`)).toBeLessThan(1.2);
          // it grows up from its foot, inside the room its own label has, and stays clear of every name and digit
          expect(d.glyph.t, where(`${what}: the ${d.place} digit's top stays in its label`)).toBeGreaterThanOrEqual(d.t);
          for (const other of [...f.digits.filter((x) => x.place !== d.place).map((x) => x.glyph), ...f.heads]) expect(meet(d.glyph, other, -2), where(`${what}: the ${d.place} digit meets a neighbour`)).toBe(false);
        }
        for (const h of f.heads) same(h, by(rest.heads, h.place), where(`${what}: the name ${h.place}`));
        for (const id of [...flats, flat3]) same(piece(f, id), piece(after, id), where(`${what}: ${id}`));
      };
      await litDigits(20.4, ["hundreds"], "the hundreds digit lit");
      await litDigits(23.4, ["tens"], "the tens digit lit");
      await litDigits(26.4, ["hundreds", "tens", "ones"], "the numeral lit");

      // ---- digits that wait take the same room as digits that are there from the start
      const shownChart = await frame(page, 1, 31.6);
      const waiting = await frame(page, 2, 35.6);
      const arrived = await frame(page, 2, 39);
      expect(shownChart.digits.map((d) => d.on), where("digits from the start")).toEqual([true, true, true]);
      expect(waiting.digits.map((d) => d.on), where("digits that wait")).toEqual([false, false, false]);
      expect(arrived.digits.map((d) => d.on), where("digits after their word")).toEqual([true, true, true]);
      for (const other of [waiting, arrived]) {
        for (const p of shownChart.pieces.filter((x) => x.on)) same(piece(other, p.id), p, where(`with digits waiting, ${p.id}`));
        for (const h of shownChart.heads) same(by(other.heads, h.place), h, where(`with digits waiting, the name ${h.place}`));
      }
      for (const d of shownChart.digits) same(by(arrived.digits, d.place), d, where(`the ${d.place} digit, shown late`));
    }
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
}, 240_000);
