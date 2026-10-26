import { z } from "zod";
import { f as fn, graph, scene as sceneOf } from "./scene/author";
import type { Scene } from "./scene/spec";

/** The point-plot response protocol (`point-plot-v1`).
 *
 * The public response carries the grid and how many points to place. The
 * learner's answer is a JSON list of lattice points: a set (sorted on the
 * wire) unless the item names its points in order, such as images A′, B′, C′.
 * The grading rule (an exact set, or any distinct points on a line) is
 * private: `GeneratedProblem.pointGrading` never leaves the server. */
export const MAX_PLOT_POINTS = 4;
/** The longest draft or answer: four signed two-digit pairs fit easily. */
export const MAX_PLOT_RESPONSE_LENGTH = 100;
export type LatticePoint = readonly [number, number];
export interface PointPlotGrid {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Lattice spacing on both axes; every placeable point is a multiple. */
  step: number;
  xLabel: string;
  yLabel: string;
}
export interface PointPlotResponse {
  kind: "point-plot";
  label: string;
  grid: PointPlotGrid;
  pointCount: number;
  /** Ordered answers fill `pointLabels` slots; unordered answers are sets. */
  ordered: boolean;
  pointLabels?: string[];
  /** Drawn between placed points: the line through two points, or the
   * polygon through the labeled slots in order. `curve` says the points lie
   * on a graphed function; nothing is drawn and the function stays private.
   * Display only. */
  connect: "none" | "line" | "polygon" | "curve";
  /** A pre-image or reference shape drawn on the grid (never an answer). */
  given?: {
    vertices: { x: number; y: number; label: string }[];
    closed: boolean;
  };
}
/** An exact rational n/d with d > 0 in lowest terms. */
export type Rat = readonly [number, number];
/** A graphed function with exact rational parameters, private to the server:
 * quadratic a(x − h)² + k, absolute value a|x − h| + k, exponential a·bˣ and
 * square root a√(x − h) + k (defined for x ≥ h). */
export type PlotCurve =
  | { kind: "quadratic" | "absolute" | "root"; a: Rat; h: Rat; k: Rat }
  | { kind: "exponential"; a: Rat; b: Rat };
/** Server-side grading spec. On-line: any `pointCount` distinct lattice
 * points with a·x + b·y = c, the line's coefficients in lowest terms.
 * On-curve: any `pointCount` distinct lattice points with y = f(x) exactly,
 * which must include every `required` feature point (a vertex or intercept). */
export type PointPlotGrading =
  | { mode: "exact" }
  | { mode: "on-line"; a: number; b: number; c: number }
  | { mode: "on-curve"; curve: PlotCurve; required?: readonly LatticePoint[] };

const rat = z
  .tuple([
    z.number().int().min(-1000).max(1000),
    z.number().int().min(1).max(1000),
  ])
  .refine(([n, d]) => gcd(n, d) === 1, "A rational must be in lowest terms");
const shifted = (kind: "quadratic" | "absolute" | "root") =>
  z
    .object({
      kind: z.literal(kind),
      a: rat.refine(([n]) => n !== 0, "A curve needs a nonzero scale"),
      h: rat,
      k: rat,
    })
    .strict();
const plotCurveSchema: z.ZodType<PlotCurve> = z.discriminatedUnion("kind", [
  shifted("quadratic"),
  shifted("absolute"),
  shifted("root"),
  z
    .object({
      kind: z.literal("exponential"),
      a: rat.refine(([n]) => n > 0, "A positive starting value"),
      b: rat.refine(([n, d]) => n > 0 && n !== d, "A positive growth factor"),
    })
    .strict(),
]);

