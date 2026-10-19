import { z } from "zod";

/** The data-display chart family. Every figure carries the displayed data
 * itself (never an answer), and every layout below is a pure function so tests
 * can prove that what is drawn is exactly what the data say. */
const label = z.string().min(1).max(12);
const unit = z.string().min(1).max(24);
const fiveNumber = z.tuple([
  z.number().int(),
  z.number().int(),
  z.number().int(),
  z.number().int(),
  z.number().int(),
]);
const group = z
  .object({ label, values: z.array(z.number().int().min(0)).min(3).max(16) })
  .strict();
const boxGroup = z.object({ label, summary: fiveNumber }).strict();
const scale = z
  .object({
    label: z.string().min(1).max(24),
    start: z.number().int().min(0).max(10000),
    end: z.number().int().min(1).max(10000),
    step: z.number().int().positive().max(1000),
  })
  .strict();
const tableEntry = z.union([
  z.number().int().min(0).max(10000),
  z.null(),
  z.literal("?"),
]);
const tableRow = z.tuple([tableEntry, tableEntry]);
/** The tallest stack a double dot plot draws in each half. */
export const PAIR_STACK = 5;
export const shapeKinds = ["circle", "square", "triangle"] as const;
export type ShapeKind = (typeof shapeKinds)[number];

