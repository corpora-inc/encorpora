import type { GradeBand } from "../curriculum/types";

/** Grade position on one axis: K = 0 … 8, then the high-school courses. */
export const gradeNumber: Record<GradeBand, number> = {
  K: 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "algebra-1": 9,
  geometry: 10,
  "algebra-2": 11,
  precalculus: 12,
};
export const MAX_GRADE = 12;

export type FrontierObservation = {
  templateId: string;
  correct: boolean;
  assisted: boolean;
};
/** A grade-level estimate: posterior mean, standard deviation, evidence. */
export type Estimate = {
  level: number;
  sd: number;
  answered: number;
  independent: number;
};
export type Frontier = {
  /** The grade a learner of this age is typically working in. */
  expected: number;
  /** Pooled over every strand; seeds strands the learner has not practiced. */
  overall: Estimate;
  strands: Record<string, Estimate>;
};

/** Grades a learner born in `birthYear` should have completed by `now`.
 * US school years begin in August; a child starts kindergarten the fall after
 * turning five, so someone born in 2016 has finished grade 3 by October 2026. */
export function completedGrade(birthYear: number, now = Date.now()): number {
  const date = new Date(now);
  const schoolYear = date.getUTCFullYear() - (date.getUTCMonth() < 7 ? 1 : 0);
  return schoolYear - birthYear - 7;
}

const bandStart = { "K–2": 1, "3–5": 4, "6–8": 7, "9–12": 10 } as const;
/** The grade a learner is typically working in now: born 2016 → grade 4. */
export function initialLevel(options: {
  birthYear?: number | null;
  band?: keyof typeof bandStart | null;
  now?: number;
}): number {
  const level =
    options.birthYear != null
      ? completedGrade(options.birthYear, options.now) + 1
      : options.band
        ? bandStart[options.band]
        : 2;
  return Math.min(MAX_GRADE, Math.max(0, level));
}

// A grid posterior over grade level. Grade -1 lets "below kindergarten" be
// expressed; 13 is college-level.
const GRID = Array.from({ length: 141 }, (_, i) => -1 + i / 10);
const PRIOR_SD = 2.5;
const STRAND_SD = 1.75;
/** P(independent success) for a learner at `theta` on a grade-`grade` problem:
 * about 70% when the problem is at the learner's level, with a small floor
 * and ceiling for lucky guesses and slips. */
function success(theta: number, grade: number) {
  const p = 1 / (1 + Math.exp(-1.7 * (theta - grade + 0.5)));
  return 0.04 + 0.92 * p;
}
function prior(mean: number, sd: number) {
  return GRID.map((theta) => -(((theta - mean) / sd) ** 2) / 2);
}
function summarize(log: number[], answered: number, independent: number) {
  const top = Math.max(...log);
  const weights = log.map((value) => Math.exp(value - top));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const level = weights.reduce((sum, w, i) => sum + w * GRID[i]!, 0) / total;
  const variance =
    weights.reduce((sum, w, i) => sum + w * (GRID[i]! - level) ** 2, 0) /
    total;
  return {
    level: Math.round(level * 100) / 100,
    sd: Math.round(Math.sqrt(variance) * 100) / 100,
    answered,
    independent,
  };
}

/** Bayesian estimate of each strand's grade level from the attempt history.
 * Deterministic: the same history always gives the same estimate. */
export function estimateFrontier(options: {
  start: number;
  observations: readonly FrontierObservation[];
  gradeOf: (templateId: string) => number | undefined;
  strandOf: (templateId: string) => string;
}): Frontier {
  const evidence = options.observations.flatMap((observation) => {
    const grade = options.gradeOf(observation.templateId);
    return grade === undefined
      ? []
      : [
          {
            grade,
            strand: options.strandOf(observation.templateId),
            success: observation.correct && !observation.assisted,
          },
        ];
  });
  const fold = (
    log: number[],
    items: readonly { grade: number; success: boolean }[],
  ) => {
    for (const item of items)
      for (let i = 0; i < GRID.length; i++) {
        const p = success(GRID[i]!, item.grade);
        log[i] += Math.log(item.success ? p : 1 - p);
      }
    return summarize(
      log,
      items.length,
      items.filter((item) => item.success).length,
    );
  };
  const overall = fold(prior(options.start, PRIOR_SD), evidence);
  const strands: Record<string, Estimate> = {};
  for (const strand of new Set(evidence.map((item) => item.strand)))
    strands[strand] = fold(
      prior(overall.level, Math.max(STRAND_SD, overall.sd)),
      evidence.filter((item) => item.strand === strand),
    );
  return { expected: options.start, overall, strands };
}

/** A strand's estimate; untouched strands inherit the overall level with the
 * wider uncertainty of a strand that has no evidence of its own. */
export function strandEstimate(frontier: Frontier, strand: string): Estimate {
  return (
    frontier.strands[strand] ?? {
      level: frontier.overall.level,
      sd: Math.max(STRAND_SD, frontier.overall.sd),
      answered: 0,
      independent: 0,
    }
  );
}
export function strandLevel(frontier: Frontier, strand: string): number {
  return strandEstimate(frontier, strand).level;
}
/** The grade to aim the next problem at: above the estimate while it is
 * uncertain (to learn the most), settling just below it (about 80% success). */
export function targetGrade(estimate: Estimate): number {
  return estimate.level - 0.5 + 0.3 * estimate.sd;
}
