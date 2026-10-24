import type { GradeBand } from "../curriculum/types";
import {
  assertFrontierPolicy,
  DEFAULT_FRONTIER_POLICY,
  type FrontierPolicy,
} from "./frontier-policy";

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
  /** ISO time of the answer; drives how much the estimate may have moved. */
  createdAt?: string;
};
/** Curriculum coordinate, uncertainty width, and evidence counts. Overall sd
 * includes a bounded surprise reserve; it is not calibrated confidence. */
export type Estimate = {
  level: number;
  sd: number;
  answered: number;
  independent: number;
};
export type Frontier = {
  /** The grade a learner of this age is typically working in. */
  expected: number;
  /** Steadier working-grade summary for the learner-facing readout. */
  overall: Estimate;
  strands: Record<string, Estimate>;
  /** Responsive pooled prior for local selection, separate from the displayed
   * working grade. Optional for older clients and stored snapshots. */
  adaptive?: Estimate;
  /** Preserve the injected prior when looking up an untouched strand. */
  strandPriorSd?: number;
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
/** Choice success includes chance guessing. Wrong-choice likelihood is the
 * typed-miss likelihood times a constant, so both carry the same evidence. */
function responseModel(response: FrontierPolicy["response"]) {
  const { typedGuess, slip, discrimination, atLevelSuccess } = response;
  const offset =
    Math.log((atLevelSuccess - typedGuess) / (1 - slip - atLevelSuccess)) /
    discrimination;
  return (theta: number, grade: number, guess: number) => {
    const p = 1 / (1 + Math.exp(-discrimination * (theta - grade + offset)));
    return guess + (1 - guess) * (typedGuess + (1 - typedGuess - slip) * p);
  };
}
function prior(mean: number, sd: number) {
  return GRID.map((theta) => -(((theta - mean) / sd) ** 2) / 2);
}
function summarize(
  log: number[],
  answered: number,
  independent: number,
  extraVariance = 0,
) {
  const top = Math.max(...log);
  const weights = log.map((value) => Math.exp(value - top));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const level = weights.reduce((sum, w, i) => sum + w * GRID[i]!, 0) / total;
  const variance =
    weights.reduce((sum, w, i) => sum + w * (GRID[i]! - level) ** 2, 0) / total;
  return {
    level: Math.round(level * 100) / 100,
    sd: Math.round(Math.sqrt(variance + extraVariance) * 100) / 100,
    answered,
    independent,
  };
}

// Convolve the posterior with a small time/evidence-dependent drift kernel.
// Overall and strand recency are configured separately in frontier-policy.ts.
const DAY = 86400000;
function blur(log: number[], variance: number) {
  if (variance <= 0) return log;
  const sd = Math.sqrt(variance) * 10; // in grid steps of 0.1 grade
  const radius = Math.ceil(3 * sd);
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, i) =>
    Math.exp(-(((i - radius) / sd) ** 2) / 2),
  );
  const top = Math.max(...log);
  const weights = log.map((value) => Math.exp(value - top));
  return weights.map((_, i) => {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = Math.min(GRID.length - 1, Math.max(0, i + k));
      sum += weights[j]! * kernel[k + radius]!;
    }
    return Math.log(sum + 1e-300);
  });
}

