import type { ProblemLessonView } from "../../content/problem-lessons";
import type {
  CoordinateGeometryFigure,
  PlaneMotion,
  SemanticFigure,
} from "../../math/contracts";
import { applyMotion } from "../../math/plane-motion";
import {
  geometryAnimationModel,
  geometryFrames,
  type GeometryAnimationModel,
} from "./geometry";
import {
  shapeMorphFrames,
  shapeMorphModel,
  type ShapeMorphAnimation,
} from "./shape-model";

type Fraction = Extract<SemanticFigure, { kind: "fraction" }>;
type ArrayFigure = Extract<SemanticFigure, { kind: "unit-array" }>;
type Exchange = Extract<SemanticFigure, { kind: "base-ten" }>;
type RateLines = Extract<SemanticFigure, { kind: "double-number-line" }>;
/** A double number line scaled through 1: pairs are [bottom, top]. */
export type RateModel = {
  kind: "rate";
  top: string;
  bottom: string;
  given: [number, number];
  target: [number, number];
  findBottom: boolean;
};
type Display = Extract<SemanticFigure, { kind: "function-display" }>;
export type PlotRule = {
  x: string;
  y: string;
  /** y = k × x (offset 0) or y = x + offset (k 1). */
  k: number;
  offset: number;
};
type Balance = Extract<SemanticFigure, { kind: "balance-scale" }>;
/** add: x + a = b; times: px = b; remove-split: px + q = r; split-remove: p(x + q) = r. */
export type BalanceForm = "add" | "times" | "remove-split" | "split-remove";
type Shapes = Extract<SemanticFigure, { kind: "partitioned-shapes" }>;
type Area = Extract<SemanticFigure, { kind: "area-partition" }>;
/** One shape cut into n equal parts, k of them shaded. */
export type PartitionAnimation = {
  kind: "partition";
  shape: Shapes["shapes"][number];
};
/** Two fractions of one whole, a/b and c/d, with unequal values. */
export type CompareAnimation = {
  kind: "compare";
  bars: [{ n: number; d: number }, { n: number; d: number }];
};
/** Equal-area grid regions; one region is the highlighted part. */
export type AreaAnimation = { kind: "area"; figure: Area };
type LinePlot = Extract<SemanticFigure, { kind: "line-plot" }>;
type CounterRows = Extract<SemanticFigure, { kind: "counter-rows" }>;
type BaseTenPair = Extract<SemanticFigure, { kind: "base-ten-pair" }>;
type AreaModel = Extract<SemanticFigure, { kind: "area-model" }>;
type DecimalChart = Extract<SemanticFigure, { kind: "place-value-chart" }>;
/** A hundredths grid: full columns are tenths, the rest hundredths. */
export type DecimalFillAnimation = { kind: "decimal-fill"; shaded: number };
/** Two decimals written in a place-value chart, unequal in value. */
export type DecimalAlignAnimation = {
  kind: "decimal-align";
  figure: DecimalChart;
};
type CubePrism = Extract<SemanticFigure, { kind: "cube-prism" }>;
type Grid = Extract<SemanticFigure, { kind: "quadrant-grid" }>;
type TenFramePair = Extract<SemanticFigure, { kind: "ten-frame-pair" }>;
/** One analog clock: both hands start on the hour, then sweep to the time. */
export type ClockSweepAnimation = {
  kind: "clock-sweep";
  hour: number;
  minute: number;
};
/** Full jar A poured into empty jar B: eighths of B filled (9 = spills). */
export type PourAnimation = { kind: "pour"; eighths: number };
export type AnimationModel =
  | { kind: "root-zoom"; radicand: number; index: 2 | 3 }
  | {
      kind: "decimal-shift";
      digits: string;
      exponent: number;
      toStandard: boolean;
    }
  /** A balance loaded side by side until the closed box levels it. */
  | {
      kind: "balance-level";
      /** Counter groups on the complete side, and on the box's side. */
      full: number[];
      partial: number[];
      boxLeft: boolean;
    }
  /** A missing part slides in to fill the bar to the whole. */
  | { kind: "tape-join"; whole: number; part: number; partFirst: boolean }
  /** Two of three groups fill a ten-frame; the third continues. */
  | { kind: "make-ten-three"; addends: [number, number, number] }
  | PourAnimation
  | { kind: "area-model"; figure: AreaModel }
  /** a rows of b dots, built one row at a time. */
  | { kind: "array-build"; rows: number; columns: number }
  /** rows × columns turned a quarter turn: the fact family. */
  | { kind: "array-turn"; rows: number; columns: number }
  /** total counters dealt into `groups` shares, then refilled as groups of
   * `groups` (or the reverse when `first` is "measure"). */
  | {
      kind: "deal";
      total: number;
      count: number;
      first: "share" | "measure";
    }
  | ShapeMorphAnimation
  | {
      kind: "plot";
      rows: { x: number; y: number }[];
      graph: NonNullable<Display["graph"]>;
      rule: PlotRule;
    }
  | ClockSweepAnimation
  | { kind: "balance"; figure: Balance; form: BalanceForm; x: number }
  | DecimalFillAnimation
  | DecimalAlignAnimation
  | { kind: "prism-layers"; figure: CubePrism }
  | { kind: "quadrant-walk"; figure: Grid }
  | { kind: "make-ten"; figure: TenFramePair }
  | PartitionAnimation
  | CompareAnimation
  | AreaAnimation
  | { kind: "pairing"; figure: CounterRows }
  | { kind: "place-compare"; figure: BaseTenPair }
  | { kind: "regroup-sum"; figure: BaseTenPair }
  | { kind: "fraction"; figure: Fraction }
  | { kind: "array"; figure: ArrayFigure & { splitAfterRow: number } }
  | { kind: "exchange"; figure: Exchange; unit: 1 | 10 }
  | GeometryAnimationModel
  | { kind: "line-plot-stack"; figure: LinePlot }
  | { kind: "line-plot-share"; figure: LinePlot; share: number }
  | { kind: "mean-balance"; figure: LinePlot; mad: boolean; trial: number }
  | { kind: "box-build"; figure: LinePlot }
  | RateModel
  | MadGapAnimation
  /** A point reflected across 0 onto its opposite. */
  | { kind: "opposite"; value: number; min: number; max: number }
  /** Signed changes added one jump at a time; values are exact halves. */
  | { kind: "jumps"; start: number; jumps: number[]; min: number; max: number }
  | {
      kind: "motion";
      /** The pre-image alone, in a window that also holds the image. */
      figure: CoordinateGeometryFigure;
      motion: PlaneMotion;
      given: LabeledPoint[];
      image: LabeledPoint[];
    };
const half = (n: number) => Number.isFinite(n) && Number.isInteger(n * 2);
/** Running positions of a jump sequence, exact for halves. */
export const jumpStops = (start: number, jumps: number[]) =>
  jumps.reduce(
    (all, j) => [...all, Math.round((all.at(-1)! + j) * 2) / 2],
    [start],
  );
/** TeX for a signed number; negatives in parentheses when they follow an operator. */
/** Prose uses a typographic minus. */
const shown = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
const signedTex = (n: number, wrap = false) => (n < 0 && wrap ? `(${n})` : `${n}`);
type DoubleDot = Extract<SemanticFigure, { kind: "double-dot-plot" }>;
/** Two groups with the same whole-number MAD; the gap between means is laid out in MADs. */
export type MadGapAnimation = {
  kind: "mad-gap";
  figure: DoubleDot;
  means: [number, number];
  mad: number;
};
const meanOf = (v: readonly number[]) =>
  v.reduce((a, b) => a + b, 0) / v.length;