export const dataDisplayFigureSchemas = [
  z
    .object({
      kind: z.literal("sort-shapes"),
      shapes: z.array(z.enum(shapeKinds)).min(3).max(15),
    })
    .strict(),
  z
    .object({
      kind: z.literal("picture-graph"),
      categories: z
        .array(
          z.object({ label, count: z.number().int().min(0).max(100) }).strict(),
        )
        .min(2)
        .max(4),
      key: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
      unit,
    })
    .strict()
    .refine((f) =>
      f.categories.every(
        (c) => c.count % halfKey(f.key) === 0 && c.count / f.key <= 10,
      ),
    ),
  z
    .object({
      kind: z.literal("scaled-bar-graph"),
      categories: z
        .array(
          z
            .object({ label, value: z.number().int().min(0).max(1000) })
            .strict(),
        )
        .min(2)
        .max(5),
      step: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(5),
        z.literal(10),
        z.literal(20),
        z.literal(50),
        z.literal(100),
      ]),
      max: z.number().int().positive().max(1000),
      unit,
    })
    .strict()
    .refine(
      (f) =>
        f.max % f.step === 0 &&
        f.max / f.step <= 10 &&
        f.categories.every(
          (c) => c.value <= f.max && c.value % halfStep(f.step) === 0,
        ),
    ),
  z
    .object({
      kind: z.literal("line-plot"),
      /** Values and axis ends count units of 1/denominator. */
      denominator: z.union([
        z.literal(1),
        z.literal(2),
        z.literal(4),
        z.literal(8),
      ]),
      start: z.number().int().min(0).max(400),
      end: z.number().int().min(1).max(400),
      values: z.array(z.number().int().min(0).max(400)).min(3).max(24),
      mark: z.enum(["x", "dot"]),
      unit,
    })
    .strict()
    .refine(
      (f) =>
        f.end > f.start &&
        f.end - f.start <= 12 &&
        f.start % f.denominator === 0 &&
        f.end % f.denominator === 0 &&
        f.values.every((v) => v >= f.start && v <= f.end) &&
        Math.max(...stackHeights(f.values).values()) <= MAX_STACK,
    ),
  z
    .object({
      kind: z.literal("histogram"),
      /** Bins [start + i·width, start + (i+1)·width) of whole-number data. */
      start: z.number().int().min(0).max(1000),
      width: z.union([
        z.literal(2),
        z.literal(5),
        z.literal(10),
        z.literal(20),
      ]),
      counts: z.array(z.number().int().min(0).max(20)).min(3).max(8),
      unit,
    })
    .strict()
    .refine((f) => f.counts.some((c) => c > 0)),
  z
    .object({
      kind: z.literal("box-plot"),
      start: z.number().int().min(0).max(1000),
      end: z.number().int().min(1).max(1000),
      /** Every tick is a step; every second tick is labeled. */
      step: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
      summary: z.tuple([
        z.number().int(),
        z.number().int(),
        z.number().int(),
        z.number().int(),
        z.number().int(),
      ]),
      unit,
    })
    .strict()
    .refine(
      (f) =>
        f.end > f.start &&
        (f.end - f.start) % (2 * f.step) === 0 &&
        (f.end - f.start) / f.step <= 20 &&
        f.summary.every(
          (v, i) =>
            v >= f.start &&
            v <= f.end &&
            (v - f.start) % f.step === 0 &&
            (i === 0 || v >= f.summary[i - 1]!),
        ),
    ),
  z
    .object({
      kind: z.literal("double-dot-plot"),
      /** Two groups of whole-number data on one shared scale. */
      start: z.number().int().min(0).max(400),
      end: z.number().int().min(1).max(400),
      groups: z.tuple([group, group]),
      unit,
    })
    .strict()
    .refine(
      (f) =>
        f.end > f.start &&
        f.end - f.start <= 20 &&
        f.groups[0].label !== f.groups[1].label &&
        f.groups.every(
          (g) =>
            g.values.every((v) => v >= f.start && v <= f.end) &&
            Math.max(...stackHeights(g.values).values()) <= PAIR_STACK,
        ),
    ),
  z
    .object({
      kind: z.literal("double-box-plot"),
      start: z.number().int().min(0).max(1000),
      end: z.number().int().min(1).max(1000),
      step: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
      groups: z.tuple([boxGroup, boxGroup]),
      unit,
    })
    .strict()
    .refine(
      (f) =>
        f.end > f.start &&
        (f.end - f.start) % (2 * f.step) === 0 &&
        (f.end - f.start) / f.step <= 20 &&
        f.groups[0].label !== f.groups[1].label &&
        f.groups.every((g) =>
          g.summary.every(
            (v, i) =>
              v >= f.start &&
              v <= f.end &&
              (v - f.start) % f.step === 0 &&
              (i === 0 || v >= g.summary[i - 1]!),
          ),
        ),
    ),
  z
    .object({
      kind: z.literal("scatter-plot"),
      x: scale,
      y: scale,
      /** Paired whole-number data, one point per pair. */
      points: z
        .array(z.tuple([z.number().int(), z.number().int()]))
        .min(5)
        .max(24),
      /** A drawn trend line, given by two marked lattice points on it. */
      line: z
        .tuple([
          z.tuple([z.number().int(), z.number().int()]),
          z.tuple([z.number().int(), z.number().int()]),
        ])
        .optional(),
    })
    .strict()
    .refine(
      (f) =>
        [f.x, f.y].every(
          (a) =>
            a.end > a.start &&
            (a.end - a.start) % a.step === 0 &&
            (a.end - a.start) / a.step <= 10,
        ) &&
        [...f.points, ...(f.line ?? [])].every(
          ([px, py]) =>
            px >= f.x.start &&
            px <= f.x.end &&
            py >= f.y.start &&
            py <= f.y.end,
        ) &&
        (!f.line || f.line[0][0] < f.line[1][0]),
    ),
  z
    .object({
      kind: z.literal("two-way-table"),
      /** What the columns record, written above them: "Has a curfew". */
      columnTitle: z.string().min(1).max(28),
      rows: z.tuple([label, label]),
      columns: z.tuple([label, label]),
      /** Counts by row then column; null is a blank to find, and "?" marks
       * the one the question asks for. */
      cells: z.tuple([tableRow, tableRow]),
      rowTotals: z.tuple([tableEntry, tableEntry]),
      columnTotals: z.tuple([tableEntry, tableEntry]),
      total: tableEntry,
    })
    .strict()
    .refine(
      (f) =>
        [...f.cells.flat(), ...f.rowTotals, ...f.columnTotals, f.total].filter(
          (v) => v === "?",
        ).length <= 1,
    ),
] as const;
export const dataDisplayFigureSchema = z.discriminatedUnion(
  "kind",
  dataDisplayFigureSchemas,
);
export type DataDisplayFigure = z.infer<typeof dataDisplayFigureSchema>;
export const dataDisplayKinds: ReadonlySet<string> = new Set(
  dataDisplayFigureSchemas.map((schema) => schema.shape.kind.value),
);

