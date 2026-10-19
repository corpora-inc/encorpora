import { z } from "zod";

/** Plane coordinates in shape units, y up. Rotated shapes carry rounded
 * coordinates; the figure is the only geometric truth a learner sees, and an
 * independent reviewer classifies shapes from these numbers alone. */
const coordinate = z.number().finite().min(-40).max(40);
const point = z.tuple([coordinate, coordinate]);
const radius = z.number().finite().positive().max(20);
const polygon = z
  .object({ type: z.literal("polygon"), points: z.array(point).min(3).max(12) })
  .strict();
const ellipse = z
  .object({
    type: z.literal("ellipse"),
    center: point,
    radii: z.tuple([radius, radius]),
    /** Degrees, counterclockwise, of the first radius. */
    angle: z.number().finite().min(0).max(180),
  })
  .strict();
export const flatShapeSchema = z.discriminatedUnion("type", [polygon, ellipse]);
export type FlatShape = z.infer<typeof flatShapeSchema>;
const itemLabel = z.enum(["A", "B", "C", "D"]);
const shapeItem = z
  .object({
    label: itemLabel.optional(),
    /** Pieces drawn edge to edge; a single piece is an ordinary shape. */
    pieces: z.array(flatShapeSchema).min(1).max(8),
  })
  .strict();
export type ShapeItem = z.infer<typeof shapeItem>;

/** A right solid standing on a horizontal base: x right, y away from the
 * viewer, z up. A circular base is an ellipse with equal radii. */
const solidBase = z.discriminatedUnion("type", [polygon, ellipse]);
const height = z.number().finite().positive().max(20);
export const solidSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sphere"), radius }).strict(),
  z.object({ type: z.literal("prism"), base: solidBase, height }).strict(),
  z.object({ type: z.literal("pyramid"), base: solidBase, height }).strict(),
]);
export type Solid = z.infer<typeof solidSchema>;

export const shapeFigureSchemas = [
  // One to four flat shapes drawn at one common scale, so sizes compare truly.
  z
    .object({
      kind: z.literal("plane-shapes"),
      items: z.array(shapeItem).min(1).max(4),
    })
    .strict()
    .refine((f) => labelsDistinct(f.items)),
  // A dashed target outline partly covered by pieces, and lettered candidate
  // pieces at the same scale; one candidate fills the gap.
  z
    .object({
      kind: z.literal("shape-puzzle"),
      outline: z.array(point).min(3).max(12),
      placed: z.array(flatShapeSchema).min(1).max(7),
      candidates: z.array(shapeItem).min(2).max(4),
    })
    .strict()
    .refine(
      (f) => labelsDistinct(f.candidates) && f.candidates.every((c) => c.label),
    ),
  z.object({ kind: z.literal("solid-shape"), solid: solidSchema }).strict(),
] as const;
function labelsDistinct(items: readonly ShapeItem[]) {
  const labels = items.flatMap((i) => (i.label ? [i.label] : []));
  return new Set(labels).size === labels.length;
}
export const shapeFigureSchema = z.discriminatedUnion(
  "kind",
  shapeFigureSchemas,
);
export type ShapeFigure = z.infer<typeof shapeFigureSchema>;

export type Pt = [number, number];
const round = (n: number) => Math.round(n * 1e4) / 1e4 || 0;
/** Rotate (degrees, counterclockwise) about the origin, then translate. */
export function place(points: readonly Pt[], degrees: number, at: Pt = [0, 0]) {
  const t = (degrees * Math.PI) / 180,
    c = Math.cos(t),
    s = Math.sin(t);
  return points.map(
    ([x, y]) =>
      [round(x * c - y * s + at[0]), round(x * s + y * c + at[1])] as Pt,
  );
}
export function centroid(points: readonly Pt[]): Pt {
  const n = points.length;
  return [
    points.reduce((a, p) => a + p[0], 0) / n,
    points.reduce((a, p) => a + p[1], 0) / n,
  ];
}
/** Signed area: positive for counterclockwise vertex order. */
export function signedArea(points: readonly Pt[]) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!,
      [x2, y2] = points[(i + 1) % points.length]!;
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}
export function bounds(shapes: readonly FlatShape[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const add = ([x, y]: Pt) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  for (const s of shapes)
    if (s.type === "polygon") s.points.forEach((p) => add(p as Pt));
    else {
      // Exact extent of a rotated ellipse.
      const t = (s.angle * Math.PI) / 180,
        [a, b] = s.radii,
        ex = Math.hypot(a * Math.cos(t), b * Math.sin(t)),
        ey = Math.hypot(a * Math.sin(t), b * Math.cos(t));
      add([s.center[0] - ex, s.center[1] - ey]);
      add([s.center[0] + ex, s.center[1] + ey]);
    }
  return { minX, minY, maxX, maxY };
}

/** Orthographic view from in front and above, shared by the figure and the
 * lesson models. Screen y runs down. */
export const SOLID_VIEW = { elevation: (22 * Math.PI) / 180 } as const;
export function solidProject(x: number, y: number, z: number) {
  const e = SOLID_VIEW.elevation;
  return { x, y: -(y * Math.sin(e) + z * Math.cos(e)) };
}
/** True when a face with outward normal n faces the viewer. */
export function facesViewer(n: [number, number, number]) {
  const e = SOLID_VIEW.elevation;
  return -n[1] * Math.cos(e) + n[2] * Math.sin(e) > 1e-9;
}
