import { z } from "zod";

/** A two-row table of equivalent ratios; `null` marks the one cell asked for. */
export type RatioTableFigure = {
  kind: "ratio-table";
  rows: [RatioTableRow, RatioTableRow];
};
export type RatioTableRow = { label: string; values: (number | null)[] };
/** One line of a double number line. Values are numerator/denominator, so
 * fractional marks stay exact; `null` marks the one value asked for. */
export type RateLine = {
  label: string;
  denominator: number;
  numerators: (number | null)[];
};
/** Two aligned number lines; column i of each line is one equivalent pair. */
export type DoubleNumberLineFigure = {
  kind: "double-number-line";
  top: RateLine;
  bottom: RateLine;
};
export type RatioRateFigure = RatioTableFigure | DoubleNumberLineFigure;

const cell = z.number().int().min(0).max(100000).nullable();
const known = <T>(values: (T | null)[]) =>
  values.filter((v): v is T => v !== null);

/** Every complete column states the same ratio, and exactly one cell is unknown. */
function consistent(columns: [number | null, number | null][]) {
  const full = columns.filter(
    (c): c is [number, number] =>
      c[0] !== null && c[1] !== null && (c[0] > 0 || c[1] > 0),
  );
  const unknown = columns.flat().filter((v) => v === null).length;
  if (unknown !== 1 || full.length === 0) return false;
  const [a, b] = full[0]!;
  return full.every(([x, y]) => x * b === y * a) && a > 0 && b > 0;
}

export const ratioRateFigureSchemas = [
  z
    .object({
      kind: z.literal("ratio-table"),
      rows: z.tuple([
        z
          .object({
            label: z.string().min(1).max(24),
            values: z.array(cell).min(3).max(5),
          })
          .strict(),
        z
          .object({
            label: z.string().min(1).max(24),
            values: z.array(cell).min(3).max(5),
          })
          .strict(),
      ]),
    })
    .strict()
    .refine(
      ({ rows: [top, bottom] }) =>
        top.values.length === bottom.values.length &&
        known(top.values).every((v) => v > 0) &&
        known(bottom.values).every((v) => v > 0) &&
        consistent(top.values.map((v, i) => [v, bottom.values[i]!])),
      "A ratio table needs positive equivalent columns and one unknown cell",
    ),
  z
    .object({
      kind: z.literal("double-number-line"),
      top: z
        .object({
          label: z.string().min(1).max(24),
          denominator: z.number().int().min(1).max(12),
          numerators: z.array(cell).min(3).max(6),
        })
        .strict(),
      bottom: z
        .object({
          label: z.string().min(1).max(24),
          denominator: z.number().int().min(1).max(12),
          numerators: z.array(cell).min(3).max(6),
        })
        .strict(),
    })
    .strict()
    .refine(({ top, bottom }) => {
      if (top.numerators.length !== bottom.numerators.length) return false;
      if (top.numerators[0] !== 0 || bottom.numerators[0] !== 0) return false;
      // Compare a/da with b/db by cross-multiplying the denominators in.
      const columns = top.numerators.map(
        (t, i) =>
          [
            t === null ? null : t * bottom.denominator,
            bottom.numerators[i] === null
              ? null
              : bottom.numerators[i]! * top.denominator,
          ] as [number | null, number | null],
      );
      if (!consistent(columns)) return false;
      const positions = rateLinePositions({
        kind: "double-number-line",
        top,
        bottom,
      });
      return positions.every((p, i) => i === 0 || p > positions[i - 1]!);
    }, "A double number line needs aligned, increasing equivalent marks and one unknown value"),
] as const;

/** Each column's position along the lines as a fraction of the longest
 * column, found from the bottom value (or the top value through the rate). */
export function rateLinePositions(figure: DoubleNumberLineFigure): number[] {
  const { top, bottom } = figure;
  const full = top.numerators.findIndex(
    (t, i) => t !== null && t > 0 && bottom.numerators[i] !== null,
  );
  if (full < 0) return top.numerators.map(() => 0);
  // Bottom units per top unit, from one complete column.
  const scale =
    bottom.numerators[full]! /
    bottom.denominator /
    (top.numerators[full]! / top.denominator);
  const values = top.numerators.map((t, i) =>
    bottom.numerators[i] !== null
      ? bottom.numerators[i]! / bottom.denominator
      : (t! / top.denominator) * scale,
  );
  const max = Math.max(...values);
  return values.map((v) => (max > 0 ? v / max : 0));
}
