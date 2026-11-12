/**
 * Base-ten blocks in a place-value chart, drawn to scale: a square, a rod of
 * ten squares, a flat of ten rods. One unit is one square's side, so a rod is
 * visibly ten squares long and a flat visibly ten rods wide; no piece ever
 * stands for an amount it is not the size of.
 *
 * Everything here is pure: a chart's state (which pieces sit in which place)
 * is laid out by functions of the state alone, and a trade is a new state.
 * The stage only interpolates between layouts, so a frame at any time is the
 * same frame however it is reached.
 */

export const PLACES = [
  "millions", "hundred-thousands", "ten-thousands", "thousands", "hundreds", "tens", "ones", "tenths", "hundredths", "thousandths",
] as const;
export type Place = (typeof PLACES)[number];
export type Kind = "square" | "rod" | "flat";
export type Piece = { id: string; kind: Kind; ink: string; /** The piece it was cut from, when a split made it. */ from?: string; /** The ten pieces it was fused from, when a join made it. */ of?: string[] };
export type State = Record<string, Piece[]>;
/** Bottom-left corner and size, in chart units, y up. */
export type Box = { x: number; y: number; w: number; h: number };
export type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "c";

export const PLACE_VALUE: Record<Place, number> = {
  millions: 1e6, "hundred-thousands": 1e5, "ten-thousands": 1e4, thousands: 1e3, hundreds: 100, tens: 10, ones: 1, tenths: 0.1, hundredths: 0.01, thousandths: 0.001,
};
const idx = (p: Place) => PLACES.indexOf(p);
const isDecimal = (p: Place) => idx(p) > idx("ones");

/** The place drawn as a single square: hundredths when the chart has decimal places, ones otherwise. */
export const unitPlace = (places: readonly Place[]): Place => (places.some(isDecimal) ? "hundredths" : "ones");

/** The shape a place takes: square, rod or flat, counting up from the unit. */
export function kindOf(place: Place, unit: Place): Kind {
  const k = idx(unit) - idx(place);
  if (k === 0) return "square";
  if (k === 1) return "rod";
  if (k === 2) return "flat";
  throw new Error(`blocks: the ${place} place is not drawn yet when the unit is ${unit} (only square, rod and flat exist so far).`);
}
export const SIZE: Record<Kind, [number, number]> = { square: [1, 1], rod: [1, 10], flat: [10, 10] };

// ------------------------------------------------------------------ layout
/** Gaps in chart units. Squares in a stack sit close, so ten of them read as one rod. */
export const GAP = { piece: 0.5, stack: 0.12, flat: 0.6, row: 0.8 };
/** A column is never narrower than this: the place name must fit under it. */
export const COL_MIN = 8;
/** Between columns: room for the point. */
export const COL_GAP = 2.2;
/** Rows under the piles: the place names, then the digits, as pixel offsets below the baseline (they are fixed-size type). */
export const HEAD_PX = 46;
export const DIGIT_PX = 124;
/** The same rows in chart units when the scale is not known yet (tests, a first layout). */
export const HEAD_Y = -1.7;
export const DIGIT_Y = -4.3;

export type Pile = { boxes: Box[]; w: number; h: number };
/**
 * One place's pieces, bottom-aligned, relative to the pile's bottom-left.
 * Flats in rows of two (up to four) or three; rods side by side, ten to a
 * row; squares in stacks of ten (`stacks`) or rows of five (`rows`).
 */
export function layoutPile(pieces: Piece[], squares: "rows" | "stacks" = "stacks"): Pile {
  const boxes: Box[] = [];
  const n = pieces.length;
  pieces.forEach((p, i) => {
    const [w, h] = SIZE[p.kind];
    if (p.kind === "flat") {
      const per = n <= 4 ? 2 : 3;
      boxes.push({ x: (i % per) * (10 + GAP.flat), y: Math.floor(i / per) * (10 + GAP.flat), w, h });
    } else if (p.kind === "rod") {
      boxes.push({ x: (i % 10) * (1 + GAP.piece), y: Math.floor(i / 10) * (10 + GAP.row), w, h });
    } else if (squares === "stacks") {
      boxes.push({ x: Math.floor(i / 10) * (1 + GAP.piece), y: (i % 10) * (1 + GAP.stack), w, h });
    } else {
      boxes.push({ x: (i % 5) * (1 + GAP.piece), y: Math.floor(i / 5) * (1 + GAP.piece), w, h });
    }
  });
  const w = boxes.length ? Math.max(...boxes.map((b) => b.x + b.w)) : 0;
  const h = boxes.length ? Math.max(...boxes.map((b) => b.y + b.h)) : 0;
  return { boxes, w, h };
}