const gridInt = z.number().int().min(-20).max(20);
const pointLabel = z.string().regex(/^[A-Z]′?$/);
export const pointPlotResponseSchema = z
  .object({
    kind: z.literal("point-plot"),
    label: z.string().trim().min(1).max(200),
    grid: z
      .object({
        xMin: gridInt,
        xMax: gridInt,
        yMin: gridInt,
        yMax: gridInt,
        step: z.number().int().min(1).max(5),
        xLabel: z.string().trim().min(1).max(24),
        yLabel: z.string().trim().min(1).max(24),
      })
      .strict(),
    pointCount: z.number().int().min(1).max(MAX_PLOT_POINTS),
    ordered: z.boolean(),
    pointLabels: z.array(pointLabel).min(1).max(MAX_PLOT_POINTS).optional(),
    connect: z.enum(["none", "line", "polygon", "curve"]),
    given: z
      .object({
        vertices: z
          .array(
            z.object({ x: gridInt, y: gridInt, label: pointLabel }).strict(),
          )
          .min(1)
          .max(6),
        closed: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((r) => {
    const g = r.grid;
    const lattice = (v: number) => v % g.step === 0;
    const columns = (g.xMax - g.xMin) / g.step,
      rows = (g.yMax - g.yMin) / g.step;
    return (
      [g.xMin, g.xMax, g.yMin, g.yMax].every(lattice) &&
      columns >= 2 &&
      rows >= 2 &&
      columns <= 20 &&
      rows <= 20 &&
      (r.ordered
        ? r.pointLabels?.length === r.pointCount &&
          new Set(r.pointLabels).size === r.pointCount
        : r.pointLabels === undefined) &&
      (r.connect !== "line" || (r.pointCount >= 2 && !r.ordered)) &&
      (r.connect !== "curve" || (r.pointCount >= 3 && !r.ordered)) &&
      (r.connect !== "polygon" || (r.pointCount >= 2 && r.ordered)) &&
      (r.given?.vertices ?? []).every((p) => onGrid(g, [p.x, p.y]))
    );
  }, "A point plot needs a lattice grid of 2–20 steps, labels exactly for ordered points, and givens on the grid");
export const pointPlotGradingSchema: z.ZodType<PointPlotGrading> =
  z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("exact") }).strict(),
    z
      .object({
        mode: z.literal("on-line"),
        a: z.number().int().min(-1000).max(1000),
        b: z.number().int().min(-1000).max(1000),
        c: z.number().int().min(-100000).max(100000),
      })
      .strict()
      .refine((l) => l.a !== 0 || l.b !== 0, "A line needs a direction"),
    z
      .object({
        mode: z.literal("on-curve"),
        curve: plotCurveSchema,
        required: z
          .array(z.tuple([z.number().int(), z.number().int()]))
          .max(MAX_PLOT_POINTS)
          .optional(),
      })
      .strict(),
  ]);

export const onGrid = (g: PointPlotGrid, [x, y]: LatticePoint) =>
  Number.isSafeInteger(x) &&
  Number.isSafeInteger(y) &&
  x >= g.xMin &&
  x <= g.xMax &&
  y >= g.yMin &&
  y <= g.yMax &&
  (x - g.xMin) % g.step === 0 &&
  (y - g.yMin) % g.step === 0;
export const samePoint = (a: LatticePoint, b: LatticePoint) =>
  a[0] === b[0] && a[1] === b[1];
const isPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((n) => Number.isSafeInteger(n) && Math.abs(n) <= 1000);

/** A draft: complete or not, with `null` for an empty ordered slot. Repeated
 * points and foreign shapes are invalid, never silently repaired. */
export function parsePlotDraft(raw: string): (LatticePoint | null)[] | null {
  if (typeof raw !== "string" || raw.length > MAX_PLOT_RESPONSE_LENGTH)
    return null;
  if (raw === "") return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !Array.isArray(value) ||
      value.length > MAX_PLOT_POINTS ||
      !value.every((p) => p === null || isPair(p))
    )
      return null;
    const points = value as (LatticePoint | null)[];
    const placed = points.filter((p): p is LatticePoint => p !== null);
    if (new Set(placed.map((p) => `${p[0]},${p[1]}`)).size !== placed.length)
      return null;
    return points;
  } catch {
    return null;
  }
}
const byCoordinates = (a: LatticePoint, b: LatticePoint) =>
  a[0] - b[0] || a[1] - b[1];
/** Sets serialize sorted; ordered slots keep their places. */
export function serializePlot(
  points: readonly (LatticePoint | null)[],
  ordered: boolean,
): string {
  const list = ordered
    ? points
    : points.filter((p): p is LatticePoint => p !== null).sort(byCoordinates);
  return list.length === 0 || list.every((p) => p === null)
    ? ""
    : JSON.stringify(list.map((p) => (p ? [p[0], p[1]] : null)));
}
/** The complete set form of any point list, for comparing retried
 * submissions without the problem instance. */
export function canonicalPointSet(raw: string): string | null {
  const points = parsePlotDraft(raw);
  if (!points?.length || points.some((p) => p === null)) return null;
  return serializePlot(points, false);
}
/** Only a complete answer of distinct points on the displayed lattice can be
 * submitted; it is returned in canonical form. */
