import { z } from "zod";

const side = z.number().int().min(1).max(10);
/** Public figures for one-digit multiplication and division. A figure never
 * carries the unknown: a covered array that asks for the row length omits
 * `columns`, and its card has a fixed size so its width cannot be measured. */
export const factArrayFigureSchemas = [
  z
    .object({
      kind: z.literal("dot-array"),
      /** all: every dot. edges: the top row and left column show; a card
       * covers the rest of the array. first-column: the left column shows and
       * a fixed card marked with the total hides how far the rows extend.
       * first-row: the top row shows and a fixed card hides the other rows. */
      show: z.enum(["all", "edges", "first-column", "first-row"]),
      rows: side.optional(),
      columns: side.optional(),
      total: z.number().int().min(1).max(100).optional(),
    })
    .strict()
    .refine((f) => {
      if (f.show === "all" || f.show === "edges")
        return (
          f.rows !== undefined &&
          f.columns !== undefined &&
          f.total === undefined &&
          (f.show === "all" || (f.rows >= 2 && f.columns >= 2))
        );
      const known = f.show === "first-column" ? f.rows : f.columns,
        other = f.show === "first-column" ? f.columns : f.rows;
      return (
        known !== undefined &&
        other === undefined &&
        f.total !== undefined &&
        f.total % known === 0 &&
        f.total / known >= 2 &&
        f.total / known <= 10
      );
    }, "A covered array shows one known side and its total"),
  z
    .object({
      kind: z.literal("share-model"),
      /** share: `count` empty groups wait for the counters. measure: one
       * outlined group holds `count` counters; the number of groups is open. */
      mode: z.enum(["share", "measure"]),
      total: z.number().int().min(4).max(60),
      count: z.number().int().min(2).max(9),
    })
    .strict()
    .refine(
      (f) =>
        f.total % f.count === 0 &&
        f.total / f.count >= 2 &&
        f.total / f.count <= 10 &&
        (f.mode === "measure" || f.count <= 8),
      "The counters must divide exactly",
    ),
  z
    .object({
      kind: z.literal("times-table"),
      /** Row and column factors in display order; each cell is their product. */
      rows: z.array(z.number().int().min(1).max(10)).min(1).max(3),
      columns: z.array(z.number().int().min(1).max(10)).min(1).max(4),
      /** The cell marked ?, as [row index, column index]. */
      ask: z.tuple([z.number().int().min(0), z.number().int().min(0)]),
      /** Further cells left empty, without a mark. */
      blank: z
        .array(z.tuple([z.number().int().min(0), z.number().int().min(0)]))
        .max(4),
    })
    .strict()
    .refine(
      (f) =>
        [f.ask, ...f.blank].every(
          ([r, c]) => r < f.rows.length && c < f.columns.length,
        ) &&
        !f.blank.some(([r, c]) => r === f.ask[0] && c === f.ask[1]) &&
        new Set(f.rows).size === f.rows.length &&
        new Set(f.columns).size === f.columns.length,
      "Cells must lie in the table",
    ),
] as const;
export const factArrayFigureSchema = z.discriminatedUnion(
  "kind",
  factArrayFigureSchemas,
);
export type FactArrayFigure = z.infer<typeof factArrayFigureSchema>;
