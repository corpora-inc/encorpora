import { z } from "zod";

/** Public decimal figures. Every shaded square, tick and digit is an exact
 * count of tenths, hundredths or thousandths; nothing is approximate. */
export const decimalFigureSchemas = [
  z
    .object({
      kind: z.literal("decimal-grid"),
      /** tenths: one whole as 10 strips; hundredths: one whole as 10 × 10. */
      unit: z.enum(["tenths", "hundredths"]),
      /** Shaded units, filled column by column from the left. */
      shaded: z.number().int().min(0).max(100),
    })
    .strict()
    .refine((f) => f.shaded <= (f.unit === "tenths" ? 10 : 100)),
  z
    .object({
      kind: z.literal("decimal-line"),
      /** The line runs from start/denominator to (start + 10)/denominator. */
      denominator: z.union([z.literal(10), z.literal(100)]),
      start: z.number().int().min(0).max(990),
      /** Small intervals from the left end to P. */
      point: z.number().int().min(1).max(9),
    })
    .strict(),
  z
    .object({
      kind: z.literal("place-value-chart"),
      /** Digit columns after the decimal point. */
      places: z.union([z.literal(2), z.literal(3)]),
      rows: z
        .array(
          z
            .object({
              ones: z.number().int().min(0).max(9),
              /** Digits written after the point, as given (no padding). */
              decimals: z.string().regex(/^\d{1,3}$/),
            })
            .strict(),
        )
        .length(2),
    })
    .strict()
    .refine((f) => f.rows.every((r) => r.decimals.length <= f.places)),
] as const;
export const decimalFigureSchema = z.discriminatedUnion(
  "kind",
  decimalFigureSchemas,
);
export type DecimalFigure = z.infer<typeof decimalFigureSchema>;

/** n / 10^places written with exactly `places` decimal digits. */
export function fixed(n: number, places: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("Expected n >= 0");
  if (!places) return String(n);
  const s = String(n).padStart(places + 1, "0");
  return `${s.slice(0, -places)}.${s.slice(-places)}`;
}
/** Exact decimal without trailing zeros: 3.40 → 3.4, 2.00 → 2. */
export function decimal(n: number, places: number): string {
  const s = fixed(n, places);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
