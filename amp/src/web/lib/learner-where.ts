import {
  gradeName,
  measured,
  shownRange,
  type ShownRange,
} from "../../learning/level-check";
import type { Estimate } from "../../learning/frontier";

/** An estimate as the server reports it (`reportEstimate`): a child's
 * record, an adult's own, or a learner's frontier. */
export type ReportedEstimate = Pick<
  Estimate,
  "level" | "sd" | "low" | "high"
> & {
  answered?: number;
};

/**
 * Where a learner is, the one answer every screen gives: the child page's
 * "Current estimates", Pathways' grades view ("Where you are" and the bands
 * it marks) and the 3D map ("Where you are" and its outlines).
 *
 * - `best`: the best guess, as a whole grade (0 kindergarten … 12
 *   precalculus) inside the likely range, named `bestName` ("Algebra 1").
 * - `range`: the likely range in the whole grades its words and bar name
 *   (`shownRange`: the estimate's own 80% range).
 *
 * Null before any answer: there is no "where" yet, only the starting guess.
 */
export type LearnerWhere = {
  level: number;
  best: number;
  bestName: string;
  range: ShownRange;
};

export function learnerWhere(
  estimate: ReportedEstimate | null | undefined,
): LearnerWhere | null {
  if (!estimate || !measured(estimate)) return null;
  const range = shownRange(estimate);
  const best = Math.min(
    range.to,
    Math.max(range.from, Math.round(estimate.level)),
  );
  return { level: estimate.level, best, bestName: gradeName(best), range };
}
