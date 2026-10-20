import { z } from "zod";

/** The data-display figure kinds: the wire format of every chart. Each figure
 * carries the displayed data itself (never an answer); it draws through the
 * scene renderer (`scene/legacy.ts`). */
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