const madOf = (v: readonly number[]) => {
  const m = meanOf(v);
  return v.reduce((a, x) => a + Math.abs(x - m), 0) / v.length;
};
/** Indexes of the first two addends that make ten, then the third. */
export function tenPair(
  addends: readonly [number, number, number],
): [number, number, number] | null {
  for (const p of [
    [0, 1, 2],
    [1, 2, 0],
    [0, 2, 1],
  ] as const)
    if (addends[p[0]] + addends[p[1]] === 10) return [...p];
  return null;
}
type LabeledPoint = { x: number; y: number; label: string };
const motionTemplates = new Set([
  "transformation-image",
  "identify-rigid-motion",
  "dilation-image",
  "dilation-scale-factor",
]);
const moved = applyMotion;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** The single motion carrying every given vertex onto its labeled image, if any. */
function detectMotion(
  given: LabeledPoint[],
  image: LabeledPoint[],
): PlaneMotion | null {
  const first = given.find((p) => p.x !== 0);
  const candidates: PlaneMotion[] = [
    { kind: "reflect", axis: "x" },
    { kind: "reflect", axis: "y" },
    { kind: "rotate", degrees: 90 },
    { kind: "rotate", degrees: 180 },
    { kind: "rotate", degrees: 270 },
    {
      kind: "translate",
      dx: image[0]!.x - given[0]!.x,
      dy: image[0]!.y - given[0]!.y,
    },
  ];
  if (first) {
    const i = given.indexOf(first),
      num = image[i]!.x,
      den = first.x,
      g = gcd(num, den) * Math.sign(den);
    if (Number.isInteger(num) && num / den > 0)
      candidates.push({
        kind: "dilate",
        numerator: num / g,
        denominator: den / g,
      });
  }
  const fits = candidates.filter((m) =>
    given.every((p, i) => {
      const q = moved(m, p);
      return q.x === image[i]!.x && q.y === image[i]!.y;
    }),
  );
  return fits.length === 1 ? fits[0]! : null;
}
function motionModel(
  f: CoordinateGeometryFigure,
): Extract<AnimationModel, { kind: "motion" }> | null {
  const givenShapes = f.shapes.filter((s) => s.role === "given"),
    imageShapes = f.shapes.filter((s) => s.role === "image");
  if (givenShapes.length !== 1 || imageShapes.length > 1) return null;
  const given = givenShapes[0]!.vertices;
  if (given.length !== 3 || !givenShapes[0]!.closed) return null;
  let motion = f.motion ?? null;
  if (!motion) {
    const image = imageShapes[0]?.vertices;
    if (!image || image.length !== 3) return null;
    if (!image.every((v, i) => v.label === `${given[i]!.label}′`)) return null;
    motion = detectMotion(given, image);
  }
  if (!motion) return null;
  if (
    motion.kind === "dilate" &&
    (motion.numerator <= 0 || motion.denominator <= 0)
  )
    return null;
  const image = given.map((p) => ({
    ...moved(motion, p),
    label: `${p.label}′`,
  }));
  if (image.some((p) => !Number.isInteger(p.x) || !Number.isInteger(p.y)))
    return null;
  const all = [...given, ...image, { x: 0, y: 0 }];
  const window = {
    xMin: Math.min(...all.map((p) => p.x)) - 1,
    xMax: Math.max(...all.map((p) => p.x)) + 1,
    yMin: Math.min(...all.map((p) => p.y)) - 1,
    yMax: Math.max(...all.map((p) => p.y)) + 1,
  };
  if (window.xMax - window.xMin > 24 || window.yMax - window.yMin > 24)
    return null;
  return {
    kind: "motion",
    figure: {
      kind: "coordinate-geometry",
      ...window,
      shapes: [{ role: "given", closed: true, vertices: given }],
    },
    motion,
    given,
    image,
  };
}
const integer = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;

