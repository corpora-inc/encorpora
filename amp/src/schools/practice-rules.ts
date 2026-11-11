/**
 * What "practiced this week" means, a school's weekly practice target, and when
 * a class is flagged for little practice. One file, so a head's overview, its
 * weekly chart and a teacher's Today count the same students and flag the same
 * classes. Every rule here can be said in one sentence, and is, beside the flag.
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

/** When a class's week reads as little practice. */
export const LOW_PRACTICE = {
  /** Monday is 0: from the third school day, so the week has happened. */
  fromWeekday: 2,
  /** Fewer than this share of the class has practiced. */
  practicedShare: 0.6,
  /** Or the median student is under this share of the target so far. */
  targetShare: 0.25,
} as const;

/** Share of a Monday-to-Friday week gone by the end of `weekday` (Monday 0). */
export const weekElapsed = (weekday: number) => Math.min(5, weekday + 1) / 5;

/** The minutes the median student should be past by now: a quarter of the
 * target for the share of the week gone. Rounded up, so it's a whole minute. */
export const lowPracticeLine = (target: number, weekday: number) =>
  Math.ceil(target * weekElapsed(weekday) * LOW_PRACTICE.targetShare);

export type ClassWeek = {
  /** Each student's active minutes this week. */
  minutes: readonly number[];
  /** How many of them practiced, by `practiced`. */
  practiced: number;
};
export type LowPractice = {
  students: number;
  practiced: number;
  medianMinutes: number;
  target: number;
  /** The median's line for today. */
  line: number;
  fewPracticed: boolean;
  lowMedian: boolean;
};

export const medianOf = (values: readonly number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[half]!
    : (sorted[half - 1]! + sorted[half]!) / 2;
};

/** A class flagged this week, with the facts that flagged it; null when it
 * isn't. Pure, so the overview and Today can't disagree. */
export function lowPractice(
  week: ClassWeek,
  target: number | null,
  weekday: number,
): LowPractice | null {
  const students = week.minutes.length;
  if (!students || weekday < LOW_PRACTICE.fromWeekday) return null;
  const median = medianOf(week.minutes) ?? 0;
  const fewPracticed = week.practiced < LOW_PRACTICE.practicedShare * students;
  const line = target === null ? null : lowPracticeLine(target, weekday);
  const lowMedian = line !== null && median < line;
  if (!fewPracticed && !lowMedian) return null;
  return {
    students,
    practiced: week.practiced,
    medianMinutes: Math.round(median),
    target: target ?? 0,
    line: line ?? 0,
    fewPracticed,
    lowMedian,
  };
}

/** "9 of 22 have practiced · median 4 of 60 min". */
export function lowPracticeFacts(flag: LowPractice): string {
  const who = `${flag.practiced} of ${flag.students} ${flag.practiced === 1 ? "has" : "have"} practiced`;
  return flag.target
    ? `${who} · median ${flag.medianMinutes} of ${flag.target} min`
    : who;
}

/** The rule in one sentence, with today's numbers in it. */
export function lowPracticeRule(target: number | null, weekday: number) {
  const share = Math.round(LOW_PRACTICE.practicedShare * 100);
  const practice = `fewer than ${share}% of its students have practiced (${PRACTICED.minutes} minutes or ${PRACTICED.problems} problems)`;
  if (target === null)
    return `From Wednesday, a class is flagged when ${practice}.`;
  const line = lowPracticeLine(
    target,
    Math.max(weekday, LOW_PRACTICE.fromWeekday),
  );
  return `From Wednesday, a class is flagged when ${practice}, or its median student has under a quarter of the ${target}-minute weekly target for the days so far (${line} minutes ${weekday >= 4 ? "this week" : "by today"}).`;
}