export type Column = { place: Place; x0: number; x1: number; cx: number; pile: Box; count: number };
export type ChartLayout = {
  pieces: Map<string, Box>;
  columns: Column[];
  width: number;
  /** The tallest pile. */
  top: number;
  /** Where the point sits, between the ones and the tenths. */
  pointX?: number;
  /** What the chart covers, headers and digits included: [left, bottom, right, top]. */
  bounds: [number, number, number, number];
};
export type ChartOpts = {
  squares?: "rows" | "stacks";
  point?: boolean;
  counts?: boolean;
  /** Fixed column widths (units), so columns stay put while piles come and go. */
  colW?: Record<string, number>;
  /** Where the name row and the digit row sit, in units below the baseline. */
  headY?: number;
  digitY?: number;
  /** Room kept above the baseline (units) for a pile this chart will hold later, so the chart is one height in every state. */
  top?: number;
};

/** How many units a place's name needs under its column when one unit is `pxPerUnit` pixels wide (30 px spaced capitals). */
export const headerUnits = (place: Place, pxPerUnit: number) => (27 * place.length + 40) / pxPerUnit;

/** The whole chart for one state: columns side by side, each pile centered in its column. */
export function layoutChart(places: readonly Place[], state: State, opts: ChartOpts = {}): ChartLayout {
  const pieces = new Map<string, Box>();
  const columns: Column[] = [];
  let x = 0;
  for (const place of places) {
    const list = state[place] ?? [];
    const pile = layoutPile(list, opts.squares);
    const colW = Math.max(pile.w, COL_MIN, opts.colW?.[place] ?? 0);
    const px = x + (colW - pile.w) / 2;
    list.forEach((p, i) => { const b = pile.boxes[i]!; pieces.set(p.id, { x: px + b.x, y: b.y, w: b.w, h: b.h }); });
    columns.push({ place, x0: x, x1: x + colW, cx: x + colW / 2, pile: { x: px, y: 0, w: pile.w, h: pile.h }, count: list.length });
    x += colW + COL_GAP;
  }
  const width = x - COL_GAP;
  const top = Math.max(10, opts.top ?? 0, ...columns.map((c) => c.pile.h));
  const ones = columns.find((c) => c.place === "ones"), tenths = columns.find((c) => c.place === "tenths");
  const pointX = opts.point !== false && ones && tenths ? (ones.x1 + tenths.x0) / 2 : undefined;
  const digitY = opts.digitY ?? DIGIT_Y;
  const bounds: [number, number, number, number] = [0, digitY * 1.35, width, top + (opts.counts ? 3.2 : 0.8)];
  return { pieces, columns, width, top, pointX, bounds };
}

