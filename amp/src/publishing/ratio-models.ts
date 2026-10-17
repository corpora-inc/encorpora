import type { Rational } from "./schema.js";
/** Each row measures a commensurable quantity in the same named unit. */
export interface RatioTapeModel {
  kind: "ratio-tape";
  unitLabel: string;
  partValue?: Rational;
  frameParts: number;
  rows: { label: string; parts: number; total?: Rational }[];
}
export interface PercentGridModel {
  kind: "percent-grid";
  wholeLabel: string;
  shadedCells: number[];
}
export type RatioModel = RatioTapeModel | PercentGridModel;
function fail(reason: string): never {
  throw new Error(`Ratio model: ${reason}`);
}
function label(value: unknown, limit: number) {
  if (typeof value !== "string" || !value.trim() || value.length > limit)
    fail("invalid label");
}
function integer(
  value: unknown,
  min: number,
  max: number,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    fail("integer outside model bounds");
}
function rational(value: unknown): asserts value is Rational {
  if (!Array.isArray(value) || value.length !== 2)
    fail("exact rational pair required");
  integer(value[0], 1, 10000);
  integer(value[1], 1, 1000);
}
export function ratioLabel(value: Rational) {
  return value[1] === 1 ? String(value[0]) : `${value[0]}/${value[1]}`;
}
export function validateRatioModel(model: RatioModel) {
  if (!model || typeof model !== "object") fail("missing model");
  if (model.kind === "percent-grid") {
    label(model.wholeLabel, 48);
    if (!Array.isArray(model.shadedCells) || model.shadedCells.length > 100)
      fail("invalid percent cells");
    const seen = new Set<number>();
    for (const index of model.shadedCells) {
      integer(index, 0, 99);
      if (seen.has(index)) fail("duplicate percent cell");
      seen.add(index);
    }
    return;
  }
  if (model.kind !== "ratio-tape") fail("unsupported kind");
  label(model.unitLabel, 24);
  integer(model.frameParts, 1, 12);
  if (
    !Array.isArray(model.rows) ||
    model.rows.length < 2 ||
    model.rows.length > 3
  )
    fail("two or three rows required");
  let common: Rational | undefined;
  if (model.partValue !== undefined) {
    rational(model.partValue);
    common = model.partValue;
  }
  const names = new Set<string>();
  for (const row of model.rows) {
    if (!row || typeof row !== "object") fail("invalid row");
    label(row.label, 24);
    integer(row.parts, 1, model.frameParts);
    if (names.has(row.label.trim())) fail("distinct row labels required");
    names.add(row.label.trim());
    if (row.total !== undefined) {
      rational(row.total);
      const implied: Rational = [row.total[0], row.total[1] * row.parts];
      if (common && common[0] * implied[1] !== implied[0] * common[1])
        fail("displayed amounts disagree about one part");
      common = implied;
    }
  }
}
/** Equal frames and row counts preserve equal SVG part geometry in comparisons. */
export function ratioTapeLayout(model: RatioTapeModel) {
  return {
    cellWidth: 276 / model.frameParts,
    left: 22,
    top: 30,
    rowHeight: 72,
    cellHeight: 32,
    height: model.rows.length * 72 + 10,
  };
}
