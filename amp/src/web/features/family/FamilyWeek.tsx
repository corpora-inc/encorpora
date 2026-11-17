import { useQueries } from "@tanstack/react-query";
import { minutesFigure } from "../../../schools/practice-rules";
import { Button } from "../../ui/Button";
import { number, shortDay, TipZone } from "../school/classes/teacher-shared";
import { childTimeOptions } from "./api";
import type { Interval } from "./ChildActivity";
import type { FamilyPlace } from "./FamilyFrame";
import styles from "./FamilyWeek.module.css";

const shift = (day: string, offset: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** A day's initial (M, T, W…), as the chart labels its columns. */
const weekday = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "narrow",
    timeZone: "UTC",
  });

/**
 * The family's week on Today, compact: practice time each day this week,
 * every child's together, and the skills earned, from the same daily time
 * each child's page reads: seven day slots, Monday first, today marked, a
 * quiet day a faint tick, each day's figures on hover, tap and focus. Nothing before the week's first practice, so an empty week is the
 * children's cards saying "Not started", never a row of zeros. The chart
 * holds its height while the days arrive.
 */
export function FamilyWeek({ place }: { place: FamilyPlace }) {
  const { data, session, family } = place;
  const week = data?.today.week;
  const children = (data?.children ?? []).filter(
    (child) => child.capabilities.readProgress,
  );
  const times = useQueries({
    queries: children.map((child) =>
      childTimeOptions(session, family, child.id, "week", week?.from ?? ""),
    ),
  });
  if (!data || !week || (week.minutes <= 0 && week.problems <= 0)) return null;
  const pending = times.some((time) => time.isPending);
  const failed = times.find((time) => time.isError);
  const days: Interval[] = Array.from({ length: 7 }, (_, index) => {
    const date = shift(week.from, index);
    let minutes = 0;
    let problems = 0;
    for (const time of times)
      for (const day of time.data?.days ?? [])
        if (day.day === date) {
          minutes += day.minutes;
          problems += day.problems;
        }
    return { date, minutes, problems };
  });
  const largest = Math.max(1, ...days.map((entry) => entry.minutes));
  const label = (entry: Interval) =>
    `${entry.date === data.today.date ? "Today" : shortDay(entry.date)}: ${
      entry.minutes || entry.problems
        ? `${number(entry.minutes)} min · ${entry.problems ?? 0} ${
            entry.problems === 1 ? "problem" : "problems"
          }`
        : "no practice"
    }`;
  return (
    <section
      aria-labelledby="family-week"
      className={styles.week}
      data-family-week=""
    >
      <div className={styles.head}>
        <h2 id="family-week">This week</h2>
        <p data-family-week-facts="">
          {minutesFigure(week.minutes)} min
          {week.objectives > 0 &&
            ` · ${number(week.objectives)} ${
              week.objectives === 1 ? "skill earned" : "skills earned"
            }`}
        </p>
      </div>
      {failed ? (
        <p role="alert" className={styles.reserve}>
          Practice time didn’t load.{" "}
          <Button variant="quiet" onClick={() => void failed.refetch()}>
            Try again
          </Button>
        </p>
      ) : pending ? (
        <div
          className={`amp-skeleton ${styles.reserve}`}
          aria-busy="true"
          aria-label="Loading practice time"
        />
      ) : (
        <TipZone>
          <div
            className={styles.chart}
            role="group"
            aria-label="Practice time each day this week"
          >
            {days.map((entry) => (
              <div
                key={entry.date}
                className={`${styles.day} ${
                  entry.date === data.today.date ? styles.today : ""
                } ${entry.date > data.today.date ? styles.ahead : ""}`}
                tabIndex={0}
                aria-label={label(entry)}
                data-tip={label(entry)}
                data-week-day={entry.date}
              >
                <span className={styles.track}>
                  {entry.minutes > 0 ? (
                    <span
                      className={styles.bar}
                      style={{
                        height: `${Math.max(6, (entry.minutes / largest) * 100)}%`,
                      }}
                    />
                  ) : (
                    <span className={styles.quiet} />
                  )}
                </span>
                <span className={styles.initial} aria-hidden="true">
                  {weekday(entry.date)}
                </span>
              </div>
            ))}
          </div>
        </TipZone>
      )}
    </section>
  );
}
