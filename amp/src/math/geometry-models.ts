import { z } from "zod";

/** Angle and solid figures. Every figure is drawn at its true measures: the
 * renderer reads directions and dimensions, and the labels carry the givens. */
const label = z.string().trim().min(1).max(24);
const degrees = z.number().int();
const point = z.string().regex(/^[A-Z]$/);
const lineName = z.string().regex(/^[a-z]$/);

/** Counterclockwise sweep from one direction to another, in degrees. */
export const sweep = (from: number, to: number) =>
  (((to - from) % 360) + 360) % 360;

export const geometryFigureSchemas = [
  z
    .object({
      kind: z.literal("angle-rays"),
      /** Ray directions in degrees, counterclockwise from the rightward direction. */
      rays: z.array(degrees.min(0).max(359)).min(2).max(6),
      vertex: point,
      points: z.array(point).min(2).max(6),
      /** Each mark spans counterclockwise from ray `from` to ray `to`. */
      marks: z
        .array(
          z
            .object({
              from: z.number().int().min(0).max(5),
              to: z.number().int().min(0).max(5),
              label,
              right: z.boolean().optional(),
            })
            .strict(),
        )
        .min(1)
        .max(4),
    })
    .strict()
    .refine(
      (f) =>
        new Set(f.rays).size === f.rays.length &&
        f.points.length === f.rays.length &&
        new Set([f.vertex, ...f.points]).size === f.points.length + 1 &&
        f.marks.every(
          (m) =>
            m.from < f.rays.length &&
            m.to < f.rays.length &&
            sweep(f.rays[m.from]!, f.rays[m.to]!) > 0 &&
            sweep(f.rays[m.from]!, f.rays[m.to]!) < 180 &&
            (!m.right || sweep(f.rays[m.from]!, f.rays[m.to]!) === 90),
        ),
    ),
  z
    .object({
      kind: z.literal("triangle-angles"),
      /** True interior measures at A, B and C; A and B lie on the base. */
      angles: z.tuple([degrees, degrees, degrees]),
      vertices: z.tuple([point, point, point]),
      labels: z.tuple([label.nullable(), label.nullable(), label.nullable()]),
      /** Side AB extended past B to this point; the exterior angle sits at B. */
      exterior: z
        .object({ point, label: label.nullable() })
        .strict()
        .optional(),
    })
    .strict()
    .refine(
      (f) =>
        f.angles.every((a) => a >= 10 && a <= 160) &&
        f.angles[0] + f.angles[1] + f.angles[2] === 180 &&
        new Set(f.exterior ? [...f.vertices, f.exterior.point] : f.vertices)
          .size === (f.exterior ? 4 : 3),
    ),
  z
    .object({
      kind: z.literal("parallel-transversal"),
      /** Angle above the line and right of the transversal, at both crossings. */
      angle: degrees.min(25).max(155),
      /** Names of the upper parallel line, the lower one and the transversal. */
      lines: z.tuple([lineName, lineName, lineName]),
      /** crossing 0 is the upper parallel line. Positions: 0 upper right,
       * 1 upper left, 2 lower left, 3 lower right. */
      marks: z
        .array(
          z
            .object({
              crossing: z.union([z.literal(0), z.literal(1)]),
              position: z.number().int().min(0).max(3),
              label,
            })
            .strict(),
        )
        .min(2)
        .max(3),
    })
    .strict()
    .refine(
      (f) =>
        new Set(f.marks.map((m) => `${m.crossing}:${m.position}`)).size ===
          f.marks.length && new Set(f.lines).size === 3,
    ),
  z
    .object({
      kind: z.literal("solid-section"),
      solid: z.enum(["prism", "pyramid"]),
      length: z.number().int().min(2).max(30),
      width: z.number().int().min(2).max(30),
      height: z.number().int().min(2).max(30),
      plane: z.enum([
        "parallel-base",
        "perpendicular-front",
        "perpendicular-side",
        "perpendicular-diagonal",
        "corner",
        "through-apex",
        "off-apex",
      ]),
      /** Show the dimension labels (in this unit) on the solid. */
      unit: z.enum(["cm", "mm", "m", "ft"]).optional(),
    })
    .strict()
    .refine((f) =>
      f.solid === "prism"
        ? !["through-apex", "off-apex"].includes(f.plane)
        : ["parallel-base", "through-apex", "off-apex"].includes(f.plane),
    ),
] as const;
export const geometryFigureSchema = z.discriminatedUnion(
  "kind",
  geometryFigureSchemas,
);
export type GeometryFigure = z.infer<typeof geometryFigureSchema>;
