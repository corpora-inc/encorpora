import { z } from "zod";

/** A counting surface with local scratch marks and an independently typed area.
 * Only the numeric area travels in the answer; scratch marks never earn credit. */
export const unitSquareMarkingResponseSchema = z
  .object({
    kind: z.literal("unit-square-marking"),
    label: z.string().trim().min(1).max(60),
    unit: z.string().trim().min(1).max(60),
    cols: z.number().int().min(2).max(5),
    rows: z.number().int().min(2).max(6),
    cells: z
      .array(
        z.tuple([
          z.number().int().nonnegative(),
          z.number().int().nonnegative(),
        ]),
      )
      .min(6)
      .max(30),
    tile: z.enum(["square", "sticky", "tile", "card", "napkin", "cracker"]),
    showEmptyGrid: z.boolean(),
  })
  .strict()
  .refine(
    (r) =>
      r.cells.every(([col, row]) => col < r.cols && row < r.rows) &&
      new Set(r.cells.map(([col, row]) => `${col},${row}`)).size ===
        r.cells.length,
    "Every unit square occupies one distinct cell inside the grid",
  );
export type UnitSquareMarkingResponse = z.infer<
  typeof unitSquareMarkingResponseSchema
>;

/** A count is a nonnegative whole number. Do not clamp a wrong count to the grid. */
export function normalizeUnitSquareMarking(raw: string): string | null {
  if (typeof raw !== "string" || raw.length > 100) return null;
  const text = raw.trim();
  return /^\d{1,18}(?:\.0{1,18})?$/.test(text)
    ? BigInt(text.split(".")[0]!).toString()
    : null;
}

export function gradeUnitSquareMarking(key: string, raw: string): boolean {
  const answer = normalizeUnitSquareMarking(raw);
  return answer !== null && answer === normalizeUnitSquareMarking(key);
}

export function unitSquareRowDescription(
  response: UnitSquareMarkingResponse,
): string {
  return Array.from({ length: response.rows }, (_, row) => {
    const count = response.cells.filter((cell) => cell[1] === row).length;
    return `Row ${row + 1}: ${count} shaded ${count === 1 ? "square" : "squares"}.`;
  }).join(" ");
}
