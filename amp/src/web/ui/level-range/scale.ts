import { levelRange } from "../../../learning/level-check";

/** A grade-level estimate: best guess and its uncertainty, on the curriculum
 * scale (K = 0, grades 1–8, Algebra 1 = 9 … Precalculus = 12, 13 beyond). */
export type Estimate = { level: number; sd: number };
/** The stretch of grades an axis spans, in whole grades. */
export type RangeScale = { lo: number; hi: number };

const FLOOR = 0;
const CEILING = 13;

/** The likely range of an estimate, as every chart here draws it. */
export const likelyRange = (estimate: Estimate) => levelRange(estimate);

/**
 * The scale for a set of estimates: whole grades that hold every likely range
 * (and any `include`d level), at least `minSpan` grades wide, widened evenly
 * around the data when it is narrower. Never narrower than the data, so no
 * one's range runs off an end.
 */
export function fitScale(
  estimates: readonly Estimate[],
  {
    minSpan = 4,
    include = [],
    pad = 0,
  }: {
    minSpan?: number;
    include?: readonly number[];
    /** Whole grades of context beyond the data on each side. */
    pad?: number;
  } = {},
): RangeScale {
  const lows = [
    ...estimates.map((estimate) => likelyRange(estimate)[0]),
    ...include,
  ];
  const highs = [
    ...estimates.map((estimate) => likelyRange(estimate)[1]),
    ...include,
  ];
  if (!lows.length) return { lo: 3, hi: 3 + minSpan };
  let lo = Math.max(FLOOR, Math.floor(Math.min(...lows)) - pad);
  let hi = Math.min(CEILING, Math.ceil(Math.max(...highs)) + pad);
  while (hi - lo < minSpan) {
    if (lo > FLOOR && (hi >= CEILING || (hi - lo) % 2 === 0)) lo -= 1;
    else if (hi < CEILING) hi += 1;
    else break;
  }
  return { lo, hi };
}

/** A level's position on the scale, from 0 to 1; outside the scale it rests
 * at the nearer end. */
export function scaleAt(scale: RangeScale, level: number) {
  const span = Math.max(1e-6, scale.hi - scale.lo);
  return (Math.min(scale.hi, Math.max(scale.lo, level)) - scale.lo) / span;
}

/** Whole grades across a scale. */
export function scaleGrades(scale: RangeScale) {
  const grades: number[] = [];
  for (let g = Math.ceil(scale.lo); g <= Math.floor(scale.hi); g++)
    grades.push(g);
  return grades;
}

/** Grade names short enough to sit side by side under a chart. */
export function shortGrade(level: number) {
  const g = Math.round(level);
  if (g <= 0) return "K";
  if (g <= 8) return `Gr ${g}`;
  return ["Alg 1", "Geom", "Alg 2", "Precalc"][g - 9] ?? "College";
}

export const percent = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;
