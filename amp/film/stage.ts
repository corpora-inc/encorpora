/**
 * The film is a pure function of time. `seek(t)` sets every element from t and
 * nothing else, so any frame can be rendered alone, in any order.
 * The board is laid out once. Each frame centres the figure's ink in its card.
 */
import katex from "katex";
import type { Action, BeatTime, Geo, Part, Script, Shot, Timing } from "./schema";
import { compile } from "./expr";
import { placeNames, planStack, type StackPlan } from "./stack";
import { BlocksModel, chartView, subBox, zoomView, type Box, type Dir, type Place } from "./blocks";
import { axisSpan, glided, onCircle, sectorAngles, sweepLabelAngle, traceRange } from "./wave";
import { planVector, vectorPath } from "./vector";
import { resolveCast } from "./cast";
import { amountAt, barAnchor, barCells, checkBar, planBar, shareBox, shadedAt, spreadBarLabels, type BarCut, type BarShade, type BarSpec } from "./bar";
import {
  bandOpacity, checkGroups, CONTEXT, DIM, fits, guideLine, inRegion, mosaicAnchor, partBox, restBox, restriction, slabBox, tableAnchor, tableBox, tableCell,
  tableRegion, type Given, type MosaicSpec, type TableSpec,
} from "./table";

export type Frame = { w: number; h: number };
const W = 1920;
const H = 1080;
const clamp = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u);
/** The app's standard ease, stretched: quick to start, long settle. */
const ease = (u: number) => {
  u = clamp(u);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const svgNS = "http://www.w3.org/2000/svg";
const svg = (tag: string, cls?: string) => {
  const e = document.createElementNS(svgNS, tag);
  if (cls) e.setAttribute("class", cls);
  return e as SVGElement;
};
const div = (cls: string, parent?: Element) => {
  const e = document.createElement("div");
  e.className = cls;
  parent?.appendChild(e);
  return e;
};
const macros = {
  "\\ca": "\\textcolor{##20776d}{#1}",
  "\\cw": "\\textcolor{##9c4420}{#1}",
  "\\cg": "\\textcolor{##9a5c12}{#1}",
  "\\cb": "\\textcolor{##2d6a9a}{#1}",
  "\\cv": "\\textcolor{##6a5aa0}{#1}",
  "\\cm": "\\textcolor{##4c625b}{#1}",
};
export const tex = (s: string, display = false) =>
  katex.renderToString(s, { throwOnError: true, displayMode: display, macros, strict: false, output: "html" });
const esc = (t: string) => t.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
/**
 * Prose with $math$. Math and the punctuation touching it stay on one line:
 * a browser may break after a math box, and a comma must never start a line.
 */
export const prose = (s: string) =>
  s
    .split(/([(\[]?\$[^$]+\$[.,;:?!)\]]*)/)
    .map((p) => {
      const m = p.match(/^([(\[]?)\$([^$]+)\$([.,;:?!)\]]*)$/);
      return m ? `<span class="film-nowrap">${esc(m[1]!)}${tex(m[2]!)}${esc(m[3]!)}</span>` : esc(p);
    })
    .join("");

/** A coordinate for a readout: at most three decimals, "undefined" where there is no value. */
export const fmtNum = (v: number, digits = 3) => {
  if (!Number.isFinite(v)) return "\\text{undefined}";
  if (Math.abs(v) >= 1e7) return "\\text{huge}";
  const p = 10 ** digits, r = Math.round(v * p) / p;
  const str = String(Object.is(r, -0) ? 0 : r);
  // 10000 reads as 10,000
  return Math.abs(r) >= 1e4 ? str.replace(/\B(?=(\d{3})+(?!\d))/g, "{,}") : str;
};
const INK: Record<string, string> = {
  ink: "var(--color-figure-ink)",
  muted: "var(--color-muted-text)",
  accent: "var(--color-figure-accent)",
  warm: "var(--color-figure-warm)",
  gold: "var(--color-figure-gold)",
  blue: "var(--color-info-accent)",
  violet: "var(--color-strand-operations)",
  paper: "var(--color-figure-paper)",
  wood: "#b9935f",
};
const FILL: Record<string, string> = {
  none: "none",
  paper: "var(--color-figure-paper)",
  "accent-fill": "var(--color-figure-accent-fill)",
  "warm-fill": "var(--color-figure-warm-fill)",
  "gold-fill": "var(--color-figure-gold-fill)",
  "blue-fill": "var(--color-info)",
  "violet-fill": "#e6e1f2",
  wood: "#d9c19c",
  walnut: "#8f6a4a",
};

const DEFAULT_DUR: Record<string, number> = {
  glide: 1.4, overview: 1.6, recap: 0.5,
  show: 0.4, hide: 0.35, draw: 0.8, highlight: 0.3, move: 1.2, turn: 2.2, flip: 2.2, slide: 1.1, view: 1.3,
  cut: 1.0, split: 0.9, zoom: 1.4, given: 0.7,
  partition: 1.5, shade: 1.3,
  problem: 0.45, write: 0.75, text: 0.45, term: 0.45, watch: 0.45, answer: 0.6, clear: 0.4, scene: 0.9,
};

/** `words`: later moments of the same action, by the words that name them (a stack column's trade and its written digit). */
type Entry = { a: Action; t0: number; dur: number; beatEnd: number; words?: Record<string, number> };
type P = [number, number];

function wordTime(beat: BeatTime, word: string, nth = 1) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hits = beat.words.filter((w) => norm(w.text) === norm(word));
  const hit = hits[nth - 1];
  if (!hit) throw new Error(`Word "${word}" (occurrence ${nth}) is not in: ${beat.words.map((w) => w.text).join(" ")}`);
  return hit.start;
}
/** The first time a word is said in this beat at or after t. */
function wordAfter(beat: BeatTime, word: string, t: number, what: string) {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hit = beat.words.find((w) => norm(w.text) === norm(word) && w.start >= t - 1e-6);
  if (!hit) throw new Error(`${what}: the word "${word}" is not said after the action starts, in: ${beat.words.map((w) => w.text).join(" ")}`);
  return hit.start;
}

/** Each beat's actions, in time. Actions without `at` start with the beat, slightly staggered. */
function entries(shot: Shot, times: BeatTime[]) {
  const out: Entry[] = [];
  shot.beats.forEach((b, i) => {
    let stagger = 0;
    for (const a of b.do ?? []) {
      const t = times[i]!;
      const t0 = a.at ? wordTime(t, a.at, a.nth) : t.start + stagger;
      if (!a.at) stagger += 0.1;
      const entry: Entry = { a, t0, dur: a.dur ?? DEFAULT_DUR[a.do] ?? 0.5, beatEnd: t.end };
      if (a.do === "column") {
        const trade = a.trade ? wordAfter(t, a.trade, t0, `column of "${a.of}", trade`) : undefined;
        const write = a.write ? wordAfter(t, a.write, trade ?? t0, `column of "${a.of}", write`) : undefined;
        entry.words = { ...(trade !== undefined && { trade }), ...(write !== undefined && { write }) };
      }
      out.push(entry);
    }
  });
  return out.sort((x, y) => x.t0 - y.t0);
}

// ------------------------------------------------------------------ figure
type Grid = Extract<Part, { grid: unknown }>;
const cellSize = (g: Grid): P => (Array.isArray(g.size) ? (g.size as P) : [g.size ?? 1, g.size ?? 1]);
type Target = P | string | { cell: [string, number] };
/** A dot made from `counters`: it knows its shape and is sized by its cell. */
type Counter = Part & { counter?: "round" | "square" };
/** Each counter becomes its own point and dot, named id1, id2, ..., grouped under the counters' id. */
function expandCounters(geo: Geo): Geo {
  const points = { ...geo.points };
  const parts: Part[] = [];
  for (const p of geo.parts) {
    if (!("counters" in p)) { parts.push(p); continue; }
    const g = geo.parts.find((q) => q.id === p.counters && "grid" in q) as Grid | undefined;
    if (!g) throw new Error(`counters ${p.id}: there is no grid named ${p.counters}`);
    if (p.group) throw new Error(`counters ${p.id}: counters are already a group, named ${p.id}; leave out group`);
    const first = p.from ?? 1;
    if (first + p.n - 1 > g.grid[0] * g.grid[1]) throw new Error(`counters ${p.id}: ${p.n} counters from cell ${first} do not fit in ${g.id}`);
    for (let k = 1; k <= p.n; k++) {
      const nm = `${p.id}${k}`;
      if (points[nm]) throw new Error(`counters ${p.id}: ${nm} is already the name of a point`);
      points[nm] = { cell: [p.counters, first + k - 1] };
      parts.push({ id: nm, dot: nm, ink: p.ink ?? "accent", group: p.id, start: p.start, counter: p.shape ?? "round" } as Part);
    }
  }
  return { ...geo, points, parts };
}
type Blocks = Extract<Part, { blocks: unknown }>;
type Fade = { kind: string; t0: number; dur: number; end?: number };
/** `b.n.tenths.3` is also part of `b.n.tenths`, `b.n` and `b`: a fade on any of them reaches it. */
const prefixes = (id: string) => id.split(".").map((_, i, a) => a.slice(0, i + 1).join("."));
/** The elements of one place-value chart, built once; `drawBlocks` sets them from t. */
type BlocksView = {
  model: BlocksModel;
  p: Blocks;
  pointLine: SVGElement;
  point: SVGElement;
  pieces: Map<string, { body: SVGElement; lines: SVGElement; overlays: Map<string, SVGElement> }>;
  heads: Map<Place, HTMLElement>;
  digits: Map<Place, HTMLElement>;
  counts: Map<Place, HTMLElement>;
  labels: { spec: NonNullable<Blocks["labels"]>[number]; el: HTMLElement }[];
};
type TablePart = Extract<Part, { table: true }>;
type BarPart = Extract<Part, { bar: string }>;
type BarView = {
  p: BarPart;
  base: SVGElement; part: SVGElement; cuts: SVGElement; major: SVGElement; ring: SVGElement; unit: SVGElement;
  bracket: SVGElement; title: HTMLElement;
  values: HTMLElement[];
  scales: { kind: "top" | "amount"; line: SVGElement; caption: HTMLElement }[];
  marks: { id: string; value: number; top: HTMLElement; amount: HTMLElement; topTick: SVGElement; amountTick: SVGElement; guide: SVGElement; leaders: SVGElement }[];
};
type MosaicPart = Extract<Part, { mosaic: string }>;
/** One table's elements, built once: a background and a label per cell, the grid, the rules, and a band per row and column for "given". */
type TableView = {
  p: TablePart;
  grid: SVGElement;
  rules: SVGElement;
  cells: { r: number; c: number; bg: SVGElement; el: HTMLElement }[];
  bands: Map<string, SVGElement>;
};
/** One mosaic's elements: per slab a base, its colored part, a name and two counts; and the guide. */
type MosaicView = {
  p: MosaicPart;
  slabs: { base: SVGElement; part: SVGElement; edge: SVGElement; ring: SVGElement; name?: HTMLElement; kEl?: HTMLElement; restEl?: HTMLElement }[];
  guide: SVGElement;
};
/**
 * Centre the figure's ink in its card. The box is the scene's content
 * (shapes, axes, bars, tables, labels), not the scene's nominal view and not
 * a highlight's ink (`.film-em`: rings, bands, overlays). Every side keeps a
 * margin of at least 6% of the shorter side and 16 CSS px. Ink that would
 * cross that margin is scaled down; ink that already fits is only moved.
 * `root` is the card's `.film-fit` layer.
 */
export function fitFigure(root: HTMLElement) {
  root.style.transform = "none";
  const area = root.getBoundingClientRect();
  const localW = root.offsetWidth, localH = root.offsetHeight;
  if (area.width < 32 || area.height < 32 || localW < 32 || localH < 32) return;
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  const paint = (el: Element) => {
    if (el instanceof SVGSVGElement || el instanceof SVGGElement) return false;
    if (el instanceof SVGGraphicsElement) return true;
    if (!(el instanceof HTMLElement)) return false;
    if (el.classList.contains("film-label")) return true;
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== "transparent" && !/rgba?\([^)]*,\s*0(?:\.0+)?\)/.test(bg) && !bg.endsWith("/ 0)") && !bg.endsWith("/0)")) return true;
    return el.childElementCount === 0 && (el.textContent ?? "").trim() !== "";
  };
  const walk = (el: Element, opac: number) => {
    if (el.classList.contains("film-em")) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    const o = opac * (Number.parseFloat(cs.opacity) || 0);
    if (o < 0.04) return;
    if (paint(el)) {
      const box = el.getBoundingClientRect();
      if (box.width >= 0.5 || box.height >= 0.5) {
        l = Math.min(l, box.left); t = Math.min(t, box.top); r = Math.max(r, box.right); b = Math.max(b, box.bottom);
      }
    }
    if (el instanceof HTMLElement && el.classList.contains("film-label")) return;
    for (const c of el.children) walk(c, o);
  };
  for (const c of root.children) walk(c, 1);
  if (!Number.isFinite(l) || r - l < 0.5 || b - t < 0.5) return;
  const k = area.width / localW;
  const shorter = Math.min(area.width, area.height);
  const margin = Math.max(shorter * 0.06, 16) + 0.75;
  const iw = r - l, ih = b - t;
  const roomW = area.width - 2 * margin, roomH = area.height - 2 * margin;
  if (roomW < 8 || roomH < 8) return;
  const s = Math.min(1, roomW / iw, roomH / ih);
  if (!Number.isFinite(s) || s <= 0) return;
  const tx = ((area.width - iw * s) / 2 - (l - area.left) * s) / k;
  const ty = ((area.height - ih * s) / 2 - (t - area.top) * s) / k;
  root.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
}
/** Nudge a placed label without touching its scale. place() writes a plain translate. */
function nudgeLabel(el: HTMLElement, dx: number, dy: number) {
  const m = el.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
  if (!m) return;
  el.style.transform = `translate(${(parseFloat(m[1]!) + dx).toFixed(2)}px, ${(parseFloat(m[2]!) + dy).toFixed(2)}px)`;
}
/**
 * Labels that land on each other are pushed apart. A highlight does not change
 * their boxes, so this nudge is the same on the frame before and during one.
 */
function separateLabels(root: HTMLElement) {
  const els = [...root.querySelectorAll<HTMLElement>(".film-label")].filter((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || (Number.parseFloat(cs.opacity) || 0) < 0.85) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  });
  const k = root.getBoundingClientRect().width / root.offsetWidth || 1;
  const gap = 6;
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (let i = 0; i < els.length; i++) {
      for (let j = i + 1; j < els.length; j++) {
        const a = els[i]!.getBoundingClientRect(), b = els[j]!.getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox <= 0.5 || oy <= 0.5) continue;
        const dx = ox <= oy ? ((a.left + a.width / 2 <= b.left + b.width / 2 ? -1 : 1) * ((ox + gap) / 2)) / k : 0;
        const dy = oy < ox ? ((a.top + a.height / 2 <= b.top + b.height / 2 ? -1 : 1) * ((oy + gap) / 2)) / k : 0;
        nudgeLabel(els[i]!, dx, dy);
        nudgeLabel(els[j]!, -dx, -dy);
        moved = true;
      }
    }
    if (!moved) break;
  }
}
const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  return `M${(x + r).toFixed(2)} ${y.toFixed(2)}H${(x + w - r).toFixed(2)}Q${(x + w).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + r).toFixed(2)}V${(y + h - r).toFixed(2)}Q${(x + w).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - r).toFixed(2)} ${(y + h).toFixed(2)}H${(x + r).toFixed(2)}Q${x.toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - r).toFixed(2)}V${(y + r).toFixed(2)}Q${x.toFixed(2)} ${y.toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)}Z`;
};
class GeoStage {
  svg: SVGSVGElement;
  labels: HTMLElement;
  parts: { p: Part; el: SVGElement; shadow?: SVGElement; side?: SVGElement; html?: HTMLElement; extra?: SVGElement[]; extraHtml?: HTMLElement[]; blocks?: BlocksView; table?: TableView; mosaic?: MosaicView; bar?: BarView; a0: number }[] = [];
  barCuts = new Map<string, BarCut[]>();
  barShades = new Map<string, BarShade[]>();
  /** Each place-value chart's model, by the part's id. */
  blocks = new Map<string, BlocksModel>();
  /** Each table's or mosaic's "given" restrictions, by the part's id. */
  givens = new Map<string, Given[]>();
  /** Labels that did not fit their table cells, found while drawing. */
  tableIssues = new Set<string>();
  moves: { name: string; t0: number; dur: number; to: Target; from?: P }[] = [];
  views: { t0: number; dur: number; from: number[]; to: number[]; lazy?: () => number[] }[] = [];
  /** For a chart that starts pushed in on one piece: when the camera first pulls back to the whole chart, and its frame (names, point) comes in. */
  frameFrom = new Map<string, { t0: number; dur: number }>();
  xforms: { targets: Set<string>; kind: string; t0: number; dur: number; a: any; about?: P; over?: [P, P] }[] = [];
  fades: Map<string, { kind: string; t0: number; dur: number; end?: number }[]> = new Map();
  view0: number[];
  box: { x: number; y: number; w: number; h: number };
  size = 1;
  fns = new Map<string, (x: number) => number>();
  glides: { name: string; t0: number; dur: number; from: number; to: number }[] = [];
  /** Points that may leave the view: they ride a graph off to infinity. */
  riders = new Set<string>();
  readouts = new Map<HTMLElement, string>();