/** The variable a column names: "d (miles)" → d, "Pattern B" → B. */
const variable = (label: string) =>
  /^([A-Za-z]) \(/.exec(label)?.[1] ?? label.split(" ").at(-1)!;
/** A proportional or constant-difference rule that every row obeys, if any. */
function plotRule(f: Display): PlotRule | null {
  const t = f.table,
    g = f.graph;
  if (!t || !g || g.series.length !== 1) return null;
  const rows = t.rows;
  if (rows.length < 2 || rows.length > 6) return null;
  const points = g.series[0]!.points;
  if (
    points.length !== rows.length ||
    points.some((p, i) => p.x !== rows[i]!.x || p.y !== rows[i]!.y) ||
    rows.some((r) => r.x < 0 || r.y < 0 || r.x > g.xMax || r.y > g.yMax)
  )
    return null;
  const x = variable(t.columns[0]),
    y = variable(t.columns[1]);
  const base = rows.find((r) => r.x !== 0);
  if (!base) return null;
  const k = base.y / base.x;
  if (Number.isInteger(k) && k > 1 && rows.every((r) => r.y === k * r.x))
    return { x, y, k, offset: 0 };
  const offset = rows[0]!.y - rows[0]!.x;
  if (offset > 0 && rows.every((r) => r.y - r.x === offset))
    return { x, y, k: 1, offset };
  return null;
}

/** Only compatible semantic figures opt in. No prompt parsing or answer access. */
export function animationModel(
  lesson: ProblemLessonView,
): AnimationModel | null {
  const g = lesson.example.givens;
  if (
    (lesson.templateId === "root-between-integers" ||
      lesson.templateId === "root-nearest-tenth") &&
    g?.kind === "root" &&
    (g.index === 2 || g.index === 3) &&
    integer(g.radicand, 2, g.index === 2 ? 400 : 1000) &&
    rootFloor(g.radicand, g.index) ** g.index !== g.radicand
  )
    return { kind: "root-zoom", radicand: g.radicand, index: g.index };
  if (
    (lesson.templateId === "scientific-to-standard" ||
      lesson.templateId === "standard-to-scientific") &&
    g?.kind === "power-of-ten" &&
    /^[1-9](\d{0,2}[1-9])?$/.test(g.digits) &&
    integer(g.exponent, -9, 12) &&
    g.exponent !== 0 &&
    g.toStandard === (lesson.templateId === "scientific-to-standard")
  )
    return {
      kind: "decimal-shift",
      digits: g.digits,
      exponent: g.exponent,
      toStandard: g.toStandard,
    };
  const f = lesson.example.figure;
  const geometry = geometryAnimationModel(lesson.templateId, f);
  if (geometry) return geometry;
  const morph = shapeMorphModel(lesson.templateId, f);
  if (morph) return morph;
  if (
    lesson.templateId === "compare-capacity" &&
    f?.kind === "pour" &&
    integer(f.eighths, 1, 9)
  )
    return { kind: "pour", eighths: f.eighths };
  if (
    lesson.templateId === "area-model-product" &&
    f?.kind === "area-model" &&
    f.columns.length === 2 &&
    f.rows.length === 2 &&
    [...f.columns, ...f.rows].every((n) => integer(n, 1, 90))
  )
    return { kind: "area-model", figure: f };
  if (
    (lesson.templateId === "related-patterns-relationship" ||
      lesson.templateId === "dependent-variable-equation") &&
    f?.kind === "function-display"
  ) {
    const rule = plotRule(f);
    return rule
      ? { kind: "plot", rows: f.table!.rows, graph: f.graph!, rule }
      : null;
  }
  if (
    [
      "read-clock-hour-half",
      "clock-hour-read",
      "read-clock-five-minutes",
      "minutes-past-hour",
    ].includes(lesson.templateId) &&
    f?.kind === "analog-clocks" &&
    f.clocks.length === 1 &&
    integer(f.clocks[0]!.hour, 1, 12) &&
    integer(f.clocks[0]!.minute, 5, 55) &&
    f.clocks[0]!.minute % 5 === 0
  )
    return {
      kind: "clock-sweep",
      hour: f.clocks[0]!.hour,
      minute: f.clocks[0]!.minute,
    };
  if (
    lesson.templateId === "decimal-grid-read" &&
    f?.kind === "decimal-grid" &&
    f.unit === "hundredths" &&
    integer(f.shaded, 1, 99)
  )
    return { kind: "decimal-fill", shaded: f.shaded };
  if (
    (lesson.templateId === "compare-decimals-hundredths" ||
      lesson.templateId === "compare-decimals-thousandths") &&
    f?.kind === "place-value-chart" &&
    f.rows.every(
      (row) =>
        integer(row.ones, 0, 9) &&
        /^\d+$/.test(row.decimals) &&
        row.decimals.length <= f.places,
    ) &&
    chartValue(f.rows[0]!, f.places) !== chartValue(f.rows[1]!, f.places)
  )
    return { kind: "decimal-align", figure: f };
  if (
    (lesson.templateId === "unit-cube-volume" ||
      lesson.templateId === "cube-layer-count") &&
    f?.kind === "cube-prism" &&
    integer(f.length, 1, 6) &&
    integer(f.width, 1, 6) &&
    integer(f.height, 2, 6)
  )
    return { kind: "prism-layers", figure: f };
  if (
    lesson.templateId === "first-quadrant-coordinates" &&
    f?.kind === "quadrant-grid" &&
    integer(f.size, 4, 10) &&
    f.points.length === 1
  )
    return { kind: "quadrant-walk", figure: f };
  if (
    (lesson.templateId === "dot-plot-mean" ||
      lesson.templateId === "dot-plot-mad") &&
    f?.kind === "line-plot" &&
    f.mark === "dot" &&
    f.denominator === 1 &&
    validPlot(f)
  ) {
    const mean = f.values.reduce((a, b) => a + b, 0) / f.values.length;
    const lo = Math.min(...f.values),
      hi = Math.max(...f.values);
    // A trial pivot that is not the mean: the middle of the range, or beside it.
    const mid = (lo + hi) / 2;
    const trial = mid !== mean ? mid : mean + (hi - mean > 1 ? 1 : -1);
    return {
      kind: "mean-balance",
      figure: f,
      mad: lesson.templateId === "dot-plot-mad",
      trial,
    };
  }
  if (lesson.templateId === "means-in-mads" && f?.kind === "double-dot-plot") {
    const [a, b] = f.groups.map((g) => g.values);
    const mad = madOf(a!),
      gap = Math.abs(meanOf(a!) - meanOf(b!));
    if (
      integer(mad, 1, 5) &&
      madOf(b!) === mad &&
      integer((2 * gap) / mad, 1, 12)
    )
      return {
        kind: "mad-gap",
        figure: f,
        means: [meanOf(a!), meanOf(b!)],
        mad,
      };
  }
  if (
    lesson.templateId === "dot-plot-iqr" &&
    f?.kind === "line-plot" &&
    f.mark === "dot" &&
    f.denominator === 1 &&
    validPlot(f) &&
    f.values.length >= 4
  )
    return { kind: "box-build", figure: f };
  if (
    lesson.templateId === "balanced-addition" &&
    f?.kind === "equal-balance"
  ) {
    const boxLeft = f.left.includes(null),
      full = (boxLeft ? f.right : f.left) as number[],
      partial = (boxLeft ? f.left : f.right).filter(
        (v): v is number => v !== null,
      );
    const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
    if (
      full.every((v) => integer(v, 0, 20)) &&
      sum(full) <= 20 &&
      sum(partial) < sum(full)
    )
      return { kind: "balance-level", full, partial, boxLeft };
  }
  if (
    lesson.templateId === "unknown-addend-story" &&
    f?.kind === "bar-model" &&
    f.whole !== null &&
    f.parts.length === 2 &&
    integer(f.whole, 2, 20)
  ) {
    const part = f.parts.find((p) => p !== null);
    if (part !== undefined && part !== null && integer(part, 1, f.whole - 1))
      return {
        kind: "tape-join",
        whole: f.whole,
        part,
        partFirst: f.parts[0] !== null,
      };
  }
  if (
    lesson.templateId === "three-addend-story" &&
    f?.kind === "addend-groups" &&
    f.addends.every((v) => integer(v, 1, 9)) &&
    f.addends[0] + f.addends[1] + f.addends[2] <= 20
  )
    return { kind: "make-ten-three", addends: f.addends };
  if (
    lesson.templateId === "multiply-facts" &&
    f?.kind === "dot-array" &&
    f.show === "edges" &&
    integer(f.rows!, 2, 10) &&
    integer(f.columns!, 2, 10)
  )
    return { kind: "array-build", rows: f.rows!, columns: f.columns! };
  if (
    lesson.templateId === "divide-facts" &&
    f?.kind === "dot-array" &&
    (f.show === "first-column" || f.show === "first-row")
  ) {
    const known = (f.show === "first-column" ? f.rows : f.columns) ?? 0,
      other = (f.total ?? 0) / known;
    if (integer(known, 2, 10) && integer(other, 2, 10))
      return f.show === "first-column"
        ? { kind: "array-turn", rows: known, columns: other }
        : { kind: "array-turn", rows: other, columns: known };
  }
  if (
    lesson.templateId === "share-or-group" &&
    f?.kind === "share-model" &&
    integer(f.count, 2, 9) &&
    integer(f.total / f.count, 2, 10) &&
    f.total <= 60
  )
    return {
      kind: "deal",
      total: f.total,
      count: f.count,
      first: f.mode,
    };
  if (
    lesson.templateId === "make-ten-fact" &&
    f?.kind === "ten-frame-pair" &&
    integer(f.first, 1, 9) &&
    integer(f.second, 1, 9) &&
    f.first + f.second > 10
  )
    return { kind: "make-ten", figure: f };
  if (
    (lesson.templateId === "name-equal-share" ||
      lesson.templateId === "name-share") &&
    f?.kind === "partitioned-shapes" &&
    f.shapes.length === 1
  ) {
    const shape = f.shapes[0]!,
      n = shape.sizes.length;
    if (
      integer(n, 2, 4) &&
      shape.sizes.every((w) => w === shape.sizes[0]) &&
      shape.shaded.length >= 1 &&
      shape.shaded.every((i) => integer(i, 0, n - 1))
    )
      return { kind: "partition", shape };
  }
  if (
    (lesson.templateId === "compare-like-denominators" ||
      lesson.templateId === "compare-like-numerators" ||
      lesson.templateId === "compare-unlike-fractions") &&
    f?.kind === "fraction-bars" &&
    f.bars.length === 2
  ) {
    const bars = f.bars.map((bar) => {
      const m = /^(\d+)\/(\d+)$/.exec(bar.label);
      return m && Number(m[2]) === bar.parts
        ? { n: Number(m[1]), d: bar.parts }
        : null;
    });
    const [a, b] = bars;
    if (
      a &&
      b &&
      integer(a.d, 1, 12) &&
      integer(b.d, 1, 12) &&
      integer(a.n, 0, a.d) &&
      integer(b.n, 0, b.d) &&
      a.n * b.d !== b.n * a.d
    )
      return { kind: "compare", bars: [a, b] };
  }
  if (
    (lesson.templateId === "equal-area-fraction" ||
      lesson.templateId === "equal-area-part-size") &&
    f?.kind === "area-partition" &&
    f.shaded.length === 1
  ) {
    const count = Math.max(...f.regions) + 1,
      size = f.regions.filter((r) => r === 0).length;
    if (
      integer(count, 2, 12) &&
      f.regions.length === f.columns * f.rows &&
      Array.from(
        { length: count },
        (_, r) => f.regions.filter((x) => x === r).length,
      ).every((c) => c === size)
    )
      return { kind: "area", figure: f };
  }
  if (
    lesson.templateId === "compare-groups" &&
    f?.kind === "counter-rows" &&
    integer(f.circles, 1, 10) &&
    integer(f.squares, 1, 10)
  )
    return { kind: "pairing", figure: f };
  if (
    lesson.templateId === "compare-two-digit" &&
    f?.kind === "base-ten-pair" &&
    f.values.every((n) => integer(n, 10, 99))
  )
    return { kind: "place-compare", figure: f };
  if (
    lesson.templateId === "add-two-digit-regroup" &&
    f?.kind === "base-ten-pair" &&
    f.values.every((n) => integer(n, 10, 99)) &&
    f.values[0] + f.values[1] <= 100
  )
    return { kind: "regroup-sum", figure: f };
  if (
    lesson.templateId === "fraction-model" &&
    f?.kind === "fraction" &&
    integer(f.parts, 2, 12) &&
    integer(f.selected, 0, f.parts)
  )
    return { kind: "fraction", figure: f };
  if (
    lesson.templateId === "split-array-part" &&
    f?.kind === "unit-array" &&
    integer(f.rows, 2, 12) &&
    integer(f.columns, 1, 12) &&
    f.splitAfterRow !== undefined &&
    integer(f.splitAfterRow, 1, f.rows - 1)
  )
    return { kind: "array", figure: { ...f, splitAfterRow: f.splitAfterRow } };
  if (
    lesson.templateId === "opposite-on-line" &&
    f?.kind === "signed-line" &&
    f.jumps === undefined &&
    f.points.length === 1 &&
    integer(f.points[0]!.value, f.min, f.max) &&
    f.points[0]!.value !== 0 &&
    integer(-f.points[0]!.value, f.min, f.max)
  )
    return {
      kind: "opposite",
      value: f.points[0]!.value,
      min: f.min,
      max: f.max,
    };
  if (
    lesson.templateId === "signed-jumps" &&
    f?.kind === "signed-line" &&
    f.start !== undefined &&
    f.jumps !== undefined &&
    f.jumps.length >= 1 &&
    f.jumps.length <= 4 &&
    Number.isInteger(f.min) &&
    Number.isInteger(f.max) &&
    f.max > f.min &&
    half(f.start) &&
    f.jumps.every((j) => half(j) && j !== 0) &&
    jumpStops(f.start, f.jumps).every((v) => v >= f.min && v <= f.max)
  )
    return {
      kind: "jumps",
      start: f.start,
      jumps: f.jumps,
      min: f.min,
      max: f.max,
    };
  if (
    lesson.templateId === "double-number-line-missing" &&
    f?.kind === "double-number-line"
  )
    return rateModel(f);
  if (
    (lesson.templateId === "line-plot-whole" ||
      lesson.templateId === "fraction-line-plot") &&
    f?.kind === "line-plot" &&
    validPlot(f)
  )
    return { kind: "line-plot-stack", figure: f };
  if (
    lesson.templateId === "fraction-plot-equal-share" &&
    f?.kind === "line-plot" &&
    validPlot(f)
  ) {
    const total = f.values.reduce((a, b) => a + b, 0);
    // The shared amount must land on a tick, and all marks must fit one stack.
    if (total % f.values.length === 0 && f.values.length <= 8)
      return {
        kind: "line-plot-share",
        figure: f,
        share: total / f.values.length,
      };
  }
  if (
    lesson.templateId === "exchange-base-ten" &&
    f?.kind === "base-ten" &&
    integer(f.hundreds, 0, 9) &&
    integer(f.tens, 0, 19) &&
    integer(f.ones, 0, 19)
  ) {
    if (f.ones >= 10 && f.tens < 10)
      return { kind: "exchange", figure: f, unit: 1 };
    if (f.tens >= 10 && f.ones < 10)
      return { kind: "exchange", figure: f, unit: 10 };
  }
  if (
    motionTemplates.has(lesson.templateId) &&
    f?.kind === "coordinate-geometry"
  )
    return motionModel(f);
  if (
    (lesson.templateId === "balance-one-step" ||
      lesson.templateId === "balance-two-step") &&
    f?.kind === "balance-scale"
  ) {
    const form = balanceForm(f);
    if (!form) return null;
    // The weight follows from the figure's counts; the lesson answer is not read.
    const x = (f.right - f.groups * f.units) / (f.groups * f.blocks);
    return Number.isInteger(x) && x >= 1
      ? { kind: "balance", figure: f, form, x }
      : null;
  }
  return null;
}
/** Greatest whole number whose square (or cube) is at most n. */
export function rootFloor(n: number, index: 2 | 3) {
  let k = Math.floor(Math.round(n ** (1 / index) * 1e6) / 1e6);
  while ((k + 1) ** index <= n) k++;
  while (k ** index > n) k--;
  return k;
}
/** An integer m scaled by 10^-places, as exact decimal text. */
export function scaled(m: number, places: number) {
  const digits = String(m).padStart(places + 1, "0");
  return places
    ? `${digits.slice(0, -places)}.${digits.slice(-places)}`
    : digits;
}
/** The tenth just below the root, and the nearest tenth, both in tenths. */
export function rootZoom(n: number, index: 2 | 3) {
  const k = rootFloor(n, index),
    t = rootFloor(n * 10 ** index, index);
  // Halfway point (2t + 1)/20 = (10t + 5)/100; compare its power with n exactly.
  const half = (10 * t + 5) ** index,
    up = n * 100 ** index > half;
  return { k, t, up, nearest: up ? t + 1 : t, half };
}
const tenthText = (t: number) => scaled(t, 1);
/** Standard form of digits × 10^(exponent − digits + 1), e.g. 307, −4 → 0.000307. */
export function standardForm(digits: string, exponent: number) {
  const point = exponent + 1;
  if (point >= digits.length) return digits + "0".repeat(point - digits.length);
  if (point > 0) return `${digits.slice(0, point)}.${digits.slice(point)}`;
  return `0.${"0".repeat(-point)}${digits}`;
}
export const coefficientText = (digits: string) =>
  digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
const group = (text: string) => {
  const [whole, part] = text.split(".");
  const grouped =
    whole!.length >= 5 ? whole!.replace(/\B(?=(\d{3})+$)/g, "{,}") : whole!;
  return part === undefined ? grouped : `${grouped}.${part}`;
};
const placeCount = (n: number) => `${n} ${n === 1 ? "place" : "places"}`;
function balanceForm(f: Balance): BalanceForm | null {
  if (
    !integer(f.groups, 1, 3) ||
    !integer(f.blocks, 1, 5) ||
    !integer(f.units, 0, 12) ||
    !integer(f.right, 1, 30)
  )
    return null;
  if (f.groups > 1)
    return f.blocks === 1 && f.units >= 1 ? "split-remove" : null;
  if (f.blocks === 1) return f.units >= 1 ? "add" : null;
  return f.units === 0 ? "times" : "remove-split";
}
function balanceFrames(model: Extract<AnimationModel, { kind: "balance" }>) {
  const { groups: g, blocks: p, units: q, right: r } = model.figure;
  const x = model.x;
  const cubes = (n: number) => `${n} ${n === 1 ? "cube" : "cubes"}`;
  if (model.form === "add")
    return [
      {
        title: "Read the balance",
        text: `Level pans hold equal weights: one x block and ${cubes(q)} balance ${cubes(r)}.`,
        math: `$x + ${q} = ${r}$`,
      },
      {
        title: "Remove the same weight from both pans",
        text: `Take ${cubes(q)} off each pan. Both pans lose ${q} grams, so the balance stays level.`,
        math: `$x + ${q} - ${q} = ${r} - ${q}$`,
      },
      {
        title: "The block is alone",
        text: `One x block balances ${cubes(x)}.`,
        math: `$x = ${x}$`,
      },
    ];
  if (model.form === "times")
    return [
      {
        title: "Read the balance",
        text: `Level pans hold equal weights: ${p} x blocks balance ${cubes(r)}.`,
        math: `$${p}x = ${r}$`,
      },
      {
        title: `Split both pans into ${p} equal groups`,
        text: `Each group on the left is one x block. Each group on the right has ${cubes(x)}.`,
        math: `$${p}x \\div ${p} = ${r} \\div ${p}$`,
      },
      {
        title: "Keep one group from each pan",
        text: `One x block balances one group of ${cubes(x)}.`,
        math: `$x = ${x}$`,
      },
    ];
  if (model.form === "remove-split")
    return [
      {
        title: "Read the balance",
        text: `Level pans hold equal weights: ${p} x blocks and ${cubes(q)} balance ${cubes(r)}.`,
        math: `$${p}x + ${q} = ${r}$`,
      },
      {
        title: "Remove the loose cubes from both pans",
        text: `Take ${cubes(q)} off each pan. The balance stays level.`,
        math: `$${p}x = ${r} - ${q} = ${r - q}$`,
      },
      {
        title: `Split both pans into ${p} equal groups`,
        text: `Each x block balances one group of ${cubes(x)}.`,
        math: `$x = ${r - q} \\div ${p} = ${x}$`,
      },
    ];
  return [
    {
      title: "Read the balance",
      text: `Level pans hold equal weights: ${g} bags, each holding one x block and ${cubes(q)}, balance ${cubes(r)}.`,
      math: `$${g}(x + ${q}) = ${r}$`,
    },
    {
      title: `Split both pans into ${g} equal groups`,
      text: `One bag balances one group of ${cubes(r / g)}.`,
      math: `$x + ${q} = ${r} \\div ${g} = ${r / g}$`,
    },
    {
      title: "Remove the same weight from every group",
      text: `Take the ${cubes(q)} out of each bag and ${cubes(q)} from each group on the right.`,
      math: `$x = ${r / g} - ${q} = ${x}$`,
    },
  ];
}
const WORDS = ["zero", "one", "two", "three", "four"];
const UNIT: Record<number, [string, string]> = {
  2: ["half", "halves"],
  3: ["third", "thirds"],
  4: ["quarter", "quarters"],
};
const coordTex = (v: number) => String(v);
const texPoints = (points: LabeledPoint[]) =>
  // One formula per point, so a narrow panel wraps between points.
  points
    .map((p) => `$${p.label.replace("′", "'")}(${coordTex(p.x)}, ${coordTex(p.y)})$`)
    .join(", ");
const amount = (v: number, plus: string, minus: string) =>
  `${Math.abs(v)} ${Math.abs(v) === 1 ? "unit" : "units"} ${v > 0 ? plus : minus}`;
function motionFrames(model: Extract<AnimationModel, { kind: "motion" }>) {
  const m = model.motion;
  const k =
    m.kind === "dilate"
      ? m.denominator === 1
        ? String(m.numerator)
        : `${m.numerator}/${m.denominator}`
      : "";
  const kTex =
    m.kind === "dilate"
      ? m.denominator === 1
        ? String(m.numerator)
        : `\\tfrac{${m.numerator}}{${m.denominator}}`
      : "";
  const [guideTitle, guideText, rule, result] =
    m.kind === "translate"
      ? [
          "Slide every point",
          `Every vertex moves ${[...(m.dx ? [amount(m.dx, "right", "left")] : []), ...(m.dy ? [amount(m.dy, "up", "down")] : [])].join(" and ")}.`,
          `$(x, y) \\to (x ${m.dx < 0 ? "-" : "+"} ${Math.abs(m.dx)},\\ y ${m.dy < 0 ? "-" : "+"} ${Math.abs(m.dy)})$`,
          "Same size and shape, in a new place.",
        ]
      : m.kind === "reflect"
        ? [
            `Mirror line: the ${m.axis}-axis`,
            `Each vertex moves straight across the ${m.axis}-axis, at a right angle to it, to the same distance on the other side.`,
            m.axis === "x" ? "$(x, y) \\to (x, -y)$" : "$(x, y) \\to (-x, y)$",
            `Same size and shape, flipped over the ${m.axis}-axis.`,
          ]
        : m.kind === "rotate"
          ? [
              m.degrees === 180
                ? "Half turn about the origin"
                : "Quarter turn about the origin",
              `Each vertex turns ${m.degrees === 180 ? "180°" : `90° ${m.degrees === 90 ? "counterclockwise" : "clockwise"}`} around the origin and keeps its distance from it.`,
              m.degrees === 90
                ? "$(x, y) \\to (-y, x)$"
                : m.degrees === 180
                  ? "$(x, y) \\to (-x, -y)$"
                  : "$(x, y) \\to (y, -x)$",
              "Same size and shape, turned about the origin.",
            ]
          : [
              "Rays from the center",
              `Each vertex moves along its ray from the origin, and its distance from the origin is multiplied by ${k}.`,
              `$(x, y) \\to (${kTex}x,\\ ${kTex}y)$`,
              m.numerator > m.denominator
                ? `Same shape; every length is ${k} times as long.`
                : `Same shape; every length is ${k} as long.`,
            ];
  return [
    {
      title: "The pre-image",
      text: `Triangle ${model.given.map((p) => p.label).join("")} before the ${m.kind === "dilate" ? "dilation" : "motion"}.`,
      math: texPoints(model.given),
    },
    { title: guideTitle, text: guideText, math: rule },
    {
      title: `The image ${model.image.map((p) => p.label).join("")}`,
      text: result,
      math: texPoints(model.image),
    },
  ];
}
function validPlot(f: LinePlot) {
  return (
    integer(f.start, 0, 400) &&
    integer(f.end, f.start + 1, f.start + 12) &&
    f.values.length >= 3 &&
    f.values.length <= 24 &&
    f.values.every((v) => integer(v, f.start, f.end))
  );
}
const plotted = (v: number, d: number) => {
  const whole = Math.floor(v / d),
    rest = v % d;
  if (!rest) return `${whole}`;
  let a = rest,
    b = d;
  while (b) [a, b] = [b, a % b];
  const frac = `\\tfrac{${rest / a}}{${d / a}}`;
  return whole ? `${whole}${frac}` : frac;
};
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
const tex = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "{,}");
/** Whole-number lines with 0, one known pair and one pair with an unknown. */
function rateModel(f: RateLines): RateModel | null {
  const { top, bottom } = f;
  if (top.denominator !== 1 || bottom.denominator !== 1) return null;
  if (top.numerators.length !== 3 || bottom.numerators.length !== 3)
    return null;
  if (top.numerators[0] !== 0 || bottom.numerators[0] !== 0) return null;
  const columns = [1, 2].map((i) => [
    bottom.numerators[i] ?? null,
    top.numerators[i] ?? null,
  ]);
  const known = columns.find(([b, t]) => b !== null && t !== null),
    asked = columns.find(([b, t]) => (b === null) !== (t === null));
  if (!known || !asked) return null;
  const [b, t] = known as [number, number];
  if (!integer(b, 1, 1000) || !integer(t, 1, 100000) || t % b) return null;
  const rate = t / b,
    findBottom = asked[0] === null;
  const target: [number, number] = findBottom
    ? [asked[1]! / rate, asked[1]!]
    : [asked[0]!, asked[0]! * rate];
  if (!integer(target[0], 2, 1000) || target[0] === b) return null;
  return {
    kind: "rate",
    top: top.label,
    bottom: bottom.label,
    given: [b, t],
    target,
    findBottom,
  };
}
/** A chart row as a whole number of the smallest place: 0.45 → 450 (3 places). */
export const chartValue = (
  row: { ones: number; decimals: string },
  places: number,
) => Number(`${row.ones}${row.decimals.padEnd(places, "0")}`);
/** Index of the first differing column, ones = 0. */
export const firstDifference = (figure: DecimalChart) => {
  const [a, b] = figure.rows.map(
    (row) => `${row.ones}${row.decimals.padEnd(figure.places, "0")}`,
  );
  let i = 0;
  while (a![i] === b![i]) i++;
  return i;
};
const written = (row: { ones: number; decimals: string }) =>
  `${row.ones}.${row.decimals}`;
