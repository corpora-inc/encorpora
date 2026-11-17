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

/** How many practiced today and this week, by the one rule, from the same
 * per-student totals: a day is inside its week, so today's count can never
 * pass the week's. */
export function practiceCounts(
  students: readonly {
    todayMinutes: number;
    todayProblems: number;
    weekMinutes: number;
    weekProblems: number;
  }[],
): { today: number; week: number } {
  return {
    today: students.filter((s) => practiced(s.todayMinutes, s.todayProblems))
      .length,
    week: students.filter((s) => practiced(s.weekMinutes, s.weekProblems))
      .length,
  };
}

/** Active minutes as a figure: "<1" for under a minute of real practice
 * (never a 0 beside work done), else whole minutes. */
export function minutesFigure(minutes: number): string {
  if (minutes > 0 && minutes < 0.5) return "<1";
  return Math.round(minutes).toLocaleString("en-US");
}
/** The unit beside `minutesFigure`: one for "<1" and "1", else many. */
export function minutesNoun(minutes: number, noun = "minute"): string {
  const figure = minutesFigure(minutes);
  return figure === "<1" || figure === "1" ? noun : `${noun}s`;
}
/** "under 1 active minute", "1 active minute", "12 active minutes". */
export function minutesWords(minutes: number, noun = "minute"): string {
  const figure = minutesFigure(minutes);
  return `${figure === "<1" ? "under 1" : figure} ${minutesNoun(minutes, noun)}`;
}

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