  geo: Geo;
  constructor(host: HTMLElement, geo: Geo, entriesList: Entry[], box: { x: number; y: number; w: number; h: number }) {
    this.geo = geo = expandCounters(geo);
    this.box = box;
    this.svg = svg("svg", "film-geo") as SVGSVGElement;
    this.svg.setAttribute("width", String(box.w));
    this.svg.setAttribute("height", String(box.h));
    this.svg.setAttribute("viewBox", `0 0 ${box.w} ${box.h}`);
    host.appendChild(this.svg);
    this.labels = div("film-labels", host);
    for (const p of geo.parts) if ("plot" in p) this.fns.set(p.id, compile(p.plot));
    // a point on a graph may ride off the view; a point on a circle never leaves it
    for (const [n, d] of Object.entries(geo.points)) if (!Array.isArray(d) && "on" in d && "x" in d) this.riders.add(n);
    for (const [n, d] of Object.entries(geo.points)) {
      if (Array.isArray(d) || !("on" in d)) continue;
      const plotPart = geo.parts.find((p) => p.id === d.on && "plot" in p), circ = this.circleOf(d.on);
      if ("x" in d && !plotPart) throw new Error(`Point ${n} is on "${d.on}", which is not a plot. A point with x sits on a plot; one with deg sits on a circle.`);
      if ("deg" in d && !circ) throw new Error(`Point ${n} is on "${d.on}", which is not a circle. A point with deg sits on a circle; one with x sits on a plot.`);
    }
    for (const p of geo.parts) {
      if (!("sweep" in p)) continue;
      const d = geo.points[p.sweep];
      if (!d || Array.isArray(d) || !("on" in d) || !("deg" in d)) throw new Error(`sweep ${p.id}: "${p.sweep}" is not a point on a circle (placed with on and deg).`);
    }
    for (const p of geo.parts) {
      if ("bar" in p) {
        checkBar(this.barSpec(p, 0, true));
        const ids = (p.marks ?? []).map(m => m.id);
        if (new Set(ids).size !== ids.length || ids.some(id => id === "zero" || id === "end")) throw new Error(`bar ${p.id}: mark names must be unique; zero and end are reserved.`);
      }
      if ("mosaic" in p) {
        try { checkGroups(p.groups); } catch (err) { throw new Error(`${p.id}: ${(err as Error).message}`); }
        if (p.names && p.names.length !== p.groups.length) throw new Error(`mosaic ${p.id}: ${p.names.length} names for ${p.groups.length} groups.`);
      }
      if ("table" in p) for (const [i, r] of p.rows.entries()) if (r.cells.length !== p.head.length) throw new Error(`table ${p.id}: row ${i + 1} ("${r.label}") has ${r.cells.length} cells under ${p.head.length} headers.`);
    }
    for (const p of geo.parts) {
      if (!("blocks" in p)) continue;
      const row = p.rows[0]!;
      const m = new BlocksModel(p.id, row.id, p.blocks, row.pieces as Record<string, number>, { squares: p.squares, point: p.point, counts: p.counts, ink: row.ink, inks: row.inks as Record<string, string> | undefined, lines: p.lines });
      if (m.digits.overflow) throw new Error(`blocks ${p.id}: the pieces add up to more than the chart's places can show.`);
      this.blocks.set(p.id, m);
    }
    this.view0 = geo.view ?? [0, 0, 1, 1];
    for (const e of entriesList) this.addEntry(e);
    // every trade is known now: columns take the width of the widest pile they ever hold,
    // and at least the room their names need at the scale the pulled-back chart will have
    for (const m of this.blocks.values()) {
      for (let k = 0; k < 3; k++) {
        const v = chartView(m.layouts[0]!);
        m.fitHeaders(Math.min(box.w / (v[2] - v[0]), box.h / (v[3] - v[1])));
      }
    }
    if (!geo.view) {
      const fp = geo.parts.find((p): p is Blocks => "blocks" in p && !!p.focus);
      this.view0 = fp ? this.blockView(fp, `${fp.id}.${fp.focus}`, 0) : this.fit();
    }
    // a zoom's window depends on the final layout, so it is worked out last
    let prevTo = this.view0;
    for (const v of this.views) {
      if (v.lazy) v.to = v.lazy();
      v.from = prevTo;
      prevTo = v.to;
    }
    for (const p of geo.parts) this.build(p);
    this.size = (Math.abs(this.view0[2]! - this.view0[0]!)) / box.w;
  }
  fit() {
    const pts = Object.keys(this.geo.points).filter((k) => !this.riders.has(k)).map((k) => this.base(k));
    for (const g of this.grids()) {
      const a = this.base(g.at), [cw, ch] = cellSize(g);
      pts.push(a, [a[0] + g.grid[0] * cw, a[1] - g.grid[1] * ch]);
    }
    for (const m of this.blocks.values()) {
      const v = chartView(m.layouts[0]!);
      pts.push([v[0], v[1]], [v[2], v[3]]);
    }
    for (const p of this.geo.parts) {
      if ("bar" in p) {
        const a = this.base(p.bar);
        pts.push([a[0] - 3.5, a[1] - p.h - 4.6], [a[0] + p.w + 1.1, a[1] + 2.1]);
      }
      if (!("table" in p) && !("mosaic" in p)) continue;
      const b = "table" in p ? tableBox(this.tableSpec(p, 0, true)) : slabBox(this.mosaicSpec(p, 0, true), 1);
      const whole = "table" in p ? b : { x: this.base(p.mosaic)[0], y: this.base(p.mosaic)[1] - p.h, w: p.w, h: p.h };
      pts.push([whole.x, whole.y], [whole.x + whole.w, whole.y + whole.h]);
    }
    if (!pts.length) throw new Error("The figure has nothing to fit a view to.");
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const pad = 0.12 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
  }
  base(name: string): P {
    const d = this.geo.points[name];
    if (!d) throw new Error(`No point named ${name}`);
    if (Array.isArray(d)) return d as P;
    if ("mid" in d) {
      const a = this.base(d.mid[0]), b = this.base(d.mid[1]);
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
    if ("on" in d && "x" in d) return [d.x, this.fn(d.on)(d.x)];
    if ("on" in d) { const c = this.circleOf(d.on)!; return onCircle(this.base(c.circle), c.r, d.deg); }
    if ("foot" in d) return [this.base(d.foot)[0], 0];
    if ("cell" in d) return this.cellAt(d.cell[0], d.cell[1], 0, true);
    if ("anchor" in d) return this.anchorAt(d.anchor[0], d.anchor[1], 0, true);
    const a = this.base(d.along[0]), b = this.base(d.along[1]);
    return [a[0] + (b[0] - a[0]) * d.t, a[1] + (b[1] - a[1]) * d.t];
  }
  /** A table's geometry at t (its corner point may move). */
  tableSpec(p: TablePart, t: number, still = false): TableSpec {
    return { at: still ? this.base(p.at) : this.at(p.at, t), cols: p.head.length, rows: p.rows.length, cell: p.cell, labelW: p.labelW };
  }
  mosaicSpec(p: MosaicPart, t: number, still = false): MosaicSpec {
    return { at: still ? this.base(p.mosaic) : this.at(p.mosaic, t), w: p.w, h: p.h, slice: p.slice, groups: p.groups };
  }
  barSpec(p: BarPart, t: number, still = false): BarSpec {
    return { at: still ? this.base(p.bar) : this.at(p.bar, t), w: p.w, h: p.h, whole: p.whole, divisions: p.divisions };
  }
  /** A named point of a table or a mosaic. */
  anchorAt(id: string, name: string, t: number, still = false): P {
    const p = this.geo.parts.find((x) => x.id === id);
    if (!p) throw new Error(`anchor: no part is named ${id}`);
    if ("table" in p) return tableAnchor(this.tableSpec(p, t, still), name);
    if ("mosaic" in p) return mosaicAnchor(this.mosaicSpec(p, t, still), name);
    if ("bar" in p) return barAnchor(this.barSpec(p, t, still), name, shadedAt(this.barShades.get(id) ?? [], t));
    throw new Error(`anchor: ${id} is not a table, mosaic or bar`);
  }
  /** The circle part a point turns on. */
  circleOf(id: string) {
    const c = this.geo.parts.find((p) => p.id === id && "circle" in p);
    return c && "circle" in c ? c : undefined;
  }
  /** How far a point on a circle has turned at time t, in degrees: where it was placed, then every glide of it. */
  degOf(name: string, t: number) {
    const d = this.geo.points[name];
    if (!d || Array.isArray(d) || !("on" in d) || !("deg" in d)) throw new Error(`${name} is not a point on a circle`);
    return glided(d.deg, this.glides.filter((g) => g.name === name), t, ease);
  }
  /** Where a point is at time t: its definition, then every move of it in order. */
  at(name: string, t: number, upto = Infinity): P {
    let v = this.placed(name, t);
    const mv = this.moves.filter((m) => m.name === name);
    for (let k = 0; k < mv.length && k < upto; k++) {
      const m = mv[k]!;
      if (t < m.t0) break;
      const from = (m.from ??= this.at(name, m.t0, k));
      const to = this.target(m.to, t);
      const u = ease((t - m.t0) / m.dur);
      v = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u];
    }
    return v;
  }
  target(to: Target, t: number): P {
    if (Array.isArray(to)) return to;
    if (typeof to === "string") return this.at(to, t);
    return this.cellAt(to.cell[0], to.cell[1], t);
  }
  grids() {
    return this.geo.parts.filter((p): p is Grid => "grid" in p);
  }
  grid(id: string) {
    const g = this.grids().find((x) => x.id === id);
    if (!g) throw new Error(`No grid named ${id}`);
    return g;
  }
  /** The middle of cell n (from 1, row by row from the top-left). */
  cellAt(id: string, n: number, t: number, still = false): P {
    const g = this.grid(id), [cw, ch] = cellSize(g);
    if (n > g.grid[0] * g.grid[1]) throw new Error(`Grid ${id} has no cell ${n}`);
    const a = still ? this.base(g.at) : this.at(g.at, t);
    const c = (n - 1) % g.grid[0], r = Math.floor((n - 1) / g.grid[0]);
    return [a[0] + (c + 0.5) * cw, a[1] - (r + 0.5) * ch];
  }
  /** How many dots sit in a grid's cells: a dot counts once it has landed near a cell's middle. */
  countIn(id: string, t: number) {
    const g = this.grid(id), [cw, ch] = cellSize(g), a = this.at(g.at, t);
    let n = 0;
    for (const e of this.parts) {
      if (!("dot" in e.p) || this.opacity(e.p, t).o < 0.5) continue;
      const q = this.at(e.p.dot, t);
      const x = (q[0] - a[0]) / cw - 0.5, y = (a[1] - q[1]) / ch - 0.5;
      const c = Math.round(x), r = Math.round(y);
      if (c >= 0 && r >= 0 && c < g.grid[0] && r < g.grid[1] && Math.hypot(x - c, y - r) < 0.2) n++;
    }
    return n;
  }
  placed(name: string, t: number): P {
    const d = this.geo.points[name];
    if (!d) throw new Error(`No point named ${name}`);
    if (Array.isArray(d)) return d as P;
    if ("cell" in d) return this.cellAt(d.cell[0], d.cell[1], t);
    if ("mid" in d) {
      const a = this.at(d.mid[0], t), b = this.at(d.mid[1], t);
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
    if ("on" in d && "x" in d) {
      const x = glided(d.x, this.glides.filter((g) => g.name === name), t, ease);
      return [x, this.fn(d.on)(x)];
    }
    if ("on" in d) {
      const c = this.circleOf(d.on)!;
      return onCircle(this.at(c.circle, t), c.r, this.degOf(name, t));
    }
    if ("foot" in d) return [this.at(d.foot, t)[0], 0];
    if ("anchor" in d) return this.anchorAt(d.anchor[0], d.anchor[1], t);
    const a = this.at(d.along[0], t), b = this.at(d.along[1], t);
    return [a[0] + (b[0] - a[0]) * d.t, a[1] + (b[1] - a[1]) * d.t];
  }
  fn(id: string) {
    const f = this.fns.get(id);
    if (!f) throw new Error(`No plot named ${id}`);
    return f;
  }
  /** The chart a dotted target belongs to. */
  blockModel(target: string, what: string) {
    const m = this.blocks.get(target.split(".")[0]!);
    if (!m) throw new Error(`${what} "${target}": no blocks part is named ${target.split(".")[0]}.`);
    return m;
  }
  /** The view that frames a chart (its id) or one piece of it, with room for the labels tied to that piece. */
  blockView(p: Blocks, target: string, t: number): number[] {
    const m = this.blockModel(target, "zoom");
    if (target === p.id) return chartView(m.layouts[m.stateIndexAt(t)]!);
    const on = target.slice(p.id.length + 1);
    const dirs = (p.labels ?? []).filter((l) => l.on === on || l.on.startsWith(on + ".")).map((l) => l.dir ?? "n");
    return zoomView(m.boxOf(target, t), dirs);
  }
  addEntry(e: Entry) {
    const a = e.a as any;
    const list = (x: string | string[]) => (Array.isArray(x) ? x : [x]);
    if (a.do === "partition" || a.do === "shade") {
      const p = this.geo.parts.find(x => x.id === a.target);
      if (!p || !("bar" in p)) throw new Error(`${a.do}: ${a.target} is not a bar.`);
      if (a.do === "partition") {
        if (!this.barCuts.has(p.id)) this.barCuts.set(p.id, []);
        this.barCuts.get(p.id)!.push({ t0: e.t0, dur: e.dur, into: a.into });
      } else {
        shareBox(this.barSpec(p, e.t0, true), a.from ?? 0, a.to);
        if (!this.barShades.has(p.id)) this.barShades.set(p.id, []);
        this.barShades.get(p.id)!.push({ t0: e.t0, dur: e.dur, from: a.from ?? 0, to: a.to });
      }
    } else if (a.do === "cut") {
      this.blockModel(a.target, "cut").cut(a.into, e.t0, e.dur);
    } else if (a.do === "split") {
      const m = this.blockModel(a.target, "split");
      const parts = a.target.split(".");
      if (parts.length !== 3 || parts[1] !== m.rowId) throw new Error(`split "${a.target}": name a pile, like ${m.chartId}.${m.rowId}.tenths.`);
      const n = a.n ?? 1, each = Math.min(0.9, e.dur), step = n > 1 ? (a.dur === undefined ? 0.45 : Math.max(0, (e.dur - each) / (n - 1))) : 0;
      if (a.dur === undefined) e.dur = each + step * (n - 1);
      m.split(parts[2] as Place, n, e.t0, each, step);
    } else if (a.do === "zoom") {
      const p = this.geo.parts.find((x) => "blocks" in x && x.id === a.target.split(".")[0]) as Blocks | undefined;
      if (!p) throw new Error(`zoom "${a.target}": no blocks part is named ${a.target.split(".")[0]}.`);
      this.blockModel(a.target, "zoom").boxOf(a.target, e.t0); // a clear error now if the target does not exist then
      if (a.target === p.id && !this.frameFrom.has(p.id)) this.frameFrom.set(p.id, { t0: e.t0, dur: e.dur });
      this.views.push({ t0: e.t0, dur: e.dur, from: this.view0, to: this.view0, lazy: () => this.blockView(p, a.target, e.t0) });
    } else if (a.do === "given") {
      const [id, ...rest] = (a.target as string).split(".");
      const p = this.geo.parts.find((x) => x.id === id);
      if (!p || (!("table" in p) && !("mosaic" in p))) throw new Error(`given "${a.target}": no table or mosaic is named ${id}.`);
      const target = rest.length ? rest.join(".") : null;
      if (target !== null) {
        if ("table" in p) tableRegion(this.tableSpec(p, e.t0, true), target);
        else {
          const m = target.match(/^slab\.(\d+)$/);
          if (!m) throw new Error(`given "${a.target}": a mosaic is restricted to a slab (${id}.slab.1), or released with "${id}".`);
          slabBox(this.mosaicSpec(p, e.t0, true), Number(m[1]));
        }
      }
      if (!this.givens.has(id)) this.givens.set(id, []);
      this.givens.get(id)!.push({ t0: e.t0, dur: e.dur, target });
    } else if (a.do === "glide") {
      const d = this.geo.points[a.point];
      if (!d || Array.isArray(d) || !("on" in d)) throw new Error(`glide needs a point on a plot or a circle; ${a.point} is not one`);
      if ((a.x === undefined) === (a.deg === undefined)) throw new Error(`glide ${a.point}: give x (along a plot) or deg (around a circle), not both.`);
      if ("x" in d && a.x === undefined) throw new Error(`glide ${a.point}: ${a.point} sits on a plot; glide it with x, not deg.`);
      if ("deg" in d && a.deg === undefined) throw new Error(`glide ${a.point}: ${a.point} sits on a circle; glide it with deg, not x.`);
      const prev = [...this.glides].reverse().find((g) => g.name === a.point);
      const start = "x" in d ? d.x : d.deg, to = "x" in d ? a.x : a.deg;
      this.glides.push({ name: a.point, t0: e.t0, dur: e.dur, from: prev ? prev.to : start, to });
    } else if (a.do === "move") {
      for (const [name, to] of Object.entries(a.points) as [string, Target][]) {
        const d = this.geo.points[name];
        if (!d) throw new Error(`move: no point named ${name}`);
        if (!Array.isArray(d) && !("cell" in d)) throw new Error(`Point ${name} is derived; move the points it is built from`);
        if (to === name) throw new Error(`move: ${name} cannot move to itself`);
        if (typeof to === "string" && !this.geo.points[to]) throw new Error(`move: no point named ${to}`);
        if (!Array.isArray(to) && typeof to === "object") this.grid(to.cell[0]);
        this.moves.push({ name, t0: e.t0, dur: e.dur, to });
      }
    } else if (a.do === "view") {
      this.views.push({ t0: e.t0, dur: e.dur, from: this.view0, to: a.to });
    } else if (a.do === "turn" || a.do === "flip" || a.do === "slide") {
      this.xforms.push({
        targets: new Set(list(a.target)),
        kind: a.do,
        t0: e.t0,
        dur: e.dur,
        a,
        about: a.about ? this.at(a.about, e.t0) : undefined,
        over: a.over ? [this.at(a.over[0], e.t0), this.at(a.over[1], e.t0)] : undefined,
      });
    } else if (a.do === "show" || a.do === "hide" || a.do === "draw" || a.do === "highlight") {
      for (const n of list(a.target)) {
        // a table's or a mosaic's parts are named by pattern: a typo would fade nothing, silently
        const [id, ...rest] = n.split(".");
        const p = this.geo.parts.find((x) => x.id === id);
        const sub = rest.join(".");
        if (p && "bar" in p && sub) {
          const m = sub.match(/^mark\.([A-Za-z][\w']*)(?:\.(top|amount))?$/);
          const valid = ["whole", "part", "unit", "values", "title", "scale", "amounts"].includes(sub) || (m && ["zero", "end", ...(p.marks ?? []).map(x => x.id)].includes(m[1]!));
          if (!valid) throw new Error(`${a.do} "${n}": unknown bar part or mark.`);
        }
        if (p && "table" in p && sub) {
          const m = sub.match(/^(row|col)\.(\d+)$/) ?? sub.match(/^(cell)\.(\d+)\.(\d+)$/);
          const ok = m && (m[1] === "row" ? Number(m[2]) <= p.rows.length : m[1] === "col" ? Number(m[2]) <= p.head.length : Number(m[2]) <= p.rows.length && Number(m[3]!) <= p.head.length);
          if (!ok) throw new Error(`${a.do} "${n}": a table has ${id}.row.r (0 is the header row), ${id}.col.c (0 is the labels) and ${id}.cell.r.c; this one has ${p.rows.length} rows and ${p.head.length} columns.`);
        }
        if (p && "mosaic" in p && sub) {
          const m = sub.match(/^(slab|part|name)\.(\d+)$/);
          const ok = sub === "parts" || sub === "guide" || (m && Number(m[2]) >= 1 && Number(m[2]) <= p.groups.length);
          if (!ok) throw new Error(`${a.do} "${n}": a mosaic has ${id}.slab.i, ${id}.part.i, ${id}.name.i, ${id}.parts and ${id}.guide; this one has ${p.groups.length} slabs.`);
        }
        if (!this.fades.has(n)) this.fades.set(n, []);
        this.fades.get(n)!.push({ kind: a.do, t0: e.t0, dur: e.dur, end: e.beatEnd });
      }
    }
  }
  viewAt(t: number) {
    let v = this.view0;
    for (const m of this.views) {
      if (t < m.t0) break;
      const u = ease((t - m.t0) / m.dur);
      v = m.from.map((x, i) => x + (m.to[i]! - x) * u);
    }
    return v;
  }
  px(t: number, fixed?: number[]) {
    const v = fixed ?? this.viewAt(t);
    const vw = v[2]! - v[0]!, vh = v[3]! - v[1]!;
    const s = Math.min(this.box.w / vw, this.box.h / vh);
    if (this.geo.stretch) {
      // a graph: x and y each fill the card, so a steep curve is not a spike
      const sx = this.box.w / vw, sy = this.box.h / vh;
      return { s: Math.min(sx, sy), map: (p: P): P => [(p[0] - v[0]!) * sx, (v[3]! - p[1]) * sy] };
    }
    const ox = (this.box.w - vw * s) / 2 - v[0]! * s;
    const oy = (this.box.h + vh * s) / 2 + v[1]! * s;
    return { s, map: (p: P): P => [ox + p[0] * s, oy - p[1] * s] };
  }
  /** Every transform on a part, applied in order; `lift` is how high it is off the page. */
  xform(part: Part, t: number) {
    const hit = this.xforms.filter((x) => x.targets.has(part.id) || (part.group && x.targets.has(part.group)));
    let lift = 0, back = false;
    const steps = hit.filter((x) => t >= x.t0).map((x) => {
      const raw = clamp((t - x.t0) / x.dur); const u = ease(raw);
      if (x.kind === "turn" || x.kind === "flip") lift = Math.max(lift, Math.sin(Math.PI * u));
      if (x.kind === "flip") back = u > 0.5 ? !back : back;
      return { x, u };
    });
    const T = (p: P): P => {
      let q: P = p;
      for (const { x, u } of steps) {
        if (x.kind === "slide") q = [q[0] + x.a.by[0] * u, q[1] + x.a.by[1] * u];
        else if (x.kind === "turn") {
          const r = (x.a.deg * Math.PI * u) / 180, c = Math.cos(r), s = Math.sin(r), o = x.about!;
          const d: P = [q[0] - o[0], q[1] - o[1]];
          q = [o[0] + d[0] * c - d[1] * s, o[1] + d[0] * s + d[1] * c];
        } else {
          const [a, b] = x.over!;
          const ax = [b[0] - a[0], b[1] - a[1]]; const L = Math.hypot(ax[0]!, ax[1]!); const ux = ax[0]! / L, uy = ax[1]! / L;
          const dx = q[0] - a[0], dy = q[1] - a[1];
          const al = dx * ux + dy * uy; const px = dx - al * ux, py = dy - al * uy;
          const th = Math.PI * u; const c = Math.cos(th), s = Math.sin(th);
          // the near edge grows as it comes toward the camera
          const persp = 1 + 0.16 * s * (Math.hypot(px, py) / L) * Math.sign(px * uy - py * ux || 1);
          q = [a[0] + (al * persp) * ux + px * c, a[1] + (al * persp) * uy + py * c];
        }
      }
      return q;
    };
    return { T, lift, back };
  }
  opacity(part: Part, t: number) {
    const lists = [this.fades.get(part.id) ?? [], part.group ? (this.fades.get(part.group) ?? []) : []].flat();
    // a chart's frame (names, point) is there from the start; its pieces have their own fades.
    // A table or a mosaic works out its own cells' and slabs' visibility.
    return this.fadeState(lists, !!part.start || "blocks" in part || "table" in part || "mosaic" in part || "bar" in part, t);
  }
  /** The state of something named by a path: fades on it or on anything it is part of. */
  chainState(ids: string[], start: boolean, t: number) {
    return this.fadeState(ids.flatMap((id) => this.fades.get(id) ?? []), start, t);
  }
  fadeState(lists: Fade[], start: boolean, t: number) {
    lists = [...lists].sort((a, b) => a.t0 - b.t0);
    let o = start ? 1 : 0, drawn = start ? 1 : 0, em = 0;
    for (const f of lists) {
      if (t < f.t0) continue;
      const u = ease((t - f.t0) / f.dur);
      if (f.kind === "show") { o = Math.max(o, u); drawn = 1; }
      else if (f.kind === "draw") { o = 1; drawn = Math.max(drawn, u); }
      else if (f.kind === "hide") { o = Math.min(o, 1 - u); }
      else if (f.kind === "highlight") {
        const off = f.end! + 0.35;
        const v = t < off ? ease((t - f.t0) / 0.3) : 1 - ease((t - off) / 0.35);
        em = Math.max(em, v);
      }
    }
    return { o, drawn, em };
  }
  build(p: Part) {
    const entry: GeoStage["parts"][number] = { p, el: svg("g"), a0: 0 };
    if ("bar" in p) {
      const g = svg("g", "film-bar"); this.svg.appendChild(g); entry.el = g;
      const path = (cls: string) => { const el = svg("path", cls); g.appendChild(el); return el; };
      const label = (cls: string, content: string) => { const el = div(`film-label ${cls}`, this.labels); el.innerHTML = tex(content); return el; };
      const base = path("film-bar-base"), part = path("film-bar-part"), cuts = path("film-bar-cuts"), major = path("film-bar-major"), unit = path("film-bar-unit"), ring = path("film-bar-ring film-em"), bracket = path("film-bar-bracket");
      const title = label("size-s film-bar-title", p.title ?? "\\text{One whole}");
      const scales: BarView["scales"] = (["top", "amount"] as const).map(kind => ({ kind, line: path("film-bar-axis"), caption: label("film-bar-caption", `\\text{${kind === "top" ? p.scale?.label ?? "Share" : p.unit ?? "Amount"}}`) }));
      const marks: BarView["marks"] = [{ id: "zero", value: 0 }, ...(p.marks ?? []), { id: "end", value: 1 }].map(m => {
        const amount = amountAt(this.barSpec(p, 0, true), m.value);
        return { id: m.id, value: m.value,
          top: label("size-s film-bar-number", ("top" in m && m.top) || `${fmtNum(m.value * (p.scale?.max ?? 1))}${p.scale?.suffix ?? ""}`),
          amount: label("size-s film-bar-number", ("bottom" in m && m.bottom) || (m.value === 0 ? "0" : amount === undefined ? "?" : fmtNum(amount))),
          topTick: path("film-bar-tick"), amountTick: path("film-bar-tick"), guide: path("film-bar-guide"), leaders: path("film-bar-leader") };
      });
      const values = Array.from({ length: 20 }, () => label("size-s film-bar-number", ""));
      entry.bar = { p, base, part, cuts, major, ring, unit, bracket, title, scales, marks, values };
      entry.extraHtml = [title, ...scales.map(x => x.caption), ...marks.flatMap(x => [x.top, x.amount]), ...values];
      this.parts.push(entry); return;
    }
    if ("blocks" in p) {
      const model = this.blocks.get(p.id)!;
      const g = svg("g", "film-blocks");
      this.svg.appendChild(g);
      entry.el = g;
      const pointLine = svg("path", "film-block-pointline"), point = svg("circle");
      g.appendChild(pointLine); g.appendChild(point);
      const pieces: BlocksView["pieces"] = new Map();
      const fadeIds = [...this.fades.keys()];
      for (const piece of model.pieces()) {
        const body = svg("path", "film-block"), lines = svg("path", "film-block-lines");
        g.appendChild(body);
        const overlays = new Map<string, SVGElement>();
        // a strip or a cell of this piece that some beat highlights gets its own gold overlay
        for (const id of fadeIds) {
          if (!id.startsWith(piece.id + ".")) continue;
          const sub = id.slice(piece.id.length + 1);
          const ov = svg("path", "film-block-overlay film-em");
          g.appendChild(ov);
          overlays.set(sub, ov);
        }
        g.appendChild(lines);
        pieces.set(piece.id, { body, lines, overlays });
      }
      const heads = new Map<Place, HTMLElement>(), digits = new Map<Place, HTMLElement>(), counts = new Map<Place, HTMLElement>();
      const { digit, placeholder } = model.digits;
      for (const place of model.places) {
        const h = div("film-label film-blocks-head", this.labels);
        h.textContent = place.replace("-", " ");
        heads.set(place, h);
        if (p.digits) {
          const d = div(`film-label size-l film-blocks-digit${placeholder[place] ? " pad" : ""}`, this.labels);
          d.innerHTML = tex(String(digit[place]));
          digits.set(place, d);
        }
        if (p.counts) counts.set(place, div("film-label size-l film-blocks-count", this.labels));
      }
      const labels = (p.labels ?? []).map((spec) => {
        const el = div(`film-label size-${spec.size ?? "m"}`, this.labels);
        el.innerHTML = tex(spec.tex.replace(/\\frac/g, "\\dfrac"));
        el.style.color = INK[spec.ink ?? "ink"]!;
        return { spec, el };
      });
      entry.extraHtml = [...heads.values(), ...digits.values(), ...counts.values(), ...labels.map((l) => l.el)];
      entry.blocks = { model, p, pointLine, point, pieces, heads, digits, counts, labels };
      this.parts.push(entry);
      return;
    }
    if ("table" in p) {
      const g = svg("g", "film-table");
      this.svg.appendChild(g);
      entry.el = g;
      // bands beneath, then cell backgrounds, then the lines
      const bands = new Map<string, SVGElement>();
      for (let r = 1; r <= p.rows.length; r++) bands.set(`row.${r}`, svg("path", "film-table-band film-em"));
      for (let c = 1; c <= p.head.length; c++) bands.set(`col.${c}`, svg("path", "film-table-band film-em"));
      for (const b of bands.values()) g.appendChild(b);
      const cells: TableView["cells"] = [];
      const text = (r: number, c: number) => (r === 0 ? (c === 0 ? p.corner ?? "" : p.head[c - 1]!) : c === 0 ? p.rows[r - 1]!.label : p.rows[r - 1]!.cells[c - 1]!);
      for (let r = 0; r <= p.rows.length; r++) {
        for (let c = 0; c <= p.head.length; c++) {
          const bg = svg("path", "film-table-bg");
          g.appendChild(bg);
          const total = p.totals && (r === p.rows.length || c === p.head.length);
          const el = div(`film-label size-${p.size ?? "s"} film-table-cell${r === 0 || c === 0 ? " head" : ""}${total ? " total" : ""}`, this.labels);
          el.innerHTML = prose(text(r, c));
          cells.push({ r, c, bg, el });
        }
      }
      const grid = svg("path", "film-table-grid"), rules = svg("path", "film-table-rule");
      g.appendChild(grid);
      g.appendChild(rules);
      entry.extra = [grid, rules, ...bands.values(), ...cells.map((x) => x.bg)];
      entry.extraHtml = cells.map((x) => x.el);
      entry.table = { p, grid, rules, cells, bands };
      this.parts.push(entry);
      return;
    }
    if ("mosaic" in p) {
      const g = svg("g", "film-mosaic");
      this.svg.appendChild(g);
      entry.el = g;
      const slabs: MosaicView["slabs"] = [];
      const html: HTMLElement[] = [];
      p.groups.forEach((grp, i) => {
        const base = svg("path", "film-mosaic-base"), part = svg("path", "film-mosaic-part"), edge = svg("path", "film-mosaic-edge"), ring = svg("path", "film-mosaic-ring film-em");
        for (const el of [base, part]) g.appendChild(el);
        const slab: MosaicView["slabs"][number] = { base, part, edge, ring };
        if (p.names) {
          slab.name = div("film-label size-s film-mosaic-name", this.labels);
          slab.name.innerHTML = tex(p.names[i]!);
          html.push(slab.name);
        }
        if (p.counts) {
          slab.kEl = div("film-label size-s film-mosaic-count part halo", this.labels);
          slab.kEl.innerHTML = tex(String(grp.k));
          slab.restEl = div("film-label size-s film-mosaic-count rest halo", this.labels);
          slab.restEl.innerHTML = tex(String(grp.n - grp.k));
          html.push(slab.kEl, slab.restEl);
        }
        slabs.push(slab);
      });
      // the guide lies under the colored edges, so an edge that sits on it still shows through the dashes
      const guide = svg("path", "film-mosaic-guide");
      g.appendChild(guide);
      for (const sl of slabs) for (const el of [sl.edge, sl.ring]) g.appendChild(el);
      entry.extra = [guide, ...slabs.flatMap((s) => [s.base, s.part, s.edge, s.ring])];
      entry.extraHtml = html;
      entry.mosaic = { p, slabs, guide };
      this.parts.push(entry);
      return;
    }
    if ("poly" in p) {
      if (p.solid) {
        entry.shadow = svg("path", "film-shadow"); this.svg.appendChild(entry.shadow);
        entry.side = svg("path", "film-side"); this.svg.appendChild(entry.side);
      }
      entry.el = svg("path");
      entry.el.setAttribute("stroke-linejoin", "round");
      this.svg.appendChild(entry.el);
    } else if ("seg" in p || "curve" in p || "vector" in p) {
      entry.el = svg("path");
      entry.el.setAttribute("fill", "none");
      entry.el.setAttribute("stroke-linecap", "round");
      this.svg.appendChild(entry.el);
      if ("seg" in p && (p.arrows || p.ticks)) {
        entry.extra = [svg("path")];
        entry.extra[0]!.setAttribute("fill", "none");
        entry.extra[0]!.setAttribute("stroke-linecap", "round");
        entry.extra[0]!.setAttribute("stroke-linejoin", "round");
        this.svg.appendChild(entry.extra[0]!);
      }
    } else if ("dot" in p) {
      entry.el = svg((p as Counter).counter ? "path" : "circle"); this.svg.appendChild(entry.el);
    } else if ("circle" in p) {
      entry.el = svg("path");
      this.svg.appendChild(entry.el);
    } else if ("sweep" in p) {
      entry.el = svg("path"); this.svg.appendChild(entry.el);
      entry.extra = [svg("path")];
      entry.extra[0]!.setAttribute("fill", "none");
      entry.extra[0]!.setAttribute("stroke-linecap", "round");
      this.svg.appendChild(entry.extra[0]!);
      if (p.tex) {
        entry.html = div(`film-label size-${p.size ?? "m"} halo`, this.labels);
        entry.html.innerHTML = tex(p.tex);
        entry.html.style.color = INK[p.ink ?? "gold"]!;
      }
    } else if ("grid" in p) {
      entry.el = svg("path");
      entry.el.setAttribute("stroke-linejoin", "round");
      this.svg.appendChild(entry.el);
      entry.extra = [svg("path")];
      entry.extra[0]!.setAttribute("fill", "none");
      this.svg.appendChild(entry.extra[0]!);
    } else if ("angle" in p) {
      entry.el = svg("path"); this.svg.appendChild(entry.el);
      entry.extra = [svg("path")];
      entry.extra[0]!.setAttribute("fill", "none");
      this.svg.appendChild(entry.extra[0]!);
    } else if ("label" in p) {
      // on a graph, every label is haloed so grid lines and curves never cut through it
      const halo = p.halo || this.geo.parts.some((q) => "axes" in q);
      entry.html = div(`film-label size-${p.size ?? "m"}${halo ? " halo" : ""}`, this.labels);
      if (p.label.includes("@")) this.readouts.set(entry.html, "");
      // a fraction on a figure is read at a glance: full size, not squeezed into a line
      else entry.html.innerHTML = tex(p.label.replace(/\\frac/g, "\\dfrac"));
      entry.html.style.color = INK[p.ink ?? "ink"]!;
    } else if ("plot" in p) {
      entry.el = svg("path");
      entry.el.setAttribute("fill", "none");
      entry.el.setAttribute("stroke-linecap", "round");
      entry.el.setAttribute("stroke-linejoin", "round");
      entry.el.setAttribute("pathLength", "1");
      this.svg.appendChild(entry.el);
    } else if ("axes" in p) {
      entry.el = svg("path");
      entry.el.setAttribute("fill", "none");
      entry.el.setAttribute("stroke-linecap", "round");
      this.svg.appendChild(entry.el);
      entry.extra = [];
    } else if ("dim" in p) {
      entry.el = svg("path");
      entry.el.setAttribute("fill", "none");
      entry.el.setAttribute("stroke-linecap", "round");
      this.svg.appendChild(entry.el);
      entry.html = div("film-label size-m", this.labels);
      entry.html.innerHTML = tex(p.tex);
      entry.html.style.color = INK[p.ink ?? "ink"]!;
    }
    this.parts.push(entry);
  }
  segLine(id: string, t: number): [P, P] | null {
    const part = this.parts.find((x) => x.p.id === id)?.p;
    if (part && "seg" in part) return [this.at(part.seg[0], t), this.at(part.seg[1], t)];
    if (part && "vector" in part) return [this.at(part.vector[0], t), this.at(part.vector[1], t)];
    return null;
  }
  draw(t: number) {
    const { s, map } = this.px(t);
    const unit = 1;
    for (const e of this.parts) {
      const { p } = e;
      if (e.table) { this.drawTable(e.table, e.el, t, map, s); continue; }
      if (e.mosaic) { this.drawMosaic(e.mosaic, e.el, t, map, s); continue; }
      if (e.bar) { this.drawBar(e.bar, e.el, t, map, s); continue; }
      const { o, drawn, em } = this.opacity(p, t);
      const show = o > 0.001;
      const set = (el: Element | undefined, v: string) => { if (el) (el as SVGElement).style.display = v; };
      set(e.el, show ? "" : "none"); set(e.shadow, show ? "" : "none"); set(e.side, show ? "" : "none"); e.extra?.forEach((x) => set(x, show ? "" : "none"));
      if (e.html) e.html.style.display = show ? "" : "none";
      if (!show) e.extraHtml?.forEach((x) => { x.style.display = "none"; });
      if (!show) continue;
      if (e.blocks) { this.drawBlocks(e.blocks, t, map, s, o); continue; }
      const { T, lift, back } = this.xform(p, t);
      const P = (n: string) => map(T(this.at(n, t)));
      if ("poly" in p) {
        const pts = p.poly.map(P);
        const d = "M" + pts.map((q) => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join("L") + "Z";
        const f = back && p.back ? p.back : (p.fill ?? "none");
        e.el.setAttribute("d", d);
        e.el.style.fill = em > 0 && f !== "none" ? `color-mix(in srgb, ${FILL[f]} ${(1 - em * 0.5) * 100}%, var(--color-figure-accent-fill-strong))` : FILL[f]!;
        e.el.style.fillOpacity = String(o);
        const w = p.w ?? (p.ink ? 5 : 0);
        e.el.style.stroke = emphInk(p.ink ? INK[p.ink]! : "none", em);
        e.el.style.strokeWidth = String(w);
        e.el.style.strokeOpacity = String(o);
        if (p.solid) {
          const th = 7; // thickness of the tile in px
          const off = 6 + lift * 46; const blur = 8 + lift * 26;
          e.shadow!.setAttribute("d", d);
          e.shadow!.setAttribute("transform", `translate(${off * 0.55} ${off})`);
          (e.shadow as SVGElement).style.opacity = String(o * (0.26 - lift * 0.1));
          (e.shadow as SVGElement).style.filter = `blur(${blur.toFixed(1)}px)`;
          e.side!.setAttribute("d", d);
          e.side!.setAttribute("transform", `translate(0 ${th * (1 - lift * 0.3)})`);
          (e.side as SVGElement).style.opacity = String(o);
          (e.side as SVGElement).style.fill = `color-mix(in srgb, ${FILL[f]} 62%, #1b2b28)`;
          e.el.setAttribute("transform", `translate(${-lift * 4} ${-lift * 14})`);
          e.side!.setAttribute("transform", `translate(${-lift * 4} ${th * (1 - lift * 0.3) - lift * 14})`);
        }
      } else if ("vector" in p) {
        e.el.setAttribute("d", vectorPath(planVector(P(p.vector[0]), P(p.vector[1]), drawn)));
        e.el.style.stroke = emphInk(INK[p.ink ?? "accent"]!, em);
        e.el.style.strokeWidth = String(p.w ?? 6);
        e.el.style.strokeLinejoin = "round";
        e.el.style.strokeDasharray = p.dash ? "16 14" : "";
        e.el.style.opacity = String(o);
      } else if ("seg" in p) {
        let a = P(p.seg[0]), b = P(p.seg[1]);
        if (p.extend) {
          // extend in the figure's own units, then map
          const fa = T(this.at(p.seg[0], t)), fb = T(this.at(p.seg[1], t));
          const L = Math.hypot(fb[0] - fa[0], fb[1] - fa[1]) || 1; const ux = (fb[0] - fa[0]) / L, uy = (fb[1] - fa[1]) / L;
          a = map([fa[0] - ux * p.extend[0], fa[1] - uy * p.extend[0]]);
          b = map([fb[0] + ux * p.extend[1], fb[1] + uy * p.extend[1]]);
        }
        const end: P = [a[0] + (b[0] - a[0]) * drawn, a[1] + (b[1] - a[1]) * drawn];
        e.el.setAttribute("d", `M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${end[0].toFixed(2)} ${end[1].toFixed(2)}`);
        e.el.style.stroke = emphInk(INK[p.ink ?? "ink"]!, em);
        e.el.style.strokeWidth = String(p.w ?? 5);
        e.el.style.opacity = String(o);
        e.el.style.strokeDasharray = p.dash ? "16 14" : "";
        if (e.extra) {
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
          let d = "";
          const r = 18;
          if (p.arrows) {
            for (let i = 0; i < p.arrows; i++) {
              const mx = (a[0] + b[0]) / 2 + ux * (i - (p.arrows - 1) / 2) * 20, my = (a[1] + b[1]) / 2 + uy * (i - (p.arrows - 1) / 2) * 20;
              d += `M${mx - ux * r - uy * r * 0.7} ${my - uy * r + ux * r * 0.7}L${mx} ${my}L${mx - ux * r + uy * r * 0.7} ${my - uy * r - ux * r * 0.7}`;
            }
          }
          if (p.ticks) {
            for (const f of p.tickAt ?? [0.5]) {
              for (let i = 0; i < p.ticks; i++) {
                const mx = a[0] + (b[0] - a[0]) * f + ux * (i - (p.ticks - 1) / 2) * 12, my = a[1] + (b[1] - a[1]) * f + uy * (i - (p.ticks - 1) / 2) * 12;
                d += `M${mx - uy * r} ${my + ux * r}L${mx + uy * r} ${my - ux * r}`;
              }
            }
          }
          e.extra[0]!.setAttribute("d", d);
          e.extra[0]!.style.stroke = INK[p.ink ?? "ink"]!;
          e.extra[0]!.style.strokeWidth = "4.5";
          e.extra[0]!.style.opacity = String(o);
        }
      } else if ("dot" in p && (p as Counter).counter) {
        const c = P(p.dot), d = this.geo.points[p.dot] as { cell: [string, number] };
        const [cw, ch] = cellSize(this.grid(d.cell[0]));
        const k = Math.min(cw, ch) * s;
        let path: string;
        if ((p as Counter).counter === "square") {
          const h = 0.27 * k, r = 0.05 * k;
          path = `M${c[0] - h + r} ${c[1] - h}H${c[0] + h - r}Q${c[0] + h} ${c[1] - h} ${c[0] + h} ${c[1] - h + r}V${c[1] + h - r}Q${c[0] + h} ${c[1] + h} ${c[0] + h - r} ${c[1] + h}H${c[0] - h + r}Q${c[0] - h} ${c[1] + h} ${c[0] - h} ${c[1] + h - r}V${c[1] - h + r}Q${c[0] - h} ${c[1] - h} ${c[0] - h + r} ${c[1] - h}Z`;
        } else {
          const r = 0.3 * k;
          path = `M${c[0] - r} ${c[1]}A${r} ${r} 0 1 0 ${c[0] + r} ${c[1]}A${r} ${r} 0 1 0 ${c[0] - r} ${c[1]}Z`;
        }
        e.el.setAttribute("d", path);
        e.el.style.fill = emphInk(INK[p.ink ?? "accent"]!, em);
        e.el.style.opacity = String(o);
        // a counter in flight passes over the others
        if (this.moves.some((m) => m.name === p.dot && t >= m.t0 && t <= m.t0 + m.dur) && this.svg.lastChild !== e.el) this.svg.appendChild(e.el);
      } else if ("circle" in p) {
        // traced as points so a stretched view and every transform apply
        const c = T(this.at(p.circle, t)), n = 96;
        let d = "";
        for (let k = 0; k <= n * drawn; k++) {
          const a = Math.PI / 2 - (2 * Math.PI * k) / n;
          const q = map([c[0] + p.r * Math.cos(a), c[1] + p.r * Math.sin(a)]);
          d += `${k ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
        }
        if (drawn >= 1) d += "Z";
        e.el.setAttribute("d", d);
        e.el.style.fill = FILL[p.fill ?? "none"]!;
        e.el.style.fillOpacity = String(o);
        e.el.style.stroke = emphInk(INK[p.ink ?? "ink"]!, em);
        e.el.style.strokeWidth = String(p.w ?? 5);
        e.el.style.strokeOpacity = String(o);
      } else if ("sweep" in p) {
        const d = this.geo.points[p.sweep] as { on: string; deg: number };
        const c = map(T(this.at(this.circleOf(d.on)!.circle, t)));
        const deg = this.degOf(p.sweep, t), r = p.r ?? 80;
        // in pixels y points down, so a counterclockwise turn is a negative angle
        const px = (ang: number, rr = r): P => [c[0] + rr * Math.cos((-ang * Math.PI) / 180), c[1] + rr * Math.sin((-ang * Math.PI) / 180)];
        const ring = sectorAngles(deg).map((a) => px(a));
        const arc = ring.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join("");
        const full = deg >= 360;
        e.el.setAttribute("d", full ? arc + "Z" : `M${c[0].toFixed(1)} ${c[1].toFixed(1)}${arc.replace(/^M/, "L")}Z`);
        e.el.style.fill = FILL[p.fill ?? "gold-fill"]!;
        e.el.style.opacity = String(o * 0.92);
        e.extra![0]!.setAttribute("d", deg > 0.01 ? arc : "");
        e.extra![0]!.style.stroke = emphInk(INK[p.ink ?? "gold"]!, em);
        e.extra![0]!.style.strokeWidth = "4.5";
        e.extra![0]!.style.opacity = String(o);
        if (e.html) {
          // the reading rides the bisector, just inside the arc; a full turn reads at the top
          const lab = px(full ? 90 : sweepLabelAngle(deg), r * 0.62);
          e.html.style.display = deg > 12 ? "" : "none";
          place(e.html, lab, "c", 0, o, em);
        }
      } else if ("grid" in p) {
        const a = this.at(p.at, t), [cw, ch] = cellSize(p), [nc, nr] = p.grid;
        const k = (c: number, r: number) => { const q = map(T([a[0] + c * cw, a[1] - r * ch])); return `${q[0].toFixed(2)} ${q[1].toFixed(2)}`; };
        e.el.setAttribute("d", `M${k(0, 0)}L${k(nc, 0)}L${k(nc, nr)}L${k(0, nr)}Z`);
        let inner = "";
        for (let c = 1; c < nc; c++) inner += `M${k(c, 0)}L${k(c, nr)}`;
        for (let r = 1; r < nr; r++) inner += `M${k(0, r)}L${k(nc, r)}`;
        e.extra![0]!.setAttribute("d", inner);
        const w = String(p.w ?? 4), ink = emphInk(INK[p.ink ?? "ink"]!, em);
        e.el.style.fill = FILL[p.fill ?? "paper"]!; e.el.style.stroke = ink; e.el.style.strokeWidth = w; e.el.style.opacity = String(o);
        e.extra![0]!.style.stroke = ink; e.extra![0]!.style.strokeWidth = w; e.extra![0]!.style.opacity = String(o);
      } else if ("dot" in p) {
        const c = P(p.dot);
        if (!Number.isFinite(c[1]) || c[1] < -60 || c[1] > this.box.h + 60) { e.el.style.opacity = "0"; continue; }
        e.el.setAttribute("cx", String(c[0])); e.el.setAttribute("cy", String(c[1]));
        e.el.setAttribute("r", String(p.r ?? 9));
        e.el.style.fill = emphInk(INK[p.ink ?? "ink"]!, em);
        e.el.style.stroke = "var(--color-figure-paper)"; e.el.style.strokeWidth = "3";
        e.el.style.opacity = String(o);
      } else if ("angle" in p) {
        const v = P(p.angle[1]), a = P(p.angle[0]), b = P(p.angle[2]);
        const r = p.r ?? 62;
        let a0 = Math.atan2(a[1] - v[1], a[0] - v[0]), a1 = Math.atan2(b[1] - v[1], b[0] - v[0]);
        let dl = a1 - a0; while (dl > Math.PI) dl -= 2 * Math.PI; while (dl < -Math.PI) dl += 2 * Math.PI;
        const px = (ang: number, rr = r): P => [v[0] + rr * Math.cos(ang), v[1] + rr * Math.sin(ang)];
        const s0 = px(a0), s1 = px(a0 + dl * drawn);
        let d: string, arc: string;
        if (p.right) {
          const u0: P = [Math.cos(a0) * r * 0.62, Math.sin(a0) * r * 0.62], u1: P = [Math.cos(a1) * r * 0.62, Math.sin(a1) * r * 0.62];
          arc = `M${v[0] + u0[0]} ${v[1] + u0[1]}L${v[0] + u0[0] + u1[0]} ${v[1] + u0[1] + u1[1]}L${v[0] + u1[0]} ${v[1] + u1[1]}`;
          d = `M${v[0]} ${v[1]}L${v[0] + u0[0]} ${v[1] + u0[1]}L${v[0] + u0[0] + u1[0]} ${v[1] + u0[1] + u1[1]}L${v[0] + u1[0]} ${v[1] + u1[1]}Z`;
        } else {
          const large = Math.abs(dl * drawn) > Math.PI ? 1 : 0; const sweep = dl > 0 ? 1 : 0;
          arc = `M${s0[0]} ${s0[1]}A${r} ${r} 0 ${large} ${sweep} ${s1[0]} ${s1[1]}`;
          d = `M${v[0]} ${v[1]}L${s0[0]} ${s0[1]}A${r} ${r} 0 ${large} ${sweep} ${s1[0]} ${s1[1]}Z`;
        }
        e.el.setAttribute("d", d);
        e.el.style.fill = FILL[p.fill ?? "gold-fill"]!;
        e.el.style.opacity = String(o * 0.92);
        e.extra![0]!.setAttribute("d", arc);
        e.extra![0]!.style.stroke = emphInk(INK[p.ink ?? "gold"]!, em);
        e.extra![0]!.style.strokeWidth = "4.5";
        e.extra![0]!.style.opacity = String(o);
      } else if ("curve" in p) {
        const pts = p.curve.map(P);
        let d = `M${pts[0]![0]} ${pts[0]![1]}`;
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(pts.length - 1, i + 2)]!;
          d += `C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
        }
        e.el.setAttribute("d", d);
        e.el.setAttribute("pathLength", "1");
        e.el.style.strokeDasharray = "1 1"; e.el.style.strokeDashoffset = String(1 - drawn);
        e.el.style.stroke = emphInk(INK[p.ink ?? "ink"]!, em); e.el.style.strokeWidth = String(p.w ?? 5); e.el.style.opacity = String(o);
      } else if ("plot" in p) {
        const f = this.fn(p.id), v = this.viewAt(t);
        const range = traceRange(p.from, p.to, [v[0]!, v[2]!], p.upto ? this.at(p.upto, t)[0] : undefined);
        if (!range) { e.el.setAttribute("d", ""); continue; }
        const [x0, x1] = range;
        const lo = v[1]!, hi = v[3]!, span = hi - lo, n = 720;
        const inside = (y: number) => Number.isFinite(y) && y >= lo - span && y <= hi + span;
        // from a (on screen) toward b, the last x where the curve is still on screen, same side
        const edge = (a: number, b: number) => {
          const sa = Math.sign(f(a));
          for (let i = 0; i < 48; i++) {
            const m = (a + b) / 2, ym = f(m);
            if (inside(ym) && Math.sign(ym) === sa) a = m; else b = m;
          }
          return a;
        };
        const pt = (x: number) => { const q = map(T([x, Math.max(lo - span, Math.min(hi + span, f(x)))])); return `${q[0].toFixed(1)} ${q[1].toFixed(1)}`; };
        let d = "", pen = false, prev: number | null = null, px0 = x0;
        for (let k = 0; k <= n; k++) {
          const x = x0 + ((x1 - x0) * k) / n, y = f(x);
          const ok = Number.isFinite(y);
          // an asymptote: the graph leaves through one edge and returns through the other
          const jump = ok && prev !== null && ((prev > hi && y < lo) || (prev < lo && y > hi) || Math.abs(y - prev) > span * 4);
          const broke = (!ok && prev !== null) || jump;
          // follow the curve right up to the edge of the view, however close the break is
          if (broke && pen && inside(prev!)) d += `L${pt(edge(px0, x))}`;
          if (!ok || jump) pen = false;
          if (ok) {
            if (!pen && k > 0 && inside(y) && (jump || prev === null)) d += `M${pt(edge(x, px0))}`, pen = true;
            d += `${pen ? "L" : "M"}${pt(x)}`;
            pen = true;
          }
          prev = ok ? y : null;
          px0 = x;
        }
        e.el.setAttribute("d", d);
        e.el.style.strokeDasharray = "1 1"; e.el.style.strokeDashoffset = String(1 - drawn);
        e.el.style.stroke = emphInk(INK[p.ink ?? "accent"]!, em); e.el.style.strokeWidth = String(p.w ?? 6); e.el.style.opacity = String(o);
      } else if ("axes" in p) {
        const v = this.viewAt(t);
        // when the view zooms out, ticks and numbers thin out in 1-2-5 steps
        const thin = (span: number, base: number) => {
          for (let m = 1; ; m *= 10) for (const f of [1, 2, 5]) if (span / (base * f * m) <= 24) return f * m;
        };
        const fx = thin(v[2]! - v[0]!, p.step ?? 1), step = (p.step ?? 1) * fx;
        const every = p.every ? p.every * fx : step * Math.max(1, Math.ceil((v[2]! - v[0]!) / step / 12));
        let d = "";
        const xs = axisSpan([v[0]!, v[2]!], p.xrange) ?? [v[0]!, v[0]!];
        const ys = axisSpan([v[1]!, v[3]!], p.yrange) ?? [v[1]!, v[1]!];
        const ax0 = map([xs[0], 0]), ax1 = map([xs[1], 0]), ay0 = map([0, ys[0]]), ay1 = map([0, ys[1]]);
        if (ys[0] <= 0 && ys[1] >= 0 && xs[1] > xs[0]) d += `M${ax0[0]} ${ax0[1]}L${ax1[0]} ${ax1[1]}`;
        const yAxis = p.y !== false;
        if (yAxis && xs[0] <= 0 && xs[1] >= 0 && ys[1] > ys[0]) d += `M${ay0[0]} ${ay0[1]}L${ay1[0]} ${ay1[1]}`;
        const nums: [string, P, string][] = [];
        for (let x = Math.ceil(xs[0] / step) * step; x <= xs[1] + 1e-9; x += step) {
          if (Math.abs(x) < 1e-9 && yAxis) continue;
          const q = map([x, 0]); d += `M${q[0]} ${q[1] - 10}L${q[0]} ${q[1] + 10}`;
          if (Math.abs(x / every - Math.round(x / every)) < 1e-6) nums.push([fmtNum(x), q, "s"]);
        }
        const yb = p.ystep ?? p.step ?? 1, fy = thin(v[3]! - v[1]!, yb), ystep = yb * fy;
        const yevery = p.yevery ? p.yevery * fy : p.ystep ? ystep * Math.max(1, Math.ceil((v[3]! - v[1]!) / ystep / 12)) : p.every ? p.every * fy : ystep * Math.max(1, Math.ceil((v[3]! - v[1]!) / ystep / 12));
        for (let y = Math.ceil(ys[0] / ystep) * ystep; yAxis && y <= ys[1] + 1e-9; y += ystep) {
          if (Math.abs(y) < 1e-9) continue;
          const q = map([0, y]); d += `M${q[0] - 10} ${q[1]}L${q[0] + 10} ${q[1]}`;
          if (Math.abs(y / yevery - Math.round(y / yevery)) < 1e-6) nums.push([fmtNum(y), q, "w"]);
        }
        e.el.setAttribute("d", d);
        e.el.style.stroke = INK[p.ink ?? "muted"]!; e.el.style.strokeWidth = "3.5"; e.el.style.opacity = String(o);
        // numbers that would touch each other (near the origin, or crowded) drop out, nearest the origin first
        {
          const o0 = map([0, 0]), fs = 34, gap = LABEL_GAP * 0.62;
          const box = (n: [string, P, string]) => {
            const w = n[0].replace(/[^0-9.\-]/g, "").length * fs * 0.55 + 6, h = fs;
            const cx = n[2] === "s" ? n[1][0] : n[1][0] - gap - w / 2, cy = n[2] === "s" ? n[1][1] + gap + h / 2 : n[1][1];
            return { l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2 };
          };
          const order = nums.map((n, i) => ({ n, i, far: Math.hypot(n[1][0] - o0[0], n[1][1] - o0[1]) })).sort((a, b) => b.far - a.far);
          const kept: ReturnType<typeof box>[] = [], keep = new Set<number>();
          for (const { n, i } of order) {
            const bx = box(n);
            if (kept.some((k) => bx.l < k.r && bx.r > k.l && bx.t < k.b && bx.b > k.t)) continue;
            kept.push(bx); keep.add(i);
          }
          for (let i = nums.length - 1; i >= 0; i--) if (!keep.has(i)) nums.splice(i, 1);
        }
        const tags = (e.extraHtml ??= []);
        // haloed: a curve through its own zero crossing never cuts through the number there
        while (tags.length < nums.length) tags.push(div("film-label film-axis-num halo", this.labels));
        tags.forEach((el, k) => {
          const it = nums[k];
          el.style.display = it ? "" : "none";
          if (!it) return;
          if (el.dataset.v !== it[0]) { el.dataset.v = it[0]; el.innerHTML = tex(it[0]); }
          place(el, it[1], it[2], 0.62, o, 0);
        });
      } else if ("label" in p) {
        if (this.readouts.has(e.html!)) {
          let text = p.label;
          if (text.includes("@n")) text = text.replace(/@n/g, String(this.countIn(p.of ?? "", t)));
          if (/@[xy]/.test(text)) {
            const who = p.of ?? p.at, q = this.at(who, t);
            // as many decimals as the point's glides need: 2.00001 must not read as 2
            const dec = (x: number) => Math.min(6, (String(x).split(".")[1] ?? "").length);
            const digits = Math.max(3, ...this.glides.filter((g) => g.name === who).map((g) => dec(g.to)));
            text = text.replace(/@x/g, fmtNum(q[0], digits)).replace(/@y/g, fmtNum(q[1]));
          }
          if (this.readouts.get(e.html!) !== text) { this.readouts.set(e.html!, text); e.html!.innerHTML = tex(text.replace(/\\frac/g, "\\dfrac")); }
        }
        const line = this.segLine(p.at, t);
        // a pinned label (a readout, a title) stays where it is on the card when the view zooms
        const m = p.pin ? this.px(t, this.view0).map : map;
        const anchor: P = line ? m(T([(line[0][0] + line[1][0]) / 2, (line[0][1] + line[1][1]) / 2])) : m(T(this.at(p.at, t)));
        place(e.html!, anchor, p.dir ?? "n", p.far ?? 1, o, em);
      } else if ("dim" in p) {
        const a = P(p.dim[0]), b = P(p.dim[1]);
        const dirv = DIRS[p.side]!; const gap = LABEL_GAP * 0.7 * (p.far ?? 1);
        const q0: P = [a[0] + dirv[0] * gap, a[1] + dirv[1] * gap], q1: P = [b[0] + dirv[0] * gap, b[1] + dirv[1] * gap];
        const tick = 13;
        e.el.setAttribute("d", `M${q0[0] - dirv[0] * tick} ${q0[1] - dirv[1] * tick}L${q0[0]} ${q0[1]}L${q1[0]} ${q1[1]}L${q1[0] - dirv[0] * tick} ${q1[1] - dirv[1] * tick}`);
        e.el.style.stroke = INK[p.ink ?? "ink"]!; e.el.style.strokeWidth = "4"; e.el.style.opacity = String(o);
        place(e.html!, [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2], p.side, 0.7, o, em);
      }
      void unit;
    }
    const host = this.labels.parentElement;
    if (host) { separateLabels(host); fitFigure(host); }
  }
  /** A rectangle in pixels from a box in units. */
  rectPath(b: Box, map: (p: P) => P, s: number, r = 0) {
    const tl = map([b.x, b.y + b.h]);
    return roundRect(tl[0], tl[1], b.w * s, b.h * s, r);
  }
  /** The bar and its two aligned scales. Tick positions never move to accommodate text. */
  drawBar(v: BarView, g: SVGElement, t: number, map: (p: P) => P, s: number) {
    const { p } = v, spec = this.barSpec(p, t);
    const plan = planBar(spec, this.barCuts.get(p.id) ?? [], this.barShades.get(p.id) ?? [], t);
    const own = this.chainState([p.id, ...(p.group ? [p.group] : [])], !!p.start, t);
    const whole = this.chainState([`${p.id}.whole`], true, t);
    const o = own.o * whole.o, ink = INK[p.ink ?? "accent"]!;
    const show = (el: SVGElement | HTMLElement, opacity: number) => { el.style.display = opacity < 0.002 ? "none" : ""; el.style.opacity = String(opacity); };
    g.style.display = own.o < 0.002 ? "none" : "";
    if (own.o < 0.002) {
      for (const el of [v.title, ...v.scales.map(x => x.caption), ...v.marks.flatMap(x => [x.top, x.amount]), ...v.values]) el.style.display = "none";
      return;
    }
    show(v.base, o); v.base.setAttribute("d", this.rectPath(plan.whole, map, s));
    const shade = this.chainState([`${p.id}.part`], true, t);
    show(v.part, o * shade.o * (plan.part.w > 1e-9 ? 1 : 0));
    v.part.setAttribute("d", this.rectPath(plan.part, map, s));
    v.part.style.fill = ink; v.part.style.fillOpacity = "0.32";
    const k = (x: number, y: number) => { const a = map([x, y]); return `${a[0].toFixed(2)} ${a[1].toFixed(2)}`; };
    const b = plan.whole, top = b.y + b.h;
    let fine = "", major = "";
    for (const cut of plan.cuts) {
      const x = b.x + cut.share * b.w;
      const d = `M${k(x, top)}L${k(x, top - b.h * cut.progress)}`;
      if (plan.divisions <= 10 || Math.abs(cut.share * 10 - Math.round(cut.share * 10)) < 1e-7) major += d;
      else fine += d;
    }
    show(v.cuts, o); v.cuts.setAttribute("d", fine);
    show(v.major, o); v.major.setAttribute("d", major);
    const highlight = Math.max(own.em, whole.em, shade.em);
    show(v.ring, o * highlight); v.ring.setAttribute("d", this.rectPath(shade.em > 0 ? plan.part : b, map, s));
    const unit = this.chainState([`${p.id}.unit`], false, t);
    show(v.unit, o * unit.o); v.unit.setAttribute("d", this.rectPath(shareBox(spec, 0, 1 / plan.divisions), map, s));
    const values = this.chainState([`${p.id}.values`], false, t);
    const settled = plan.cuts.every(c => c.progress > 0.999);
    if (values.o > 0.5 && plan.divisions > v.values.length)
      this.tableIssues.add(`bar ${p.id}: per-piece values need at most 20 pieces. Hide .values before a finer partition.`);
    const cells = barCells(spec, plan.divisions);
    v.values.forEach((el, i) => {
      const cell = cells[i], opacity = cell && settled && plan.divisions <= v.values.length ? o * values.o : 0;
      show(el, opacity);
      if (!cell || opacity < 0.002) return;
      const content = cell.amount === undefined ? "?" : Number.isInteger(cell.amount) ? fmtNum(cell.amount) : `\\frac{${fmtNum(spec.whole!)}}{${plan.divisions}}`;
      if (el.dataset.value !== content) { el.innerHTML = tex(content); el.dataset.value = content; }
      if (opacity > 0.5) fitCellLabel(el, cell.box.w * s, cell.box.h * s, 10, 8);
      place(el, map(cell.center), "c", 0, opacity, values.em);
      if (opacity > 0.5 && !fits(el.offsetWidth, el.offsetHeight, cell.box.w * s, cell.box.h * s, 10, 8))
        this.tableIssues.add(`bar ${p.id}: a per-piece value does not fit. Widen the bar or hide .values.`);
    });
    const title = this.chainState([`${p.id}.title`], true, t);
    show(v.bracket, o * title.o);
    v.bracket.setAttribute("d", `M${k(b.x, top + 0.22)}V${map([0, top + 0.6])[1]}H${map([b.x + b.w, 0])[0]}V${map([0, top + 0.22])[1]}`);
    show(v.title, o * title.o); place(v.title, map([b.x + b.w / 2, top + 1.35]), "c", 0, o * title.o, title.em);
    const scaleStates = {
      top: this.chainState([`${p.id}.scale`], false, t),
      amount: this.chainState([`${p.id}.amounts`], false, t),
    };
    const levels = new Map<string, { top: number; amount: number }>();
    for (const sc of v.scales) {
      const st = scaleStates[sc.kind], axis = sc.kind === "top" ? "share" : "amount";
      const a = barAnchor(spec, `${axis}:0`), z = barAnchor(spec, `${axis}:1`);
      show(sc.line, own.o * st.o);
      sc.line.setAttribute("d", `M${k(...a)}L${k(...z)}`);
      show(sc.caption, own.o * st.o);
      place(sc.caption, map([a[0] - 0.35, a[1]]), "w", 0, own.o * st.o, st.em);
      const visible: { m: BarView["marks"][number]; x: number; y: number; el: HTMLElement; opacity: number; em: number }[] = [];
      for (const m of v.marks) {
        const end = m.id === "zero" || m.id === "end";
        const ms = this.chainState([`${p.id}.mark.${m.id}`, `${p.id}.mark.${m.id}.${sc.kind}`], end, t);
        const opacity = own.o * st.o * ms.o, el = sc.kind === "top" ? m.top : m.amount;
        const tick = sc.kind === "top" ? m.topTick : m.amountTick;
        const pos = barAnchor(spec, `${axis}:${m.value}`), [x, y] = map(pos);
        const level = levels.get(m.id) ?? { top: 0, amount: 0 }; level[sc.kind] = opacity; levels.set(m.id, level);
        show(el, opacity); show(tick, opacity);
        tick.setAttribute("d", `M${x} ${y - 8}V${y + 8}`); tick.style.stroke = end ? INK.muted! : ink;
        el.style.color = end ? INK.ink! : ink;
        if (opacity >= 0.002) visible.push({ m, x, y, el, opacity, em: Math.max(st.em, ms.em) });
      }
      const xs = spreadBarLabels(visible.map(x => ({ x: x.x, w: x.el.offsetWidth * 1.08 })), map([b.x, 0])[0] - 32, map([b.x + b.w, 0])[0] + 48, 22);
      if (!xs) this.tableIssues.add(`bar ${p.id}: ${sc.kind} labels cannot fit. Show fewer marks together or widen the bar.`);
      visible.forEach((label, i) => {
        const x = xs?.[i] ?? label.x, dir = sc.kind === "top" ? -1 : 1;
        place(label.el, [x, label.y + dir * 56], "c", 0, label.opacity, label.em);
      });
      // One leader path per mark, rebuilt for both scales on every seek.
      for (const m of v.marks) {
        if (sc.kind === "top") { m.leaders.setAttribute("d", ""); show(m.leaders, own.o); }
        const idx = visible.findIndex(x => x.m === m);
        if (idx < 0) continue;
        const l = visible[idx]!, x = xs?.[idx] ?? l.x, dir = sc.kind === "top" ? -1 : 1;
        if (Math.abs(x - l.x) > 3) m.leaders.setAttribute("d", (m.leaders.getAttribute("d") ?? "") + `M${l.x} ${l.y + dir * 12}L${x} ${l.y + dir * 32}`);
      }
    }
    for (const m of v.marks) {
      const lv = levels.get(m.id)!;
      show(m.guide, m.id === "zero" || m.id === "end" ? 0 : Math.min(lv.top, lv.amount) * 0.6);
      m.guide.setAttribute("d", `M${k(...barAnchor(spec, `share:${m.value}`))}L${k(...barAnchor(spec, `amount:${m.value}`))}`);
    }
  }
  /**
   * A table at time t. Each cell follows fades on itself, its row, its column
   * and the table, then dims if a "given" restricts the table to another row or
   * column (the header row stays legible as context). The grid shows as soon as
   * any cell does.
   */
  drawTable(v: TableView, g: SVGElement, t: number, map: (p: P) => P, s: number) {
    const { p } = v;
    const spec = this.tableSpec(p, t), givens = this.givens.get(p.id) ?? [], start = !!p.start;
    const own = this.chainState([p.id], start, t);
    let frameO = own.o;
    for (const { r, c, bg, el } of v.cells) {
      const st = this.chainState([p.id, `${p.id}.row.${r}`, `${p.id}.col.${c}`, `${p.id}.cell.${r}.${c}`], start, t);
      frameO = Math.max(frameO, st.o);
      const level = (target: string) => (inRegion(target, r, c) ? 1 : (r === 0 && target.startsWith("row.")) || (c === 0 && target.startsWith("col.")) ? CONTEXT : DIM);
      const o = st.o * restriction(givens, t, level, ease);
      const box = tableCell(spec, r, c);
      if (o < 0.002) { el.style.display = "none"; bg.style.display = "none"; continue; }
      el.style.display = ""; bg.style.display = "";
      bg.setAttribute("d", this.rectPath(box, map, s));
      const head = r === 0 || c === 0;
      const tint = head ? "var(--color-figure-head-tint, color-mix(in srgb, var(--color-muted-text) 9%, transparent))" : "transparent";
      bg.style.fill = st.em > 0 ? `color-mix(in srgb, var(--color-figure-gold-fill) ${Math.round(st.em * 100)}%, ${tint})` : tint;
      bg.style.opacity = String(o);
      if (o > 0.5) fitCellLabel(el, box.w * s, box.h * s, 12, 8);
      place(el, map([box.x + box.w / 2, box.y + box.h / 2]), "c", 0, o, st.em);
      if (o > 0.5 && !fits(el.offsetWidth, el.offsetHeight, box.w * s, box.h * s, 12, 8))
        this.tableIssues.add(`table ${p.id}: "${(el.textContent ?? "").trim()}" does not fit cell (${r}, ${c}): ${Math.round(el.offsetWidth)} by ${Math.round(el.offsetHeight)} px in a cell ${Math.round(box.w * s)} by ${Math.round(box.h * s)} px. Widen the cell or shorten the text.`);
    }
    g.style.display = frameO < 0.002 ? "none" : "";
    if (frameO < 0.002) return;
    const whole = tableBox(spec), [cw, ch] = spec.cell, lw = spec.labelW ?? cw;
    const k = (x: number, y: number) => { const q = map([x, y]); return `${q[0].toFixed(2)} ${q[1].toFixed(2)}`; };
    const top = whole.y + whole.h, bottom = whole.y, left = whole.x, right = whole.x + whole.w;
    let d = `M${k(left, top)}L${k(right, top)}L${k(right, bottom)}L${k(left, bottom)}Z`;
    for (let r = 1; r <= p.rows.length; r++) d += `M${k(left, top - r * ch)}L${k(right, top - r * ch)}`;
    for (let c = 0; c < p.head.length; c++) { const x = left + lw + c * cw; d += `M${k(x, top)}L${k(x, bottom)}`; }
    v.grid.setAttribute("d", d);
    v.grid.style.opacity = String(frameO);
    let rules = "";
    if (p.totals) {
      rules += `M${k(left, top - p.rows.length * ch)}L${k(right, top - p.rows.length * ch)}`;
      const x = left + lw + (p.head.length - 1) * cw;
      rules += `M${k(x, top)}L${k(x, bottom)}`;
    }
    v.rules.setAttribute("d", rules);
    v.rules.style.opacity = String(frameO);
    for (const [target, band] of v.bands) {
      const bo = bandOpacity(givens, t, target, ease) * frameO;
      band.style.display = bo < 0.002 ? "none" : "";
      if (bo < 0.002) continue;
      band.setAttribute("d", this.rectPath(tableRegion(spec, target), map, s, 10));
      band.style.opacity = String(bo);
    }
  }
  /**
   * A mosaic at time t. A slab (its base and name) follows fades on itself and
   * the mosaic; its colored part also needs `m.parts` or `m.part.i` (or the part
   * starting shown), so a lesson can draw the groups first and color them after.
   * A "given" dims every other slab.
   */
  drawMosaic(v: MosaicView, g: SVGElement, t: number, map: (p: P) => P, s: number) {
    const { p } = v;
    const spec = this.mosaicSpec(p, t), givens = this.givens.get(p.id) ?? [], start = !!p.start;
    let any = 0;
    const fill = FILL[p.fill ?? "accent-fill"]!, rest = FILL[p.rest ?? "paper"]!, ink = INK[p.ink ?? "ink"]!;
    v.slabs.forEach((sl, idx) => {
      const i = idx + 1;
      const sb = this.chainState([p.id, `${p.id}.slab.${i}`], start, t);
      const pt = this.chainState([`${p.id}.parts`, `${p.id}.part.${i}`], start, t);
      const dim = restriction(givens, t, (target) => (target === `slab.${i}` ? 1 : DIM), ease);
      const baseO = sb.o * dim, partO = Math.min(sb.o, pt.o) * dim;
      any = Math.max(any, baseO);
      const box = slabBox(spec, i), pb = partBox(spec, i), rb = restBox(spec, i);
      const set = (el: SVGElement, o: number) => { el.style.display = o < 0.002 ? "none" : ""; el.style.opacity = String(o); };
      set(sl.base, baseO);
      sl.base.setAttribute("d", this.rectPath(box, map, s));
      sl.base.style.fill = rest;
      sl.base.style.stroke = ink;
      set(sl.part, partO);
      sl.part.setAttribute("d", this.rectPath(pb, map, s));
      sl.part.style.fill = pt.em > 0 ? `color-mix(in srgb, ${fill} ${Math.round((1 - pt.em * 0.6) * 100)}%, var(--color-figure-gold-fill))` : fill;
      sl.part.style.stroke = ink;
      // the colored edge: the line a learner reads
      const a = p.slice === "rows" ? map([pb.x + pb.w, pb.y]) : map([pb.x, pb.y + pb.h]);
      const b = p.slice === "rows" ? map([pb.x + pb.w, pb.y + pb.h]) : map([pb.x + pb.w, pb.y + pb.h]);
      set(sl.edge, partO * (spec.groups[idx]!.k > 0 ? 1 : 0));
      sl.edge.setAttribute("d", `M${a[0].toFixed(2)} ${a[1].toFixed(2)}L${b[0].toFixed(2)} ${b[1].toFixed(2)}`);
      sl.edge.style.stroke = emphInk(INK[p.fill === "warm-fill" ? "warm" : p.fill === "gold-fill" ? "gold" : p.fill === "blue-fill" ? "blue" : p.fill === "violet-fill" ? "violet" : "accent"]!, pt.em);
      sl.edge.style.strokeWidth = "5";
      const ringO = bandOpacity(givens, t, `slab.${i}`, ease) * sb.o;
      set(sl.ring, Math.max(ringO, sb.em * baseO));
      sl.ring.setAttribute("d", this.rectPath(box, map, s));
      if (sl.name) {
        const nm = this.chainState([p.id, `${p.id}.slab.${i}`, `${p.id}.name.${i}`], start, t);
        const o = nm.o * dim;
        sl.name.style.display = o < 0.002 ? "none" : "";
        if (p.slice === "rows") place(sl.name, map([box.x, box.y + box.h / 2]), "w", 0.6, o, Math.max(nm.em, sb.em));
        else place(sl.name, map([box.x + box.w / 2, box.y + box.h]), "n", 0.6, o, Math.max(nm.em, sb.em));
      }
      const room = (bx: Box, el: HTMLElement) => bx.w * s > el.offsetWidth + 14 && bx.h * s > el.offsetHeight + 4;
      if (sl.kEl) {
        const o = partO * (spec.groups[idx]!.k > 0 && room(pb, sl.kEl) ? 1 : 0);
        sl.kEl.style.display = o < 0.002 ? "none" : "";
        place(sl.kEl, map([pb.x + pb.w / 2, pb.y + pb.h / 2]), "c", 0, o, pt.em);
      }
      if (sl.restEl) {
        const o = baseO * (spec.groups[idx]!.k < spec.groups[idx]!.n && room(rb, sl.restEl) ? 1 : 0);
        sl.restEl.style.display = o < 0.002 ? "none" : "";
        place(sl.restEl, map([rb.x + rb.w / 2, rb.y + rb.h / 2]), "c", 0, o, 0);
      }
    });
    const gd = p.guide ? this.chainState([p.id, `${p.id}.guide`], start, t) : { o: 0, em: 0 };
    v.guide.style.display = gd.o < 0.002 ? "none" : "";
    if (gd.o >= 0.002) {
      const [a, b] = guideLine(spec).map((q) => map(q));
      v.guide.setAttribute("d", `M${a![0].toFixed(2)} ${a![1].toFixed(2)}L${b![0].toFixed(2)} ${b![1].toFixed(2)}`);
      v.guide.style.opacity = String(gd.o);
      v.guide.style.strokeWidth = "5";
      v.guide.style.stroke = emphInk("var(--color-figure-warm)", gd.em);
      any = Math.max(any, gd.o);
    }
    g.style.display = any < 0.002 ? "none" : "";
    if (any < 0.002) for (const el of [...v.slabs.flatMap((sl) => [sl.name, sl.kEl, sl.restEl])]) if (el) el.style.display = "none";
  }
  /**
   * A place-value chart at time t. Pieces sit where the model puts them (a trade
   * in progress is a lerp between two layouts); their visibility follows fades
   * on the piece, its pile, its row or the chart, and a piece cut from another
   * is as visible as its parent was. Names and the point are the chart's frame.
   */
  drawBlocks(v: BlocksView, t: number, map: (p: P) => P, s: number, chartO: number) {
    const { model: m, p } = v;
    const shown = p.rows[0]!.shown ?? [];
    const startOf = (id: string) => !!p.start || shown.includes(m.placeOf(id));
    // pushed in on one piece, the chart's frame waits for the first pull-back
    const ff = this.frameFrom.get(p.id);
    const frameO = chartO * (!p.focus ? 1 : ff ? ease((t - ff.t0) / ff.dur) : 0);
    const lines = m.linesAt(t);
    const pieceO = new Map<string, number>();
    const lineW = Math.max(1.2, 0.055 * s), bodyW = Math.max(1.2, 0.05 * s);
    for (const piece of m.pieces()) {
      const el = v.pieces.get(piece.id)!;
      const box = m.positionAt(piece.id, t);
      const hideAll = () => { el.body.style.display = "none"; el.lines.style.display = "none"; for (const ov of el.overlays.values()) ov.style.display = "none"; };
      if (!box) { hideAll(); continue; }
      const own = this.chainState(prefixes(piece.id), startOf(piece.id), t);
      let o = own.o;
      if (piece.from) o = Math.max(o, this.chainState(prefixes(piece.from), startOf(piece.from), t).o);
      o *= chartO;
      pieceO.set(piece.id, o);
      if (o < 0.002) { hideAll(); continue; }
      el.body.style.display = ""; el.lines.style.display = "";
      const tl = map([box.x, box.y + box.h]);
      const w = box.w * s, h = box.h * s;
      el.body.setAttribute("d", roundRect(tl[0], tl[1], w, h, 0.07 * s));
      const base = INK[piece.ink] ?? INK.accent!;
      // looked at: the block glows light gold, with a gold edge
      el.body.style.fill = own.em > 0 ? `color-mix(in srgb, ${base} ${Math.round((1 - own.em) * 100)}%, var(--color-figure-gold-fill))` : base;
      el.body.style.stroke = own.em > 0 ? `color-mix(in srgb, var(--color-figure-ink) ${Math.round((1 - own.em) * 100)}%, var(--color-figure-gold))` : "";
      el.body.style.strokeWidth = String(bodyW);
      el.body.style.opacity = String(o);
      // unit lines: the cuts that make a flat ten rods and a rod ten squares
      let d = "";
      const cell = s * (box.h / (piece.kind === "square" ? 1 : 10));
      if (piece.kind === "flat") {
        for (let i = 1; i < 10; i++) {
          if (lines.v > 0) d += `M${(tl[0] + i * cell).toFixed(2)} ${tl[1].toFixed(2)}v${(h * lines.v).toFixed(2)}`;
          if (lines.h > 0) d += `M${tl[0].toFixed(2)} ${(tl[1] + i * cell).toFixed(2)}h${(w * lines.h).toFixed(2)}`;
        }
      } else if (piece.kind === "rod" && lines.h > 0) {
        for (let i = 1; i < 10; i++) d += `M${tl[0].toFixed(2)} ${(tl[1] + i * cell).toFixed(2)}h${(w * lines.h).toFixed(2)}`;
      }
      el.lines.setAttribute("d", d);
      el.lines.style.strokeWidth = String(lineW);
      el.lines.style.opacity = String(o);
      for (const [sub, ov] of el.overlays) {
        const st = this.chainState([`${piece.id}.${sub}`], false, t);
        if (st.em < 0.002) { ov.style.display = "none"; continue; }
        const sb = subBox(piece.kind, box, sub);
        const q = map([sb.x, sb.y + sb.h]);
        ov.style.display = "";
        ov.setAttribute("d", roundRect(q[0], q[1], sb.w * s, sb.h * s, 0.08 * s));
        ov.style.opacity = String(o * st.em);
      }
    }
    // the frame: place names, the digit row, the point
    const li = m.stateIndexAt(t);
    const layout = m.layouts[li]!;
    const pileO = (place: Place) => {
      let o = 0;
      for (const pc of m.states[li]![place] ?? []) o = Math.max(o, pieceO.get(pc.id) ?? 0);
      return o;
    };
    let rowO = 0;
    for (const place of m.places) rowO = Math.max(rowO, this.chainState(prefixes(`${p.id}.${m.rowId}.${place}`), startOf(`${p.id}.${m.rowId}.${place}.0`), t).o, pileO(place));
    rowO *= frameO;
    for (const c of layout.columns) {
      const head = v.heads.get(c.place)!;
      const em = this.chainState([`${p.id}.place.${c.place}`], false, t).em;
      head.style.color = em > 0 ? `color-mix(in srgb, var(--color-muted-text) ${Math.round((1 - em) * 100)}%, var(--color-figure-gold))` : "";
      head.style.display = frameO < 0.002 ? "none" : "";
      place(head, map([c.cx, m.headY]), "c", 0, frameO, em);
      const dcell = v.digits.get(c.place);
      if (dcell) {
        const ph = m.digits.placeholder[c.place];
        const own = this.chainState([`${p.id}.digit.${c.place}`], false, t);
        const o = ph ? own.o * frameO : rowO;
        const em = Math.max(own.em, this.chainState([`${p.id}.digits`], false, t).em);
        dcell.style.display = o < 0.002 ? "none" : "";
        place(dcell, map([c.cx, m.digitY]), "c", 0, o, em);
      }
      const count = v.counts.get(c.place);
      if (count) {
        const n = m.countAt(c.place, t), pile = m.pileAt(c.place, t), o = pileO(c.place);
        if (!n || !pile || o < 0.002) count.style.display = "none";
        else {
          count.style.display = "";
          if (count.dataset.v !== String(n)) { count.dataset.v = String(n); count.innerHTML = tex(String(n)); }
          // the count wears the pile's color when the pile is one color
          const inks = new Set((m.states[li]![c.place] ?? []).map((pc) => pc.ink));
          count.style.color = inks.size === 1 ? INK[[...inks][0]!]! : "";
          const em = this.chainState([`${p.id}.count.${c.place}`], false, t).em;
          place(count, map([pile.x + pile.w / 2, pile.y + pile.h]), "n", 0.8, o, em);
        }
      }
    }
    if (layout.pointX !== undefined && p.point !== false) {
      const em = this.chainState([`${p.id}.point`], false, t).em;
      const q = map([layout.pointX, m.digitY]);
      v.point.style.display = "";
      v.point.setAttribute("cx", String(q[0])); v.point.setAttribute("cy", String(q[1] + 24));
      v.point.setAttribute("r", "9");
      v.point.style.fill = em > 0 ? "var(--color-figure-gold)" : "var(--color-figure-ink)";
      v.point.style.opacity = String(frameO);
      const a = map([layout.pointX, layout.top + 0.6]), b = map([layout.pointX, m.digitY + (m.headY - m.digitY) * 0.45]);
      v.pointLine.style.display = "";
      v.pointLine.setAttribute("d", `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`);
      v.pointLine.style.opacity = String(frameO * (0.35 + em * 0.5));
    } else { v.point.style.display = "none"; v.pointLine.style.display = "none"; }
    for (const { spec, el } of v.labels) {
      const st = this.chainState([spec.id], !!spec.start, t);
      if (st.o < 0.002) { el.style.display = "none"; continue; }
      el.style.display = "";
      const b = m.boxOf(`${p.id}.${spec.on}`, t);
      const dir: Dir = spec.dir ?? "n";
      const ax = dir.includes("e") ? b.x + b.w : dir.includes("w") ? b.x : b.x + b.w / 2;
      const ay = dir.includes("n") ? b.y + b.h : dir.includes("s") ? b.y : b.y + b.h / 2;
      place(el, map([ax, ay]), dir, spec.far ?? 1, st.o * chartO, st.em);
    }
  }
}
const DIRS: Record<string, P> = {
  n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0], ne: [0.71, -0.71], nw: [-0.71, -0.71], se: [0.71, 0.71], sw: [-0.71, 0.71], c: [0, 0],
};
/** How far a label sits from the thing it names, before `far` scales it. */
const LABEL_GAP = 58;
/** A highlight mixes paint toward gold. It never changes a length. */
function emphInk(ink: string, em: number): string {
  if (em <= 0.001 || ink === "none") return ink;
  const keep = Math.round((1 - Math.min(1, em)) * 100);
  return `color-mix(in srgb, ${ink} ${keep}%, var(--color-figure-gold))`;
}
function place(el: HTMLElement, at: P, dir: string, far: number, o: number, em: number) {
  const d = DIRS[dir]!; const gap = LABEL_GAP * far;
  const w = el.offsetWidth, h = el.offsetHeight;
  const hw = (w / 2) * (d[0] === 0 ? 0 : Math.sign(d[0])), hh = (h / 2) * (d[1] === 0 ? 0 : Math.sign(d[1]));
  const k = Math.abs(d[0]) > 0 && Math.abs(d[1]) > 0 ? 0.6 : 1;
  // emphasis is a glow, not a scale: scaling would change the ink box and re-centre the figure
  el.style.transform = `translate(${at[0] + d[0] * gap + hw * k - w / 2}px, ${at[1] + d[1] * gap + hh * k - h / 2}px)`;
  el.style.opacity = String(o);
  if (em > 0.02) el.style.textShadow = `0 0 ${Math.round(8 + em * 14)}px var(--color-figure-gold)`;
  else el.style.removeProperty("text-shadow");
}
/** Shrink a label until it clears its cell. Extra leading must not spill into the rules. */
function fitCellLabel(el: HTMLElement, cellW: number, cellH: number, padX = 12, padY = 8) {
  el.style.fontSize = "";
  let size = parseFloat(getComputedStyle(el).fontSize) || 44;
  for (let i = 0; i < 8 && !fits(el.offsetWidth, el.offsetHeight, cellW, cellH, padX, padY); i++) {
    size *= 0.9;
    if (size < 24) break;
    el.style.fontSize = `${size.toFixed(1)}px`;
  }
}

// ------------------------------------------------------------------ work column
type WorkItem = {
  kind: string; el: HTMLElement; t0: number; dur: number; page: number;
  fly?: { el: HTMLElement; dx: number; dy: number }[]; fresh?: HTMLElement[]; note?: HTMLElement; standalone?: boolean;
};
const leaves = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>(".katex-html *")].filter(
    (e) => e.children.length === 0 && (e.textContent ?? "").trim() !== "" && !e.closest(".vlist-s"),
  );
const bars = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(".frac-line, .overline-line, .sqrt-line, .hide-tail")];
/** Longest common subsequence of the two lines' symbols: what travels. */
function pairs(a: string[], b: string[]) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--)
    dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: [number, number][] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push([i, j]); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  return out;
}
// ------------------------------------------------------------------ the whiteboard
/**
 * One board for the whole lesson. Work is written down a column, the camera
 * follows the newest line, and earlier lines scroll up rather than vanish.
 * `clear` starts a new column to the right; `overview` pulls back to show every
 * column at once; `recap` adds numbered steps in a card beside that overview.
 * Everything is laid out once, at load; only the camera and opacities move.
 */
