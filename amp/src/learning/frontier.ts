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
type Staircase = {
  level: number;
  step: number;
  direction: -1 | 0 | 1;
  n: number;
};
export type Frontier = {
  /** Overall estimate; seeds strands the learner has not yet touched. */
  overall: Staircase;
  strands: Record<string, Staircase>;
};

/** Grades a learner born in `birthYear` should have completed by `now`.
 * US school years begin in August; a child starts kindergarten the fall after
 * turning five, so someone born in 2016 has finished grade 3 by October 2026. */
export function completedGrade(birthYear: number, now = Date.now()): number {
  const date = new Date(now);
  const schoolYear = date.getUTCFullYear() - (date.getUTCMonth() < 7 ? 1 : 0);
  return schoolYear - birthYear - 7;
}

const bandStart = { "K–2": 1, "3–5": 3, "6–8": 6, "9–12": 9 } as const;
export function initialLevel(options: {
  birthYear?: number | null;
  band?: keyof typeof bandStart | null;
  now?: number;
}): number {
  const level =
    options.birthYear != null
      ? completedGrade(options.birthYear, options.now)
      : options.band
        ? bandStart[options.band]
        : 1;
  return Math.min(MAX_GRADE, Math.max(0, level));
}

const FIRST_STEP = 1;
const MIN_STEP = 0.25;
const MAX_STEP = 2;
function fresh(level: number): Staircase {
  return { level, step: FIRST_STEP, direction: 0, n: 0 };
}

/** Adaptive staircase in grade units. Consecutive moves in one direction grow
 * the step, so a strong learner climbs several grades in a few problems and a
 * struggling learner descends as far as counting. Each reversal halves the step,
 * so the estimate settles on the level where the learner succeeds about as often
 * as not. An easy success or an out-of-reach miss carries little information
 * and barely moves it. */
function move(state: Staircase, grade: number, success: boolean): Staircase {
  const direction = success ? 1 : -1;
  if (success && grade < state.level - 1) return { ...state, n: state.n + 1 };
  const step =
    state.direction === 0
      ? state.step
      : direction === state.direction
        ? Math.min(MAX_STEP, state.step * 1.5)
        : Math.max(MIN_STEP, state.step / 2);
  const reach = !success && grade > state.level + 1 ? 0.5 : 1;
  const level = Math.min(
    MAX_GRADE,
    Math.max(0, state.level + direction * step * reach),
  );
  return { level, step, direction, n: state.n + 1 };
}

export function estimateFrontier(options: {
  start: number;
  observations: readonly FrontierObservation[];
  gradeOf: (templateId: string) => number | undefined;
  strandOf: (templateId: string) => string;
}): Frontier {
  const frontier: Frontier = { overall: fresh(options.start), strands: {} };
  for (const observation of options.observations) {
    const grade = options.gradeOf(observation.templateId);
    if (grade === undefined) continue;
    const success = observation.correct && !observation.assisted;
    const strand = options.strandOf(observation.templateId);
    const current = frontier.strands[strand] ?? fresh(frontier.overall.level);
    frontier.strands[strand] = move(current, grade, success);
    frontier.overall = move(frontier.overall, grade, success);
  }
  return frontier;
}

export function strandLevel(frontier: Frontier, strand: string): number {
  return (frontier.strands[strand] ?? frontier.overall).level;
}
