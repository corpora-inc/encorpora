import { z } from "zod";

const edge = z.number().int().min(1).max(12);
const label = z.enum(["A", "B", "P", "Q", "R", "S"]);
const length = z
  .object({ value: edge, unit: z.literal("cm") })
  .strict()
  .nullable();

/** Public displayed givens only: every number a learner reads in the figure,
 * and nothing else. A missing edge has no numeric representation. */
export const geometryFigureSchemas = [
  // A right rectangular prism built from unit cubes; every cube is 1 cubic unit.
  z
    .object({
      kind: z.literal("cube-prism"),
      length: z.number().int().min(1).max(6),
      width: z.number().int().min(1).max(6),
      height: z.number().int().min(1).max(6),
    })
    .strict(),
  // A solid box with labeled edges in centimeters.
  z
    .object({
      kind: z.literal("box-prism"),
      length,
      width: length,
      height: length,
    })
    .strict()
    .refine(
      (f) =>
        [f.length, f.width, f.height].filter((e) => e === null).length <= 1,
    ),
  // Two right rectangular prisms of equal depth on one base; the taller is behind.
  z
    .object({
      kind: z.literal("composite-prism"),
      width: edge,
      parts: z
        .array(z.object({ length: edge, height: edge }).strict())
        .length(2),
      unit: z.literal("cm"),
    })
    .strict()
    .refine((f) => f.parts[0]!.height > f.parts[1]!.height),
  // The first quadrant with every whole-number gridline labeled.
  z
    .object({
      kind: z.literal("quadrant-grid"),
      size: z.number().int().min(4).max(10),
      points: z
        .array(
          z
            .object({
              x: z.number().int().nonnegative(),
              y: z.number().int().nonnegative(),
              label,
            })
            .strict(),
        )
        .min(1)
        .max(4),
    })
    .strict()
    .refine(
      (f) =>
        f.points.every((p) => p.x <= f.size && p.y <= f.size) &&
        new Set(f.points.map((p) => p.label)).size === f.points.length &&
        new Set(f.points.map((p) => `${p.x},${p.y}`)).size === f.points.length,
    ),
] as const;
export const geometryFigureSchema = z.discriminatedUnion(
  "kind",
  geometryFigureSchemas,
);
export type GeometryFigure = z.infer<typeof geometryFigureSchema>;

/** Isometric projection shared by figures and lesson models: x runs right and
 * down, y (depth) runs left and down, z runs straight up. Faces visible from
 * the viewer are the top (z = h), the left front (y = w) and the right front
 * (x = l). */
export const ISO = { cos: Math.sqrt(3) / 2, sin: 1 / 2 } as const;
export function isoPoint(
  x: number,
  y: number,
  z: number,
  unit: number,
  origin: { x: number; y: number },
) {
  return {
    x: origin.x + (x - y) * ISO.cos * unit,
    y: origin.y + (x + y) * ISO.sin * unit - z * unit,
  };
}
/** The unit and origin that center an l × w × h box inside a frame. */
export function isoFit(
  l: number,
  w: number,
  h: number,
  frame: {
    width: number;
    height: number;
    pad: number;
    /** Extra horizontal room for labels beside the solid (defaults to pad). */
    padLeft?: number;
    padRight?: number;
  },
) {
  const left = frame.padLeft ?? frame.pad,
    right = frame.padRight ?? frame.pad;
  const unit = Math.min(
    (frame.width - left - right) / ((l + w) * ISO.cos),
    (frame.height - 2 * frame.pad) / ((l + w) * ISO.sin + h),
  );
  const spanX = (l + w) * ISO.cos * unit,
    spanY = ((l + w) * ISO.sin + h) * unit;
  return {
    unit,
    origin: {
      x: left + (frame.width - left - right - spanX) / 2 + w * ISO.cos * unit,
      y: (frame.height - spanY) / 2 + h * unit,
    },
  };
}