type Rect = { x: number; y: number; w: number; h: number };
/**
 * Where things go on the frame. `fig` holds the figure, `panel` the board beside
 * (or below) it, `full` the board alone, `side` the board during the recap and
 * `recap` the recap card. Wide is the 16:9 film; tall is a phone held upright.
 */
export type Layout = { name: "wide" | "tall"; w: number; h: number; fig: Rect; panel: Rect; full: Rect; side: Rect; recap: Rect; card: { fig: number; full: number }; tight: { panel: number; full: number }; minType: number };
export const WIDE: Layout = {
  name: "wide", w: 1920, h: 1080,
  fig: { x: 44, y: 44, w: 968, h: 992 },
  panel: { x: 1052, y: 44, w: 824, h: 992 },
  full: { x: 150, y: 56, w: 1620, h: 968 },
  side: { x: 56, y: 56, w: 1120, h: 968 },
  recap: { x: 1216, y: 56, w: 648, h: 968 },
  card: { fig: 780, full: 1400 },
  tight: { panel: 0.7, full: 0.8 },
  minType: 60,
};
export const TALL: Layout = {
  name: "tall", w: 1080, h: 1920,
  fig: { x: 40, y: 40, w: 1000, h: 880 },
  panel: { x: 40, y: 944, w: 1000, h: 936 },
  full: { x: 40, y: 56, w: 1000, h: 1808 },
  side: { x: 40, y: 40, w: 1000, h: 1120 },
  recap: { x: 40, y: 1184, w: 1000, h: 696 },
  card: { fig: 960, full: 960 },
  tight: { panel: 0.62, full: 0.62 },
  // an upright phone scales the frame less, so slightly smaller type still reads at about 19 px
  minType: 52,
};
const COL_W = 1640, COL_GAP = 200, EDGE_PAD = 64, CAM_DUR = 0.95;