type Evidence = {
  grade: number;
  /** Chance a guess is graded correct: 0 for typed answers, 1/k for k options. */
  guess: number;
  strand: string;
  success: boolean;
  assisted: boolean;
  at: number;
};
function fold(
  start: number[],
  items: readonly Evidence[],
  now: number,
  policy: FrontierPolicy,
  drift: FrontierPolicy["overall"],
  success: ReturnType<typeof responseModel>,
  reportSurprises = false,
): Estimate {
  let log = start;
  let previous: number | null = null;
  let surprise = 0;
  let uncertainty = 0;
  for (const item of items) {
    const correct =
      item.assisted && policy.assisted.treatAsFailure ? false : item.success;
    const weight = item.assisted
      ? correct
        ? policy.assisted.correctWeight
        : policy.assisted.incorrectWeight
      : 1;
    // Assisted success provides partial evidence, never independent mastery.
    // An assisted miss can be neutral without losing the recorded attempt.
    if (weight === 0) continue;
    const days =
      previous === null
        ? 0
        : Math.min(
            policy.maxDriftDays,
            Math.max(0, (item.at - previous) / DAY),
          );
    log = blur(
      log,
      (previous === null ? 0 : drift.perAnswer * weight) +
        drift.perDay * days +
        surprise,
    );
    previous = item.at;
    const top = Math.max(...log);
    const weights = log.map((value) => Math.exp(value - top));
    const total = weights.reduce((sum, w) => sum + w, 0);
    const expected =
      weights.reduce(
        (sum, w, i) => sum + w * success(GRID[i]!, item.grade, item.guess),
        0,
      ) / total;
    // This is reporting uncertainty, not extra likelihood weight for the
    // next answer. A rare miss calls the summary into question without
    // erasing the learner's established history.
    if (reportSurprises) {
      const u = policy.overallUncertainty;
      uncertainty *= u.retentionPerAnswer ** weight;
      const withoutChoiceGuess = (expected - item.guess) / (1 - item.guess);
      if (!correct && withoutChoiceGuess > u.rareMissThreshold)
        uncertainty = Math.min(
          u.maxVariance,
          uncertainty + u.rareMissVariance * weight,
        );
    }
    surprise =
      (correct ? 1 - expected : expected) > policy.surpriseThreshold
        ? correct
          ? drift.surpriseCorrect * weight
          : drift.surpriseIncorrect * weight
        : 0;
    for (let i = 0; i < GRID.length; i++) {
      const p = success(GRID[i]!, item.grade, item.guess);
      log[i] = log[i]! + weight * Math.log(correct ? p : 1 - p);
    }
  }
  if (previous !== null)
    log = blur(
      log,
      drift.perDay *
        Math.min(policy.maxDriftDays, Math.max(0, (now - previous) / DAY)),
    );
  return summarize(
    log,
    items.length,
    items.filter((item) => item.success && !item.assisted).length,
    uncertainty,
  );
}

/** Bayesian estimate of each strand's grade level from the attempt history,
 * allowing the level to change over time. Deterministic for a given history
 * and time. */
export function estimateFrontier(options: {
  start: number;
  observations: readonly FrontierObservation[];
  gradeOf: (templateId: string) => number | undefined;
  strandOf: (templateId: string) => string;
  /** Chance that guessing answers the item correctly (`guessChance` in
   * math/guess-chance.ts). Required, so no caller silently scores a 1-in-3
   * pick as a typed answer. */
  guessOf: (templateId: string) => number;
  now?: number;
  /** Validated, immutable parameters for reproducible estimator comparisons. */
  policy?: FrontierPolicy;
}): Frontier {
  const policy = options.policy ?? DEFAULT_FRONTIER_POLICY;
  assertFrontierPolicy(policy);
  const success = responseModel(policy.response);
  const strandSuccess = responseModel(policy.strandResponse);
  const evidence: Evidence[] = [];
  options.observations.forEach((observation, index) => {
    const grade = options.gradeOf(observation.templateId);
    if (grade === undefined) return;
    evidence.push({
      grade,
      guess: Math.min(
        0.5,
        Math.max(0, options.guessOf(observation.templateId)),
      ),
      strand: options.strandOf(observation.templateId),
      success: observation.correct,
      assisted: observation.assisted,
      at: observation.createdAt
        ? Date.parse(observation.createdAt)
        : index * 60000,
    });
  });
  const now = options.now ?? evidence.at(-1)?.at ?? 0;
  const overall = fold(
    prior(options.start, policy.prior.overallSd),
    evidence,
    now,
    policy,
    policy.overall,
    success,
    true,
  );
  // Local selection retains its responsive evidence model. A steadier overall
  // readout must not hide a weak area or slow progress in a stronger one.
  const adaptive = fold(
    prior(options.start, policy.prior.overallSd),
    evidence,
    now,
    policy,
    policy.strand,
    strandSuccess,
  );
  const strands: Record<string, Estimate> = {};
  for (const strand of new Set(evidence.map((item) => item.strand)))
    strands[strand] = fold(
      prior(adaptive.level, Math.max(policy.prior.strandSd, adaptive.sd)),
      evidence.filter((item) => item.strand === strand),
      now,
      policy,
      policy.strand,
      strandSuccess,
    );
  return {
    expected: options.start,
    overall,
    adaptive,
    strands,
    strandPriorSd: policy.prior.strandSd,
  };
}

/** A strand's estimate; untouched strands inherit the overall level with the
 * wider uncertainty of a strand that has no evidence of its own. */
export function strandEstimate(frontier: Frontier, strand: string): Estimate {
  if (frontier.strands[strand]) return frontier.strands[strand]!;
  const pooled = frontier.adaptive ?? frontier.overall;
  // Match fold's bounded prior exactly. Otherwise merely recording a neutral
  // assisted attempt could move a previously untouched area's estimate.
  return summarize(
    prior(
      pooled.level,
      Math.max(
        frontier.strandPriorSd ?? DEFAULT_FRONTIER_POLICY.prior.strandSd,
        pooled.sd,
      ),
    ),
    0,
    0,
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
