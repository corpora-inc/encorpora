import type { Rational } from "./schema.js";
export type PlotPoint = { x: Rational; y: Rational };
export type AlgebraModel =
  | {
      kind: "balance";
      unknownLabel: string;
      unitLabel: string;
      left: { bags: number; units: number };
      right: { bags: number; units: number };
    }
  | {
      kind: "coordinate-plot";
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
      xStep: number;
      yStep: number;
      xLabel: string;
      yLabel: string;
      points: (PlotPoint & {
        label?: string;
        labelPosition?: "ne" | "nw" | "se" | "sw";
      })[];
      lines?: {
        slope: Rational;
        intercept: Rational;
        label: string;
        domain?: [Rational, Rational];
      }[];
      segments?: { from: PlotPoint; to: PlotPoint; label?: string }[];
    }
  | {
      kind: "value-table";
      inputLabel: string;
      outputLabel: string;
      rows: { input: Rational; output: Rational | null }[];
    };
export type CoordinatePlot = Extract<AlgebraModel, { kind: "coordinate-plot" }>;
export const exactValue = (q: Rational) => q[0] / q[1];
export const exactLabel = (q: Rational) =>
  q[1] === 1 ? String(q[0]) : `${q[0]}/${q[1]}`;
function fail(message: string): never {
  throw new Error(message);
}
function integer(n: number, min: number, max: number) {
  if (!Number.isSafeInteger(n) || n < min || n > max)
    fail("Algebra diagram integer out of range");
}
function text(s: string, max = 48) {
  if (typeof s !== "string" || !s.trim() || s.length > max)
    fail("Algebra diagram label missing or too long");
}
function quantity(q: Rational) {
  if (!Array.isArray(q) || q.length !== 2) fail("Invalid algebra rational");
  integer(q[0], -10000, 10000);
  integer(q[1], 1, 1000);
}
function reduce(n: bigint, d: bigint): Rational {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  let a = n < 0n ? -n : n,
    b = d;
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  if (!d) fail("Zero rational denominator");
  n /= a;
  d /= a;
  if (!Number.isSafeInteger(Number(n)) || !Number.isSafeInteger(Number(d)))
    fail("Unsafe rational arithmetic");
  return [Number(n), Number(d)];
}
const add = (a: Rational, b: Rational) =>
  reduce(
    BigInt(a[0]) * BigInt(b[1]) + BigInt(b[0]) * BigInt(a[1]),
    BigInt(a[1]) * BigInt(b[1]),
  );
const multiply = (a: Rational, b: Rational) =>
  reduce(BigInt(a[0]) * BigInt(b[0]), BigInt(a[1]) * BigInt(b[1]));
const subtract = (a: Rational, b: Rational) => add(a, [-b[0], b[1]]);
const divide = (a: Rational, b: Rational) =>
  reduce(BigInt(a[0]) * BigInt(b[1]), BigInt(a[1]) * BigInt(b[0]));
export const compareExact = (a: Rational, b: Rational) => {
  const n = BigInt(a[0]) * BigInt(b[1]) - BigInt(b[0]) * BigInt(a[1]);
  return n < 0n ? -1 : n > 0n ? 1 : 0;
};
export function plotContains(d: CoordinatePlot, p: PlotPoint) {
  return (
    compareExact(p.x, [d.xMin, 1]) >= 0 &&
    compareExact(p.x, [d.xMax, 1]) <= 0 &&
    compareExact(p.y, [d.yMin, 1]) >= 0 &&
    compareExact(p.y, [d.yMax, 1]) <= 0
  );
}
/** Exact intersections are computed before converting to SVG coordinates. */
export function clipPlotLine(
  d: CoordinatePlot,
  line: NonNullable<CoordinatePlot["lines"]>[number],
): [PlotPoint, PlotPoint] {
  const at = (x: Rational): PlotPoint => ({
    x,
    y: add(multiply(line.slope, x), line.intercept),
  });
  if (line.domain) return [at(line.domain[0]), at(line.domain[1])];
  const candidates = [at([d.xMin, 1]), at([d.xMax, 1])];
  if (line.slope[0] !== 0)
    for (const y of [d.yMin, d.yMax])
      candidates.push({
        x: divide(subtract([y, 1], line.intercept), line.slope),
        y: [y, 1],
      });
  const points = candidates
    .filter((p) => plotContains(d, p))
    .filter(
      (p, i, a) =>
        a.findIndex(
          (t) => compareExact(t.x, p.x) === 0 && compareExact(t.y, p.y) === 0,
        ) === i,
    )
    .sort((a, b) => compareExact(a.x, b.x));
  if (points.length < 2) fail("Line must cross the coordinate window");
  return [points[0]!, points.at(-1)!];
}
export function validateAlgebraModel(d: AlgebraModel): void {
  if (d.kind === "balance") {
    if (!/^[a-z]$/i.test(d.unknownLabel))
      fail("Balance unknown must be one letter");
    text(d.unitLabel, 24);
    for (const side of [d.left, d.right]) {
      integer(side.bags, 0, 4);
      integer(side.units, 0, 24);
    }
    const a = d.left.bags - d.right.bags,
      b = d.right.units - d.left.units;
    if (a === 0 ? b !== 0 : a * b < 0)
      fail("A level balance must admit a nonnegative bag value");
  } else if (d.kind === "value-table") {
    text(d.inputLabel);
    text(d.outputLabel);
    integer(d.rows.length, 1, 6);
    for (const row of d.rows) {
      quantity(row.input);
      for (const q of [row.input, row.output])
        if (q !== null) {
          quantity(q);
          if (exactLabel(q).length > 8) fail("Table value label too long");
        }
    }
  } else {
    text(d.xLabel);
    text(d.yLabel);
    for (const [min, max, step] of [
      [d.xMin, d.xMax, d.xStep],
      [d.yMin, d.yMax, d.yStep],
    ]) {
      integer(min!, -100, 0);
      integer(max!, 0, 100);
      integer(step!, 1, 100);
      if (
        min! >= max! ||
        min! % step! ||
        max! % step! ||
        (max! - min!) / step! > 8
      )
        fail("Coordinate ticks must align and remain sparse");
    }
    integer(d.points.length, 0, 8);
    integer(d.lines?.length ?? 0, 0, 2);
    integer(d.segments?.length ?? 0, 0, 6);
    const point = (p: PlotPoint) => {
      quantity(p.x);
      quantity(p.y);
      if (!plotContains(d, p)) fail("Coordinate point outside window");
    };
    for (const p of d.points) {
      point(p);
      if (p.label !== undefined) text(p.label, 3);
      if (
        p.labelPosition !== undefined &&
        !["ne", "nw", "se", "sw"].includes(p.labelPosition)
      )
        fail("Invalid point label position");
    }
    for (const line of d.lines ?? []) {
      quantity(line.slope);
      quantity(line.intercept);
      text(line.label, 3);
      if (line.domain) {
        if (line.domain.length !== 2) fail("Line domain needs two endpoints");
        line.domain.forEach(quantity);
        if (compareExact(...line.domain) >= 0)
          fail("Line domain must increase");
      }
      clipPlotLine(d, line).forEach(point);
    }
    for (const segment of d.segments ?? []) {
      point(segment.from);
      point(segment.to);
      if (
        compareExact(segment.from.x, segment.to.x) === 0 &&
        compareExact(segment.from.y, segment.to.y) === 0
      )
        fail("Coordinate segment must have length");
      if (segment.label !== undefined) text(segment.label, 8);
    }
  }
}
