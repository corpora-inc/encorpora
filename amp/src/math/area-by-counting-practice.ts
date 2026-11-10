import { createHash } from "node:crypto";
import { count } from "./agreement";
import type {
  GeneratedProblem,
  ProblemVariant,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import { CARD, problemOf, type Candidate } from "./figure-choice-practice";
import { scene } from "./scene/author";
import type { Element, PathOp, Scene } from "./scene/spec";
import { storyName, storyNameSet } from "./story-kit/names";
import type { UnitSquareMarkingResponse } from "./unit-square-marking";

/**
 * Area by counting unit squares (3.MD.C.6, with the gaps-and-overlaps edge
 * of 3.MD.C.5): a shaded figure on a unit grid in square centimeters, inches,
 * feet or meters, and real surfaces covered by improvised square units
 * (sticky notes, floor tiles, cards, napkins, crackers). No side lengths are
 * labeled: the area is always found from the figure by counting.
 *
 * Every figure is built from scene primitives. A shaded figure is one path of
 * unit cells (`cells`), the unit grid of its bounding box (`grid`) and its
 * heavier boundary (`outline`); a covered surface is its outline (`surface`)
 * with one path of tiles (`tiles`) and, for an overlapping covering, the
 * extra tiles laid on top (`extra`).
 */

const SKILL = "area-by-counting-squares";
const band = "3–5" as const;
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const senses = {
  glossarySenses: {
    square: "square-shape",
    squares: "square-shape",
    unit: "unit",
    units: "unit",
    side: "side",
    sides: "side",
    "more than": "more-than",
  },
  // Ordinary words here: part of a mat, the whole hallway, a hole in a
  // shape, the edge of a patio, a covering that leaves a gap.
  glossaryNoLink: [
    "part",
    "parts",
    "whole",
    "hole",
    "holes",
    "edge",
    "change",
    "changes",
    "leaves",
  ],
};

export const areaByCountingTemplates: readonly TemplateMetadata[] = [
  {
    id: "mark-unit-squares",
    version: 1,
    title: "Mark unit squares as you count",
    skillId: SKILL,
    gradeBand: band,
    description:
      "Count shaded unit squares in rectangles, joined shapes, irregular shapes and shapes with holes. Optional tap marks track the count; enter the area in square units.",
    requiredResponseCapability: "unit-square-marking-v1",
    ...scenes,
    ...senses,
  },
  {
    id: "mark-improvised-units",
    version: 1,
    title: "Mark square units as you count",
    skillId: SKILL,
    gradeBand: band,
    description:
      "Measure a surface covered by square sticky notes, tiles, cards, napkins or crackers. Optional tap marks track the count; enter the area in those units.",
    requiredResponseCapability: "unit-square-marking-v1",
    ...scenes,
    ...senses,
  },
  {
    id: "count-unit-squares",
    version: 1,
    title: "Count unit squares to find area",
    skillId: SKILL,
    gradeBand: band,
    description:
      "Find the area of a shaded figure on a unit grid by counting its unit squares: a rectangle, an L-shaped, T-shaped, U-shaped, plus-shaped or staircase figure, an irregular shape, or a shape with a hole. The unit is a square centimeter, inch, foot or meter, and no side lengths are labeled.",
    ...scenes,
    ...senses,
  },
  {
    id: "unit-square-area-statement",
    version: 1,
    title: "Choose the true area statement",
    skillId: SKILL,
    gradeBand: band,
    description:
      "Choose the true statement of a shaded figure's area, in square units. The wrong statements use a length unit, count the whole box around the figure, or count only the squares along its edge.",
    requiredResponseCapability: "single-choice-v1",
    ...scenes,
    ...senses,
  },
  {
    id: "improvised-unit-count",
    version: 1,
    title: "Area in sticky notes, tiles or cards",
    skillId: SKILL,
    gradeBand: band,
    description:
      "Find the area of a desk top, floor, tray or other surface covered with no gaps or overlaps by an improvised square unit, such as sticky notes, floor tiles, cards, napkins or crackers.",
    ...scenes,
    ...senses,
  },
  {
    id: "improvised-unit-covering",
    version: 1,
    title: "Which covering measures the area",
    skillId: SKILL,
    gradeBand: band,
    description:
      "Three pictures cover the same surface with square units. Choose the one whose count is the area: one leaves gaps, and one has units lying on top of others.",
    requiredResponseCapability: "figure-choice-v1",
    ...scenes,
    ...senses,
  },
  {
    id: "improvised-unit-change",
    version: 1,
    title: "Smaller unit, more units",
    skillId: SKILL,
    gradeBand: band,
    description:
      "A surface is measured with one square unit, then with a unit whose sides are half or twice as long. Decide whether the new count is more, fewer or the same.",
    requiredResponseCapability: "single-choice-v1",
    ...scenes,
    ...senses,
  },
];
const metaOf = (id: string) =>
  areaByCountingTemplates.find((t) => t.id === id)!;

/* ---------------------------------------------------------- cell shapes */

/** A unit cell: column from the left, row from the top. */
export type Cell = readonly [number, number];
const keyOf = (c: number, r: number) => `${c},${r}`;
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;

/** Shift to the origin, drop repeats, sort by row then column. */
export function normalize(cells: readonly Cell[]): Cell[] {
  const c0 = Math.min(...cells.map((c) => c[0]));
  const r0 = Math.min(...cells.map((c) => c[1]));
  const seen = new Map<string, Cell>();
  for (const [c, r] of cells) seen.set(keyOf(c - c0, r - r0), [c - c0, r - r0]);
  return [...seen.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
export const boxOf = (cells: readonly Cell[]) => ({
  cols: Math.max(...cells.map((c) => c[0])) + 1,
  rows: Math.max(...cells.map((c) => c[1])) + 1,
});
const setOf = (cells: readonly Cell[]) =>
  new Set(cells.map(([c, r]) => keyOf(c, r)));
export const canon = (cells: readonly Cell[]) =>
  normalize(cells)
    .map(([c, r]) => keyOf(c, r))
    .join(";");
const NEIGHBORS: readonly Cell[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function connected(cells: readonly Cell[]): boolean {
  if (!cells.length) return false;
  const all = setOf(cells);
  const seen = new Set([keyOf(...cells[0]!)]);
  const stack: Cell[] = [cells[0]!];
  while (stack.length) {
    const [c, r] = stack.pop()!;
    for (const [dc, dr] of NEIGHBORS) {
      const k = keyOf(c + dc, r + dr);
      if (all.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push([c + dc, r + dr]);
      }
    }
  }
  return seen.size === all.size;
}
/** Empty cells of the bounding box that cannot reach the outside. */
export function holesOf(cells: readonly Cell[]): Cell[] {
  const { cols, rows } = boxOf(cells);
  const all = setOf(cells);
  const outside = new Set<string>();
  const stack: Cell[] = [[-1, -1]];
  outside.add(keyOf(-1, -1));
  while (stack.length) {
    const [c, r] = stack.pop()!;
    for (const [dc, dr] of NEIGHBORS) {
      const nc = c + dc,
        nr = r + dr;
      const k = keyOf(nc, nr);
      if (nc < -1 || nr < -1 || nc > cols || nr > rows) continue;
      if (all.has(k) || outside.has(k)) continue;
      outside.add(k);
      stack.push([nc, nr]);
    }
  }
  const holes: Cell[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (!all.has(keyOf(c, r)) && !outside.has(keyOf(c, r)))
        holes.push([c, r]);
  return holes;
}
export const isRectangle = (cells: readonly Cell[]) => {
  const { cols, rows } = boxOf(cells);
  return cells.length === cols * rows;
};
/** Shaded squares in each row of the bounding box, top row first. */
export function rowCounts(cells: readonly Cell[]): number[] {
  const { rows } = boxOf(cells);
  const out = Array.from({ length: rows }, () => 0);
  for (const [, r] of cells) out[r]!++;
  return out;
}
/** Shaded squares with a side on the figure's edge (next to an unshaded
 * square or the outside). */
export function borderCount(cells: readonly Cell[]): number {
  const all = setOf(cells);
  return cells.filter(([c, r]) =>
    NEIGHBORS.some(([dc, dr]) => !all.has(keyOf(c + dc, r + dr))),
  ).length;
}
/** The longest straight run of squares one square thick: squares with no
 * shaded neighbor across the run. A long thin stalk is hard to read on a
 * phone. */
function longestStalk(cells: readonly Cell[]): number {
  const all = setOf(cells);
  const has = (c: number, r: number) => all.has(keyOf(c, r));
  let best = 0;
  const { cols, rows } = boxOf(cells);
  for (let r = 0; r < rows; r++) {
    let run = 0;
    for (let c = 0; c <= cols; c++) {
      const thin = has(c, r) && !has(c, r - 1) && !has(c, r + 1);
      run = thin ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  for (let c = 0; c < cols; c++) {
    let run = 0;
    for (let r = 0; r <= rows; r++) {
      const thin = has(c, r) && !has(c - 1, r) && !has(c + 1, r);
      run = thin ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  return best;
}
/** Turn a quarter turn `turns` times, then mirror left to right. */
export function orient(
  cells: readonly Cell[],
  turns: number,
  mirror: boolean,
): Cell[] {
  let out: Cell[] = [...cells];
  for (let i = 0; i < turns % 4; i++) out = out.map(([c, r]) => [-r, c]);
  if (mirror) out = out.map(([c, r]) => [-c, r]);
  return normalize(out);
}
const block = (c0: number, r0: number, w: number, h: number): Cell[] => {
  const out: Cell[] = [];
  for (let r = r0; r < r0 + h; r++)
    for (let c = c0; c < c0 + w; c++) out.push([c, r]);
  return out;
};
const without = (cells: readonly Cell[], gone: readonly Cell[]) => {
  const drop = setOf(gone);
  return cells.filter(([c, r]) => !drop.has(keyOf(c, r)));
};

/** The composite shapes of variant B, by kind, before turning. */
export type CompositeKind = "l" | "t" | "u" | "plus" | "stairs";
const COMPOSITES: Record<CompositeKind, () => Cell[][]> = {
  // A rectangle with one corner block cut away.
  l: () => {
    const out: Cell[][] = [];
    for (let W = 3; W <= 7; W++)
      for (let H = 3; H <= 6; H++)
        for (let a = 1; a < W; a++)
          for (let b = 1; b < H; b++)
            out.push(without(block(0, 0, W, H), block(W - a, 0, a, b)));
    return out;
  },
  // A bar on top of a centered stem.
  t: () => {
    const out: Cell[][] = [];
    for (let W = 3; W <= 7; W++)
      for (let t = 1; t <= 2; t++)
        for (let s = 1; s <= W - 2; s++)
          for (let h = 1; t + h <= 6; h++)
            if ((W - s) % 2 === 0)
              out.push([...block(0, 0, W, t), ...block((W - s) / 2, t, s, h)]);
    return out;
  },
  // A rectangle with a notch cut down from its top edge, an arm on each side.
  u: () => {
    const out: Cell[][] = [];
    for (let W = 3; W <= 7; W++)
      for (let H = 2; H <= 6; H++)
        for (let n = 1; n <= W - 2; n++)
          for (let d = 1; d < H; d++)
            for (let o = 1; o + n <= W - 1; o++)
              out.push(without(block(0, 0, W, H), block(o, 0, n, d)));
    return out;
  },
  // Two centered bars crossing, with an arm on every side.
  plus: () => {
    const out: Cell[][] = [];
    for (let W = 3; W <= 7; W++)
      for (let H = 3; H <= 6; H++)
        for (let v = 1; v <= W - 2; v++)
          for (let g = 1; g <= H - 2; g++)
            if ((W - v) % 2 === 0 && (H - g) % 2 === 0)
              out.push([
                ...block((W - v) / 2, 0, v, H),
                ...block(0, (H - g) / 2, W, g),
              ]);
    return out;
  },
  // Columns that rise one step at a time.
  stairs: () => {
    const out: Cell[][] = [];
    for (let k = 3; k <= 5; k++)
      for (let sw = 1; sw <= 2; sw++)
        for (let sh = 1; sh <= 2; sh++) {
          if (k * sw > 7 || k * sh > 6) continue;
          const cells: Cell[] = [];
          for (let i = 0; i < k; i++)
            cells.push(...block(i * sw, (k - 1 - i) * sh, sw, (i + 1) * sh));
          out.push(cells);
        }
    return out;
  },
};
const COMPOSITE_KINDS = Object.keys(COMPOSITES) as CompositeKind[];
const fits = (cells: readonly Cell[], cols: number, rows: number) => {
  const box = boxOf(cells);
  return box.cols <= cols && box.rows <= rows;
};
/** Every composite of variant B in every orientation that fits the 7 × 6
 * grid, with an area from 8 to 30. Built once. */
let compositeShapes: Map<CompositeKind, Cell[][]> | undefined;
function compositeLibrary() {
  if (compositeShapes) return compositeShapes;
  compositeShapes = new Map();
  for (const kind of COMPOSITE_KINDS) {
    const seen = new Map<string, Cell[]>();
    for (const base of COMPOSITES[kind]())
      for (let turns = 0; turns < 4; turns++)
        for (const mirror of [false, true]) {
          const cells = orient(base, turns, mirror);
          if (
            cells.length >= 8 &&
            cells.length <= 30 &&
            fits(cells, 7, 6) &&
            !isRectangle(cells) &&
            connected(cells)
          )
            seen.set(canon(cells), cells);
        }
    compositeShapes.set(
      kind,
      [...seen.entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([, c]) => c),
    );
  }
  return compositeShapes;
}
let compositeKeys: Set<string> | undefined;
const isComposite = (cells: readonly Cell[]) => {
  compositeKeys ??= new Set(
    [...compositeLibrary().values()].flat().map((cells) => canon(cells)),
  );
  return compositeKeys.has(canon(cells));
};

function rectangleShape(r: Random): Cell[] {
  for (;;) {
    const w = r(2, 6),
      h = r(2, 6);
    if (w === h && (w < 3 || w > 5)) continue;
    if (w * h < 6 || w * h > 30) continue;
    return block(0, 0, w, h);
  }
}
function compositeShape(r: Random): { kind: CompositeKind; cells: Cell[] } {
  const kind = pick(r, COMPOSITE_KINDS);
  return { kind, cells: pick(r, compositeLibrary().get(kind)!) };
}
/** Variant C: grown one random edge-neighbor at a time inside a 6 × 5 box. */
function polyominoShape(r: Random): Cell[] {
  for (;;) {
    const target = r(6, 20);
    const start: Cell = [r(0, 5), r(0, 4)];
    const cells: Cell[] = [start];
    const all = setOf(cells);
    while (cells.length < target) {
      const frontier: Cell[] = [];
      const seen = new Set<string>();
      for (const [c, r0] of cells)
        for (const [dc, dr] of NEIGHBORS) {
          const nc = c + dc,
            nr = r0 + dr;
          const k = keyOf(nc, nr);
          if (nc < 0 || nr < 0 || nc > 5 || nr > 4) continue;
          if (all.has(k) || seen.has(k)) continue;
          seen.add(k);
          frontier.push([nc, nr]);
        }
      frontier.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      const next = pick(r, frontier);
      cells.push(next);
      all.add(keyOf(...next));
    }
    const shape = normalize(cells);
    const box = boxOf(shape);
    if (box.cols < 2 || box.rows < 2) continue;
    if (isRectangle(shape) || holesOf(shape).length) continue;
    if (longestStalk(shape) > 2 || isComposite(shape)) continue;
    return shape;
  }
}
/** Variant D: a rectangle or composite at least 4 × 4 with one or two
 * interior squares left unshaded. */
function holeShape(r: Random): { base: string; cells: Cell[]; holes: Cell[] } {
  for (;;) {
    const fromRectangle = r(0, 2) === 0;
    let base: Cell[];
    let name: string;
    if (fromRectangle) {
      const w = r(4, 6),
        h = r(4, 6);
      base = block(0, 0, w, h);
      name = "rectangle";
    } else {
      const made = compositeShape(r);
      base = made.cells;
      name = made.kind;
    }
    const box = boxOf(base);
    if (box.cols < 4 || box.rows < 4) continue;
    const all = setOf(base);
    const interior = base.filter(([c, r0]) =>
      NEIGHBORS.every(([dc, dr]) => all.has(keyOf(c + dc, r0 + dr))),
    );
    if (!interior.length) continue;
    const want = interior.length >= 2 && r(0, 1) === 1 ? 2 : 1;
    const holes = shuffle(r, [...interior]).slice(0, want);
    if (
      want === 2 &&
      Math.abs(holes[0]![0] - holes[1]![0]) +
        Math.abs(holes[0]![1] - holes[1]![1]) <
        2
    )
      continue;
    const cells = without(base, holes);
    if (cells.length < 10 || cells.length > 30 || !connected(cells)) continue;
    if (holesOf(cells).length !== holes.length) continue;
    return { base: name, cells, holes: normalizeLike(holes, base) };
  }
}
/** The holes in the same coordinates as their normalized figure. */
function normalizeLike(holes: readonly Cell[], base: readonly Cell[]) {
  const c0 = Math.min(...base.map((c) => c[0]));
  const r0 = Math.min(...base.map((c) => c[1]));
  return holes.map(([c, r]) => [c - c0, r - r0] as Cell);
}

/* ------------------------------------------------------------- drawing */

const square = (x: number, y: number, s: number): PathOp[] => [
  ["M", x, y],
  ["L", x + s, y],
  ["L", x + s, y + s],
  ["L", x, y + s],
  ["Z"],
];
/** Boundary loops of a cell set, in math coordinates (y up) for a box of
 * `rows` rows, traced with the figure on the left. */
export function boundaryLoops(
  cells: readonly Cell[],
  rows: number,
): [number, number][][] {
  const all = setOf(cells);
  const has = (c: number, r: number) => all.has(keyOf(c, r));
  type Edge = { from: [number, number]; to: [number, number]; used: boolean };
  const edges: Edge[] = [];
  for (const [c, r] of cells) {
    const x = c,
      y = rows - 1 - r;
    if (!has(c, r + 1))
      edges.push({ from: [x, y], to: [x + 1, y], used: false });
    if (!has(c + 1, r))
      edges.push({ from: [x + 1, y], to: [x + 1, y + 1], used: false });
    if (!has(c, r - 1))
      edges.push({ from: [x + 1, y + 1], to: [x, y + 1], used: false });
    if (!has(c - 1, r))
      edges.push({ from: [x, y + 1], to: [x, y], used: false });
  }
  const at = new Map<string, Edge[]>();
  for (const e of edges) {
    const k = keyOf(...e.from);
    at.set(k, [...(at.get(k) ?? []), e]);
  }
  const loops: [number, number][][] = [];
  for (const first of edges) {
    if (first.used) continue;
    first.used = true;
    const loop: [number, number][] = [first.from];
    let e = first;
    for (;;) {
      const options = (at.get(keyOf(...e.to)) ?? []).filter((x) => !x.used);
      if (!options.length) break;
      // At a pinch point, turn left first so the loop keeps the figure on its left.
      const dx = e.to[0] - e.from[0],
        dy = e.to[1] - e.from[1];
      const turn = (x: Edge) => {
        const ex = x.to[0] - x.from[0],
          ey = x.to[1] - x.from[1];
        return dx * ey - dy * ex;
      };
      options.sort((a, b) => turn(b) - turn(a));
      const next = options[0]!;
      next.used = true;
      loop.push(e.to);
      e = next;
    }
    // Keep only the corners.
    const corners = loop.filter((p, i) => {
      const a = loop[(i + loop.length - 1) % loop.length]!,
        b = loop[(i + 1) % loop.length]!;
      return (
        (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0
      );
    });
    loops.push(corners);
  }
  return loops;
}
const loopPath = (loops: readonly [number, number][][]): PathOp[] =>
  loops.flatMap((loop) => [
    ["M", loop[0]![0], loop[0]![1]] as PathOp,
    ...loop.slice(1).map((p) => ["L", p[0], p[1]] as PathOp),
    ["Z"] as PathOp,
  ]);

/** A shaded figure on the unit grid of its box, with a legend square. */
function gridFigure(
  cells: readonly Cell[],
  unitOne: string,
  title: string,
  holes: number,
): Scene {
  const { cols, rows } = boxOf(cells);
  const lines: PathOp[] = [];
  for (let c = 0; c <= cols; c++) lines.push(["M", c, 0], ["L", c, rows]);
  for (let r = 0; r <= rows; r++) lines.push(["M", 0, r], ["L", cols, r]);
  const counts = rowCounts(cells);
  const elements: Element[] = [
    {
      type: "path",
      id: "cells",
      d: cells.flatMap(([c, r]) => square(c, rows - 1 - r, 1)),
      fill: "accent-fill",
      stroke: "grid",
      width: 1,
    },
    {
      type: "path",
      id: "grid",
      d: lines,
      fill: "none",
      stroke: "grid",
      width: 1,
    },
    {
      type: "path",
      id: "outline",
      d: loopPath(boundaryLoops(cells, rows)),
      fill: "none",
      stroke: "ink",
      width: 3,
    },
    {
      type: "rect",
      id: "legend",
      at: [0, -1.7],
      size: [1, 1],
      fill: "accent-fill",
      stroke: "ink",
      width: 1.5,
    },
    {
      type: "text",
      id: "legendLabel",
      at: [1.3, -1.2],
      text: `= 1 ${unitOne}`,
      align: [-1, 0],
      size: "sm",
    },
  ];
  return scene(...elements).build({
    title,
    note: `Shaded squares in each row, from the top: ${counts.join(", ")}.${
      holes
        ? ` ${holes === 1 ? "One unshaded square sits" : "Two unshaded squares sit"} inside the shape.`
        : ""
    }`,
    width: 360,
    maxHeight: 320,
  });
}

/* ------------------------------------------------------- improvised units */

export type TileKind = "sticky" | "tile" | "card" | "napkin" | "cracker";
const TILE: Record<
  TileKind,
  {
    one: string;
    many: string;
    fill: "gold-fill" | "accent-fill" | "warm-fill";
    ink: "gold" | "accent" | "warm";
  }
> = {
  sticky: {
    one: "sticky note",
    many: "sticky notes",
    fill: "gold-fill",
    ink: "gold",
  },
  tile: {
    one: "square tile",
    many: "square tiles",
    fill: "accent-fill",
    ink: "accent",
  },
  card: {
    one: "square card",
    many: "square cards",
    fill: "warm-fill",
    ink: "warm",
  },
  napkin: {
    one: "square napkin",
    many: "square napkins",
    fill: "accent-fill",
    ink: "accent",
  },
  cracker: {
    one: "square cracker",
    many: "square crackers",
    fill: "gold-fill",
    ink: "gold",
  },
};
/** Surfaces each unit could cover; `bent` surfaces may be L- or T-shaped. */
const SURFACES: Record<
  TileKind,
  { name: string; bent?: true; max: [number, number] }[]
> = {
  sticky: [
    { name: "desk top", bent: true, max: [7, 5] },
    { name: "locker door", max: [4, 5] },
    { name: "book cover", max: [4, 5] },
    { name: "bulletin board", max: [7, 5] },
  ],
  tile: [
    { name: "hallway", bent: true, max: [7, 5] },
    { name: "bathroom floor", bent: true, max: [7, 5] },
    { name: "play mat", max: [6, 5] },
    { name: "tabletop", bent: true, max: [7, 5] },
  ],
  card: [
    { name: "tray", max: [6, 4] },
    { name: "shelf", max: [7, 3] },
    { name: "poster", max: [5, 5] },
  ],
  napkin: [
    { name: "picnic table", max: [7, 4] },
    { name: "blanket", max: [6, 5] },
  ],
  cracker: [
    { name: "plate", max: [4, 4] },
    { name: "lunch tray", max: [6, 4] },
  ],
};
const TILE_KINDS = Object.keys(TILE) as TileKind[];
const INSET = 0.06;

/** One unit's glyph at lower-left (x, y), side s: fill and its marks. */
function glyph(kind: TileKind, x: number, y: number, s: number) {
  const a = x + INSET * s,
    b = y + INSET * s,
    side = s * (1 - 2 * INSET);
  const body = square(a, b, side);
  const marks: PathOp[] = [];
  if (kind === "sticky") {
    // A folded top-right corner.
    const f = 0.28 * s;
    marks.push(
      ["M", a + side - f, b + side],
      ["L", a + side, b + side - f],
      ["L", a + side - f, b + side - f],
      ["Z"],
    );
  } else if (kind === "card") {
    marks.push(
      ["M", a + 0.12 * s, b + 0.72 * s],
      ["L", a + side - 0.12 * s, b + 0.72 * s],
    );
  } else if (kind === "napkin") {
    marks.push(["M", a, b], ["L", a + side, b + side]);
  } else if (kind === "cracker")
    for (const [u, v] of [
      [0.28, 0.28],
      [0.58, 0.28],
      [0.28, 0.58],
      [0.58, 0.58],
    ] as const)
      marks.push(...square(a + u * s, b + v * s, 0.08 * s));
  return { body, marks };
}
function tilePaths(
  kind: TileKind,
  spots: readonly { x: number; y: number; s: number }[],
  id: string,
  opacity?: number,
): Element[] {
  if (!spots.length) return [];
  const t = TILE[kind];
  const parts = spots.map((p) => glyph(kind, p.x, p.y, p.s));
  const out: Element[] = [
    {
      type: "path",
      id,
      d: parts.flatMap((p) => p.body),
      fill: t.fill,
      stroke: t.ink,
      width: 1.2,
      ...(opacity === undefined ? {} : { opacity }),
    },
  ];
  const marks = parts.flatMap((p) => p.marks);
  if (marks.length)
    out.push(
      kind === "sticky" || kind === "cracker"
        ? {
            type: "path",
            id: `${id}Marks`,
            d: marks,
            fill: t.ink,
            stroke: t.ink,
            width: 1,
          }
        : {
            type: "path",
            id: `${id}Marks`,
            d: marks,
            fill: "none",
            stroke: t.ink,
            width: 1,
          },
    );
  return out;
}
/** A surface outline with its covering. */
function surfaceElements(
  surface: readonly Cell[],
  kind: TileKind,
  tiles: readonly Cell[],
  extra: readonly { x: number; y: number }[] = [],
): Element[] {
  const { rows } = boxOf(surface);
  const loops = loopPath(boundaryLoops(surface, rows));
  return [
    {
      type: "path",
      id: "surface",
      d: loops,
      fill: "empty",
      stroke: "ink",
      width: 2.5,
    },
    ...tilePaths(
      kind,
      tiles.map(([c, r]) => ({ x: c, y: rows - 1 - r, s: 1 })),
      "tiles",
    ),
    ...tilePaths(
      kind,
      extra.map((p) => ({ ...p, s: 1 })),
      "extra",
      0.7,
    ),
    {
      type: "path",
      id: "edge",
      d: loops,
      fill: "none",
      stroke: "ink",
      width: 2.5,
    },
  ];
}
function surfaceShape(
  r: Random,
  spec: { bent?: true; max: [number, number] },
  min: number,
  max: number,
  bends: readonly ("l" | "t")[] = ["l", "t"],
): { cells: Cell[]; shape: string } {
  for (;;) {
    const [mc, mr] = spec.max;
    if (spec.bent && r(0, 2) > 0) {
      const kind = pick(r, bends);
      const options = compositeLibrary()
        .get(kind)!
        .filter((c) => fits(c, mc, mr) && c.length >= min && c.length <= max);
      if (!options.length) continue;
      return {
        cells: pick(r, options),
        shape: kind === "l" ? "l-shape" : "t-shape",
      };
    }
    const w = r(2, Math.min(6, mc)),
      h = r(2, mr);
    if (w * h < min || w * h > max) continue;
    return { cells: block(0, 0, w, h), shape: "rectangle" };
  }
}

/* ------------------------------------------------------------- contexts */

type Unit = {
  key: "cm" | "in" | "ft" | "m";
  one: string;
  many: string;
  length: string;
  contexts: { noun: string; owned: boolean }[];
};
export const UNITS: readonly Unit[] = [
  {
    key: "cm",
    one: "square centimeter",
    many: "square centimeters",
    length: "centimeters",
    contexts: [
      { noun: "sticker", owned: true },
      { noun: "paper cut-out", owned: true },
      { noun: "game piece", owned: true },
      { noun: "stamp design", owned: true },
    ],
  },
  {
    key: "in",
    one: "square inch",
    many: "square inches",
    length: "inches",
    contexts: [
      { noun: "mosaic tile design", owned: true },
      { noun: "bookmark", owned: true },
      { noun: "phone case pattern", owned: true },
      { noun: "cookie cut-out", owned: true },
    ],
  },
  {
    key: "ft",
    one: "square foot",
    many: "square feet",
    length: "feet",
    contexts: [
      { noun: "patio", owned: true },
      { noun: "rug", owned: true },
      { noun: "garden bed", owned: true },
      { noun: "sandbox", owned: true },
      { noun: "dance floor", owned: false },
    ],
  },
  {
    key: "m",
    one: "square meter",
    many: "square meters",
    length: "meters",
    contexts: [
      { noun: "stage", owned: false },
      { noun: "school garden", owned: false },
      { noun: "reading corner", owned: false },
      { noun: "garden shed floor", owned: true },
    ],
  },
];

/** Row-by-row counting with running totals, one line per row. */
function rowLines(counts: readonly number[], noun: string): string[] {
  let total = 0;
  return counts.map((k, i) => {
    const before = total;
    total += k;
    const row = `Row ${i + 1}${i === 0 ? " (the top row)" : ""} has ${count(k, noun)}`;
    return i === 0
      ? `${row}: ${total} so far.`
      : `${row}: $${before} + ${k} = ${total}$ so far.`;
  });
}
function boxCheck(
  cells: readonly Cell[],
  noun: string,
  squareWord: string,
): string[] {
  // squareWord names the units of the box: "squares" or "sticky notes".
  const { cols, rows } = boxOf(cells);
  const n = cells.length;
  if (isRectangle(cells))
    return [
      `Check: the ${noun} is ${rows} rows of ${cols}, and $${rows} \\times ${cols} = ${n}$.`,
    ];
  const box = cols * rows;
  return [
    `Check: the ${noun} fits in a box ${cols} ${squareWord} wide and ${rows} ${squareWord} tall.`,
    `That box holds $${cols} \\times ${rows} = ${box}$ ${squareWord}. ${n} is less than ${box}, because some ${squareWord} of the box are not part of the ${noun}.`,
  ];
}

/* ------------------------------------------------------------ problems */

type Built = {
  prompt: string;
  hint: string;
  explanation: string[];
  answer: string;
  figure?: SemanticFigure;
  label?: string;
  marking?: UnitSquareMarkingResponse;
  choices?: { label: string; correct?: true; feedback?: string }[];
  variant: ProblemVariant;
};
function finish(
  id: string,
  seed: string,
  r: Random,
  built: Built,
): GeneratedProblem {
  const meta = metaOf(id);
  let answer = built.answer;
  let response: GeneratedProblem["public"]["response"] = built.marking ?? {
    kind: "number",
    label: built.label ?? "Answer",
  };
  let choiceFeedback: Record<string, string> | undefined;
  if (built.choices) {
    const choices = shuffle(r, [...built.choices]);
    if (
      choices.filter((c) => c.correct).length !== 1 ||
      new Set(choices.map((c) => c.label)).size !== choices.length
    )
      throw new Error("Need distinct choices with one answer");
    choiceFeedback = {};
    response = {
      kind: "choice",
      label: built.label ?? "Choose one answer",
      options: choices.map((c, i) => {
        const optionId = `option-${"abcd"[i]}`;
        if (c.correct) answer = optionId;
        else choiceFeedback![optionId] = c.feedback!;
        return { id: optionId, label: c.label };
      }),
    };
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, meta.version, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response,
      ...(built.figure ? { figure: built.figure } : {}),
    },
    answer,
    explanation: built.explanation,
    hint: built.hint,
    ...(choiceFeedback ? { choiceFeedback } : {}),
    variant: built.variant,
  };
}

type ShapeVariant = "rectangle" | "composite" | "polyomino" | "hole";
/** Weights from the spec: A 15, B 35, C 30, D 10 (E is its own template). */
function shapeVariant(r: Random, withHoles: boolean): ShapeVariant {
  const roll = r(1, withHoles ? 90 : 80);
  return roll <= 15
    ? "rectangle"
    : roll <= 50
      ? "composite"
      : roll <= 80
        ? "polyomino"
        : "hole";
}
function drawShape(r: Random, variant: ShapeVariant) {
  if (variant === "rectangle")
    return { cells: rectangleShape(r), holes: [] as Cell[], kind: "rectangle" };
  if (variant === "composite") {
    const made = compositeShape(r);
    return { cells: made.cells, holes: [] as Cell[], kind: made.kind };
  }
  if (variant === "polyomino")
    return { cells: polyominoShape(r), holes: [] as Cell[], kind: "polyomino" };
  const made = holeShape(r);
  return { cells: made.cells, holes: made.holes, kind: made.base };
}
function contextOf(r: Random) {
  const unit = pick(r, UNITS);
  const context = pick(r, unit.contexts);
  const owner = context.owned ? `${storyName((n) => r(0, n - 1))}'s` : "the";
  return { unit, noun: context.noun, owner };
}
const ownerPhrase = (owner: string, noun: string) =>
  owner === "the" ? `the ${noun}` : `${owner} ${noun}`;

function countUnitSquares(
  seed: string,
  r: Random,
  marking = false,
): GeneratedProblem {
  const variant = shapeVariant(r, true);
  const { cells, holes, kind } = drawShape(r, variant);
  if (marking && boxOf(cells).cols > 5)
    throw new Error("Need at most five columns for touch targets");
  const { unit, noun, owner } = contextOf(r);
  const n = cells.length;
  const counts = rowCounts(cells);
  const figure: SemanticFigure = {
    kind: "scene",
    scene: gridFigure(
      cells,
      unit.one,
      `A shaded shape on a grid of squares; each square is 1 ${unit.one}`,
      holes.length,
    ),
  };
  return finish(marking ? "mark-unit-squares" : "count-unit-squares", seed, r, {
    ...(marking
      ? {
          marking: {
            kind: "unit-square-marking" as const,
            label: unit.many,
            unit: `1 ${unit.one}`,
            ...boxOf(cells),
            cells: cells.map(([col, row]) => [col, row] as [number, number]),
            tile: "square" as const,
            showEmptyGrid: true,
          },
        }
      : {}),
    prompt: `Each small square is 1 ${unit.one}. The shaded shape is ${ownerPhrase(owner, noun)}. What is the area of the ${noun}?`,
    label: unit.many,
    answer: String(n),
    figure,
    hint: marking
      ? `Tap each shaded square of the ${noun} as you count it, starting with the top row of ${count(counts[0]!, "square")}. The area, in ${unit.many}, is how many squares you mark.`
      : `Count the shaded squares of the ${noun} one row at a time, starting with the top row of ${count(counts[0]!, "square")}. Keep a running total, and count each square only once.`,
    explanation: [
      `Each small square is 1 ${unit.one}. The area is the number of squares that cover the ${noun}, with no gaps and no overlaps.`,
      ...rowLines(counts, "shaded square"),
      ...(holes.length
        ? [
            `The ${holes.length === 1 ? "unshaded square inside is a hole. It is" : "unshaded squares inside are holes. They are"} not covered, so ${holes.length === 1 ? "it is" : "they are"} not counted.`,
          ]
        : []),
      `${n} squares cover the ${noun}, so its area is ${n} ${unit.many}.`,
      ...boxCheck(cells, noun, "squares"),
    ],
    variant: {
      id:
        variant === "composite"
          ? `composite-${kind}`
          : variant === "hole"
            ? `hole-${kind}`
            : variant,
      axes: { unit: unit.key },
    },
  });
}

function areaStatement(seed: string, r: Random): GeneratedProblem {
  const variant = shapeVariant(r, false);
  const { cells, kind } = drawShape(r, variant);
  const { unit, noun, owner } = contextOf(r);
  const n = cells.length;
  const { cols, rows } = boxOf(cells);
  const counts = rowCounts(cells);
  const border = borderCount(cells);
  const rectangle = isRectangle(cells);
  const statement = (v: number, u: string) => `The area is ${v} ${u}.`;
  const choices: Built["choices"] = [
    { label: statement(n, unit.many), correct: true },
    {
      label: statement(n, unit.length),
      feedback: `${n} ${unit.length} would be a length, like the distance along one edge. Area counts squares, so it is measured in ${unit.many}.`,
    },
    rectangle
      ? {
          label: statement(2 * (cols + rows), unit.many),
          feedback: `${2 * (cols + rows)} counts the unit edges all the way around the ${noun}, its perimeter. Area counts the squares inside.`,
        }
      : {
          label: statement(cols * rows, unit.many),
          feedback: `${cols * rows} counts every square of the ${cols} by ${rows} box around the ${noun}, unshaded squares too. Count only the shaded squares.`,
        },
    {
      label: statement(border, unit.many),
      feedback: `${border} counts only the shaded squares along the edge of the ${noun}. Area counts every shaded square, the inside ones too.`,
    },
  ];
  const values = new Set(choices.map((c) => c.label));
  if (values.size !== 4) throw new Error("Need four different statements");
  const figure: SemanticFigure = {
    kind: "scene",
    scene: gridFigure(
      cells,
      unit.one,
      `A shaded shape on a grid of squares; each square is 1 ${unit.one}`,
      0,
    ),
  };
  return finish("unit-square-area-statement", seed, r, {
    prompt: `Each small square is 1 ${unit.one}. The shaded shape is ${ownerPhrase(owner, noun)}. Which statement about the area of the ${noun} is true?`,
    label: "Choose the true statement",
    answer: "",
    figure,
    choices,
    hint: `Count the shaded squares row by row, starting with ${counts[0]} in the top row. Then ask: is area measured in ${unit.length} or in ${unit.many}?`,
    explanation: [
      `The area is the number of shaded squares, each 1 ${unit.one}.`,
      ...rowLines(counts, "shaded square"),
      `So the area is ${n} ${unit.many}. ${n} ${unit.length} would be a length, not an area.`,
      ...boxCheck(cells, noun, "squares"),
    ],
    variant: {
      id: variant === "composite" ? `composite-${kind}` : variant,
      axes: { unit: unit.key },
    },
  });
}

function improvisedCount(
  seed: string,
  r: Random,
  marking = false,
): GeneratedProblem {
  const kind = pick(r, TILE_KINDS);
  const spec = pick(r, SURFACES[kind]);
  const { cells, shape } = surfaceShape(r, spec, 6, 30);
  if (marking && boxOf(cells).cols > 5)
    throw new Error("Need at most five columns for touch targets");
  const t = TILE[kind];
  const name = storyName((n) => r(0, n - 1));
  const n = cells.length;
  const counts = rowCounts(cells);
  const legendY = -1.7;
  const elements: Element[] = [
    ...surfaceElements(cells, kind, cells),
    ...tilePaths(kind, [{ x: 0, y: legendY, s: 1 }], "legend"),
    {
      type: "text",
      id: "legendLabel",
      at: [1.3, legendY + 0.5],
      text: `= 1 ${t.one}`,
      align: [-1, 0],
      size: "sm",
    },
  ];
  const figure: SemanticFigure = {
    kind: "scene",
    scene: scene(...elements).build({
      title: `A ${spec.name} covered by ${t.many}, with no gaps and no overlaps`,
      note: `${t.many[0]!.toUpperCase()}${t.many.slice(1)} in each row, from the top: ${counts.join(", ")}.`,
      width: 360,
      maxHeight: 320,
    }),
  };
  return finish(
    marking ? "mark-improvised-units" : "improvised-unit-count",
    seed,
    r,
    {
      ...(marking
        ? {
            marking: {
              kind: "unit-square-marking" as const,
              label: t.many,
              unit: `1 ${t.one}`,
              ...boxOf(cells),
              cells: cells.map(([col, row]) => [col, row] as [number, number]),
              tile: kind,
              showEmptyGrid: false,
            },
          }
        : {}),
      prompt: `${name} covers the ${spec.name} with ${t.many}, with no gaps and no overlaps. What is the area of the ${spec.name}, in ${t.many}?`,
      label: t.many,
      answer: String(n),
      figure,
      hint: marking
        ? `Tap each ${t.one} on the ${spec.name} as you count, starting with ${counts[0]} in the top row. The area is how many ${t.many} you mark.`
        : `Count the ${t.many} on the ${spec.name}, starting with ${counts[0]} in the top row. Then add each row below it, keeping a running total.`,
      explanation: [
        `Each ${t.one} is one unit of area. It is not a standard unit like a square foot, but it covers flat space the same way: no gaps and no overlaps.`,
        ...rowLines(counts, t.one),
        `${count(n, t.one)} cover the ${spec.name}, so its area is ${n} ${t.many}.`,
        ...boxCheck(cells, spec.name, t.many),
      ],
      variant: { id: shape, axes: { unit: kind } },
    },
  );
}

type Place = "middle" | "top" | "bottom" | "left" | "right";
const PLACE_WORDS: Record<Place, string> = {
  middle: "near the middle",
  top: "along the top edge",
  bottom: "along the bottom edge",
  left: "along the left edge",
  right: "along the right edge",
};
/** Squares of the surface left bare: 1–3 inside, or a short strip on an edge. */
function bareSpots(
  r: Random,
  cells: readonly Cell[],
): { gone: Cell[]; place: Place } | null {
  const all = setOf(cells);
  const { cols, rows } = boxOf(cells);
  const inside = cells.filter(([c, r0]) =>
    NEIGHBORS.every(([dc, dr]) => all.has(keyOf(c + dc, r0 + dr))),
  );
  if (inside.length && r(0, 1) === 0) {
    const want = Math.min(inside.length, r(1, 3));
    const start = pick(r, inside);
    // A small patch of neighboring inside squares.
    const patch: Cell[] = [start];
    for (const cell of inside) {
      if (patch.length >= want) break;
      if (
        patch.some(
          (p) => Math.abs(p[0] - cell[0]) + Math.abs(p[1] - cell[1]) === 1,
        )
      )
        patch.push(cell);
    }
    return { gone: patch, place: "middle" };
  }
  const place = pick(r, ["top", "bottom", "left", "right"] as const);
  const line =
    place === "top"
      ? cells.filter(([, r0]) => r0 === 0)
      : place === "bottom"
        ? cells.filter(([, r0]) => r0 === rows - 1)
        : place === "left"
          ? cells.filter(([c]) => c === 0)
          : cells.filter(([c]) => c === cols - 1);
  const ordered = [...line].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (ordered.length < 3) return null;
  const length = r(2, Math.min(3, ordered.length - 1));
  const from = r(0, ordered.length - length);
  const strip = ordered.slice(from, from + length);
  // The strip must be one straight run.
  const straight = strip.every(
    (cell, i) =>
      i === 0 ||
      Math.abs(cell[0] - strip[i - 1]![0]) +
        Math.abs(cell[1] - strip[i - 1]![1]) ===
        1,
  );
  return straight ? { gone: strip, place } : null;
}
/** Extra units laid half a square across two neighbors in one row. */
function extraSpots(r: Random, cells: readonly Cell[]) {
  const all = setOf(cells);
  const { rows } = boxOf(cells);
  const pairs = cells.filter(([c, r0]) => all.has(keyOf(c + 1, r0)));
  if (!pairs.length) return null;
  const want = pairs.length >= 3 && r(0, 1) === 1 ? 2 : 1;
  const chosen: Cell[] = [];
  for (const cell of shuffle(r, [...pairs])) {
    if (chosen.length >= want) break;
    if (chosen.some((p) => p[1] === cell[1] && Math.abs(p[0] - cell[0]) < 3))
      continue;
    chosen.push(cell);
  }
  return {
    spots: chosen.map(([c, r0]) => ({ x: c + 0.5, y: rows - 1 - r0 })),
    rowsHit: [...new Set(chosen.map(([, r0]) => r0 + 1))].sort((a, b) => a - b),
  };
}

function improvisedCovering(seed: string, r: Random): GeneratedProblem {
  const kind = pick(r, TILE_KINDS);
  const spec = pick(r, SURFACES[kind]);
  const { cells, shape } = surfaceShape(r, spec, 8, 20, ["l"]);
  const t = TILE[kind];
  const n = cells.length;
  const { rows } = boxOf(cells);
  const bare = bareSpots(r, cells);
  const extra = extraSpots(r, cells);
  if (!bare || !extra) throw new Error("Need room for both defects");
  const kept = without(cells, bare.gone);
  const card = (elements: Element[]) => scene(...elements).build(CARD);
  const exact: Candidate = {
    description: `${count(n, t.one)} laid edge to edge across the ${spec.name}, ${count(rows, "row")} from top to bottom.`,
    scene: card(surfaceElements(cells, kind, cells)),
  };
  const gaps: Candidate = {
    description: `${count(kept.length, t.one)} on the ${spec.name}, with part of it bare ${PLACE_WORDS[bare.place]}.`,
    scene: card(surfaceElements(cells, kind, kept)),
    feedback: (name) =>
      `${name} leaves part of the ${spec.name} bare, so counting its ${kept.length} ${t.many} gives too small an area.`,
  };
  const k = extra.spots.length;
  const overlap: Candidate = {
    description: `${count(n + k, t.one)} on the ${spec.name}; ${k === 1 ? "1 lies" : "2 lie"} on top of others in row ${extra.rowsHit.join(" and row ")} from the top.`,
    scene: card(surfaceElements(cells, kind, cells, extra.spots)),
    feedback: (name) =>
      `${name} has ${t.many} on top of other ${t.many}, so part of the ${spec.name} is counted twice: ${n + k} is too many.`,
  };
  const children = storyNameSet((m) => r(0, m - 1), 3);
  const problem = problemOf(metaOf("improvised-unit-covering"), seed, r, {
    prompt: `${children[0]}, ${children[1]} and ${children[2]} each covered the same ${spec.name} with ${t.many}. Which picture shows a covering that can be counted to find the area of the ${spec.name}?`,
    label: "Choose the covering that measures the area",
    noun: "Picture",
    correct: exact,
    distractors: [gaps, overlap],
    hint: `Look at each ${spec.name}: a covering of ${t.many} measures area only when no part is bare and no ${t.one} lies on top of another.`,
    explanation: (name) => [
      `To measure area, the units must cover the whole ${spec.name} with no gaps and no overlaps.`,
      `The covering with a bare part has only ${kept.length} ${t.many}. It misses some of the ${spec.name}, so its count is too small.`,
      `The covering with ${count(k, t.one)} on top of others counts part of the ${spec.name} twice, so its count, ${n + k}, is too many.`,
      `${name} covers the ${spec.name} exactly, with no gaps and no overlaps, so its count is the area.`,
      `The area of the ${spec.name} is ${n} ${t.many}.`,
    ],
    walkthrough: card(surfaceElements(cells, kind, cells)),
  });
  return {
    ...problem,
    variant: {
      id: bare.place === "middle" ? "gap-inside" : "gap-edge",
      axes: { unit: kind, surface: shape },
    },
  };
}

const PAIRS: readonly {
  kind: TileKind;
  small: string;
  large: string;
  surfaces: string[];
}[] = [
  {
    kind: "sticky",
    small: "small sticky note",
    large: "large sticky note",
    surfaces: ["desk top", "bulletin board", "book cover"],
  },
  {
    kind: "tile",
    small: "small square tile",
    large: "large square tile",
    surfaces: ["hallway", "bathroom floor", "tabletop"],
  },
  {
    kind: "card",
    small: "small square card",
    large: "large square card",
    surfaces: ["tray", "poster"],
  },
];
function improvisedChange(seed: string, r: Random): GeneratedProblem {
  const pair = pick(r, PAIRS);
  const surface = pick(r, pair.surfaces);
  const toSmaller = r(0, 1) === 1;
  // The first unit is drawn at side 1; the second at side 1/2 or 2.
  let w: number, h: number;
  for (;;) {
    w = r(2, 6);
    h = r(2, 5);
    if (w * h < 6 || w * h > 24) continue;
    if (!toSmaller && (w % 2 || h % 2)) continue;
    break;
  }
  const n = w * h;
  const first = toSmaller ? pair.large : pair.small;
  const second = toSmaller ? pair.small : pair.large;
  const firstMany = `${first}s`,
    secondMany = `${second}s`;
  const name = storyName((m) => r(0, m - 1));
  const cells = block(0, 0, w, h);
  const s2 = toSmaller ? 0.5 : 2;
  // Below the surface, one of each unit to the same scale, each labeled.
  const y1 = -1.6,
    y2 = y1 - 0.4 - s2;
  const elements: Element[] = [
    ...surfaceElements(cells, pair.kind, cells),
    ...tilePaths(pair.kind, [{ x: 0, y: y1, s: 1 }], "first"),
    {
      type: "text",
      id: "firstLabel",
      at: [1.3, y1 + 0.5],
      text: `1 ${first}`,
      align: [-1, 0],
      size: "sm",
    },
    ...tilePaths(pair.kind, [{ x: 0, y: y2, s: s2 }], "second"),
    {
      type: "text",
      id: "secondLabel",
      at: [s2 + 0.3, y2 + s2 / 2],
      text: `1 ${second}`,
      align: [-1, 0],
      size: "sm",
    },
  ];
  const figure: SemanticFigure = {
    kind: "scene",
    scene: scene(...elements).build({
      title: `A ${surface} covered by ${n} ${firstMany}, with one ${first} and one ${second} drawn below it to the same scale`,
      width: 360,
      maxHeight: 320,
    }),
  };
  const relation = toSmaller
    ? `Each side of a ${second} is half as long as a side of a ${first}.`
    : `Each side of a ${second} is twice as long as a side of a ${first}.`;
  const more = `More than ${n}`,
    fewer = `Fewer than ${n}`,
    same = `Exactly ${n}`;
  return finish("improvised-unit-change", seed, r, {
    prompt: `${name} covered the ${surface} with ${firstMany} and counted ${n}. Then ${name} covered the same ${surface} with ${secondMany}. ${relation} Will it take more than ${n}, fewer than ${n} or exactly ${n} ${secondMany}?`,
    label: "Choose one answer",
    answer: "",
    figure,
    choices: [
      {
        label: more,
        ...(toSmaller
          ? { correct: true as const }
          : {
              feedback: `A ${second} is bigger, so each one covers more of the ${surface}. Bigger units take fewer pieces, not more.`,
            }),
      },
      {
        label: fewer,
        ...(!toSmaller
          ? { correct: true as const }
          : {
              feedback: `A ${second} is smaller, so each one covers less of the ${surface}. Smaller units take more pieces, not fewer.`,
            }),
      },
      {
        label: same,
        feedback: `The area of the ${surface} stays the same, but the count depends on the unit. A unit of a different size gives a different count.`,
      },
    ],
    hint: `Picture how many ${pair.small}s fit on one ${pair.large}. Then think about what that means for the ${n} ${firstMany}.`,
    explanation: [
      `The ${surface} does not change, so its area does not change. Only the unit changes.`,
      `Two ${pair.small}s fit along each side of a ${pair.large}, so $2 \\times 2 = 4$ ${pair.small}s cover one ${pair.large}.`,
      toSmaller
        ? `Each ${first} the ${surface} needed is replaced by 4 ${secondMany}: $4 \\times ${n} = ${4 * n}$ ${secondMany}. That is more than ${n}.`
        : `Every 4 ${firstMany} are replaced by 1 ${second}: $${n} \\div 4 = ${n / 4}$ ${secondMany}. That is fewer than ${n}.`,
      `A smaller unit takes more units to cover the same area, and a larger unit takes fewer.`,
    ],
    variant: {
      id: toSmaller ? "smaller-unit" : "larger-unit",
      axes: { unit: pair.kind },
    },
  });
}

const generators: Record<
  string,
  (seed: string, r: Random) => GeneratedProblem
> = {
  "mark-unit-squares": (seed, r) => countUnitSquares(seed, r, true),
  "mark-improvised-units": (seed, r) => improvisedCount(seed, r, true),
  "count-unit-squares": countUnitSquares,
  "unit-square-area-statement": areaStatement,
  "improvised-unit-count": improvisedCount,
  "improvised-unit-covering": improvisedCovering,
  "improvised-unit-change": improvisedChange,
};

export function generateAreaByCounting(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate)
    throw new Error(`Unknown area-by-counting template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  // A draw that cannot make a valid item is redrawn from a salted stream.
  for (let attempt = 0; attempt < 80; attempt++)
    try {
      return generate(
        seed,
        random(templateId, attempt ? `${seed}#${attempt}` : seed),
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
    }
  throw new Error(`${templateId}: no instance for ${seed}`);
}