export function normalizePointPlot(
  response: PointPlotResponse,
  raw: string,
): string | null {
  const points = parsePlotDraft(raw);
  if (
    points === null ||
    points.length !== response.pointCount ||
    !points.every((p) => p !== null && onGrid(response.grid, p))
  )
    return null;
  return serializePlot(points, response.ordered);
}
/** The points of a canonical (or any valid) answer, in their stored order. */
export function plotPoints(raw: string): LatticePoint[] {
  return (parsePlotDraft(raw) ?? []).filter(
    (p): p is LatticePoint => p !== null,
  );
}
export function gradePointPlot(
  response: PointPlotResponse,
  grading: PointPlotGrading,
  answer: string,
  raw: string,
): boolean {
  const submitted = normalizePointPlot(response, raw);
  if (submitted === null) return false;
  if (grading.mode === "exact")
    return submitted === normalizePointPlot(response, answer);
  if (grading.mode === "on-curve") {
    const placed = plotPoints(submitted);
    return (
      placed.every((p) => onCurve(grading.curve, p)) &&
      (grading.required ?? []).every((r) => placed.some((p) => samePoint(p, r)))
    );
  }
  return plotPoints(submitted).every(
    ([x, y]) => grading.a * x + grading.b * y === grading.c,
  );
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a);
}

/* ---------- curves: exact rational evaluation ---------- */
type Frac = { n: bigint; d: bigint };
const big = ([n, d]: Rat): Frac => ({ n: BigInt(n), d: BigInt(d) });
const bigGcd = (a: bigint, b: bigint): bigint =>
  b === 0n ? (a < 0n ? -a : a) : bigGcd(b, a % b);
const frac = (n: bigint, d: bigint): Frac => {
  const g = bigGcd(n, d) || 1n;
  return d < 0n ? { n: -n / g, d: -d / g } : { n: n / g, d: d / g };
};
const plus = (p: Frac, q: Frac) => frac(p.n * q.d + q.n * p.d, p.d * q.d);
const times = (p: Frac, q: Frac) => frac(p.n * q.n, p.d * q.d);
const exactRoot = (n: bigint): bigint | null => {
  if (n < 0n) return null;
  const r = BigInt(Math.round(Math.sqrt(Number(n))));
  return r * r === n ? r : null;
};
/** f(x) as an exact fraction, or null where the function is undefined or its
 * square root is irrational. Integer arguments only (the lattice). */
export function curveValue(curve: PlotCurve, x: number): Frac | null {
  const at = frac(BigInt(x), 1n);
  if (curve.kind === "exponential") {
    if (Math.abs(x) > 60) return null;
    const b = big(curve.b);
    const base = x >= 0 ? b : frac(b.d, b.n);
    let power: Frac = { n: 1n, d: 1n };
    for (let i = 0; i < Math.abs(x); i++) power = times(power, base);
    return times(big(curve.a), power);
  }
  const t = plus(at, times(big(curve.h), { n: -1n, d: 1n }));
  const a = big(curve.a),
    k = big(curve.k);
  switch (curve.kind) {
    case "quadratic":
      return plus(times(a, times(t, t)), k);
    case "absolute":
      return plus(times(a, t.n < 0n ? { n: -t.n, d: t.d } : t), k);
    case "root": {
      const n = exactRoot(t.n),
        d = exactRoot(t.d);
      return n === null || d === null ? null : plus(times(a, frac(n, d)), k);
    }
  }
}
/** True when the lattice point satisfies y = f(x) exactly. */
export function onCurve(curve: PlotCurve, [x, y]: LatticePoint): boolean {
  const v = curveValue(curve, x);
  return v !== null && v.d === 1n && v.n === BigInt(y);
}
/** Lattice points of the grid on the curve, left to right. */
export function latticeOnCurve(
  g: PointPlotGrid,
  curve: PlotCurve,
): LatticePoint[] {
  const out: LatticePoint[] = [];
  for (let x = g.xMin; x <= g.xMax; x += g.step)
    for (let y = g.yMin; y <= g.yMax; y += g.step)
      if (onCurve(curve, [x, y])) out.push([x, y]);
  return out;
}
const ratNumber = ([n, d]: Rat) => n / d;
/** The curve as a scene function, to draw it (print keys and lessons). */
export function curveFunction(curve: PlotCurve) {
  const a = ratNumber(curve.a);
  if (curve.kind === "exponential") return fn.exp(a, ratNumber(curve.b));
  const h = ratNumber(curve.h),
    k = ratNumber(curve.k);
  return curve.kind === "quadratic"
    ? fn.vertex(a, h, k)
    : curve.kind === "absolute"
      ? fn.abs(a, h, k)
      : fn.sqrt(a, h, k);
}

/** a·x + b·y = c through two distinct lattice points, in lowest terms with a
 * positive leading coefficient. */