/** A view that holds a box with room around it, and room beside it for labels in the given directions. */
export function zoomView(b: Box, labelDirs: Dir[] = []): [number, number, number, number] {
  const pad = 0.1 * Math.max(b.w, b.h);
  const has = (c: string) => labelDirs.some((d) => d.includes(c));
  return [b.x - pad - (has("w") ? 5.5 : 0), b.y - pad - (has("s") ? 2.2 : 0), b.x + b.w + pad + (has("e") ? 5.5 : 0), b.y + b.h + pad + (has("n") ? 2.2 : 0)];
}
/** The view that shows the whole chart. */
export function chartView(l: ChartLayout): [number, number, number, number] {
  const [x0, y0, x1, y1] = l.bounds;
  const pad = 0.05 * Math.max(x1 - x0, y1 - y0);
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

/** A strip (`s3`, a rod-shaped tenth of a flat) or a cell (`c37`, one square, counted row by row from the top-left) of a piece. */
export function subBox(kind: Kind, b: Box, sub: string): Box {
  const m = sub.match(/^([sc])(\d+)$/);
  if (!m) throw new Error(`blocks: "${sub}" is not a strip (s1..s10) or a cell (c1..c100).`);
  const k = Number(m[2]);
  if (m[1] === "s") {
    if (kind !== "flat" || k < 1 || k > 10) throw new Error(`blocks: only a flat has strips s1..s10; got ${sub} on a ${kind}.`);
    return { x: b.x + k - 1, y: b.y, w: 1, h: 10 };
  }
  if (kind === "flat") {
    if (k < 1 || k > 100) throw new Error(`blocks: a flat has cells c1..c100; got ${sub}.`);
    return { x: b.x + ((k - 1) % 10), y: b.y + 10 - Math.floor((k - 1) / 10) - 1, w: 1, h: 1 };
  }
  if (kind === "rod") {
    if (k < 1 || k > 10) throw new Error(`blocks: a rod has cells c1..c10; got ${sub}.`);
    return { x: b.x, y: b.y + 10 - k, w: 1, h: 1 };
  }
  throw new Error(`blocks: a square has no parts; got ${sub}.`);
}

// ------------------------------------------------------------------ digits
/** The numeral the pieces make: a digit per place (carrying any pile of ten or more), and which digits are placeholders. */
export function digitsOf(places: readonly Place[], state: State): { digit: Record<string, number>; placeholder: Record<string, boolean>; overflow: boolean } {
  const digit: Record<string, number> = {};
  let carry = 0;
  for (let i = places.length - 1; i >= 0; i--) {
    const p = places[i]!;
    const n = (state[p] ?? []).length + carry;
    digit[p] = n % 10;
    carry = Math.floor(n / 10);
  }
  const placeholder: Record<string, boolean> = {};
  // trailing zeros right of the point, and leading zeros left of the ones, only hold a place
  let trailing = true;
  for (let i = places.length - 1; i >= 0; i--) {
    const p = places[i]!;
    if (!isDecimal(p)) break;
    placeholder[p] = trailing && digit[p] === 0;
    if (digit[p] !== 0) trailing = false;
  }
  let leading = true;
  for (const p of places) {
    if (idx(p) >= idx("ones")) break;
    placeholder[p] = leading && digit[p] === 0;
    if (digit[p] !== 0) leading = false;
  }
  return { digit, placeholder, overflow: carry > 0 };
}

// ------------------------------------------------------------------ states and trades
/** The pieces the author asked for, named `<chart>.<row>.<place>.<k>`. */
export function initialState(chartId: string, rowId: string, places: readonly Place[], pieces: Record<string, number>, inks: Record<string, string>, ink: string): State {
  const unit = unitPlace(places);
  const state: State = {};
  for (const place of Object.keys(pieces)) if (!places.includes(place as Place)) throw new Error(`blocks ${chartId}: row ${rowId} has pieces in "${place}", but the chart's places are ${places.join(", ")}.`);
  for (const place of Object.keys(inks)) if (!places.includes(place as Place)) throw new Error(`blocks ${chartId}: row ${rowId} colors "${place}", but the chart's places are ${places.join(", ")}.`);
  for (const place of places) {
    const n = pieces[place] ?? 0;
    const kind = kindOf(place, unit);
    state[place] = Array.from({ length: n }, (_, k) => ({ id: `${chartId}.${rowId}.${place}.${k + 1}`, kind, ink: inks[place] ?? ink }));
  }
  return state;
}

export type Split = { from: Piece; born: Piece[]; state: State };
/**
 * Cut the rightmost piece of a place into ten of the next place, which join
 * that pile at its left. The amount never changes; the pieces do.
 */
export function splitOne(places: readonly Place[], state: State, place: Place, seq: Record<string, number>): Split {
  const i = places.indexOf(place);
  const next = places[i + 1];
  if (!next) throw new Error(`blocks: to split the ${place} the chart needs the place to its right.`);
  const list = state[place] ?? [];
  const from = list[list.length - 1];
  if (!from) throw new Error(`blocks: there is nothing left in the ${place} to split.`);
  const kind = kindOf(next, unitPlace(places));
  const chart = from.id.split(".").slice(0, 2).join(".");
  const born: Piece[] = Array.from({ length: 10 }, () => ({ id: `${chart}.${next}.${++seq[next]!}`, kind, ink: from.ink, from: from.id }));
  const out: State = { ...state, [place]: list.slice(0, -1), [next]: [...born, ...(state[next] ?? [])] };
  return { from, born, state: out };
}
/** Where the ten new pieces sit inside the piece they were cut from, in order: bottom to top of a rod, left to right of a flat. */
export function tiles(from: Box, kind: Kind): Box[] {
  return Array.from({ length: 10 }, (_, j) => (kind === "rod" ? { x: from.x, y: from.y + j, w: 1, h: 1 } : { x: from.x + j, y: from.y, w: 1, h: 10 }));
}

export type Join = { parts: Piece[]; made: Piece; state: State };
/**
 * Fuse the ten leftmost pieces of a place into one of the place to its left,
 * which joins that pile at its right: the reverse of `splitOne`. The amount
 * never changes; the pieces do.
 */
export function joinTen(places: readonly Place[], state: State, place: Place, seq: Record<string, number>): Join {
  const i = places.indexOf(place);
  const up = places[i - 1];
  if (i < 0 || !up) throw new Error(`blocks: to join the ${place} the chart needs the place to its left.`);
  const list = state[place] ?? [];
  if (list.length < 10) throw new Error(`blocks: a join fuses ten pieces, and the ${place} pile holds ${list.length} at that moment.`);
  const kind = kindOf(up, unitPlace(places));
  const parts = list.slice(0, 10);
  const chart = parts[0]!.id.split(".").slice(0, 2).join(".");
  const made: Piece = { id: `${chart}.${up}.${++seq[up]!}`, kind, ink: parts[0]!.ink, of: parts.map((p) => p.id) };
  return { parts, made, state: { ...state, [place]: list.slice(10), [up]: [...(state[up] ?? []), made] } };
}
/**
 * A join's three moves, as fractions of its time. The ten pieces close up into
 * the shape of the piece they make and fuse (`fuse`); that piece travels to its
 * pile and lands as the join ends (`land`); the pieces left behind settle into
 * the room it left, starting once it is clear of them (`settle`). Pieces
 * already in the pile it joins make room while the ten close up. `rise` is how
 * far along its way the fused piece starts to climb to a higher row: it leaves
 * its own column along the baseline first.
 */
export const JOIN = { fuse: 0.4, land: 1, settle: 0.7, rise: 0.45 };
const overlap = (a: Box, b: Box) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1e-6 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1e-6;

const ease = (u: number) => { u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * u * (u * (u * 6 - 15) + 10); };
const lerpBox = (a: Box, b: Box, u: number): Box => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, w: a.w + (b.w - a.w) * u, h: a.h + (b.h - a.h) * u });

