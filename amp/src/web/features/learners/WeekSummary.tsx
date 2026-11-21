import type { ReactNode } from "react";
import { shortDay, TipZone } from "../school/classes/teacher-shared";
import {
  daysInWords,
  intervalDetail,
  practiceTime,
  practiced,
  weekDays,
  type WeekDay,
} from "./week-words";
import styles from "./WeekSummary.module.css";

/** The days of a week a summary draws: the week's Monday, today, and what
 * each day so far held (a missing day is quiet). */
export type WeekDays = {
  from: string;
  today: string;
  daily: readonly { day: string; minutes: number; problems: number }[];
};

/** A day's initial (M, T, W…), as the chart labels its columns. */
const initial = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "narrow",
    timeZone: "UTC",
  });

/**
 * One learner's week as seven dots, Monday first: filled on a day with
 * practice, an open ring on a quiet day so far, a faint point on a day
 * still ahead. One image to a screen reader ("Practiced 3 days this week:
 * Mon, Tue, Fri"). Always the same width.
 */
export function WeekDots({ from, today, daily }: WeekDays) {
  const days = weekDays(from, today, daily);
  return (
    <span
      className={styles.dots}
      role="img"
      aria-label={daysInWords(days)}
      data-week-dots=""
    >
      {days.map((day) => (
        <span
          key={day.day}
          className={styles.dot}
          data-state={
            day.ahead ? "ahead" : practiced(day) ? "practiced" : "quiet"
          }
          data-today={day.today || undefined}
        />
      ))}
    </span>
  );
}

/**
 * The week, merged for every space: a heading, the week's figures (each a
 * value over its label), and optionally the days (each day's minutes as a
 * column, its detail on hover, tap and focus; a day ahead keeps its slot
 * with nothing to say) and a spread across learners, which the caller
 * draws. Holds its height: the chart is the same box whatever it holds.
 */
export function WeekSummary({
  heading = "This week",
  headingId,
  facts,
  days,
  daysLabel = "Practice time each day this week",
  spread,
  ...data
}: {
  heading?: ReactNode;
  headingId: string;
  facts: readonly { value: string; label: string }[];
  days?: WeekDays;
  /** What the day chart shows, for a screen reader. */
  daysLabel?: string;
  /** Each learner's share of the week (a class's spread). */
  spread?: ReactNode;
} & { [key: `data-${string}`]: string | undefined }) {
  return (
    <section
      aria-labelledby={headingId}
      className={styles.week}
      {...data}
    >
      <h2 id={headingId} className={styles.heading}>
        {heading}
      </h2>
      <dl className={styles.facts} data-week-facts="">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {days && <DayChart {...days} label={daysLabel} />}
      {spread}
    </section>
  );
}

function DayChart({ label, ...week }: WeekDays & { label: string }) {
  const days = weekDays(week.from, week.today, week.daily);
  const largest = Math.max(1, ...days.map((day) => day.minutes));
  const words = (day: WeekDay) =>
    `${day.today ? "Today" : shortDay(day.day)}: ${
      practiceTime({ date: day.day, ...day }) ?? "no practice"
    }`;
  return (
    <TipZone>
      <div className={styles.chart} role="group" aria-label={label}>
        {days.map((day) => (
          <div
            key={day.day}
            className={styles.day}
            data-today={day.today || undefined}
            data-week-day={day.day}
            {...intervalDetail(words(day), day.ahead)}
          >
            <span className={styles.track}>
              {day.minutes > 0 ? (
                <span
                  className={styles.bar}
                  style={{
                    height: `${Math.max(6, (day.minutes / largest) * 100)}%`,
                  }}
                />
              ) : (
                <span className={styles.quiet} />
              )}
            </span>
            <span className={styles.initial} aria-hidden="true">
              {initial(day.day)}
            </span>
          </div>
        ))}
      </div>
    </TipZone>
  );
}