export function lineThrough(
  [x1, y1]: LatticePoint,
  [x2, y2]: LatticePoint,
): { a: number; b: number; c: number } {
  let a = y2 - y1,
    b = x1 - x2;
  if (a === 0 && b === 0) throw new Error("A line needs two distinct points");
  let c = a * x1 + b * y1;
  const g = gcd(gcd(a, b), c) || 1;
  [a, b, c] = [a / g, b / g, c / g];
  if (a < 0 || (a === 0 && b < 0)) [a, b, c] = [-a, -b, -c];
  return { a: a + 0, b: b + 0, c: c + 0 };
}
/** Lattice points of the grid on a·x + b·y = c, left to right. */
export function latticeOnLine(
  g: PointPlotGrid,
  line: { a: number; b: number; c: number },
): LatticePoint[] {
  const out: LatticePoint[] = [];
  for (let x = g.xMin; x <= g.xMax; x += g.step)
    for (let y = g.yMin; y <= g.yMax; y += g.step)
      if (line.a * x + line.b * y === line.c) out.push([x, y]);
  return out;
}

const minus = (n: number) => (n < 0 ? `-${-n}` : `${n}`);
/** "$(2, -3)$" or "$A'(2, -3)$" in MathText. */
export const pointTex = (p: LatticePoint, label?: string) =>
  `$${label ? label.replace("′", "'") : ""}(${minus(p[0])}, ${minus(p[1])})$`;
const list = (items: string[]) =>
  items.length < 3
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
/** A readable answer: labeled for ordered items, a line through two points
 * for graphed lines (any two points of that line are correct). */
export function pointPlotAnswerText(
  response: PointPlotResponse,
  raw: string,
): string {
  const points = parsePlotDraft(raw);
  if (!points) throw new Error("Worked answer must be a list of points");
  const texts = points.flatMap((p, i) =>
    p
      ? [pointTex(p, response.ordered ? response.pointLabels?.[i] : undefined)]
      : [],
  );
  if (!texts.length) return "No points placed";
  if (response.connect === "line" && texts.length === 2)
    return `the line through ${texts.join(" and ")}`;
  return list(texts);
}

/** Chance that blind placement is graded correct, never understated: one
 * permitted set among every choice of points, or for a graphed line every
 * pair on the longest line the window can hold. */
export function pointPlotGuessChance(response: PointPlotResponse): number {
  const g = response.grid;
  const columns = (g.xMax - g.xMin) / g.step + 1,
    rows = (g.yMax - g.yMin) / g.step + 1,
    n = columns * rows,
    k = response.pointCount;
  const choose = (m: number, r: number) => {
    if (r > m) return 0;
    let value = 1;
    for (let i = 1; i <= r; i++) value = (value * (m - i + 1)) / i;
    return value;
  };
  const accepted =
    response.connect === "line" || response.connect === "curve"
      ? choose(Math.max(columns, rows), k)
      : 1;
  const orders = response.ordered ? choose(n, k) * factorial(k) : choose(n, k);
  return Math.min(1 / 2, accepted / orders);
}
const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));

/** The grid as a scene: axes, lattice gridlines, axis names and the given
 * shape. Optional layers draw an answer (print keys and lesson examples).
 * Practice draws placed points over this scene, never inside it, so the
 * scene's layout (and the page) never changes while the learner works. */
export function pointPlotScene(
  response: PointPlotResponse,
  options: {
    answer?: readonly (LatticePoint | null)[];
    /** The graphed function, drawn under the answer points. */
    curve?: PlotCurve;
    width?: number;
    title?: string;
  } = {},
): Scene {
  const g = response.grid;
  const span = Math.max(g.xMax - g.xMin, g.yMax - g.yMin) / g.step;
  let plot = graph({
    x: [g.xMin, g.xMax],
    y: [g.yMin, g.yMax],
    grid: g.step,
    tick: span > 12 ? 2 * g.step : g.step,
    aspect: 1,
    axisNames: [g.xLabel, g.yLabel],
  }).id("plot");
  const given = response.given;
  if (given) {
    const v = given.vertices;
    for (let i = 0; i + 1 < v.length; i++)
      plot = plot.segment([v[i]!.x, v[i]!.y], [v[i + 1]!.x, v[i + 1]!.y], {
        color: "ink",
      });
    if (given.closed && v.length > 2)
      plot = plot.segment([v.at(-1)!.x, v.at(-1)!.y], [v[0]!.x, v[0]!.y], {
        color: "ink",
      });
    for (const p of v) plot = plot.point(p.x, p.y, p.label, { color: "ink" });
  }
  if (options.curve) plot = plot.curve(curveFunction(options.curve), {});
  const answer = options.answer ?? [];
  const placed = answer.filter((p): p is LatticePoint => p !== null);
  if (response.connect === "line" && placed.length >= 2)
    plot = plot.line(
      { through: [[...placed[0]!], [...placed[1]!]] },
      {
        color: "accent",
      },
    );
  if (response.connect === "polygon")
    for (let i = 0; i < answer.length; i++) {
      const from = answer[i],
        to = answer[(i + 1) % answer.length];
      const last = i + 1 === answer.length;
      if (from && to && (!last || answer.length > 2))
        plot = plot.segment([...from], [...to], {
          color: "accent",
          dash: "dash",
        });
    }
  answer.forEach((p, i) => {
    if (p)
      plot = plot.point(
        p[0],
        p[1],
        response.ordered ? response.pointLabels?.[i] : undefined,
        { color: "accent" },
      );
  });
  return sceneOf(plot).build({
    title:
      options.title ??
      (placed.length ? "Coordinate grid with the answer" : "Coordinate grid"),
    width: options.width ?? 420,
    maxHeight: options.width ?? 420,
  });
}