/** A half symbol stands for half the key; an odd key has no half symbol. */
export function halfKey(key: number) {
  return key % 2 === 0 ? key / 2 : key;
}
/** A bar may end halfway between two labeled grid lines when the step is even. */
export function halfStep(step: number) {
  return step % 2 === 0 ? step / 2 : step;
}

/** Sorting shapes: a 5-column grid in a fixed, seed-shuffled order. */
export function sortShapesLayout(shapes: readonly ShapeKind[]) {
  const columns = 5,
    rows = Math.ceil(shapes.length / columns);
  const cell = 64,
    top = (200 - rows * cell) / 2;
  return shapes.map((shape, i) => ({
    shape,
    cx: 52 + (i % columns) * cell,
    cy: top + cell / 2 + Math.floor(i / columns) * cell,
    size: 40,
  }));
}

/** A picture graph: one row per category; each whole symbol is one key. */
export function pictureGraphLayout(
  figure: Extract<DataDisplayFigure, { kind: "picture-graph" }>,
) {
  const rowHeight = 36,
    top = 12,
    labelWidth = 92,
    spacing = 26;
  return {
    rows: figure.categories.map((c, row) => {
      const wholes = Math.floor(c.count / figure.key),
        half = c.count % figure.key !== 0;
      return {
        label: c.label,
        y: top + row * rowHeight + rowHeight / 2,
        symbols: Array.from({ length: wholes + (half ? 1 : 0) }, (_, i) => ({
          cx: labelWidth + 14 + i * spacing,
          half: half && i === wholes,
        })),
      };
    }),
    keyY: top + figure.categories.length * rowHeight + 26,
    height: top + figure.categories.length * rowHeight + 42,
    labelWidth,
    radius: 10,
  };
}

/** A vertical bar graph on a labeled scale: bar height is exactly proportional to value. */
export function barGraphLayout(
  figure: Extract<DataDisplayFigure, { kind: "scaled-bar-graph" }>,
) {
  const left = 64,
    right = 348,
    top = 30,
    bottom = 176;
  const y = (value: number) => bottom - ((bottom - top) * value) / figure.max;
  const slot = (right - left) / figure.categories.length,
    width = Math.min(48, slot * 0.6);
  return {
    left,
    right,
    top,
    bottom,
    y,
    gridlines: Array.from(
      { length: figure.max / figure.step + 1 },
      (_, i) => i * figure.step,
    ),
    bars: figure.categories.map((c, i) => ({
      label: c.label,
      value: c.value,
      x: left + slot * i + (slot - width) / 2,
      width,
      top: y(c.value),
      height: bottom - y(c.value),
      center: left + slot * i + slot / 2,
    })),
  };
}

