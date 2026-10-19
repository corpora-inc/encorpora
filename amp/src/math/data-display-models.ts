import { z } from "zod";

/** The data-display chart family. Every figure carries the displayed data
 * itself (never an answer), and every layout below is a pure function so tests
 * can prove that what is drawn is exactly what the data say. */
const label = z.string().min(1).max(12);
const unit = z.string().min(1).max(24);
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
