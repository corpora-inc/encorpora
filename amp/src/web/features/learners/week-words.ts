import { practiceMinutes } from "../../lib/practice-minutes";

/*
 * A learner's week in words, the same on every screen that shows one (a
 * family's Today, a child's page, a class's roster). Plain functions: no
 * space, no data fetching.
 */

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const WEEKDAY = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});
const DAY_MS = 86_400_000;
const count = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
const at = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** "Today", "Yesterday", or the day: when they last practiced. */
export function lastPracticed(day: string, today: string) {
  const ago = Math.round((at(today) - at(day)) / DAY_MS);
  if (ago <= 0) return "Today";
  if (ago === 1) return "Yesterday";
  return DAY.format(new Date(`${day}T12:00:00Z`));
}

/** A practiced learner's week with nothing in it yet: one quiet line, never
 * "None" (the same words on a family's Today and a child's page). */
export const QUIET_WEEK = "No practice yet this week";

/** A week's figure for a learner who has practiced before: minutes over
 * problems, or null for a week with nothing in it yet (QUIET_WEEK). */
export function weekFigure(minutes: number, problems: number) {
  const value = practiceMinutes(minutes, problems);
  if (!value) return null;
  return {
    value,
    label:
      minutes > 0 || problems > 0
        ? `${count(problems, "problem")} this week`
        : "this week",
  };
}

/** One interval of practice (a day, a week) as a chart draws it. */
export type Interval = { date: string; minutes: number; problems?: number };

/** A day's or a week's practice in words, the one way every family screen
 * says it (lib/practice-minutes.ts): "4 min · 9 problems", "<1 min · 14
 * problems", "1 min"; null when nothing was done. */
export function practiceTime(entry: Interval): string | null {
  const minutes = practiceMinutes(entry.minutes, entry.problems ?? 0);
  if (!minutes) return null;
  return entry.problems === undefined
    ? minutes
    : `${minutes} · ${entry.problems} ${entry.problems === 1 ? "problem" : "problems"}`;
}

/**
 * What a chart column offers about its interval, the one rule for every
 * practice-time chart (a child's page, a week): its detail on hover, tap
 * and keyboard focus (TipZone reads `data-tip`). An interval still ahead (a
 * day after today) has happened to no one yet: it keeps its place in the
 * row but has no detail, no tip and no focus stop.
 */
export function intervalDetail(text: string, ahead = false) {
  return ahead
    ? ({ "aria-hidden": true, "data-ahead": "" } as const)
    : ({ tabIndex: 0, "aria-label": text, "data-tip": text } as const);
}

/** Right answers as a whole percent of the problems answered; null before
 * any. */
export function percentRight(correct: number, problems: number) {
  if (problems <= 0) return null;
  return Math.round((100 * Math.min(correct, problems)) / problems);
}

/** One day of a week as a strip draws it. */
export type WeekDay = {
  day: string;
  minutes: number;
  problems: number;
  /** After today: it keeps its place, with nothing to say yet. */
  ahead: boolean;
  today: boolean;
};

const shift = (day: string, offset: number) =>
  new Date(at(day) + offset * DAY_MS).toISOString().slice(0, 10);

/** The seven days of the week that starts `from` (a Monday), each with its
 * figures from `daily` (days missing from it are quiet). */
export function weekDays(
  from: string,
  today: string,
  daily: readonly { day: string; minutes: number; problems: number }[],
): WeekDay[] {
  const byDay = new Map(daily.map((entry) => [entry.day, entry]));
  return Array.from({ length: 7 }, (_, index) => {
    const day = shift(from, index);
    const entry = byDay.get(day);
    return {
      day,
      minutes: entry?.minutes ?? 0,
      problems: entry?.problems ?? 0,
      ahead: day > today,
      today: day === today,
    };
  });
}

/** Whether a day had any practice. */
export const practiced = (day: { minutes: number; problems: number }) =>
  day.minutes > 0 || day.problems > 0;

/** "Mon", "Tue"… for a day. */
export const weekdayName = (day: string) =>
  WEEKDAY.format(new Date(`${day}T12:00:00Z`));

/** The days practiced, in words for a screen reader: "Practiced 3 days this
 * week: Mon, Tue, Fri". */
export function daysInWords(days: readonly WeekDay[]) {
  const on = days.filter(practiced);
  if (!on.length) return QUIET_WEEK;
  return `Practiced ${count(on.length, "day")} this week: ${on
    .map((day) => weekdayName(day.day))
    .join(", ")}`;
}
