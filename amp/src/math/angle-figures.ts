import { z } from "zod";

/** Directions are degrees counterclockwise from the positive x-axis. Every
 * figure is drawn to its true measure; the numbers here are exactly what a
 * learner sees drawn. */
const direction = z.number().finite().min(0).lt(360);
const letter = z.string().regex(/^[A-Z]$/);
const point = z.tuple([z.number().finite(), z.number().finite()]);
const lattice = z.tuple([
  z.number().int().min(0).max(12),
  z.number().int().min(0).max(12),
]);

export const angleFigureSchemas = [
  // A protractor centered on the vertex, with one ray along its baseline.
  z
    .object({
      kind: z.literal("protractor"),
      rays: z.tuple([direction, direction]),
      /** End of the first ray, the vertex, end of the second ray. */
      labels: z.tuple([letter, letter, letter]),
    })
    .strict()
    .refine(
      (f) =>
        f.rays.every((d) => d <= 180) &&
        f.rays.some((d) => d === 0 || d === 180) &&
        f.rays[0] !== f.rays[1],
    ),
  // One angle between two rays; a right angle is marked with a square.
  z
    .object({
      kind: z.literal("angle-figure"),
      rays: z.tuple([direction, direction]),
    })
    .strict(),
  // Three rays from one vertex: two adjacent angles that make a whole one.
  // Measures are written on the drawing; null is the unknown, shown as "?".
  z
    .object({
      kind: z.literal("angle-parts"),
      rays: z.tuple([direction, direction, direction]),
      labels: z.tuple([letter, letter, letter, letter]),
      parts: z.tuple([
        z.number().int().min(1).max(179).nullable(),
        z.number().int().min(1).max(179).nullable(),
      ]),
      whole: z.number().int().min(2).max(180).nullable(),
    })
    .strict()
    .refine(
      (f) => [...f.parts, f.whole].filter((v) => v === null).length === 1,
    ),
  // A circle cut into equal angles at its center, some of them shaded.
  z
    .object({
      kind: z.literal("turn-circle"),
      parts: z.number().int().min(2).max(36),
      shaded: z.number().int().min(1).max(36),
      start: direction,
    })
    .strict()
    .refine((f) => f.shaded < f.parts),
  // Two lines through dots of a grid, extended to its edges.
  z
    .object({
      kind: z.literal("line-pair"),
      columns: z.number().int().min(3).max(12),
      rows: z.number().int().min(3).max(12),
      lines: z.tuple([
        z.tuple([lattice, lattice]),
        z.tuple([lattice, lattice]),
      ]),
    })
    .strict(),
  // A straight figure through two labeled points; each end either stops at
  // its point or continues with an arrow.
  z
    .object({
      kind: z.literal("linear-object"),
      points: z.tuple([point, point]),
      labels: z.tuple([letter, letter]),
      ends: z.tuple([z.enum(["point", "arrow"]), z.enum(["point", "arrow"])]),
    })
    .strict(),
  // A polygon and lettered dashed lines across it.
  z
    .object({
      kind: z.literal("symmetry-lines"),
      shape: z.array(point).min(3).max(16),
      lines: z
        .array(z.object({ label: letter, a: point, b: point }).strict())
        .min(2)
        .max(4),
    })
    .strict(),
] as const;
export const angleFigureSchema = z.discriminatedUnion(
  "kind",
  angleFigureSchemas,
);
export type AngleFigure = z.infer<typeof angleFigureSchema>;

/** The angle between two directions, 0–180. */
export function between(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
