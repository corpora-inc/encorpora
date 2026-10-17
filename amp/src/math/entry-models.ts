import { z } from "zod";

const point = z.tuple([
  z.number().finite().min(30).max(290),
  z.number().finite().min(15).max(165),
]);
/** Bounds describe a well-separated closed triangle or an actual square.
 * Floating-point rotation is accepted within geometric tolerance only. */
export function validEntryPolygon(
  vertices: readonly (readonly [number, number])[],
): boolean {
  if (vertices.length !== 3 && vertices.length !== 4) return false;
  const edges = vertices.map((p, i) => {
    const q = vertices[(i + 1) % vertices.length]!;
    return [q[0] - p[0], q[1] - p[1]] as const;
  });
  const cross = edges.map((a, i) => {
    const b = edges[(i + 1) % edges.length]!;
    return a[0] * b[1] - a[1] * b[0];
  });
  if (!cross.every((v) => v > 100) && !cross.every((v) => v < -100))
    return false;
  if (vertices.length === 3) return true;
  const lengths = edges.map(([x, y]) => x * x + y * y);
  return (
    lengths.every((n) => Math.abs(n - lengths[0]!) < 1e-6) &&
    edges.every((a, i) => {
      const b = edges[(i + 1) % edges.length]!;
      return Math.abs(a[0] * b[0] + a[1] * b[1]) < 1e-6;
    })
  );
}
export const entryFigureSchemas = [
  z
    .object({
      kind: z.literal("aligned-strips"),
      lengths: z.tuple([
        z.number().int().min(80).max(240),
        z.number().int().min(80).max(240),
      ]),
      tone: z.enum(["teal-first", "coral-first"]),
    })
    .strict()
    .refine(
      (f) =>
        f.lengths[0] === f.lengths[1] ||
        Math.abs(f.lengths[0] - f.lengths[1]) >= 40,
    ),
  z
    .object({
      kind: z.literal("shape-outline"),
      outline: z.discriminatedUnion("form", [
        z
          .object({
            form: z.literal("round"),
            radius: z.number().int().min(34).max(65),
          })
          .strict(),
        z
          .object({
            form: z.literal("polygon"),
            vertices: z.array(point).min(3).max(4).refine(validEntryPolygon),
          })
          .strict(),
      ]),
      tone: z.enum(["teal", "coral"]),
    })
    .strict(),
] as const;
export type EntryFigure = z.infer<(typeof entryFigureSchemas)[number]>;

/** Describe the visible givens without selecting or naming an answer option. */
export function entryFigureDescription(figure: EntryFigure): string {
  if (figure.kind === "aligned-strips") {
    const [a, b] = figure.lengths;
    return `Two horizontal strips, A above B. Their left ends line up at a dashed starting line. ${a === b ? "Their right ends line up too." : a > b ? "A's right end is to the right of B's right end." : "B's right end is to the right of A's right end."} There are no ruler marks.`;
  }
  return figure.outline.form === "round"
    ? "One closed outline with a smooth curved boundary, no straight sides and no corners. Every point on its boundary is the same distance from its center."
    : figure.outline.vertices.length === 3
      ? "One closed outline made of three straight sides meeting at three corners."
      : "One closed outline made of four equal straight sides. Each pair of adjoining sides meets at a right angle. The outline may be turned.";
}