/**
 * One trade: `from` is the one piece of the higher place and `born` the ten of
 * the place below it. A split cuts `from` into `born`; a join (`join: true`)
 * fuses `born` into `from`.
 */
export type Transition = { t0: number; dur: number; from: Piece; born: Piece[]; join?: boolean };
/**
 * A chart through time: its states in order, with the moment each trade
 * starts. Positions, counts and the pieces that exist are all functions of t.
 */
export class BlocksModel {
  states: State[];
  layouts: ChartLayout[] = [];
  transitions: Transition[] = [];
  seq: Record<string, number> = {};
  cuts: { t0: number; dur: number; axis: "v" | "h" }[] = [];
  /** Where each join's ten pieces close up, worked out from the layouts when first asked for. */
  private gathers = new Map<number, Box>();
  /** The least width of each column, from the room its name needs. */
  minCol: Record<string, number> = {};
  /** The name row and the digit row, in units below the baseline, set from the chart's scale. */
  headY = HEAD_Y;
  digitY = DIGIT_Y;
  readonly unit: Place;
  constructor(
    public chartId: string,
    public rowId: string,
    public places: readonly Place[],
    pieces: Record<string, number>,
    public opts: ChartOpts & { ink?: string; inks?: Record<string, string>; lines?: "none" | "tenths" | "all" } = {},
  ) {
    this.unit = unitPlace(places);
    const s0 = initialState(chartId, rowId, places, pieces, opts.inks ?? {}, opts.ink ?? "accent");
    for (const p of places) this.seq[p] = (s0[p] ?? []).length;
    this.states = [s0];
    this.relayout();
  }
  /** Columns are as wide as the widest pile they ever hold, so nothing but the pieces moves during a trade. */
  relayout() {
    const colW: Record<string, number> = {};
    for (const place of this.places) {
      colW[place] = Math.max(COL_MIN, this.minCol[place] ?? 0, ...this.states.map((s) => layoutPile(s[place] ?? [], this.opts.squares).w));
    }
    // a join can leave a pile taller than any before it: the chart keeps that room from its first state
    const top = this.transitions.some((tr) => tr.join)
      ? Math.max(...this.states.flatMap((s) => this.places.map((place) => layoutPile(s[place] ?? [], this.opts.squares).h)))
      : undefined;
    this.layouts = this.states.map((s) => layoutChart(this.places, s, { ...this.opts, colW, headY: this.headY, digitY: this.digitY, top }));
    this.gathers.clear();
  }
  /** Give each column at least the room its name needs, and put the name and digit rows at their pixel offsets; `pxPerUnit` is the chart's scale when pulled back. */
  fitHeaders(pxPerUnit: number) {
    for (const place of this.places) this.minCol[place] = headerUnits(place, pxPerUnit);
    this.headY = -HEAD_PX / pxPerUnit;
    this.digitY = -DIGIT_PX / pxPerUnit;
    this.relayout();
  }
  get digits() { return digitsOf(this.places, this.states[0]!); }
  /** Every piece that ever exists. */
  pieces(): Piece[] {
    const seen = new Map<string, Piece>();
    for (const s of this.states) for (const list of Object.values(s)) for (const p of list) seen.set(p.id, p);
    return [...seen.values()];
  }
  piece(id: string): Piece | undefined {
    for (const s of this.states) for (const list of Object.values(s)) for (const p of list) if (p.id === id) return p;
    return undefined;
  }
  /** The pile a piece belongs to now, by its id. */
  placeOf(id: string): Place { return id.split(".")[2] as Place; }
  /** Add `n` trades of one piece each, the first at t0, the rest every `step` seconds; each takes `each` seconds. */
  split(place: Place, n: number, t0: number, each: number, step: number) {
    for (let k = 0; k < n; k++) {
      const cur = this.states[this.states.length - 1]!;
      const s = splitOne(this.places, cur, place, this.seq);
      this.states.push(s.state);
      this.transitions.push({ t0: t0 + k * step, dur: each, from: s.from, born: s.born });
    }
    this.relayout();
  }
  /** Add `n` joins of ten pieces each, one after another: the first at t0, each taking `each` seconds. */
  join(place: Place, n: number, t0: number, each: number) {
    try {
      for (let k = 0; k < n; k++) {
        const cur = this.states[this.states.length - 1]!;
        const j = joinTen(this.places, cur, place, this.seq);
        this.states.push(j.state);
        this.transitions.push({ t0: t0 + k * each, dur: each, from: j.made, born: j.parts, join: true });
      }
    } finally {
      // a run that stops short (fewer than ten left) keeps the joins it made
      this.relayout();
    }
  }
  /**
   * Where join `j`'s ten pieces close up: a box the shape of the piece they
   * make, standing on their own row at the end nearest the place it is going
   * to, so nothing of its own pile is in its way. It stands further that way
   * only when a piece that stays behind would otherwise be under it.
   */
  gatherBox(j: number): Box {
    const known = this.gathers.get(j);
    if (known) return known;
    const tr = this.transitions[j]!;
    const at = tr.t0 - 1e-6;
    const where = (p: Piece) => this.positionAt(p.id, at) ?? this.layouts[j]!.pieces.get(p.id)!;
    const boxes = tr.born.map(where);
    const ids = new Set(tr.born.map((p) => p.id));
    const stay = (this.states[j]![this.placeOf(tr.born[0]!.id)] ?? []).filter((p) => !ids.has(p.id)).map(where);
    const x0 = Math.min(...boxes.map((b) => b.x)), y = Math.min(...boxes.map((b) => b.y));
    const [w, h] = SIZE[tr.from.kind];
    const air = GAP.piece / 2;
    const clear = (x: number) => !stay.some((o) => overlap({ x: x - air, y, w: w + 2 * air, h }, o));
    let x = x0;
    for (let d = 0; d <= w + 1; d += 0.25) if (clear(x0 - d)) { x = x0 - d; break; }
    const box = { x, y, w, h };
    this.gathers.set(j, box);
    return box;
  }
  /** Draw the unit lines of every block as a cut: vertical lines for the place one down from the flat, horizontal for the square. */
  cut(into: Place, t0: number, dur: number) {
    const kind = kindOf(into, this.unit);
    if (kind === "flat") throw new Error(`blocks: cutting into ${into} draws nothing; cut into the rod's place or the square's.`);
    this.cuts.push({ t0, dur, axis: kind === "rod" ? "v" : "h" });
  }
  /** How far each family of unit lines is drawn at t: 0 none, 1 all. */
  linesAt(t: number): { v: number; h: number } {
    const base = this.opts.lines ?? "all";
    const out = { v: base === "none" ? 0 : 1, h: base === "all" ? 1 : 0 };
    for (const c of this.cuts) if (t >= c.t0) out[c.axis] = Math.max(out[c.axis], ease((t - c.t0) / c.dur));
    return out;
  }
  /** Where a piece is at t, or undefined when it does not exist then. */
  positionAt(id: string, t: number): Box | undefined {
    let pos = this.layouts[0]!.pieces.get(id);
    for (let j = 0; j < this.transitions.length; j++) {
      const tr = this.transitions[j]!;
      if (t < tr.t0) break;
      const target = this.layouts[j + 1]!.pieces.get(id);
      if (tr.join) {
        const u = (t - tr.t0) / tr.dur;
        const k = tr.born.findIndex((p) => p.id === id);
        if (k >= 0) {
          // one of the ten: it closes up into the piece they make, and at the fuse it is that piece
          if (!pos || u >= JOIN.fuse) return undefined;
          return lerpBox(pos, tiles(this.gatherBox(j), tr.from.kind)[k]!, ease(u / JOIN.fuse));
        }
        if (id === tr.from.id) {
          // the piece they make: it exists from the fuse, and travels to where its pile keeps it
          if (u < JOIN.fuse) return undefined;
          const g = this.gatherBox(j), home = target!, v = (u - JOIN.fuse) / (JOIN.land - JOIN.fuse);
          // along the baseline out of its own column, then up to its row if its place is a higher one
          pos = v >= 1 ? home : { x: g.x + (home.x - g.x) * ease(v), y: g.y + (home.y - g.y) * ease((v - JOIN.rise) / (1 - JOIN.rise)), w: home.w, h: home.h };
          continue;
        }
        if (!target) { if (pos) return undefined; continue; }
        if (!pos) continue;
        // the pile it joins makes room first; the pieces left behind settle once it has gone
        const [a, b] = this.placeOf(id) === this.placeOf(tr.born[0]!.id) ? [JOIN.settle, 1] : [0, JOIN.fuse];
        pos = lerpBox(pos, target, ease((u - a) / (b - a)));
        continue;
      }
      // gone (cut up), or not born yet
      if (!target) { if (pos) return undefined; continue; }
      const u = ease((t - tr.t0) / tr.dur);
      if (!pos) {
        const k = tr.born.findIndex((p) => p.id === id);
        if (k < 0) continue;
        // it starts where its parent was the instant before the cut
        const parent = this.positionAt(tr.from.id, tr.t0 - 1e-6) ?? this.layouts[j]!.pieces.get(tr.from.id)!;
        pos = tiles(parent, tr.from.kind)[k]!;
      }
      pos = lerpBox(pos, target, u);
    }
    return pos;
  }
  /** The state in force at t: a split counts from its midpoint, a join from the moment its motion ends. */
  stateIndexAt(t: number) {
    let i = 0;
    for (const tr of this.transitions) if (t >= tr.t0 + tr.dur * (tr.join ? 1 : 0.5)) i++;
    return i;
  }
  countAt(place: Place, t: number) { return (this.states[this.stateIndexAt(t)]![place] ?? []).length; }
  column(place: Place, t: number): Column {
    const c = this.layouts[this.stateIndexAt(t)]!.columns.find((x) => x.place === place);
    if (!c) throw new Error(`blocks ${this.chartId}: no ${place} column.`);
    return c;
  }
  /** The pile's box at t, from its pieces as they stand. */
  pileAt(place: Place, t: number): Box | undefined {
    // through a join, ten pieces of one pile become one piece of another: the two piles' boxes glide
    // from the pile before to the pile after, so a count or a label riding on one never jumps
    for (let j = 0; j < this.transitions.length; j++) {
      const tr = this.transitions[j]!;
      if (!tr.join || t < tr.t0 || t > tr.t0 + tr.dur) continue;
      if (place !== this.placeOf(tr.from.id) && place !== this.placeOf(tr.born[0]!.id)) continue;
      const still = (i: number) => { const c = this.layouts[i]!.columns.find((x) => x.place === place); return c && c.count ? c.pile : undefined; };
      const a = still(j), b = still(j + 1);
      if (!a || !b) return a ?? b;
      // the pile that gains a piece opens up as it comes along the baseline, before it climbs; the pile that lost ten closes after it has gone
      const [from, to] = place === this.placeOf(tr.from.id) ? [JOIN.fuse, JOIN.fuse + (JOIN.land - JOIN.fuse) * JOIN.rise] : [JOIN.settle, 1];
      return lerpBox(a, b, ease(((t - tr.t0) / tr.dur - from) / (to - from)));
    }
    const boxes = this.pieces().filter((p) => this.placeOf(p.id) === place)
      .map((p) => this.positionAt(p.id, t)).filter((b): b is Box => !!b);
    if (!boxes.length) return undefined;
    const x0 = Math.min(...boxes.map((b) => b.x)), x1 = Math.max(...boxes.map((b) => b.x + b.w));
    const y0 = Math.min(...boxes.map((b) => b.y)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  /** The box a label or a zoom names: the chart, a pile, a piece, or a strip or cell of a piece. */
  boxOf(target: string, t: number): Box {
    const parts = target.split(".");
    if (parts[0] !== this.chartId) throw new Error(`blocks: "${target}" is not part of ${this.chartId}.`);
    if (parts.length === 1) { const [x0, y0, x1, y1] = this.layouts[this.stateIndexAt(t)]!.bounds; return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
    if (parts[1] !== this.rowId) throw new Error(`blocks: "${target}" names row "${parts[1]}", but the chart's row is "${this.rowId}".`);
    if (parts.length === 2) { const [x0, , x1] = this.layouts[0]!.bounds; return { x: x0, y: 0, w: x1 - x0, h: this.layouts[0]!.top }; }
    const place = parts[2] as Place;
    if (!this.places.includes(place)) throw new Error(`blocks: "${target}": the chart has no ${place} place.`);
    if (parts.length === 3) { const b = this.pileAt(place, t); if (!b) throw new Error(`blocks: "${target}" is an empty pile at that moment; there is nothing to point at.`); return b; }
    const id = parts.slice(0, 4).join(".");
    const piece = this.piece(id);
    const box = this.positionAt(id, t);
    if (!piece || !box) throw new Error(`blocks: "${id}" does not exist at that moment (the ${place} pile holds ${this.countAt(place, t)}).`);
    return parts.length === 4 ? box : subBox(piece.kind, box, parts.slice(4).join("."));
  }
}
