import { initialLevel } from "../learning/frontier.js";
import { withinGradeSd } from "./norms-prior.js";
import type { StandingCurve } from "./standing-contracts.js";
import {
  expectedBetween,
  medianInterval,
  mixtureDensity,
  mixtureStats,
  seedOf,
  weightedDensity,
  type Grid,
  type Normal,
} from "./standing-math.js";

/** What a student's curve is drawn from: their roster grade, their latest
 * stored level and sd (null: never stored), and their birth year. */
export type CurveInputs = {
  grade: number | null;
  level: number | null;
  sd: number | null;
  birthYear: number | null;
};

/** A student's curve on "grades from their own". No roster grade: there's
 * nothing to stand against, so they aren't on this axis. */
export function standingNormal(
  row: CurveInputs,
  now = Date.now(),
): Normal | null {
  if (row.grade === null) return null;
  if (row.level !== null && row.sd !== null)
    return { mu: row.level - row.grade, sd: row.sd };
  const start =
    row.birthYear !== null
      ? initialLevel({ birthYear: row.birthYear, now })
      : row.grade;
  return { mu: start - row.grade, sd: withinGradeSd(row.grade) };
}

export const round = (value: number, places = 3) => {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
};
/** Density to four significant figures: smooth to the eye, small on the wire. */
const compact = (values: Float64Array) =>
  Array.from(values, (value) => (value ? Number(value.toPrecision(4)) : 0));

/** A group's curve and the numbers it is read by. */
export function curveOf(
  students: readonly Normal[],
  grades: readonly (number | null)[],
  settling: number,
  grid: Grid,
  seed: string,
): StandingCurve {
  const stats = mixtureStats(students);
  const middle = medianInterval(students, { seed: seedOf(seed) });
  const known = grades.filter((grade): grade is number => grade !== null);
  const byGrade = new Map<number, number>();
  for (const grade of known) byGrade.set(grade, (byGrade.get(grade) ?? 0) + 1);
  const typical = [...byGrade].map(([grade, count]) => ({
    mu: 0,
    sd: withinGradeSd(grade),
    weight: count / known.length,
  }));
  return {
    n: stats.n,
    median: middle && round(middle.median),
    mean: stats.mean === null ? null : round(stats.mean),
    sd: stats.sd === null ? null : round(stats.sd),
    middle: middle && {
      median: round(middle.median),
      low: round(middle.low),
      high: round(middle.high),
    },
    settling,
    behind: round(expectedBetween(students, -Infinity, -0.5), 2),
    within: round(expectedBetween(students, -0.5, 0.5), 2),
    ahead: round(expectedBetween(students, 0.5, Infinity), 2),
    density: compact(mixtureDensity(students, grid)),
    typical: compact(weightedDensity(typical, grid)),
  };
}