type StackView = {
  plan: StackPlan;
  /** Per step: the answer digit, the marks written with it, and the column's highlight band. */
  stepEls: { digit: HTMLElement | null; marks: HTMLElement[]; strikes: HTMLElement[]; band: HTMLElement }[];
  pads: HTMLElement[]; point: HTMLElement | null;
  /** The place names over the columns (they come in at `placesT`, or with the stack), and when each column is lit. */
  heads: { name: string; el: HTMLElement; band: HTMLElement; lit: [number, number][] }[];
  /** Per column beat: when it starts, and when its trade and its digit are written. */
  times: { t0: number; dur: number; trade: number; write: number }[]; zerosT?: number; placesT?: number;
};
/**
 * A stack drawn as a grid: a row for carries and borrows, the numbers, a rule,
 * and the answer row. With `headers`, a row of place names on top, columns of
 * one width, and the point line through every row: the place-value chart.
 */
function renderStack(plan: StackPlan, host: HTMLElement, headers = false): { el: HTMLElement; view: StackView } {
  const el = div("film-line stack", host);
  const g = div(`film-stack${headers ? " headers" : ""}`, el);
  const width = plan.int + plan.frac;
  const gcol = (c: number) => 2 + c + (plan.frac && c >= plan.int ? 1 : 0);
  const h = headers ? 1 : 0;
  const n = plan.rows.length, ansRow = n + 2 + h;
  const pointCol = 2 + plan.int;
  // under headers every place gets the same width, so the digits sit evenly, as in the chart
  const place = headers ? "minmax(min-content, 1fr)" : "auto";
  g.style.gridTemplateColumns = `auto repeat(${plan.int}, ${place})${plan.frac ? ` auto repeat(${plan.frac}, ${place})` : ""}`;
  const cell = (cls: string, row: number, col: number, html: string) => {
    const c = div(`film-stack-cell ${cls}`, g);
    c.style.gridRow = String(row); c.style.gridColumn = String(col);
    c.innerHTML = html;
    return c;
  };
  const heads: StackView["heads"] = [];
  if (headers) {
    placeNames(plan).forEach((name, c) => {
      const band = div("film-stack-band", g);
      band.style.gridRow = `1 / ${ansRow + 1}`; band.style.gridColumn = String(gcol(c));
      heads.push({ name, el: cell("head", 1, gcol(c), name), band, lit: [] });
    });
    if (plan.frac) {
      const line = div("film-stack-pointline", g);
      line.style.gridRow = `${1 + h} / ${ansRow + 1}`; line.style.gridColumn = String(pointCol);
    }
  }
  const digitEls: HTMLElement[][] = plan.rows.map(() => []);
  const pads: HTMLElement[] = [];
  plan.rows.forEach((r, ri) => {
    r.forEach((d, c) => {
      if (!d.digit) return;
      const e = cell(d.pad ? "pad" : "", ri + 2 + h, gcol(c), tex(d.digit));
      digitEls[ri]![c] = e;
      if (d.pad) pads.push(e);
    });
    if (plan.frac) cell("point", ri + 2 + h, pointCol, tex("."));
  });
  cell("op", n + 1 + h, 1, tex(plan.op === "+" ? "+" : "-"));
  const rule = div("film-stack-rule", g);
  rule.style.gridRow = String(ansRow); rule.style.gridColumn = `1 / ${2 + width + (plan.frac ? 1 : 0)}`;
  const point = plan.frac ? cell("point answer", ansRow, pointCol, tex(".")) : null;
  const stepEls = plan.steps.map((s) => {
    const band = div("film-stack-band", g);
    band.style.gridRow = `1 / ${ansRow + 1}`; band.style.gridColumn = String(gcol(s.col));
    const digit = plan.answer[s.col] ? cell("answer", ansRow, gcol(s.col), tex(plan.answer[s.col]!)) : null;
    const marks: HTMLElement[] = [], strikes: HTMLElement[] = [];
    if (s.carry) marks.push(cell("mark carry", 1 + h, gcol(s.carry.col), tex(s.carry.value)));
    if (s.lead) marks.push(cell("answer", ansRow, gcol(s.lead.col), tex(s.lead.digit)));
    for (const b of s.borrows) {
      marks.push(cell("mark borrow", 1 + h, gcol(b.col), tex(b.value)));
      const top = digitEls[0]![b.col];
      if (top) strikes.push(div("film-strike", top));
    }
    return { digit, marks, strikes, band };
  });
  return { el, view: { plan, stepEls, pads, point, heads, times: [] } };
}
/** When a column's band lights, its trade is written, and its digit is written: `write` defaults to just after the band. */
const stackTimes = (e: Entry) => ({ t0: e.t0, dur: e.dur, trade: e.words?.trade ?? e.t0, write: e.words?.write ?? e.t0 + Math.min(0.9, e.dur * 0.45) });
/** A stack at time t: placeholder zeros, then each column's borrow, digit and carry as its beat is spoken. */
function drawStack(v: StackView, t0: number, t: number) {
  const z = v.zerosT ?? t0;
  for (const p of v.pads) p.style.opacity = String(ease((t - z) / 0.5));
  for (const h of v.heads) {
    h.el.style.opacity = String(ease((t - (v.placesT ?? t0)) / 0.5));
    h.band.style.opacity = String(Math.max(0, ...h.lit.map(([a, b]) => Math.min(ease((t - a) / 0.3), 1 - ease((t - b) / 0.4)))));
  }
  if (v.point) v.point.style.opacity = String(v.times[0] ? ease((t - v.times[0].write) / 0.4) : 0);
  // a borrow rewrites a digit that an earlier borrow already rewrote: only the newest mark shows
  const latest = new Map<string, number>();
  v.stepEls.forEach((s, k) => {
    const tm = v.times[k];
    const on = tm ? t >= tm.trade : false;
    s.marks.forEach((m) => { if (on && m.classList.contains("borrow")) latest.set(m.style.gridColumn, k); });
  });
  v.stepEls.forEach((s, k) => {
    const tm = v.times[k];
    if (!tm) { s.band.style.opacity = "0"; if (s.digit) s.digit.style.opacity = "0"; for (const m of [...s.marks, ...s.strikes]) m.style.opacity = "0"; return; }
    const next = v.times[k + 1]?.t0 ?? Math.max(tm.t0 + tm.dur, tm.write + 0.45) + 0.6;
    s.band.style.opacity = String(Math.min(ease((t - tm.t0) / 0.3), 1 - ease((t - next) / 0.4)));
    const borrowU = ease((t - tm.trade) / 0.45), digitU = ease((t - tm.write) / 0.45);
    for (const st of s.strikes) st.style.opacity = String(borrowU);
    for (const m of s.marks) {
      if (m.classList.contains("borrow")) m.style.opacity = latest.get(m.style.gridColumn) === k ? String(borrowU) : "0";
      else m.style.opacity = String(digitU);
    }
    if (s.digit) s.digit.style.opacity = String(digitU);
  });
}
/** The moments a stack moves, so a render draws every frame of them. */
function stackMoves(v: StackView, t0: number): [number, number][] {
  const out: [number, number][] = [(v.zerosT ?? t0), (v.placesT ?? t0), ...v.heads.flatMap((h) => h.lit.flat())].map((a) => [a - 0.02, a + 0.52]);
  v.times.forEach((tm, k) => {
    const next = v.times[k + 1]?.t0 ?? Math.max(tm.t0 + tm.dur, tm.write + 0.45) + 0.6;
    for (const [a, d] of [[tm.t0, 0.3], [tm.trade, 0.45], [tm.write, 0.45], [next, 0.4]] as const) out.push([a - 0.02, a + d + 0.02]);
  });
  return out;
}

