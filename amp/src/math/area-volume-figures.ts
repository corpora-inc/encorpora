import { z } from "zod";

/** Exact figures for area, surface area and volume. Coordinates and lengths are
 * in the figure's unit; renderers draw them to scale. Only displayed givens
 * appear here: an unknown length is null and is drawn as “?”. */
export const lengthUnits = ["cm", "m", "in", "ft"] as const;
export type LengthUnit = (typeof lengthUnits)[number];

const unit = z.enum(lengthUnits);
const coordinate = z.number().finite().min(-40).max(40);
const point = z.tuple([coordinate, coordinate]);
const length = z.number().positive().finite().max(60);
const fraction = z
  .object({
    n: z.number().int().min(1).max(200),
    d: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  })
  .strict();
export type FigureFraction = z.infer<typeof fraction>;
const closeTo = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);
/** Twice the signed area; positive when the vertices run counterclockwise. */
export function signedArea2(vertices: readonly (readonly number[])[]) {
  return vertices.reduce((sum, p, i) => {
    const q = vertices[(i + 1) % vertices.length]!;
    return sum + p[0]! * q[1]! - q[0]! * p[1]!;
  }, 0);
}

export const areaVolumeFigureSchemas = [
  z
    .object({
      kind: z.literal("measured-polygon"),
      unit,
      vertices: z.array(point).min(3).max(12),
      /** Label for the edge from vertex i to vertex i + 1; null leaves it unlabeled. */
      sides: z.array(length.nullable()),
      /** Dashed perpendicular segments, drawn with a right-angle mark at `to`. */
      heights: z
        .array(z.object({ from: point, to: point, value: length }).strict())
        .max(3),
      /** Dashed construction lines without labels, such as an extended base. */
      guides: z.array(z.object({ from: point, to: point }).strict()).max(3),
      /** Vertices marked with a right-angle square. */
      rightAngles: z.array(z.number().int().nonnegative()).max(4),
    })
    .strict()
    .refine(
      (f) =>
        f.sides.length === f.vertices.length &&
        f.sides.every(
          (s, i) =>
            s === null ||
            closeTo(
              s,
              distance(
                f.vertices[i]!,
                f.vertices[(i + 1) % f.vertices.length]!,
              ),
            ),
        ) &&
        f.heights.every((h) => closeTo(h.value, distance(h.from, h.to))) &&
        f.rightAngles.every((i) => i < f.vertices.length) &&
        signedArea2(f.vertices) > 0,
      "Labels must match the drawn lengths",
    ),
  z
    .object({
      kind: z.literal("rectangular-prism-net"),
      unit,
      length,
      width: length,
      height: length,
    })
    .strict(),
  z
    .object({
      kind: z.literal("triangular-prism-net"),
      unit,
      /** The triangle's base, its height to that base, and its other two sides (left, right). */
      base: length,
      height: length,
      sides: z.tuple([length, length]),
      length,
    })
    .strict()
    .refine((f) => {
      // The apex sits above the base where both slanted sides reach it.
      const x =
        (f.sides[0] ** 2 - f.sides[1] ** 2 + f.base ** 2) / (2 * f.base);
      return closeTo(f.sides[0] ** 2 - x * x, f.height ** 2);
    }, "Triangle sides must agree with its base and height"),
  z
    .object({
      kind: z.literal("square-pyramid-net"),
      unit,
      side: length,
      /** Height of each triangular face, from the base edge to the apex. */
      slant: length,
    })
    .strict()
    .refine((f) => f.slant > f.side / 2, "The faces must meet at an apex"),
  z
    .object({
      kind: z.literal("box-prism"),
      unit,
      length: fraction.nullable(),
      width: fraction.nullable(),
      height: fraction.nullable(),
      /** Edge of the packing cubes drawn on the visible faces, if any. */
      cubeEdge: fraction.nullable(),
    })
    .strict()
    .refine((f) => {
      const edges = [f.length, f.width, f.height];
      if (edges.filter((e) => e === null).length > 1) return false;
      if (!f.cubeEdge) return true;
      const c = f.cubeEdge;
      return edges.every((e) => {
        if (!e) return false;
        const count = (e.n * c.d) / (e.d * c.n);
        return Number.isInteger(count) && count >= 1 && count <= 12;
      });
    }, "Packing cubes must fill every edge exactly"),
  z
    .object({
      kind: z.literal("extruded-polygon"),
      unit,
      /** The front face; every corner is a right angle. */
      face: z.array(point).min(4).max(12),
      sides: z.array(length.nullable()),
      depth: length,
    })
    .strict()
    .refine(
      (f) =>
        f.sides.length === f.face.length &&
        signedArea2(f.face) > 0 &&
        f.face.every((p, i) => {
          const q = f.face[(i + 1) % f.face.length]!;
          return (p[0] === q[0]) !== (p[1] === q[1]);
        }) &&
        f.sides.every(
          (s, i) =>
            s === null ||
            closeTo(s, distance(f.face[i]!, f.face[(i + 1) % f.face.length]!)),
        ),
      "The face must be rectilinear and labels must match",
    ),
  z
    .object({
      kind: z.literal("curved-solid"),
      unit,
      solid: z.enum(["cylinder", "cone", "sphere", "hemisphere"]),
      radius: length.nullable(),
      diameter: length.nullable(),
      height: length.nullable(),
    })
    .strict()
    .refine(
      (f) =>
        (f.radius === null) !== (f.diameter === null) &&
        (f.solid === "cylinder" || f.solid === "cone" || f.height === null),
      "Give exactly one of radius and diameter, and a height only for a cylinder or cone",
    ),
] as const;
const areaVolumeFigureSchema = z.discriminatedUnion(
  "kind",
  areaVolumeFigureSchemas,
);
export type AreaVolumeFigure = z.infer<typeof areaVolumeFigureSchema>;
export const fractionValue = (f: FigureFraction) => f.n / f.d;