/* ---------- drafts: what the learner has placed so far ---------- */
/** Ordered items keep one slot per label; sets list placed points only. */
export function draftSlots(
  response: PointPlotResponse,
  raw: string,
): (LatticePoint | null)[] {
  const parsed = (parsePlotDraft(raw) ?? []).filter(
    (p) => p === null || onGrid(response.grid, p),
  );
  if (!response.ordered)
    return parsed
      .filter((p): p is LatticePoint => p !== null)
      .slice(0, response.pointCount);
  return Array.from(
    { length: response.pointCount },
    (_, i) => parsed[i] ?? null,
  );
}
export const placedCount = (response: PointPlotResponse, raw: string) =>
  draftSlots(response, raw).filter((p) => p !== null).length;
/** Tap: remove a placed point, else place one in the first free slot. A full
 * draft is returned unchanged. */
export function toggleDraftPoint(
  response: PointPlotResponse,
  raw: string,
  p: LatticePoint,
): string {
  if (!onGrid(response.grid, p))
    return serializePlot(draftSlots(response, raw), response.ordered);
  const slots = draftSlots(response, raw);
  const at = slots.findIndex((q) => q !== null && samePoint(q, p));
  if (at >= 0) {
    if (response.ordered) slots[at] = null;
    else slots.splice(at, 1);
  } else if (response.ordered) {
    const free = slots.indexOf(null);
    if (free >= 0) slots[free] = p;
  } else if (slots.length < response.pointCount) slots.push(p);
  return serializePlot(slots, response.ordered);
}
/** Drag: move a placed point onto a free lattice point, keeping its slot. */
export function moveDraftPoint(
  response: PointPlotResponse,
  raw: string,
  from: LatticePoint,
  to: LatticePoint,
): string {
  const slots = draftSlots(response, raw);
  const at = slots.findIndex((q) => q !== null && samePoint(q, from));
  if (
    at < 0 ||
    !onGrid(response.grid, to) ||
    slots.some((q) => q !== null && samePoint(q, to))
  )
    return serializePlot(slots, response.ordered);
  slots[at] = to;
  return serializePlot(slots, response.ordered);
}
/** The label a point placed now would take (ordered items), if any. */
export function nextSlotLabel(
  response: PointPlotResponse,
  raw: string,
): string | undefined {
  if (!response.ordered) return undefined;
  const free = draftSlots(response, raw).indexOf(null);
  return free >= 0 ? response.pointLabels?.[free] : undefined;
}
/** The visible segment of the line through p and q inside the grid window. */
export function clipLineToGrid(
  g: PointPlotGrid,
  p: LatticePoint,
  q: LatticePoint,
): [LatticePoint, LatticePoint] | null {
  const dx = q[0] - p[0],
    dy = q[1] - p[1];
  if (dx === 0 && dy === 0) return null;
  let lo = -Infinity,
    hi = Infinity;
  for (const [start, delta, min, max] of [
    [p[0], dx, g.xMin, g.xMax],
    [p[1], dy, g.yMin, g.yMax],
  ] as const) {
    if (delta === 0) {
      if (start < min || start > max) return null;
      continue;
    }
    const a = (min - start) / delta,
      b = (max - start) / delta;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  if (lo > hi) return null;
  return [
    [p[0] + lo * dx, p[1] + lo * dy],
    [p[0] + hi * dx, p[1] + hi * dy],
  ];
}
/** "(2, −3)" with a typographic minus, for readouts and labels. */
export const pointLabelText = ([x, y]: LatticePoint) =>
  `(${x < 0 ? `−${-x}` : x}, ${y < 0 ? `−${-y}` : y})`;