type BoardItem = {
  kind: string; el: HTMLElement; t0: number; dur: number; col: number; shot: number; id?: string;
  top: number; bottom: number; stack?: StackView;
  fly?: { el: HTMLElement; dx: number; dy: number }[]; fresh?: HTMLElement[]; note?: HTMLElement; standalone?: boolean;
};
/** `tall`: the zoom came from a line taller than the window (a long problem card) shown whole, not from a wide line. */
type Cam = { cx: number; cy: number; s: number; win: Rect; tall?: boolean };
/** `cut`: a jump of more than one column dissolves in place instead of whipping across the board. */
type CamKey = { t0: number; dur: number; to: Cam; cols: Set<number>; cut?: boolean };
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpRect = (a: Rect, b: Rect, u: number): Rect => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), w: lerp(a.w, b.w, u), h: lerp(a.h, b.h, u) });

/** Problem text: words wrap; an equation gets its own centered display line, with its punctuation. */
function problemHtml(text: string) {
  const parts = text.split(/(\$[^$]+\$[?.!,:;]?)/).filter((x) => x !== "");
  return parts
    .map((p) => {
      const m = p.match(/^\$([^$]+)\$([?.!,:;]?)$/);
      if (!m) return `<span class="film-prose">${prose(p.trim())}</span>`;
      const big = /=|\\d?frac|\\sqrt|\\sum|\\int|<|>|\\le|\\ge/.test(m[1]!) || m[1]!.length > 18;
      if (!big) return `<span class="film-prose film-nowrap">${tex(m[1]!)}${m[2] ?? ""}</span>`;
      return `<div class="film-display">${tex(m[1]! + (m[2] ? `\\;\\text{${m[2]}}` : ""), true)}</div>`;
    })
    .join(" ");
}