/** Quartiles by the median-of-halves convention (overall median left out for odd counts). */
export function fiveNumbers(values: readonly number[]) {
  const xs = [...values].sort((a, b) => a - b),
    n = xs.length;
  const median = (v: number[]) => {
    const k = Math.floor(v.length / 2);
    return v.length % 2 ? v[k]! : (v[k - 1]! + v[k]!) / 2;
  };
  return {
    min: xs[0]!,
    q1: median(xs.slice(0, Math.floor(n / 2))),
    median: median(xs),
    q3: median(xs.slice(Math.ceil(n / 2))),
    max: xs[n - 1]!,
  };
}
const num = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));

export function animationFrames(model: AnimationModel) {
  if (model.kind === "motion") return motionFrames(model);
  if (
    model.kind === "triangle-sum" ||
    model.kind === "exterior-angle" ||
    model.kind === "transversal" ||
    model.kind === "plane-sweep"
  )
    return geometryFrames(model);
  if (model.kind === "root-zoom") {
    const { radicand: n, index: i } = model,
      { k, t, up, nearest, half } = rootZoom(n, i);
    const root = i === 2 ? `\\sqrt{${n}}` : `\\sqrt[3]{${n}}`,
      power = (x: number, places: number) => scaled(x ** i, places * i);
    return [
      {
        title: "Between whole numbers",
        text: `${n} is between ${k ** i} and ${(k + 1) ** i}, so its ${i === 2 ? "square" : "cube"} root is between ${k} and ${k + 1}.`,
        math: `$${k}^${i} = ${k ** i} < ${n} < ${(k + 1) ** i} = ${k + 1}^${i}$`,
      },
      {
        title: "Zoom in to tenths",
        text: `Between ${k} and ${k + 1}, ${n} falls between the ${i === 2 ? "squares" : "cubes"} of ${tenthText(t)} and ${tenthText(t + 1)}.`,
        math: `$${tenthText(t)}^${i} = ${power(t, 1)} < ${n} < ${power(t + 1, 1)} = ${tenthText(t + 1)}^${i}$`,
      },
      {
        title: "Compare with the halfway point",
        text: `${scaled(10 * t + 5, 2)}${i === 2 ? "²" : "³"} = ${scaled(half, 2 * i)}. ${n} is ${up ? "greater" : "less"}, so the root is closer to ${tenthText(nearest)}.`,
        math: `$${root} \\approx ${tenthText(nearest)}$`,
      },
    ];
  }
  if (model.kind === "decimal-shift") {
    const { digits, exponent: e, toStandard } = model,
      coefficient = coefficientText(digits),
      standard = group(standardForm(digits, e)),
      places = placeCount(Math.abs(e)),
      direction = e > 0 ? "right" : "left";
    const scientific = `${coefficient} \\times 10^{${e}}`;
    return toStandard
      ? [
          {
            title: "The digits stay fixed",
            text: `The digits ${digits.split("").join(", ")} keep their order. Only the decimal point moves.`,
            math: `$${scientific}$`,
          },
          {
            title: `Move the point ${places} ${direction}`,
            text: `Each factor of 10 moves the point one place. ${e > 0 ? "Multiplying" : "Dividing"} by 10 ${Math.abs(e) === 1 ? "once" : `${Math.abs(e)} times`} moves it ${places} ${direction}.`,
            math: `$\\times 10^{${e}}$`,
          },
          {
            title: "Fill the empty places with zeros",
            text: "Zeros hold the places between the digits and the decimal point.",
            math: `$${scientific} = ${standard}$`,
          },
        ]
      : [
          {
            title: "Start from standard form",
            text: `The digits ${digits.split("").join(", ")} keep their order. Only the decimal point moves.`,
            math: `$${standard}$`,
          },
          {
            title: "Move the point after the first nonzero digit",
            text: `The point moves ${places} to the ${e > 0 ? "left" : "right"}, leaving ${coefficient}.`,
            math: `$${coefficient}$`,
          },
          {
            title: "The count becomes the exponent",
            text:
              e > 0
                ? "The number is 10 or more, so the exponent is positive."
                : "The number is less than 1, so the exponent is negative.",
            math: `$${standard} = ${scientific}$`,
          },
        ];
  }
  if (model.kind === "opposite") {
    const a = model.value,
      d = Math.abs(a),
      units = `${d} ${d === 1 ? "unit" : "units"}`;
    return [
      {
        title: "Read the point",
        text: `P is ${units} to the ${a < 0 ? "left" : "right"} of 0.`,
        math: `$P = ${signedTex(a)}$`,
      },
      {
        title: "Reflect across 0",
        text: "Swing P over 0 to the other side. Its distance from 0 does not change.",
        math: `$\\text{distance from } 0 = ${d}$`,
      },
      {
        title: "Name the opposite",
        text: `The opposite of ${shown(a)} is ${shown(-a)}: ${units} from 0 on the ${a < 0 ? "right" : "left"}.`,
        math: `$-(${signedTex(a)}) = ${signedTex(-a)}$`,
      },
    ];
  }
  if (model.kind === "jumps") {
    const stops = jumpStops(model.start, model.jumps),
      end = stops.at(-1)!;
    const sum = [
      signedTex(model.start),
      ...model.jumps.map((j) => signedTex(j, true)),
    ].join(" + ");
    return [
      {
        title: "Start",
        text: `Begin at ${shown(model.start)}. Moving right adds a positive change; moving left adds a negative change.`,
        math: `$${signedTex(model.start)}$`,
      },
      {
        title: "Make each jump",
        text: `Each arrow adds one change, in order: ${model.jumps.map((j) => (j > 0 ? `+${j}` : shown(j))).join(", then ")}.`,
        math: `$${sum}$`,
      },
      {
        title: "Land",
        text: `The last arrow ends at ${shown(end)}, ${end < 0 ? "left" : "right"} of 0.`,
        math: `$${sum} = ${signedTex(end)}$`,
      },
    ];
  }
  if (model.kind === "pour") {
    const e = model.eighths;
    const result =
      e < 8
        ? {
            title: "Room left in B",
            text: "All of A's water fits in B with room to spare, so B holds more.",
            math: "B holds more",
          }
        : e === 8
          ? {
              title: "B is exactly full",
              text: "A's water fills B exactly to the top, so the jars hold the same amount.",
              math: "A and B hold the same",
            }
          : {
              title: "B overflows",
              text: "A's water is more than B can hold; some spills. A holds more.",
              math: "A holds more",
            };
    return [
      {
        title: "Fill A",
        text: "A is full. B is empty. Their shapes differ, so looking is not enough.",
        math: "A full, B empty",
      },
      {
        title: "Pour all of A into B",
        text: "Every drop of A's water goes into B.",
        math: "A → B",
      },
      result,
    ];
  }
  if (model.kind === "area-model") {
    const { columns, rows } = model.figure;
    const a = columns[0]! + columns[1]!,
      b = rows[0]! + rows[1]!;
    const parts = rows.flatMap((y) => columns.map((x) => x * y));
    return [
      {
        title: "One rectangle",
        text: `A rectangle ${a} wide and ${b} tall has area ${a} × ${b}.`,
        math: `$${a} \\times ${b}$`,
      },
      {
        title: "Split by place value",
        text: `${a} = ${columns.join(" + ")} and ${b} = ${rows.join(" + ")}. Each region is a partial product.`,
        math: `$(${columns.join(" + ")}) \\times (${rows.join(" + ")})$`,
      },
      {
        title: "Add the regions",
        text: "The four regions fill the rectangle exactly, so their areas add to the whole.",
        math: `$${parts.map(tex).join(" + ")} = ${tex(a * b)}$`,
      },
    ];
  }
  if (model.kind === "rate") {
    const [b, t] = model.given,
      [tb, tt] = model.target,
      rate = t / b;
    const bottom = model.bottom.toLowerCase(),
      top = model.top.toLowerCase();
    return [
      {
        title: "Start from a known pair",
        text: `Aligned marks pair ${t} on the ${top} line with ${b} on the ${bottom} line.`,
        math: `$${t}$ and $${b}$`,
      },
      {
        title: "Shrink both lines to 1",
        text: `Divide both values by ${b}. The pair keeps its ratio and lands on 1.`,
        math: `$${t} \\div ${b} = ${rate}$ and $${b} \\div ${b} = 1$`,
      },
      {
        title: model.findBottom
          ? "Stretch to the known value"
          : "Stretch to the target",
        text: model.findBottom
          ? `Multiply both values by ${tb}, because ${tb} groups of ${rate} make ${tt}.`
          : `Multiply both values by ${tb}. The marks stay aligned.`,
        math: model.findBottom
          ? `$${tt} \\div ${rate} = ${tb}$`
          : `$${rate} \\times ${tb} = ${tt}$`,
      },
    ];
  }
  if (model.kind === "shape-morph") return shapeMorphFrames(model);
  if (model.kind === "plot") {
    const { rows, rule } = model;
    const first = rows.find((r) => r.x !== 0) ?? rows[0]!;
    const pairs = rows.map((r) => `(${r.x}, ${r.y})`).join(",\\ ");
    const equation =
      rule.offset === 0
        ? `${rule.y} = ${rule.k}${rule.x}`
        : `${rule.y} = ${rule.x} + ${rule.offset}`;
    return [
      {
        title: "Read the pairs",
        text: `Each row of the table matches a value of ${rule.x} with the value of ${rule.y} that goes with it.`,
        math: `$${pairs}$`,
      },
      {
        title: "Plot each pair",
        text: `Each pair becomes one point: across to the value of ${rule.x}, then up to the value of ${rule.y}. For (${first.x}, ${first.y}): ${first.x} across, ${first.y} up.`,
        math: `$(${rule.x}, ${rule.y}) \\to$ point`,
      },
      {
        title: "Read the rule",
        text:
          rule.offset === 0
            ? `The points lie on one straight line through (0, 0): every ${rule.y} is ${rule.k} times its ${rule.x}, as in ${first.y} = ${rule.k} × ${first.x}.`
            : `The points lie on one straight line: every ${rule.y} is ${rule.offset} more than its ${rule.x}, as in ${first.y} = ${first.x} + ${rule.offset}.`,
        math: `$${equation}$`,
      },
    ];
  }
  if (model.kind === "clock-sweep") {
    const { hour: h, minute: m } = model,
      n = m / 5,
      next = (h % 12) + 1;
    const fives = Array.from({ length: n }, (_, i) => 5 * (i + 1));
    return [
      {
        title: `Start at ${h} o'clock`,
        text: `On the hour the long hand points at 12 and the short hand points at ${h}.`,
        math: `$${h}{:}00$`,
      },
      {
        title: "The long hand counts minutes",
        text: `The long hand turns to ${n}. Each numeral is 5 minutes: ${fives.join(", ")}.`,
        math: `$${n} \\times 5 = ${m}$ minutes`,
      },
      {
        title: "The short hand moves too",
        text: `In ${m} minutes the short hand moves ${m}/60 of the way from ${h} to ${next}. It has not reached ${next}, so the hour is still ${h}.`,
        math: `$${h}{:}${String(m).padStart(2, "0")}$`,
      },
    ];
  }
  if (model.kind === "balance") return balanceFrames(model);
  if (model.kind === "decimal-fill") {
    const k = model.shaded,
      t = Math.floor(k / 10),
      h = k % 10;
    const two = `0.${String(k).padStart(2, "0")}`;
    return [
      {
        title: "One whole, 100 squares",
        text: "Each small square is one hundredth. Each column of 10 squares is one tenth.",
        math: "$1 = \\dfrac{10}{10} = \\dfrac{100}{100}$",
      },
      {
        title: "Fill whole columns: tenths",
        text: t
          ? `${t} full ${t === 1 ? "column is" : "columns are"} ${t} ${t === 1 ? "tenth" : "tenths"}, the first digit after the point.`
          : "No full column is shaded, so there are 0 tenths.",
        math: `$\\dfrac{${t}}{10} = 0.${t}$`,
      },
      {
        title: "Add single squares: hundredths",
        text: h
          ? `${h} more ${h === 1 ? "square is" : "squares are"} ${h} ${h === 1 ? "hundredth" : "hundredths"}, the second digit.`
          : "No single squares are left over, so the hundredths digit is 0.",
        math: `$\\dfrac{${t}}{10} + \\dfrac{${h}}{100} = \\dfrac{${k}}{100} = ${two}$`,
      },
    ];
  }
  if (model.kind === "decimal-align") {
    const f = model.figure,
      [a, b] = f.rows;
    const pad = (row: { ones: number; decimals: string }) =>
      `${row.ones}.${row.decimals.padEnd(f.places, "0")}`;
    const i = firstDifference(f);
    const sign =
      chartValue(a!, f.places) > chartValue(b!, f.places) ? ">" : "<";
    const place = ["ones", "tenths", "hundredths", "thousandths"][i]!;
    const pa = pad(a!),
      pb = pad(b!);
    const digit = (p: string) => p.replace(".", "")[i];
    return [
      {
        title: "Line up the decimal points",
        text: "Each column holds one place: ones, then tenths, hundredths and thousandths.",
        math: `$${written(a!)}$ and $${written(b!)}$`,
      },
      {
        title: "Fill empty places with zeros",
        text: "A zero in an empty place on the right adds nothing, so the values stay the same.",
        math: `$${pa}$ and $${pb}$`,
      },
      {
        title: "Compare from the left",
        text: `The first column that differs is the ${place}: ${digit(pa)} and ${digit(pb)}. Columns to its right cannot change the result.`,
        math: `$${written(a!)} ${sign} ${written(b!)}$`,
      },
    ];
  }
  if (model.kind === "prism-layers") {
    const { length: l, width: w, height: h } = model.figure,
      layer = l * w;
    return [
      {
        title: "One layer",
        text: `The top shows ${l} by ${w} cubes. The bottom layer is the same.`,
        math: `$${l} \\times ${w} = ${layer}$ cubes`,
      },
      {
        title: "Stack the layers",
        text: `${h} identical layers fill the prism, hidden cubes included.`,
        math: `$${h}$ layers`,
      },
      {
        title: "Multiply",
        text: `Each of the ${h} layers holds ${layer} cubes.`,
        math: `$V = ${layer} \\times ${h} = ${layer * h}$ cubic units`,
      },
    ];
  }
  if (model.kind === "quadrant-walk") {
    const { x, y } = model.figure.points[0]!;
    return [
      {
        title: "Start at the origin",
        text: "Both coordinates are 0 where the axes meet.",
        math: "$(0, 0)$",
      },
      {
        title: "Across first",
        text: `Go ${x} across along the x-axis: the first coordinate.`,
        math: `$x = ${x}$`,
      },
      {
        title: "Then up",
        text: `Go ${y} up to reach the point: the second coordinate.`,
        math: `$(${x}, ${y})$`,
      },
    ];
  }
  if (model.kind === "mean-balance") {
    const { values } = model.figure,
      n = values.length,
      sum = values.reduce((a, b) => a + b, 0),
      mean = sum / n;
    const below = values
      .filter((v) => v < mean)
      .reduce((a, v) => a + (mean - v), 0);
    const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
    const frac = (p: number, q: number) => {
      const k = g(Math.abs(p), q);
      return q / k === 1
        ? { tex: `${p / k}`, text: `${p / k}` }
        : {
            tex: `\\tfrac{${p / k}}{${q / k}}`,
            text: `${p / k}/${q / k}`,
          };
    };
    const belowText = frac(Math.round(below * n), n);
    return [
      {
        title: "Put the dots on a beam",
        text: `${n} values sit on the number line like equal weights.`,
        math: `$\\text{sum} = ${sum}$`,
      },
      {
        title: "Try a pivot",
        text: `With the pivot at ${num(model.trial)}, the beam tips: one side carries more total distance.`,
        math: `$\\text{pivot} = ${num(model.trial)}$`,
      },
      model.mad
        ? {
            title: "Balance, then measure the spread",
            text: `The beam balances at the mean. The distances below it equal the distances above it, ${belowText.text} each side. The MAD is the mean of all the distances.`,
            math: `$\\text{MAD} = \\dfrac{2 \\times ${belowText.tex}}{${n}}$`,
          }
        : {
            title: "Balance at the mean",
            text: `The beam balances at ${frac(sum, n).text}: the distances below it add up to the distances above it.`,
            math: `$${sum} \\div ${n} = ${frac(sum, n).tex}$`,
          },
    ];
  }
  if (model.kind === "mad-gap") {
    const [g1, g2] = model.figure.groups,
      [m1, m2] = model.means,
      gap = Math.abs(m1 - m2),
      k = gap / model.mad;
    return [
      {
        title: "Two groups, one scale",
        text: `${g1.label} (top) and ${g2.label} (bottom) share one number line, so equal values line up. Both have a MAD of ${model.mad}.`,
        math: `$\\text{MAD} = ${model.mad}$`,
      },
      {
        title: "Find each mean",
        text: [g1, g2]
          .map(
            (g, i) =>
              `${g.label}: ${g.values.reduce((a, b) => a + b, 0)}\u00a0÷\u00a0${g.values.length}\u00a0=\u00a0${num(model.means[i]!)}.`,
          )
          .join(" "),
        math: `$${num(Math.max(m1, m2))} - ${num(Math.min(m1, m2))} = ${num(gap)}$`,
      },
      {
        title: "Lay MADs across the gap",
        text: `The gap of ${num(gap)} holds ${num(k)} MADs of ${model.mad}. The more MADs between the means, the less the groups overlap.`,
        math: `$${num(gap)} \\div ${model.mad} = ${num(k)}$`,
      },
    ];
  }
  if (model.kind === "box-build") {
    const q = fiveNumbers(model.figure.values);
    return [
      {
        title: "The ordered data",
        text: "A dot plot already lists the values in order, left to right.",
        math: `$${model.figure.values.length}\\text{ values}$`,
      },
      {
        title: "Split at the median, then split each half",
        text: "The median cuts the data into halves; each half’s median is a quartile.",
        math: `$Q_1 = ${num(q.q1)},\\; \\text{median} = ${num(q.median)},\\; Q_3 = ${num(q.q3)}$`,
      },
      {
        title: "Draw the box",
        text: "The box spans the middle half of the data, from Q1 to Q3; the whiskers reach the least and greatest values.",
        math: `$\\text{IQR} = ${num(q.q3)} - ${num(q.q1)} = ${num(q.q3 - q.q1)}$`,
      },
    ];
  }
  if (model.kind === "balance-level") {
    const { full, partial } = model,
      total = full.reduce((a, b) => a + b, 0),
      known = partial.reduce((a, b) => a + b, 0),
      missing = total - known;
    const fullText = full.join(" + ");
    return [
      {
        title: "Load one side",
        text: `One pan holds ${fullText}${full.length > 1 ? ` = ${total}` : ""} counters. The empty pan rises.`,
        math: `$${fullText}${full.length > 1 ? ` = ${total}` : ""}$`,
      },
      {
        title: "Not level yet",
        text: known
          ? `The other pan holds ${known} and the closed box. ${known} is less than ${total}, so that pan is still high.`
          : `The other pan holds only the closed box. It must weigh as much as ${total} counters.`,
        math: known ? `$${known} < ${total}$` : `$\\square = ${total}$`,
      },
      {
        title: "Level",
        text: `The box holds ${missing}. Now both pans hold ${total}, and the beam is level.`,
        math: known
          ? `$${known} + ${missing} = ${fullText}$`
          : `$${missing} = ${fullText}$`,
      },
    ];
  }
  if (model.kind === "tape-join") {
    const { whole, part } = model,
      missing = whole - part;
    return [
      {
        title: "The whole and one part",
        text: `The top bar is the whole, ${whole}. The bar below shows one part, ${part}.`,
        math: `$${part} + \\square = ${whole}$`,
      },
      {
        title: "Join the missing part",
        text: `The missing part fills the rest of the bar, from ${part} up to ${whole}.`,
        math: `$\\square = ${whole} - ${part}$`,
      },
      {
        title: "Name the part",
        text: `Counting up from ${part} to ${whole} takes ${missing}.`,
        math: `$${part} + ${missing} = ${whole}$`,
      },
    ];
  }
  if (model.kind === "make-ten-three") {
    const [a, b, c] = model.addends,
      total = a + b + c,
      pair = tenPair(model.addends);
    if (pair) {
      const [x, y, z] = pair.map((i) => model.addends[i]!);
      return [
        {
          title: "Three groups",
          text: `${a}, ${b} and ${c}. Look for two that make ten.`,
          math: `$${a} + ${b} + ${c}$`,
        },
        {
          title: "Make a ten",
          text: `${x} and ${y} fill the ten-frame exactly.`,
          math: `$${x} + ${y} = 10$`,
        },
        {
          title: "Add the rest",
          text: `One full ten and ${z} more. Changing the order did not change the total.`,
          math: `$10 + ${z} = ${total}$`,
        },
      ];
    }
    return [
      {
        title: "Three groups",
        text: `${a}, ${b} and ${c}. No two make ten, so join two first.`,
        math: `$${a} + ${b} + ${c}$`,
      },
      {
        title: "Join two groups",
        text: `${a} and ${b} go into the frames${a + b > 10 ? ", filling a ten" : ""}.`,
        math: `$${a} + ${b} = ${a + b}$`,
      },
      {
        title: "Add the third",
        text: `${c} more counters follow.`,
        math: `$${a + b} + ${c} = ${total}$`,
      },
    ];
  }
  if (model.kind === "array-build") {
    const { rows: a, columns: b } = model;
    return [
      {
        title: "One row",
        text: `One row holds ${b} dots.`,
        math: `$${b}$`,
      },
      {
        title: "Equal rows",
        text: `Add rows of the same length until there are ${a} rows of ${b}.`,
        math: `$${a} \\times ${b}$`,
      },
      {
        title: "Count by rows",
        text: `Each row adds ${b}: ${Array.from({ length: a }, (_, i) => b * (i + 1)).join(", ")}.`,
        math: `$${a} \\times ${b} = ${a * b}$`,
      },
    ];
  }
  if (model.kind === "array-turn") {
    const { rows: d, columns: q } = model,
      n = d * q;
    return [
      {
        title: "Rows of the array",
        text: `${n} dots in ${d} equal rows of ${q}.`,
        math: `$${d} \\times ${q} = ${n}$`,
      },
      {
        title: "A quarter turn",
        text: `Rows become columns: ${q} rows of ${d}. No dot moves in or out.`,
        math: `$${q} \\times ${d} = ${n}$`,
      },
      {
        title: "Two divisions",
        text: `${n} in ${d} rows puts ${q} in each row; ${n} in rows of ${q} makes ${d} rows.`,
        math: `$${n} \\div ${d} = ${q},\\quad ${n} \\div ${q} = ${d}$`,
      },
    ];
  }
  if (model.kind === "deal") {
    const { total: n, count: k, first } = model,
      q = n / k;
    const share = {
        title: `Share among ${k}`,
        text: `Deal one counter to each of ${k} groups per round. ${q} rounds empty the pile, so each group gets ${q}.`,
        math: `$${n} \\div ${k} = ${q}$ in each group`,
      },
      measure = {
        title: `Groups of ${k}`,
        text: `Fill one group of ${k} at a time until the pile is empty: ${q} groups.`,
        math: `$${n} \\div ${k} = ${q}$ groups`,
      };
    return [
      {
        title: "The counters",
        text: `${n} counters to divide ${first === "share" ? `among ${k} groups` : `into groups of ${k}`}.`,
        math: `$${n} \\div ${k}$`,
      },
      first === "share" ? share : measure,
      {
        ...(first === "share" ? measure : share),
        text: `${first === "share" ? `Now fill groups of ${k} instead: the same ${n} counters make ${q} groups.` : `Now deal the same ${n} counters among ${k} groups instead: ${q} in each.`} Both are ${k} × ${q} = ${n}.`,
      },
    ];
  }
  if (model.kind === "make-ten") {
    const { first: a, second: b } = model.figure;
    const need = 10 - a,
      rest = b - need;
    return [
      {
        title: "Two frames",
        text: `${a} in the first frame, ${b} in the second.`,
        math: `$${a} + ${b}$`,
      },
      {
        title: "Fill the first ten",
        text: `${a} needs ${need} more to make 10. Move ${need} from the second frame.`,
        math: `$${b} = ${need} + ${rest}$`,
      },
      {
        title: "Ten and the rest",
        text: `One full ten and ${rest} more. No counter was added or lost.`,
        math: `$${a} + ${b} = 10 + ${rest} = ${a + b}$`,
      },
    ];
  }
  if (model.kind === "partition") {
    const n = model.shape.sizes.length,
      k = model.shape.shaded.length;
    const name = `${WORDS[k]} ${UNIT[n]![k === 1 ? 0 : 1]}`;
    return [
      {
        title: "Start with one whole",
        text: `The whole ${model.shape.shape} is the thing being shared.`,
        math: "$1$ whole",
      },
      {
        title: "Cut it into equal parts",
        text: `${WORDS[n]![0]!.toUpperCase()}${WORDS[n]!.slice(1)} equal parts make the whole, so each part is one ${UNIT[n]![0]}.`,
        math: `$${n} \\times \\dfrac{1}{${n}} = 1$`,
      },
      {
        title: "Count the shaded parts",
        text: `${WORDS[k]![0]!.toUpperCase()}${WORDS[k]!.slice(1)} of the ${WORDS[n]} equal parts ${k === 1 ? "is" : "are"} shaded: ${name}.`,
        math: `$\\dfrac{${k}}{${n}}$`,
      },
    ];
  }
  if (model.kind === "compare") {
    const [a, b] = model.bars;
    const sign = a.n * b.d > b.n * a.d ? ">" : "<";
    const f = (x: { n: number; d: number }) => `\\dfrac{${x.n}}{${x.d}}`;
    return [
      {
        title: "Use one whole",
        text: "Both bars are the same length: each is one whole.",
        math: "$1 = 1$",
      },
      {
        title: "Cut each whole equally",
        text:
          a.d === b.d
            ? `Both wholes are cut into ${a.d} equal pieces, so the pieces are the same size.`
            : `Top: ${a.d} equal pieces. Bottom: ${b.d}. More pieces in the same whole means smaller pieces.`,
        math: `$\\dfrac{1}{${a.d}}${a.d === b.d ? "=" : a.d < b.d ? ">" : "<"}\\dfrac{1}{${b.d}}$`,
      },
      {
        title: "Shade and line up",
        text: "The shaded lengths start at the same place. The longer one is the greater fraction.",
        math: `$${f(a)} ${sign} ${f(b)}$`,
      },
    ];
  }
  if (model.kind === "area") {
    const f = model.figure,
      cells = f.columns * f.rows,
      count = Math.max(...f.regions) + 1;
    return [
      {
        title: "Measure the whole",
        text: `The rectangle covers ${f.columns} × ${f.rows} unit squares.`,
        math: `$${f.columns} \\times ${f.rows} = ${cells}$`,
      },
      {
        title: "Split into equal areas",
        text: `${count} parts of ${cells / count} squares each. Their shapes differ; their areas match.`,
        math: `$${count} \\times ${cells / count} = ${cells}$`,
      },
      {
        title: "Name one part",
        text: `The shaded part is one of ${count} equal shares of the area.`,
        math: `$\\dfrac{${cells / count}}{${cells}} = \\dfrac{1}{${count}}$`,
      },
    ];
  }
  if (model.kind === "line-plot-stack") {
    const { values, denominator: d } = model.figure;
    const half = Math.ceil(values.length / 2);
    const counts = new Map<number, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    const n = Math.max(...counts.values());
    const tops = [...counts]
      .filter(([, c]) => c === n)
      .map(([v]) => v)
      .sort((a, b) => a - b);
    return [
      {
        title: "Draw the scale",
        text: `Mark equal spaces of ${d === 1 ? "one unit" : `1/${d} unit`} along the number line, wide enough for every measurement.`,
        math: `${values.length}\\text{ measurements}`,
      },
      {
        title: "One mark per measurement",
        text: `Place an × above each length. A repeated length stacks on top of the one below.`,
        math: `${half}\\text{ of }${values.length}\\text{ placed}`,
      },
      {
        title: "Read the stacks",
        text: `Every measurement is shown once. The tallest ${tops.length > 1 ? "stacks show the most common lengths" : "stack is the most common length"}.`,
        math: `${n}\\text{ at }${tops.map((v) => plotted(v, d)).join("\\text{ and }")}`,
      },
    ].map((f) => ({ ...f, math: `$${f.math}$` }));
  }
  if (model.kind === "line-plot-share") {
    const { values, denominator: d } = model.figure;
    const total = values.reduce((a, b) => a + b, 0);
    return [
      {
        title: "Read every amount",
        text: `${values.length} beakers, each × one beaker, measured in ${d === 2 ? "halves" : d === 4 ? "fourths" : "eighths"} of a liter.`,
        math: `$${values.length}\\text{ beakers}$`,
      },
      {
        title: "Pool the water",
        text: "Pour every beaker into one jug. The total does not change.",
        math: `$\\text{total} = \\dfrac{${total}}{${d}}$`,
      },
      {
        title: "Share it equally",
        text: "Pour the total back into the beakers so each holds the same amount. Every × moves to one value.",
        math: `$\\dfrac{${total}}{${d}} \\div ${values.length} = ${[`\\dfrac{${model.share}}{${d}}`, plotted(model.share, d).replace("tfrac", "dfrac")].filter((v, i, all) => all.indexOf(v) === i).join(" = ")}$`,
      },
    ];
  }
  if (model.kind === "pairing") {
    const { circles: c, squares: s, spread } = model.figure;
    const pairs = Math.min(c, s),
      extra = Math.abs(c - s),
      rest =
        c > s
          ? plural(extra, "circle", "circles")
          : plural(extra, "square", "squares");
    return [
      {
        title: "Two rows",
        text:
          spread === "none"
            ? "Circles above, squares below, with the same spacing."
            : `The ${spread} are spread out, so their row looks longer.`,
        math: `$${c}$ circles, $${s}$ squares`,
      },
      {
        title: "Line them up",
        text: "Move each square under a circle. Spacing changes; the number of each does not.",
        math: `$${c}$ circles, $${s}$ squares`,
      },
      {
        title: "Pair them",
        text:
          extra === 0
            ? `${plural(pairs, "pair", "pairs")}, none left over: the same number.`
            : `${plural(pairs, "pair", "pairs")}; ${rest} without a partner.`,
        math: `$${c} ${c < s ? "<" : c > s ? ">" : "="} ${s}$`,
      },
    ];
  }
  if (model.kind === "regroup-sum") {
    const [a, b] = model.figure.values;
    const tens = Math.floor(a / 10) + Math.floor(b / 10),
      ones = (a % 10) + (b % 10),
      trade = ones >= 10 ? 1 : 0;
    return [
      {
        title: "Show both numbers",
        text: `${a} is ${plural(Math.floor(a / 10), "ten", "tens")} and ${plural(a % 10, "one", "ones")}. ${b} is ${plural(Math.floor(b / 10), "ten", "tens")} and ${plural(b % 10, "one", "ones")}.`,
        math: `$${a} + ${b}$`,
      },
      {
        title: "Join like units",
        text: `Tens join tens and ones join ones: ${plural(tens, "ten", "tens")} and ${plural(ones, "one", "ones")}.`,
        math: `$${tens * 10} + ${ones}$`,
      },
      trade
        ? {
            title: "Trade ten ones for a ten",
            text: `${ones} ones are 1 ten and ${plural(ones - 10, "one", "ones")}. The total does not change.`,
            math: `$${(tens + 1) * 10} + ${ones - 10} = ${a + b}$`,
          }
        : {
            title: "No trade needed",
            text: `${plural(ones, "one", "ones")} is fewer than ten, so the ones stay as they are.`,
            math: `$${tens * 10} + ${ones} = ${a + b}$`,
          },
    ];
  }
  if (model.kind === "place-compare") {
    const [a, b] = model.figure.values;
    const [ta, tb] = [Math.floor(a / 10), Math.floor(b / 10)],
      [oa, ob] = [a % 10, b % 10];
    const sign = a < b ? "<" : a > b ? ">" : "=";
    return [
      {
        title: "Build both numbers",
        text: `${a} is ${plural(ta, "ten", "tens")} and ${plural(oa, "one", "ones")}. ${b} is ${plural(tb, "ten", "tens")} and ${plural(ob, "one", "ones")}.`,
        math: `$${a}$ and $${b}$`,
      },
      {
        title: "Compare the tens",
        text:
          ta === tb
            ? `Both have ${plural(ta, "ten", "tens")}. The tens cannot decide.`
            : `${plural(ta, "ten", "tens")} and ${plural(tb, "ten", "tens")}. Even 9 ones are less than 1 ten.`,
        math: `$${ta * 10} ${ta < tb ? "<" : ta > tb ? ">" : "="} ${tb * 10}$`,
      },
      ta === tb
        ? {
            title: "The ones decide",
            text: `${plural(oa, "one", "ones")} and ${plural(ob, "one", "ones")}.`,
            math: `$${a} ${sign} ${b}$`,
          }
        : {
            title: "The tens decide",
            text: "The ones cannot make up a whole ten, so they do not change the answer.",
            math: `$${a} ${sign} ${b}$`,
          },
    ];
  }
  if (model.kind === "fraction") {
    const { parts: d, selected: n } = model.figure;
    return [
      {
        title: "Name the whole",
        text: "The outline marks one whole. Keep its size fixed.",
        math: "$1$ whole",
      },
      {
        title: "Partition equally",
        text: `Divide the whole into ${d} equal parts.`,
        math: `Each part is $\\dfrac{1}{${d}}$ of the whole.`,
      },
      {
        title: "Count the shaded parts",
        text: `${n === 1 ? "The shaded part keeps its" : `The ${n} shaded parts keep their`} size when moved.`,
        math: `$${n} \\times \\dfrac{1}{${d}} = \\dfrac{${n}}{${d}}$`,
      },
    ];
  }
  if (model.kind === "array") {
    const { rows: r, columns: c, splitAfterRow: a } = model.figure;
    return [
      {
        title: "Count rows and columns",
        text: `${r} rows, with ${c} unit squares in each row.`,
        math: `$${r} \\times ${c} = ${r * c}$`,
      },
      {
        title: "Separate the regions",
        text: `A has ${a} rows. B has ${r - a} rows. Each row keeps ${c} squares.`,
        math: `$A = ${a * c},\\quad B = ${(r - a) * c}$`,
      },
      {
        title: "Rejoin the partial products",
        text: "The two regions fill the original array without gaps or overlaps.",
        math: `$${a * c} + ${(r - a) * c} = ${r * c}$`,
      },
    ];
  }
  const { hundreds: h, tens: t, ones: o } = model.figure;
  const u = model.unit,
    small = u === 1 ? "ones" : "tens",
    large = u === 1 ? "ten" : "hundred";
  const h2 = h + (u === 10 ? 1 : 0),
    t2 = t + (u === 1 ? 1 : -10),
    o2 = o - (u === 1 ? 10 : 0);
  const remaining = [
    [h, "hundred"],
    [u === 1 ? t : t - 10, "ten"],
    [u === 1 ? o - 10 : o, "one"],
  ]
    .map(([count, name]) => `${count} ${name}${count === 1 ? "" : "s"}`)
    .join(", ");
  return [
    {
      title: `Choose ten ${small}`,
      text: `Focus on ten of the model’s ${u === 1 ? o : t} ${small}. Other units stay unchanged.`,
      math: `$${h} \\times 100 + ${t} \\times 10 + ${o}$`,
    },
    {
      title: "Bring equal units together",
      text: `Move the ten ${small} together without changing their size.`,
      math: `$10 \\times ${u} = ${10 * u}$`,
    },
    {
      title: `Exchange for one ${large}`,
      text: `Unchanged: ${remaining}. Total value: ${h * 100 + t * 10 + o}.`,
      math: `$${h2} \\times 100 + ${t2} \\times 10 + ${o2}$`,
    },
  ];
}