/** A stack taller than this would leave the plot. */
export const MAX_STACK = 7;
export function stackHeights(values: readonly number[]) {
  const heights = new Map<number, number>();
  for (const v of values) heights.set(v, (heights.get(v) ?? 0) + 1);
  return heights;
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** A tick label as a mixed number: whole part and a reduced proper fraction. */
export function mixedParts(numerator: number, denominator: number) {
  const whole = Math.floor(numerator / denominator),
    rest = numerator % denominator,
    g = gcd(rest, denominator) || 1;
  return { whole, n: rest / g, d: denominator / g };
}
/** "2 1/4", "3/4" or "2": how prompts and explanations name a plotted value. */
export function mixedText(numerator: number, denominator: number) {
  const { whole, n, d } = mixedParts(numerator, denominator);
  if (!n) return `${whole}`;
  return whole ? `${whole} ${n}/${d}` : `${n}/${d}`;
}

/** A line plot: equal tick spacing per 1/denominator; one mark per value,
 * stacked upward from the axis in equal steps. */
export function linePlotLayout(
  figure: Extract<DataDisplayFigure, { kind: "line-plot" }>,
  width = 360,
) {
  const left = 26,
    right = width - 26,
    axisY = 148,
    gap = 18;
  const x = (v: number) =>
    left + ((v - figure.start) * (right - left)) / (figure.end - figure.start);
  const seen = new Map<number, number>();
  const marks = figure.values.map((value) => {
    const level = seen.get(value) ?? 0;
    seen.set(value, level + 1);
    return { value, level, cx: x(value), cy: axisY - 15 - level * gap };
  });
  return {
    left,
    right,
    axisY,
    x,
    marks,
    ticks: Array.from({ length: figure.end - figure.start + 1 }, (_, i) => ({
      value: figure.start + i,
      x: x(figure.start + i),
      major: (figure.start + i) % figure.denominator === 0,
      ...mixedParts(figure.start + i, figure.denominator),
    })),
  };
}

/** A histogram: touching bars, equal bin widths, heights exactly proportional to counts. */
export function histogramLayout(
  figure: Extract<DataDisplayFigure, { kind: "histogram" }>,
) {
  const left = 52,
    right = 344,
    top = 30,
    bottom = 168;
  const peak = Math.max(...figure.counts);
  const step = peak > 10 ? 2 : 1,
    max = Math.ceil(peak / step) * step;
  const y = (v: number) => bottom - ((bottom - top) * v) / max;
  const bin = (right - left) / figure.counts.length;
  return {
    left,
    right,
    top,
    bottom,
    max,
    y,
    gridlines: Array.from({ length: max / step + 1 }, (_, i) => i * step),
    edges: figure.counts
      .map((_, i) => ({
        x: left + i * bin,
        value: figure.start + i * figure.width,
      }))
      .concat({
        x: right,
        value: figure.start + figure.counts.length * figure.width,
      }),
    bars: figure.counts.map((count, i) => ({
      count,
      from: figure.start + i * figure.width,
      x: left + i * bin,
      width: bin,
      top: y(count),
      height: bottom - y(count),
    })),
  };
}

/** A box plot on a number line: box from Q1 to Q3, a line at the median, whiskers to the extremes. */
export function boxPlotLayout(
  figure: Extract<DataDisplayFigure, { kind: "box-plot" }>,
  width = 360,
) {
  const left = 26,
    right = width - 26,
    axisY = 150;
  const x = (v: number) =>
    left + ((v - figure.start) * (right - left)) / (figure.end - figure.start);
  const [min, q1, median, q3, max] = figure.summary.map(x) as [
    number,
    number,
    number,
    number,
    number,
  ];
  return {
    left,
    right,
    axisY,
    x,
    box: { top: 64, bottom: 116, min, q1, median, q3, max },
    ticks: Array.from(
      { length: (figure.end - figure.start) / figure.step + 1 },
      (_, i) => {
        const value = figure.start + i * figure.step;
        return { value, x: x(value), labeled: i % 2 === 0 };
      },
    ),
  };
}

/** Two dot plots on one shared scale, stacked: the same value sits at the same x
 * in both, so centers and spreads compare by eye. Every tick is a whole unit;
 * labels thin to even values when the scale is long. */
export function doubleDotLayout(
  figure: Extract<DataDisplayFigure, { kind: "double-dot-plot" }>,
  size: { width: number; axes: [number, number]; gap: number } = {
    width: 360,
    axes: [118, 262],
    gap: 15,
  },
) {
  const left = 26,
    right = size.width - 26,
    span = figure.end - figure.start;
  const x = (v: number) => left + ((v - figure.start) * (right - left)) / span;
  return {
    left,
    right,
    x,
    ticks: Array.from({ length: span + 1 }, (_, i) => ({
      value: figure.start + i,
      x: x(figure.start + i),
      labeled: span <= 12 || (figure.start + i) % 2 === 0,
    })),
    panels: figure.groups.map((g, p) => {
      const axisY = size.axes[p]!;
      const seen = new Map<number, number>();
      return {
        label: g.label,
        axisY,
        marks: g.values.map((value) => {
          const level = seen.get(value) ?? 0;
          seen.set(value, level + 1);
          return {
            value,
            level,
            cx: x(value),
            cy: axisY - 13 - level * size.gap,
          };
        }),
      };
    }),
  };
}

/** Two box plots over one shared number line. */
export function doubleBoxLayout(
  figure: Extract<DataDisplayFigure, { kind: "double-box-plot" }>,
  width = 360,
) {
  const left = 26,
    right = width - 26,
    axisY = 214;
  const x = (v: number) =>
    left + ((v - figure.start) * (right - left)) / (figure.end - figure.start);
  return {
    left,
    right,
    axisY,
    x,
    boxes: figure.groups.map((g, i) => {
      const [min, q1, median, q3, max] = g.summary.map(x) as [
        number,
        number,
        number,
        number,
        number,
      ];
      const top = 44 + i * 86;
      return {
        label: g.label,
        box: { top, bottom: top + 44, min, q1, median, q3, max },
      };
    }),
    ticks: Array.from(
      { length: (figure.end - figure.start) / figure.step + 1 },
      (_, i) => {
        const value = figure.start + i * figure.step;
        return { value, x: x(value), labeled: i % 2 === 0 };
      },
    ),
  };
}

/** A scatter plot on a labeled grid: each point sits exactly at its pair. */
export function scatterLayout(
  figure: Extract<DataDisplayFigure, { kind: "scatter-plot" }>,
  box = { left: 56, right: 344, top: 34, bottom: 236 },
) {
  const { x: xs, y: ys } = figure;
  const x = (v: number) =>
    box.left + ((v - xs.start) * (box.right - box.left)) / (xs.end - xs.start);
  const y = (v: number) =>
    box.bottom -
    ((v - ys.start) * (box.bottom - box.top)) / (ys.end - ys.start);
  const ticks = (a: typeof xs) =>
    Array.from(
      { length: (a.end - a.start) / a.step + 1 },
      (_, i) => a.start + i * a.step,
    );
  // Label every other x tick when the labels would crowd one another.
  const xCount = (xs.end - xs.start) / xs.step,
    digits = String(xs.end).length;
  const xLabelEvery =
    (digits * 10 * (box.right - box.left)) / 288 >
    (box.right - box.left) / xCount
      ? 2
      : 1;
  return {
    ...box,
    x,
    y,
    xTicks: ticks(xs),
    /** Whether the x tick at index i carries a label. */
    xLabeled: (i: number) => i % xLabelEvery === 0,
    yTicks: ticks(ys),
    points: figure.points.map(([px, py]) => ({ cx: x(px), cy: y(py) })),
    /** The trend line extended across the plot, clipped to the grid. */
    line: figure.line && trendSegment(figure, x, y),
  };
}
function trendSegment(
  figure: Extract<DataDisplayFigure, { kind: "scatter-plot" }>,
  x: (v: number) => number,
  y: (v: number) => number,
) {
  const [[x1, y1], [x2, y2]] = figure.line!;
  const m = (y2 - y1) / (x2 - x1);
  const at = (vx: number) => y1 + m * (vx - x1);
  // Clip to the grid: the x-range where the line's y stays on the scale.
  let lo = figure.x.start,
    hi = figure.x.end;
  if (m !== 0) {
    const a = x1 + (figure.y.start - y1) / m,
      b = x1 + (figure.y.end - y1) / m;
    lo = Math.max(lo, Math.min(a, b));
    hi = Math.min(hi, Math.max(a, b));
  }
  return {
    x1: x(lo),
    y1: y(at(lo)),
    x2: x(hi),
    y2: y(at(hi)),
    marks: figure.line!.map(([px, py]) => ({ cx: x(px), cy: y(py) })),
  };
}

/** A two-way table: a row-label column, two category columns and a total. */
export function twoWayLayout(width = 360) {
  const labelWidth = 116,
    column = (width - 12 - labelWidth) / 3;
  return {
    left: 6,
    labelWidth,
    column,
    titleY: 22,
    headerTop: 32,
    rowHeight: 38,
    /** Center x of column c (0, 1, or 2 for the total). */
    cx: (c: number) => 6 + labelWidth + column * c + column / 2,
    /** Top y of row r (0 is the header, 1–2 the categories, 3 the total). */
    top: (r: number) => 32 + 38 * r,
    height: 32 + 38 * 4 + 6,
  };
}