class Board {
  win: HTMLElement;
  surface: HTMLElement;
  cols: HTMLElement[] = [];
  colX: number[] = [];
  colExt: { l: number; r: number }[] = [];
  items: BoardItem[] = [];
  recapItems: { el: HTMLElement; t0: number; dur: number; marks?: Set<string> }[] = [];
  home: Rect[] = [];
  recapCard: HTMLElement;
  keys: CamKey[] = [];
  starts: Cam[] = [];
  colFades: { t0: number; dur: number; from: number[]; to: number[] }[] = [];
  issues: string[] = [];
  /** When the last word is said: the camera pulls back to the whole example and every line lights up, held to the end. */
  finale = Infinity;
  constructor(root: HTMLElement, shots: { list: Entry[]; t0: number; hasFig: boolean }[], public duration: number, lastWord = Infinity, public L: Layout = WIDE) {
    this.win = div("film-board", root);
    this.surface = div("film-surface", this.win);
    this.recapCard = div("film-recap", root);
    this.recapCard.style.cssText = `left:${L.recap.x}px;top:${L.recap.y}px;width:${L.recap.w}px;height:${L.recap.h}px`;
    this.recapCard.classList.add(`film-recap-${L.name}`);
    const recapList = div("film-recap-list", this.recapCard);
    let col = this.newCol();
    const events: { t: number; kind: string; item?: BoardItem; shot?: number; col?: number; idx?: number }[] = [];
    shots.forEach((sh, si) => {
      events.push({ t: sh.t0, kind: "shot", shot: si });
      for (const e of sh.list) {
        const a = e.a as any;
        if (a.do === "clear") {
          if (this.items.some((i) => i.col === col)) col = this.newCol();
          events.push({ t: e.t0, kind: "clear", shot: si, col });
          continue;
        }
        if (a.do === "overview") {
          const held = a.of ? this.items.find((i) => i.id === a.of) : undefined;
          if (a.of && !held) this.issues.push(`overview of "${a.of}", but no earlier board line has that id.`);
          events.push({ t: e.t0, kind: a.columns === "all" ? "overview-all" : "overview", shot: si, col: held?.col });
          continue;
        }
        if (a.do === "recap") {
          const li = div("film-recap-item", recapList);
          li.innerHTML = `<b>${this.recapItems.length + 1}</b><span>${prose(a.text)}</span>`;
          for (const m of a.marks ?? []) if (!this.items.some((i) => i.id === m)) this.issues.push(`recap marks "${m}", but no board line has that id.`);
          this.recapItems.push({ el: li, t0: e.t0, dur: e.dur, marks: a.marks ? new Set(a.marks) : undefined });
          events.push({ t: e.t0, kind: "recap", shot: si, idx: this.recapItems.length - 1 });
          continue;
        }
        if (a.do === "column" || a.do === "zeros" || a.do === "places") {
          const st = this.items.find((i) => i.stack && i.id === a.of);
          if (!st?.stack) { this.issues.push(`Shot ${si + 1}: "${a.do}" of "${a.of}", but no stack has that id.`); continue; }
          if (a.do === "zeros") st.stack.zerosT = e.t0;
          else if (a.do === "places") {
            const v = st.stack;
            if (!v.heads.length) this.issues.push(`Shot ${si + 1}: "places" of "${a.of}", but that stack has no headers ("headers": true).`);
            // the names come in with the first "places"; a named place also lights its column until the next "places" or the end of the beat
            if (v.placesT === undefined) v.placesT = e.t0;
            for (const h of v.heads) { const last = h.lit[h.lit.length - 1]; if (last && last[1] > e.t0) last[1] = e.t0; }
            for (const nm of a.place === undefined ? [] : [a.place].flat() as string[]) {
              const h = v.heads.find((x) => x.name === nm);
              if (!h) { this.issues.push(`Shot ${si + 1}: "places" names "${nm}", but the stack "${a.of}" has ${v.heads.map((x) => x.name).join(", ")}.`); continue; }
              h.lit.push([e.t0, e.beatEnd]);
            }
          }
          else st.stack.times.push(stackTimes(e));
          continue;
        }
        const host = this.cols[col]!;
        if (!this.items.some((i) => i.col === col)) {
          this.home[col] = sh.hasFig ? this.L.panel : this.L.full;
          host.style.setProperty("--film-card", `${sh.hasFig ? this.L.card.fig : this.L.card.full}px`);
        }
        let el: HTMLElement | null = null, note: HTMLElement | undefined;
        if (a.do === "write" || a.do === "answer") {
          el = div(`film-line ${a.do}`, host);
          el.innerHTML = `<span class="film-math">${tex(a.tex, true)}</span>`;
          if (a.note) { note = div("film-note", el); note.innerHTML = tex(a.note); el.classList.add("has-note"); }
        } else if (a.do === "text") {
          el = div(`film-line text ${a.tone ?? "ink"}`, host); el.innerHTML = prose(a.text);
        } else if (a.do === "problem") {
          // a wordy problem (sentence-long choices) is set smaller, so the whole card still fits beside a figure
          const words = a.text.length + (a.choices ?? []).reduce((n: number, c: string) => n + c.length, 0);
          const long = words > 260 || (a.choices ?? []).some((c: string) => c.length > 40);
          el = div(`film-line problem${long ? " long" : ""}`, host);
          el.innerHTML = problemHtml(a.text) + (a.choices ? `<div class="film-choices">${a.choices.map((c: string) => `<span>${prose(c)}</span>`).join("")}</div>` : "");
        } else if (a.do === "term") {
          el = div("film-line term", host); el.innerHTML = `<b>${prose(a.word)}</b><span>${prose(a.meaning)}</span>`;
        } else if (a.do === "watch") {
          el = div("film-line watch", host); el.innerHTML = prose(a.text);
        }
        let stack: StackView | undefined;
        if (a.do === "stack") {
          const plan = planStack(a.rows, a.op);
          if (typeof plan === "string") { this.issues.push(`Shot ${si + 1}: ${plan}`); continue; }
          if (!a.id) this.issues.push(`Shot ${si + 1}: a stack needs an "id" so its "column" beats can name it.`);
          const r = renderStack(plan, host, !!a.headers);
          el = r.el; stack = r.view;
        }
        if (!el) continue;
        const item: BoardItem = { kind: a.do, el, t0: e.t0, dur: e.dur, col, shot: si, top: 0, bottom: 0, note, standalone: !!a.fresh, id: a.id, stack };
        this.items.push(item);
        events.push({ t: e.t0, kind: "item", item, shot: si });
      }
    });
    for (const it of this.items) {
      const v = it.stack;
      if (v && v.times.length !== v.plan.steps.length)
        this.issues.push(`Shot ${it.shot + 1}: the stack "${it.id}" has ${v.plan.steps.length} columns to work but ${v.times.length} "column" beats. Give each column its own beat, right to left, and say what happens in it.`);
    }
    this.layout();
    if (this.recapItems.length && Number.isFinite(lastWord)) {
      this.finale = lastWord + 0.15;
      events.push({ t: this.finale, kind: "finale" });
    }
    this.camera(events.sort((x, y) => x.t - y.t), shots);
  }
  newCol() {
    const c = div("film-col", this.surface);
    c.style.width = `${COL_W}px`;
    this.cols.push(c);
    return this.cols.length - 1;
  }
  /** Equals signs in one column per run of lines, the math centered, margin notes in a column to its right. */
  layout() {
    this.cols.forEach((c, ci) => {
      // the largest type, up to 84 px, at which the column fits the window it is written in
      const room = (this.home[ci] ?? this.L.full).w - 24;
      let size = 84;
      c.style.setProperty("--film-math", `${size}px`);
      let ext = this.measure(ci);
      const fit = () => {
        while (ext.r - ext.l > room && size > this.L.minType) {
          size -= 4;
          c.style.setProperty("--film-math", `${size}px`);
          ext = this.measure(ci);
        }
      };
      fit();
      // still too wide: the margin notes move under their lines, and the type tries again from the top
      if (ext.r - ext.l > room && c.querySelector(".film-note")) {
        c.classList.add("notes-below");
        size = 84;
        c.style.setProperty("--film-math", `${size}px`);
        ext = this.measure(ci);
        fit();
      }
      // A card taller than the window shrinks its type. The padding stays in pixels, so the camera does not have to scale that padding down to a sliver.
      const winH = (this.home[ci] ?? this.L.full).h - 2 * EDGE_PAD;
      while (size > this.L.minType) {
        const h = Math.max(0, ...this.items.filter((i) => i.col === ci).map((i) => i.el.offsetHeight));
        if (h <= winH) break;
        size -= 4;
        c.style.setProperty("--film-math", `${size}px`);
        ext = this.measure(ci);
      }
      if (ext.r - ext.l > room) {
        const its = this.items.filter((i) => i.col === ci);
        // cards wrap to the column, so the cause is a line of math (with its note)
        const lines = its.filter((i) => i.el.querySelector(".film-math"));
        const wide = (lines.length ? lines : its).map((i) => ({ i, w: (i.el.querySelector(".film-math") ?? i.el).getBoundingClientRect().width + (i.note?.getBoundingClientRect().width ?? 0) }))
          .sort((a, b) => b.w - a.w)[0];
        const what = wide ? (wide.i.el.textContent ?? "").replace(/\s+/g, " ").slice(0, 60) : "";
        this.issues.push(`Shot ${(its[0]?.shot ?? 0) + 1}: the work is ${Math.round(ext.r - ext.l)}px wide, more than the ${room}px beside the figure, even at ${size}px type. Widest: "${what}". Shorten that line, move its note, or start the work in a shot without a figure.`);
      }
      this.colExt.push(ext);
      const its = this.items.filter((i) => i.col === ci);
      for (const it of its) { it.top = it.el.offsetTop; it.bottom = it.el.offsetTop + it.el.offsetHeight; }
      this.flights(its);
    });
    // columns side by side, packed by what they hold
    let x = 0;
    this.cols.forEach((c, ci) => {
      const e = this.colExt[ci]!;
      if (ci > 0) x += this.half(ci - 1) + COL_GAP + this.half(ci);
      void e;
      this.colX.push(x);
      c.style.left = `${x - COL_W / 2}px`;
    });
  }
  /** Place one column's lines and return how far it reaches left and right of its center. */
  measure(ci: number) {
    {
      const its = this.items.filter((i) => i.col === ci);
      const center = COL_W / 2;
      // the gap before margin notes scales with the type: 56 px at full size
      const gap = Math.round((parseFloat(this.cols[ci]!.style.getPropertyValue("--film-math")) || 84) * (2 / 3));
      let l = 0, r = 0;
      const runs: BoardItem[][] = [];
      let run: BoardItem[] = [];
      for (const it of its) {
        if (it.kind === "write") run.push(it);
        else { if (run.length) runs.push(run); run = []; }
      }
      if (run.length) runs.push(run);
      for (const rn of runs) {
        const maths = rn.map((i) => i.el.querySelector(".film-math") as HTMLElement);
        const widths = maths.map((m) => m.getBoundingClientRect().width);
        const eqs = rn.map((i, k) => {
          const rel = [...i.el.querySelectorAll<HTMLElement>(".katex-html .mrel")].find((x) => x.textContent === "=");
          return rel ? rel.getBoundingClientRect().left - maths[k]!.getBoundingClientRect().left : null;
        });
        const A = Math.max(0, ...eqs.map((e) => e ?? 0));
        const left = rn.map((_, k) => (eqs[k] === null ? A - widths[k]! / 2 : A - eqs[k]!));
        const minL = Math.min(...left);
        const lefts = left.map((x) => x - minL);
        const B = Math.max(...lefts.map((x, k) => x + widths[k]!));
        const x0 = center - B / 2;
        maths.forEach((m, k) => { m.style.transform = `translateX(${x0 + lefts[k]!}px)`; });
        const below = this.cols[ci]!.classList.contains("notes-below");
        const noteX = x0 + B + gap;
        // beside: a margin column to the right; below: under the end of its own line
        rn.forEach((i, k) => { if (i.note) i.note.style.left = `${below ? x0 + lefts[k]! + widths[k]! - i.note.getBoundingClientRect().width : noteX}px`; });
        l = Math.min(l, -B / 2);
        r = Math.max(r, B / 2 + (!below && rn.some((i) => i.note) ? gap + Math.max(...rn.map((i) => i.note?.getBoundingClientRect().width ?? 0)) : 0));
      }
      for (const it of its) {
        if (it.kind === "write") continue;
        const w = it.el.getBoundingClientRect().width;
        l = Math.min(l, -w / 2); r = Math.max(r, w / 2);
      }
      return { l, r };
    }
  }
  /** What travels from the line above. */
  flights(its: BoardItem[]) {
      let prev: BoardItem | null = null;
      for (const it of its) {
        if (it.kind !== "write" && it.kind !== "answer") continue;
        const now = leaves(it.el);
        now.forEach((e) => { e.style.display = "inline-block"; });
        if (prev && !it.standalone) {
          const was = leaves(prev.el);
          const m = pairs(was.map((e) => e.textContent ?? ""), now.map((e) => e.textContent ?? ""));
          const flown = new Set<number>();
          it.fly = m.map(([i, j]) => {
            flown.add(j);
            const r0 = was[i]!.getBoundingClientRect(), r1 = now[j]!.getBoundingClientRect();
            return { el: now[j]!, dx: r0.left - r1.left, dy: r0.top - r1.top };
          });
          it.fresh = [...now.filter((_, j) => !flown.has(j)), ...bars(it.el)];
        } else it.fresh = [...now, ...bars(it.el)];
        prev = it;
      }
  }
  /** Half the width a column needs, measured both ways from its center: the math stays centered, notes and all. */
  half(col: number) {
    const e = this.colExt[col]!;
    return Math.max(1, -e.l, e.r);
  }
  focus(col: number, bottom: number, win: Rect, newest?: BoardItem): Cam {
    // Center the math when there is room; otherwise center math and notes together.
    const e = this.colExt[col]!, room = win.w - 24, sym = 2 * this.half(col);
    const centered = sym <= room;
    let s = Math.min(1, room / (centered ? sym : e.r - e.l));
    // A card and the lines written under it are shown whole. Extra padding shrinks the column rather than sliding the card under the figure.
    let tall = false;
    let spanTop = 0;
    if (newest) {
      const card = [...this.items].reverse().find((i) => i.col === col && i.t0 <= newest.t0 + 1e-6 && (i.kind === "problem" || i.kind === "term" || i.kind === "watch"));
      // Pull the card into frame only while the work under it is still short. A long column keeps scrolling.
      const room = (win.h - 2 * EDGE_PAD) * 1.8;
      spanTop = card && newest.bottom - card.top <= room ? card.top : newest.top;
      const span = Math.max(newest.bottom - spanTop, 1);
      if (span > (win.h - 2 * EDGE_PAD) / s) { s = Math.min(s, (win.h - 2 * EDGE_PAD) / span); tall = true; }
    }
    const visH = (win.h - 2 * EDGE_PAD) / s;
    const cy = tall ? spanTop + (bottom - spanTop) / 2 : bottom <= visH ? bottom / 2 : bottom - visH / 2;
    return { cx: this.colX[col]! + (centered ? 0 : (e.l + e.r) / 2), cy, s, win, tall };
  }
  whole(win: Rect, upTo: number, only?: number): Cam {
    const its = this.items.filter((i) => i.t0 <= upTo + 1e-6 && (only === undefined || i.col === only));
    const cols = [...new Set(its.map((i) => i.col))];
    if (!cols.length) return { cx: 0, cy: 0, s: 1, win };
    const l = Math.min(...cols.map((c) => this.colX[c]! - this.half(c)));
    const r = Math.max(...cols.map((c) => this.colX[c]! + this.half(c)));
    const b = Math.max(...its.map((i) => i.bottom));
    const s = Math.min(1, (win.w - 40) / (r - l), (win.h - 2 * EDGE_PAD) / b);
    return { cx: (l + r) / 2, cy: b / 2, s, win };
  }
  /**
   * A recap step's lines, framed. When the whole board is too small to read beside
   * the recap card, each step moves the camera to the lines it marks.
   */
  framed(win: Rect, upTo: number, col: number, marks?: Set<string>): Cam {
    const all = this.whole(win, upTo, col);
    const its = this.items.filter((i) => i.col === col && i.t0 <= upTo + 1e-6);
    const hit = its.filter((i) => i.id && marks?.has(i.id));
    if (all.s >= 0.7 || !hit.length) return all;
    const top = Math.min(...hit.map((i) => i.top)), bot = Math.max(...hit.map((i) => i.bottom));
    const b = Math.max(...its.map((i) => i.bottom));
    const s = Math.max(all.s, Math.min(1, (win.w - 40) / (2 * this.half(col)), (win.h - 2 * EDGE_PAD) / (bot - top + 160)));
    const visH = (win.h - 2 * EDGE_PAD) / s;
    const cy = Math.min(Math.max((top + bot) / 2, visH / 2), Math.max(visH / 2, b - visH / 2));
    return { cx: all.cx, cy, s, win };
  }
  camera(events: { t: number; kind: string; item?: BoardItem; shot?: number; col?: number; idx?: number }[], shots: { hasFig: boolean }[]) {
    let col = 0, bottom = 0, mode: "focus" | "overview" = "focus", recap = false, fig = false, all = false;
    let newest: BoardItem | undefined;
    let cols = new Set<number>([0]);
    const same = (a: Cam, b: Cam) =>
      Math.abs(a.cx - b.cx) < 0.5 && Math.abs(a.cy - b.cy) < 0.5 && Math.abs(a.s - b.s) < 1e-3 &&
      a.win.x === b.win.x && a.win.y === b.win.y && a.win.w === b.win.w && a.win.h === b.win.h;
    const push = (t: number, to: Cam) => {
      // a key that goes where the camera is already going would restart its ease: a visible hitch
      const last = this.keys[this.keys.length - 1];
      if (last && same(last.to, to) && [...last.cols].join() === [...cols].join()) return;
      const cut = !!last && Math.abs(to.cx - last.to.cx) > (COL_W + COL_GAP) * 1.1;
      this.keys.push({ t0: t, dur: CAM_DUR, to, cols: new Set(cols), cut });
    };
    for (let ei = 0; ei < events.length; ei++) {
      const ev = events[ei]!;
      if (ev.kind === "finale") {
        // pull back to the whole example only if it can still be read; otherwise hold the last step
        const w = this.whole(this.L.side, ev.t, all ? undefined : col);
        if (mode === "overview" && recap && w.s >= 0.42) push(ev.t, w);
        continue;
      }
      if (ev.kind === "shot") {
        fig = shots[ev.shot!]!.hasFig;
        // A new shot that starts a column or an overview at once moves the camera there
        // directly; a key for the old column in the new window first would be a feint.
        const nx = events[ei + 1];
        if (nx && nx.kind !== "shot" && nx.t - ev.t < 1.5) continue;
      }
      if (ev.kind === "item") {
        const it = ev.item!;
        if (it.col !== col) bottom = 0;
        col = it.col; bottom = Math.max(bottom, it.bottom); mode = "focus"; recap = false; cols = new Set([col]); newest = it;
      }
      if (ev.kind === "clear") {
        col = ev.col!; bottom = 0; mode = "focus"; recap = false; cols = new Set([col]); newest = undefined;
        // the column's first line follows at once: one move straight to it, not two
        const nx = events[ei + 1];
        if (nx && nx.kind === "item" && nx.item!.col === col && nx.t - ev.t < 1.5) continue;
      }
      if (ev.kind === "overview" || ev.kind === "overview-all") { mode = "overview"; all = ev.kind === "overview-all"; if (ev.col !== undefined) col = ev.col; }
      if (ev.kind === "item") all = false;
      if (ev.kind === "recap") { mode = "overview"; recap = true; }
      if (mode === "overview") {
        cols = all ? new Set(this.items.filter((i) => i.t0 <= ev.t).map((i) => i.col)) : new Set([col]);
        const marks = ev.kind === "recap" ? this.recapItems[ev.idx!]?.marks : undefined;
        push(ev.t - 0.1, recap && !all && marks ? this.framed(this.L.side, ev.t, col, marks) : this.whole(recap ? this.L.side : this.L.full, ev.t, all ? undefined : col));
      } else push(ev.t - 0.15, this.focus(col, Math.max(bottom, 1), fig ? this.L.panel : this.L.full, newest));
    }
    // where each move starts from: wherever the camera is when it begins
    for (const k of this.keys) this.starts.push(this.camAt(k.t0));
    for (const it of this.items) {
      const k = this.keys.find((x) => x.t0 >= it.t0 - 0.2);
      if (k && !k.to.tall && k.to.s < (k.to.win === this.L.panel ? this.L.tight.panel : this.L.tight.full))
        this.issues.push(`A line in column ${it.col + 1} is too wide: the board shrinks to ${Math.round(k.to.s * 100)}%. Break the line or use a shorter form.`);
    }
  }
  camAt(t: number, first?: Cam): Cam {
    let v = first ?? this.keys[0]?.to ?? { cx: 0, cy: 0, s: 1, win: this.L.full };
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i]!;
      if (t < k.t0) break;
      const from = this.starts[i] ?? v;
      // a dissolve: hold, then jump at the midpoint while the columns cross-fade
      const u = k.cut ? (t - k.t0 < k.dur / 2 ? 0 : 1) : ease((t - k.t0) / k.dur);
      v = { cx: lerp(from.cx, k.to.cx, u), cy: lerp(from.cy, k.to.cy, u), s: lerp(from.s, k.to.s, u), win: lerpRect(from.win, k.to.win, u) };
    }
    return v;
  }
  colOpacity(ci: number, t: number) {
    let o = ci === 0 ? 1 : 0;
    for (const k of this.keys) {
      if (t < k.t0) break;
      const target = k.cols.has(ci) ? 1 : 0;
      if (k.cut) {
        // out before the jump, in after it
        const half = k.dur / 2;
        o = target ? (t - k.t0 < half ? (o > 0.5 ? o : 0) : lerp(0, 1, ease((t - k.t0 - half) / half))) : lerp(o, 0, ease((t - k.t0) / half));
      } else o = lerp(o, target, ease((t - k.t0) / 0.6));
    }
    return o;
  }
  /** Is anything on the board visible at t? */
  showing(t: number) {
    if (this.recapItems.some((r) => r.t0 <= t)) return true;
    return this.items.some((i) => i.t0 <= t && this.colOpacity(i.col, t) > 0.5);
  }
  moving(): [number, number][] {
    const out: [number, number][] = this.keys.map((k) => [k.t0 - 0.02, k.t0 + Math.max(k.dur, 0.62) + 0.02]);
    for (const r of this.recapItems) out.push([r.t0 - 0.02, r.t0 + r.dur + 0.02]);
    if (Number.isFinite(this.finale)) out.push([this.finale - 0.02, this.finale + 0.75]);
    for (const it of this.items) if (it.stack) out.push(...stackMoves(it.stack, it.t0));
    return out;
  }
  draw(t: number, fade: number) {
    const c = this.camAt(t);
    const w = c.win;
    this.win.style.cssText = `left:${w.x}px;top:${w.y}px;width:${w.w}px;height:${w.h}px;opacity:${fade}`;
    this.surface.style.transform = `translate(${w.w / 2 - c.cx * c.s}px, ${w.h / 2 - c.cy * c.s}px) scale(${c.s})`;
    this.cols.forEach((el, ci) => {
      const o = this.colOpacity(ci, t);
      el.style.opacity = String(o);
      el.style.visibility = o < 0.002 ? "hidden" : "inherit";
    });
    // a recap step that marks lines keeps them bright and dims the rest
    let dimFor: { t0: number; marks?: Set<string> } | undefined;
    for (const r of this.recapItems) if (t >= r.t0) dimFor = r;
    for (const it of this.items) {
      const u = ease((t - it.t0) / it.dur);
      if (t < it.t0) { it.el.style.visibility = "hidden"; continue; }
      it.el.style.visibility = "inherit";
      const prevMarks = dimFor ? [...this.recapItems].reverse().find((r) => r.t0 < dimFor!.t0)?.marks : undefined;
      const lit = (m?: Set<string>) => (!m || (it.id !== undefined && m.has(it.id)) ? 1 : 0.28);
      const k = dimFor ? ease((t - dimFor.t0) / 0.5) : 1;
      it.el.style.filter = "";
      let dim = dimFor ? lerp(lit(prevMarks), lit(dimFor.marks), k) : 1;
      if (t >= this.finale) dim = lerp(dim, 1, ease((t - this.finale) / 0.7));
      if (it.fly || it.fresh) {
        for (const f of it.fly ?? []) f.el.style.transform = u >= 1 ? "" : `translate(${f.dx * (1 - u)}px, ${f.dy * (1 - u)}px)`;
        const v = clamp((t - it.t0 - it.dur * 0.35) / (it.dur * 0.65));
        for (const f of it.fresh ?? []) f.style.opacity = String(ease(v));
        if (it.note) it.note.style.opacity = String(ease(v));
        if (it.kind === "answer") it.el.style.setProperty("--film-box", String(ease(v)));
      } else {
        it.el.style.transform = `translateY(${(1 - u) * 14}px)`;
      }
      it.el.style.opacity = String((it.fly || it.fresh ? 1 : u) * dim);
      if (it.stack) drawStack(it.stack, it.t0, t);
    }
    const r0 = this.recapItems[0];
    const ro = r0 ? ease((t - r0.t0) / 0.5) : 0;
    this.recapCard.style.opacity = String(ro * fade);
    this.recapCard.style.visibility = ro * fade < 0.002 ? "hidden" : "visible";
    for (const r of this.recapItems) {
      const u = ease((t - r.t0) / r.dur);
      r.el.style.opacity = String(u);
      r.el.style.transform = `translateY(${(1 - u) * 12}px)`;
    }
  }
}

