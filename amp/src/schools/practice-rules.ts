/**
 * What "practiced this week" means, and a school's weekly practice target. One
 * file, so a head's overview, its weekly chart and a teacher's Today count the
 * same students. The target is a scale, never a verdict: it is the midpoint of
 * every practice heat map's colour scale, and nothing is flagged against it.
 */

/** A student practiced this week with at least this much of either. */
export const PRACTICED = { minutes: 5, problems: 5 } as const;
export const practiced = (minutes: number, problems: number) =>
  minutes >= PRACTICED.minutes || problems >= PRACTICED.problems;
/** The same rule over `amp_learner_weeks` columns, for SQL. */
export const practicedSql = (activeMs: string, attempts: string) =>
  `(${activeMs}>=${PRACTICED.minutes * 60_000} OR ${attempts}>=${PRACTICED.problems})`;
export const PRACTICED_WORDS = `at least ${PRACTICED.minutes} active minutes or ${PRACTICED.problems} problems this week`;

/** Minutes a week per student, until a school sets its own. A family has no
 * target until a parent sets one. */
export const DEFAULT_WEEKLY_TARGET_MINUTES = 60;

export const medianOf = (values: readonly number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[half]!
    : (sorted[half - 1]! + sorted[half]!) / 2;
};
