/**
 * The board's table and the picture of its shares.
 *
 * A `table` is cells in rows and columns: a header row (row 0), a label
 * column (column 0) and the body. A `mosaic` is a rectangle that stands for
 * everyone, sliced into slabs proportional to the groups (the rows or the
 * columns of a table), each slab colored along the other axis by the share of
 * that group in some event. Independence is one straight colored edge.
 *
 * "Given" restricts the picture to one group: everything outside that row,
 * column or slab dims. Everything here is pure geometry and pure functions of
 * time, in the figure's own units (y up); the stage maps them to pixels.
 */
export type Pt = [number, number];
/** Bottom-left corner and size, in figure units, y up (the same box as `blocks`). */
export type Box = { x: number; y: number; w: number; h: number };

// ------------------------------------------------------------------ table
export type TableSpec = {
  /** Top-left corner of the table. */
  at: Pt;
  /** Body columns (the header row has one cell over each). */
  cols: number;
  /** Body rows (each with a label cell). */
  rows: number;
  /** One body cell: width and height. */
  cell: [number, number];
  /** The label column's width; the body cell's width when omitted. */
  labelW?: number;
};

/** The box of cell (r, c): row 0 is the header row, column 0 the label column. */
export function tableCell(s: TableSpec, r: number, c: number): Box {
  if (r < 0 || r > s.rows || c < 0 || c > s.cols) throw new Error(`table: there is no cell (${r}, ${c}); rows run 0..${s.rows} and columns 0..${s.cols}.`);
  const [cw, ch] = s.cell, lw = s.labelW ?? cw;
  const x = s.at[0] + (c === 0 ? 0 : lw + (c - 1) * cw);
  const top = s.at[1] - r * ch;
  return { x, y: top - ch, w: c === 0 ? lw : cw, h: ch };
}

/** The whole table. */
export function tableBox(s: TableSpec): Box {
  const [cw, ch] = s.cell, lw = s.labelW ?? cw;
  const w = lw + s.cols * cw, h = (s.rows + 1) * ch;
  return { x: s.at[0], y: s.at[1] - h, w, h };
}

/** The region a restriction names: a row (its label and every cell) or a column (its header and every cell). */
export function tableRegion(s: TableSpec, target: string): Box {
  const m = target.match(/^(row|col)\.(\d+)$/);
  if (!m) throw new Error(`table: "${target}" is not a row or a column (row.1, col.2).`);
  const k = Number(m[2]);
  if (m[1] === "row") {
    const a = tableCell(s, k, 0), b = tableCell(s, k, s.cols);
    return { x: a.x, y: a.y, w: b.x + b.w - a.x, h: a.h };
  }
  const a = tableCell(s, 0, k), b = tableCell(s, s.rows, k);
  return { x: a.x, y: b.y, w: a.w, h: a.y + a.h - b.y };
}

/** Is cell (r, c) inside the region "row.k" or "col.k"? */
export function inRegion(target: string, r: number, c: number): boolean {
  const m = target.match(/^(row|col)\.(\d+)$/);
  if (!m) return false;
  return m[1] === "row" ? r === Number(m[2]) : c === Number(m[2]);
}

const mid = (b: Box): Pt => [b.x + b.w / 2, b.y + b.h / 2];
/**
 * A named point of a table, for labels and arrows beside it:
 * `cell:r,c` the middle of a cell; `left:r` / `right:r` the middle of a row's
 * outer edge; `top:c` / `bottom:c` the middle of a column's outer edge.
 */
export function tableAnchor(s: TableSpec, name: string): Pt {
  const box = tableBox(s);
  let m = name.match(/^cell:(\d+),(\d+)$/);
  if (m) return mid(tableCell(s, Number(m[1]), Number(m[2])));
  m = name.match(/^(left|right):(\d+)$/);
  if (m) {
    const b = tableCell(s, Number(m[2]), 0);
    return [m[1] === "left" ? box.x : box.x + box.w, b.y + b.h / 2];
  }
  m = name.match(/^(top|bottom):(\d+)$/);
  if (m) {
    const b = tableCell(s, 0, Number(m[2]));
    return [b.x + b.w / 2, m[1] === "top" ? box.y + box.h : box.y];
  }
  throw new Error(`table: no anchor "${name}" (cell:r,c; left:r; right:r; top:c; bottom:c).`);
}

// ------------------------------------------------------------------ mosaic
export type Group = { n: number; k: number };
export type MosaicSpec = {
  /** Top-left corner. */
  at: Pt;
  w: number;
  h: number;
  /** `rows`: horizontal slabs stacked from the top, colored from the left. `cols`: vertical slabs from the left, colored from the top. */
  slice: "rows" | "cols";
  /** Each group's size `n` and how many of them, `k`, are in the event that colors the slab. */
  groups: Group[];
};

export function checkGroups(groups: Group[]) {
  if (!groups.length) throw new Error("mosaic: give at least one group.");
  for (const [i, g] of groups.entries()) {
    if (!(g.n > 0)) throw new Error(`mosaic: group ${i + 1} has n = ${g.n}; a group has at least one member.`);
    if (g.k < 0 || g.k > g.n) throw new Error(`mosaic: group ${i + 1} has k = ${g.k} of n = ${g.n}; k runs from 0 to n.`);
  }
}

const total = (s: MosaicSpec) => s.groups.reduce((a, g) => a + g.n, 0);