// ------------------------------------------------------------------ the film
export class Film {
  shots: { el: HTMLElement; t0: number; t1: number; geo?: GeoStage; list: Entry[]; extern?: (t: number) => void; hasFig: boolean }[] = [];
  board: Board;
  issues: string[] = [];
  duration: number;
  L: Layout;
  /** Longest stretch of speech with nothing changing on screen; --dry passes a stricter limit, since its timing is estimated. */
  still = 7.5;
  constructor(root: HTMLElement, public script: Script, public timing: Timing, mountExample?: (host: HTMLElement, shot: Shot, list: Entry[]) => ((t: number) => void) | undefined, opts: { checks?: boolean; layout?: Layout; still?: number } = {}) {
    if (opts.still) this.still = opts.still;
    this.duration = timing.duration;
    const L0 = opts.layout ?? WIDE;
    root.style.width = `${L0.w}px`;
    root.style.height = `${L0.h}px`;
    root.dataset.layout = L0.name;
    // Roles still choose the recorded voice. Nothing about them is drawn.
    resolveCast(script, timing.voices);
    const L = (this.L = L0);
    const FIG = L.fig;
    script.shots.forEach((shot, i) => {
      const times = timing.shots[i]!;
      const list = entries(shot, times);
      const el = div("film-shot", root);
      const t0 = i === 0 ? 0 : times[0]!.start - 0.5;
      const hasFig = !!shot.figure;
      let geo: GeoStage | undefined; let extern: ((t: number) => void) | undefined;
      if (hasFig) {
        const card = div("film-figure", el);
        card.style.cssText = `left:${FIG.x}px;top:${FIG.y}px;width:${FIG.w}px;height:${FIG.h}px`;
        const host = div("film-fit", card);
        if (shot.figure && "parts" in shot.figure) geo = new GeoStage(host, shot.figure, list, { x: 0, y: 0, w: FIG.w, h: FIG.h });
        else extern = mountExample?.(host, shot, list);
      }
      this.shots.push({ el, t0, t1: Infinity, geo, list, extern, hasFig });
    });
    this.shots.forEach((s, i) => { s.t1 = this.shots[i + 1]?.t0 ?? Infinity; });
    const lastShot = timing.shots[timing.shots.length - 1]!;
    this.board = new Board(root, this.shots, this.duration, lastShot[lastShot.length - 1]!.end, L);
    this.issues.push(...this.board.issues);
    // a player skips the authoring checks: they cost time and the film already passed them
    if (opts.checks !== false) {
      this.checkFigures();
      this.checkScreen();
    }
  }
  /** Labels and points must stay on their card, and the picture must be big enough to see. */
  checkFigures() {
    this.shots.forEach((s, i) => {
      if (!s.geo) return;
      this.checkSize(s, i);
      const box = s.geo.box;
      for (const t of [s.t0 + 0.01, Math.min(s.t1, this.duration) - 0.05]) {
        s.geo.draw(t);
        const v = s.geo.px(t);
        for (const [n, d] of Object.entries(s.geo.geo.points)) {
          // a point on a graph may ride off; a point anchored in a table or mosaic sits inside it, and the picture may be shown later, pulled back
          if (s.geo.riders.has(n) || (!Array.isArray(d) && "anchor" in d)) continue;
          const q = v.map(s.geo.at(n, t));
          if (q[0] < -1 || q[1] < -1 || q[0] > box.w + 1 || q[1] > box.h + 1) {
            this.issues.push(`Shot ${i + 1}: point ${n} is outside the figure's view. Widen geo.view.`);
            break;
          }
        }
      }
      // every label that is showing stays on its card, at the end of each beat: never cut by the card's edge
      const card = s.el.querySelector(".film-figure")!.getBoundingClientRect();
      const end = Math.min(s.t1, this.duration) - 0.05;
      const flagged = new Set<string>();
      for (const t of [...s.list.map((e) => e.t0 + e.dur + 0.05).filter((t) => t > s.t0 && t < end), end]) {
        s.geo.draw(t);
        for (const el of s.el.querySelectorAll<HTMLElement>(".film-label")) {
          if (parseFloat(el.style.opacity || "1") < 0.3 || el.style.visibility === "hidden" || el.style.display === "none") continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const over = Math.max(card.left - r.left, r.right - card.right, card.top - r.top, r.bottom - card.bottom);
          // a label wholly outside is clipped away and unseen; one straddling the edge is visibly cut
          const inside = Math.min(r.right, card.right) > Math.max(r.left, card.left) && Math.min(r.bottom, card.bottom) > Math.max(r.top, card.top);
          const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
          if (over > 3 && inside && !flagged.has(text)) {
            flagged.add(text);
            this.issues.push(`Shot ${i + 1}: the label "${text}" is cut off by the edge of the figure card (${Math.round(over)}px over). Move it inside the card or make it smaller.`);
          }
        }
      }
    });
  }
  /**
   * A picture fills its card: at a few moments of the shot, what is drawn must
   * span most of the card's width or height, and grid cells must be big enough
   * to read. A graph's axes fill the view by themselves.
   */
  checkSize(s: Film["shots"][number], i: number) {
    const geo = s.geo!;
    const card = s.el.querySelector(".film-figure")!.getBoundingClientRect();
    const end = Math.min(s.t1, this.duration) - 0.05;
    const times = [0.4, 0.7, 1].map((f) => s.t0 + (end - s.t0) * f);
    let best = 0;
    const small = new Set<string>();
    for (const t of times) {
      geo.draw(t);
      const { s: k } = geo.px(t);
      for (const g of geo.grids()) {
        if (geo.opacity(g, t).o < 0.5) continue;
        const [cw, ch] = cellSize(g).map((v) => v * k);
        if (Math.max(cw!, ch!) < 80 || Math.min(cw!, ch!) < 32)
          small.add(`grid ${g.id} has cells ${Math.round(cw!)} by ${Math.round(ch!)} px`);
      }
      if (geo.geo.parts.some((p) => "axes" in p)) { best = 1; continue; }
      let l = Infinity, top = Infinity, r = -Infinity, b = -Infinity;
      for (const e of geo.parts) {
        if (geo.opacity(e.p, t).o < 0.05) continue;
        for (const el of [e.el, e.html, ...(e.extra ?? []), ...(e.blocks || e.table || e.mosaic || e.bar ? (e.extraHtml ?? []) : [])]) {
          if (!el || (el as HTMLElement).style.display === "none" || Number((el as HTMLElement).style.opacity || 1) < 0.05) continue;
          const q = el.getBoundingClientRect();
          if (!q.width && !q.height) continue;
          l = Math.min(l, q.left); top = Math.min(top, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
        }
      }
      if (r > l) best = Math.max(best, Math.max((r - l) / card.width, (b - top) / card.height));
    }
    if (best > 0 && best < 0.65)
      this.issues.push(`Shot ${i + 1}: the picture fills only ${Math.round(best * 100)}% of its card. Tighten geo.view around the parts, or make them bigger, so the picture is easy to see.`);
    for (const m of small) this.issues.push(`Shot ${i + 1}: ${m}, too small to see. Use fewer, bigger cells (a taller bar, a larger size) or a tighter view.`);
    // every moment a beat ends: a cell's text must fit its cell
    for (const b of this.timing.shots[i] ?? []) geo.draw(Math.min(b.end + 0.5, end));
    for (const m of geo.tableIssues) this.issues.push(`Shot ${i + 1}: ${m}`);
  }
  /**
   * The screen must never be empty while the voice speaks, and must not sit
   * still through a long stretch of speech.
   */
  checkScreen() {
    const said = (si: number, t: number) => this.timing.shots[si]!.find((b) => t >= b.start && t <= b.end);
    this.shots.forEach((s, si) => {
      const beats = this.timing.shots[si]!;
      for (const b of beats) {
        let empty = 0;
        for (let t = b.start; t <= b.end; t += 0.25) {
          const on = s.hasFig || this.board.showing(t);
          empty = on ? 0 : empty + 0.25;
          if (empty >= 1.25) {
            this.issues.push(`Shot ${si + 1}: the screen is empty while the voice says "${b.words.map((w) => w.text).join(" ").slice(0, 70)}". Show the problem, a figure or a line of work as it starts.`);
            break;
          }
        }
      }
      // long stretches where nothing on screen changes
      const changes = [s.t0, ...s.list.flatMap((e) => [e.t0, ...Object.values(e.words ?? {})])].sort((a, b) => a - b);
      const end = Math.min(s.t1, this.duration);
      changes.push(end);
      for (let k = 0; k < changes.length - 1; k++) {
        const a = changes[k]!, b = changes[k + 1]!;
        let talk = 0;
        for (let t = a; t < b; t += 0.25) if (said(si, t)) talk += 0.25;
        if (talk > this.still) {
          const w = beats.find((x) => x.end > a + 0.5) ?? beats[0]!;
          this.issues.push(`Shot ${si + 1}: nothing changes on screen for ${talk.toFixed(0)} s of speech, from "${w.words.map((x) => x.text).join(" ").slice(0, 60)}". Write a step, show a part, or highlight what is being said.`);
        }
      }
    });
  }
  /** Frames where nothing moves are copies; only these need rendering. */
  moving(): [number, number][] {
    const out: [number, number][] = [[0, 0.6], ...this.board.moving()];
    for (const s of this.shots) {
      out.push([s.t0 - 0.05, s.t0 + 0.65]);
      for (const e of s.list) {
        out.push([e.t0 - 0.02, e.t0 + e.dur + 0.02]);
        if (e.a.do === "highlight") out.push([e.beatEnd + 0.33, e.beatEnd + 0.72]);
      }
    }
    out.push([this.duration - 0.05, this.duration + 0.1]);
    return out;
  }
  seek(t: number) {
    this.shots.forEach((s, i) => {
      const inn = i === 0 ? ease(t / 0.5) : ease((t - s.t0) / 0.55);
      // the last shot never fades: the film ends on its summary, held
      const out = s.t1 === Infinity ? 1 : 1 - ease((t - s.t1) / 0.3);
      const o = inn * out;
      const on = o > 0.002;
      s.el.style.visibility = on ? "visible" : "hidden";
      if (!on) return;
      s.el.style.opacity = String(o);
      s.geo?.draw(t);
      s.extern?.(t);
      const fit = s.el.querySelector<HTMLElement>(".film-fit");
      if (fit) fitFigure(fit);
    });
    this.board.draw(t, ease(t / 0.5));
  }
}
