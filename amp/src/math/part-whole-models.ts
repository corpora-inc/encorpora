import { z } from "zod";

/** Public part–whole figures. Every part's size is an exact rational share of
 * its whole: strips and sectors by integer weights, grid regions by unit-square
 * counts. Renderers draw exactly these shares; nothing is approximate. */
const weights = z.array(z.number().int().min(1).max(6)).min(1).max(8);
const partitionedShape = z
  .object({
    shape: z.enum(["rectangle", "square", "circle"]),
    /** columns/rows: parallel strips; grid: 2 × 2; diagonal: one corner-to-
     * corner cut; diagonals: both diagonals of a square; sectors: from the
     * centre of a circle, clockwise from the top. */
    cut: z.enum([
      "columns",
      "rows",
      "grid",
      "diagonal",
      "diagonals",
      "sectors",
    ]),
    sizes: weights,
    shaded: z.array(z.number().int().nonnegative()).max(8),
    label: z.enum(["A", "B", "C"]).optional(),
  })
  .strict()
  .refine((s) => {
    const n = s.sizes.length,
      equal = s.sizes.every((w) => w === s.sizes[0]);
    if (new Set(s.shaded).size !== s.shaded.length) return false;
    if (s.shaded.some((i) => i >= n)) return false;
    if (s.cut === "sectors") return s.shape === "circle" && n >= 2;
    if (s.shape === "circle") return false;
    if (s.cut === "grid") return n === 4 && equal;
    if (s.cut === "diagonal") return n === 2 && equal;
    if (s.cut === "diagonals") return n === 4 && equal && s.shape === "square";
    return n >= 1;
  });
export const partWholeFigureSchemas = [
  z
    .object({
      kind: z.literal("partitioned-shapes"),
      shapes: z.array(partitionedShape).min(1).max(3),
    })
    .strict()
    .refine(
      (f) =>
        f.shapes.length === 1 ||
        (f.shapes.every((s) => s.label) &&
          new Set(f.shapes.map((s) => s.label)).size === f.shapes.length),
    ),
  z
    .object({
      kind: z.literal("area-partition"),
      columns: z.number().int().min(2).max(8),
      rows: z.number().int().min(2).max(6),
      /** Region index of each unit square, row by row from the top left. */
      regions: z.array(z.number().int().min(0).max(11)),
      shaded: z.array(z.number().int().min(0).max(11)).max(12),
      /** Whether unit-square grid lines are drawn inside the regions. */
      units: z.boolean(),
    })
    .strict()
    .refine((f) => {
      if (f.regions.length !== f.columns * f.rows) return false;
      const count = Math.max(...f.regions) + 1;
      if (!new Set(f.regions).size || new Set(f.regions).size !== count)
        return false;
      return (
        new Set(f.shaded).size === f.shaded.length &&
        f.shaded.every((r) => r < count)
      );
    }),
  z
    .object({
      kind: z.literal("fraction-bars"),
      /** Bars share one whole length; each is cut into `parts` equal pieces. */
      bars: z
        .array(
          z
            .object({
              parts: z.number().int().min(1).max(12),
              shaded: z.number().int().min(0).max(12),
              label: z.string().min(1).max(12),
            })
            .strict()
            .refine((b) => b.shaded <= b.parts),
        )
        .min(1)
        .max(3),
    })
    .strict(),
] as const;
export const partWholeFigureSchema = z.discriminatedUnion(
  "kind",
  partWholeFigureSchemas,
);
export type PartWholeFigure = z.infer<typeof partWholeFigureSchema>;
export type PartitionedShape = z.infer<typeof partitionedShape>;

/** Contiguous equal-area regions: walk the grid row by row, reversing every
 * other row (a boustrophedon path), and cut the path into equal runs. Each run
 * is connected; most runs bend, so equal areas take different shapes. */
export function snakeRegions(
  columns: number,
  rows: number,
  count: number,
  byColumn = false,
): number[] {
  const cells = columns * rows;
  if (cells % count) throw new Error("Regions must have equal area");
  const size = cells / count,
    regions = new Array<number>(cells);
  const outer = byColumn ? columns : rows,
    inner = byColumn ? rows : columns;
  let step = 0;
  for (let i = 0; i < outer; i++)
    for (let k = 0; k < inner; k++) {
      const j = i % 2 ? inner - 1 - k : k;
      const row = byColumn ? j : i,
        column = byColumn ? i : j;
      regions[row * columns + column] = Math.floor(step++ / size);
    }
  return regions;
}