/** Slab i (from 1): its share of the rectangle is the group's share of everyone. */
export function slabBox(s: MosaicSpec, i: number): Box {
  if (i < 1 || i > s.groups.length) throw new Error(`mosaic: there is no slab ${i}; slabs run 1..${s.groups.length}.`);
  const N = total(s);
  const before = s.groups.slice(0, i - 1).reduce((a, g) => a + g.n, 0) / N;
  const size = s.groups[i - 1]!.n / N;
  if (s.slice === "rows") return { x: s.at[0], y: s.at[1] - (before + size) * s.h, w: s.w, h: size * s.h };
  return { x: s.at[0] + before * s.w, y: s.at[1] - s.h, w: size * s.w, h: s.h };
}

/** The colored part of slab i: the share k/n of its length, from the left (rows) or the top (cols). */
export function partBox(s: MosaicSpec, i: number): Box {
  const b = slabBox(s, i), g = s.groups[i - 1]!, f = g.k / g.n;
  if (s.slice === "rows") return { x: b.x, y: b.y, w: b.w * f, h: b.h };
  return { x: b.x, y: b.y + b.h * (1 - f), w: b.w, h: b.h * f };
}

/** What is left of slab i after its colored part. */
export function restBox(s: MosaicSpec, i: number): Box {
  const b = slabBox(s, i), p = partBox(s, i);
  if (s.slice === "rows") return { x: p.x + p.w, y: b.y, w: b.w - p.w, h: b.h };
  return { x: b.x, y: b.y, w: b.w, h: b.h - p.h };
}

/** Everyone's share of the event: all the k over all the n. */
export function overallShare(s: MosaicSpec): number {
  return s.groups.reduce((a, g) => a + g.k, 0) / total(s);
}

/** The dashed guide at everyone's share, across the whole rectangle. With one straight colored edge, every slab's edge lies on it. */
export function guideLine(s: MosaicSpec): [Pt, Pt] {
  const f = overallShare(s);
  if (s.slice === "rows") {
    const x = s.at[0] + s.w * f;
    return [[x, s.at[1]], [x, s.at[1] - s.h]];
  }
  const y = s.at[1] - s.h * f;
  return [[s.at[0], y], [s.at[0] + s.w, y]];
}

/** True when every slab has the same share: the colored edge is one straight line. */
export function isStraight(s: MosaicSpec, tol = 1e-9): boolean {
  const f = overallShare(s);
  return s.groups.every((g) => Math.abs(g.k / g.n - f) <= tol);
}

/**
 * A named point of a mosaic: `slab:i`, `part:i`, `rest:i` (middles);
 * `left:i`, `right:i`, `top:i`, `bottom:i` (the middle of that edge of slab i);
 * `edge:i` (the middle of slab i's colored edge); `guide:start`, `guide:end`.
 */
export function mosaicAnchor(s: MosaicSpec, name: string): Pt {
  let m = name.match(/^(slab|part|rest):(\d+)$/);
  if (m) {
    const i = Number(m[2]);
    return mid(m[1] === "slab" ? slabBox(s, i) : m[1] === "part" ? partBox(s, i) : restBox(s, i));
  }
  m = name.match(/^(left|right|top|bottom):(\d+)$/);
  if (m) {
    const b = slabBox(s, Number(m[2]));
    return m[1] === "left" ? [b.x, b.y + b.h / 2] : m[1] === "right" ? [b.x + b.w, b.y + b.h / 2] : m[1] === "top" ? [b.x + b.w / 2, b.y + b.h] : [b.x + b.w / 2, b.y];
  }
  m = name.match(/^edge:(\d+)$/);
  if (m) {
    const p = partBox(s, Number(m[1]));
    return s.slice === "rows" ? [p.x + p.w, p.y + p.h / 2] : [p.x + p.w / 2, p.y];
  }
  m = name.match(/^guide:(start|end)$/);
  if (m) return guideLine(s)[m[1] === "start" ? 0 : 1];
  throw new Error(`mosaic: no anchor "${name}" (slab:i; part:i; rest:i; left:i; right:i; top:i; bottom:i; edge:i; guide:start; guide:end).`);
}

// ------------------------------------------------------------------ given
/** One "given": from t0, over dur seconds, the picture restricts to `target` (a row, column or slab), or to nothing again (null). */
export type Given = { t0: number; dur: number; target: string | null };
/** How dim the rest of the picture goes while one group is given. */
export const DIM = 0.22;
/** Context that stays legible (a table's header row while a row is given). */
export const CONTEXT = 0.55;

/**
 * The visibility factor at time t of something whose `level(target)` says how
 * bright it is under each restriction (1 inside the group, DIM outside,
 * CONTEXT for headers), eased between the last restriction and the current one.
 */
export function restriction(givens: Given[], t: number, level: (target: string) => number, ease: (u: number) => number): number {
  let prev = 1, cur = 1, u = 1;
  for (const g of [...givens].sort((a, b) => a.t0 - b.t0)) {
    if (t < g.t0) break;
    prev = cur;
    cur = g.target === null ? 1 : level(g.target);
    u = ease((t - g.t0) / g.dur);
  }
  return prev + (cur - prev) * u;
}

/** How strongly the band around `target` shows at time t: in as it becomes the given group, out as another takes over or it is released. */
export function bandOpacity(givens: Given[], t: number, target: string, ease: (u: number) => number): number {
  let prev: string | null = null, cur: string | null = null, u = 1;
  for (const g of [...givens].sort((a, b) => a.t0 - b.t0)) {
    if (t < g.t0) break;
    prev = cur;
    cur = g.target;
    u = ease((t - g.t0) / g.dur);
  }
  const was = prev === target ? 1 : 0, is = cur === target ? 1 : 0;
  return was + (is - was) * u;
}

/** A label fits its cell when its box is inside the cell, less a little padding (type carries its own leading, so less above and below). */
export function fits(textW: number, textH: number, cellW: number, cellH: number, padX = 10, padY = 4): boolean {
  return textW + 2 * padX <= cellW && textH + 2 * padY <= cellH;
}
