import { z } from "zod";

const measurement = z
  .object({
    value: z.number().int().min(1).max(300),
    unit: z.enum(["cm", "m"]),
  })
  .strict();
const rectangle = z
  .object({
    width: z.number().int().min(1).max(12),
    height: z.number().int().min(1).max(12),
  })
  .strict();

/** Public displayed givens only. Unknown sides have no numeric representation. */
export const measurementFigureSchemas = [
  z
    .object({
      kind: z.literal("length-interval"),
      denominator: z.union([z.literal(1), z.literal(2), z.literal(4)]),
      maxWhole: z.number().int().min(1).max(12),
      startNumerator: z.number().int().nonnegative(),
      endNumerator: z.number().int().positive(),
      unit: z.literal("cm"),
    })
    .strict()
    .refine(
      (f) =>
        f.startNumerator < f.endNumerator &&
        f.endNumerator <= f.maxWhole * f.denominator &&
        (f.denominator === 1 || f.maxWhole <= 3),
    ),
  z
    .object({
      kind: z.literal("measure-rectangle"),
      width: measurement.nullable(),
      height: measurement.nullable(),
    })
    .strict()
    .refine((f) => f.width !== null || f.height !== null),
  z
    .object({
      kind: z.literal("rectangle-comparison"),
      rectangles: z.tuple([rectangle, rectangle]),
      unit: z.literal("cm"),
    })
    .strict(),
] as const;
export const measurementFigureSchema = z.discriminatedUnion(
  "kind",
  measurementFigureSchemas,
);
export type MeasurementFigure = z.infer<typeof measurementFigureSchema>;

/** Comparison rectangles share both axes and one physical unit scale. */
export function rectangleComparisonLayout(
  figure: Extract<MeasurementFigure, { kind: "rectangle-comparison" }>,
) {
  const unit = Math.min(
    104 / Math.max(...figure.rectangles.map((r) => r.width)),
    70 / Math.max(...figure.rectangles.map((r) => r.height)),
  );
  return figure.rectangles.map((r, i) => ({
    x: i * 160 + 40 + (104 - r.width * unit) / 2,
    y: 38 + (70 - r.height * unit) / 2,
    width: r.width * unit,
    height: r.height * unit,
    unit,
  }));
}
