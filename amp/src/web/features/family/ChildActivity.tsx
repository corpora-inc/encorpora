import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ProgressRecord } from "../../../schools/teacher-contracts";
import { Loading } from "../../ui/Loading";
import { Segmented } from "../../ui/Segmented";
import { number, shortDay, TipZone } from "../school/classes/teacher-shared";
import { childTimeOptions } from "./api";
import type { FamilyPlace } from "./FamilyFrame";
import styles from "./ChildActivity.module.css";

const shift = (day: string, offset: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

export type Interval = { date: string; minutes: number; problems?: number };

/** Daily and weekly activity share one chart, beginning with practice.
 * Keep quiet intervals after that first practice; a single interval is a fact. */
export function ChildActivity({
  place,
  learner,
  record,
}: {
  place: FamilyPlace;
  learner: string;
  record: ProgressRecord;
}) {
  const [unit, setUnit] = useState<"day" | "week">("day");
  const today = place.data!.today.date;
  const from = shift(today, -13);
  const time = useQuery(
    childTimeOptions(place.session, place.family, learner, "month", from),
  );
  const daily = new Map(time.data?.days.map((day) => [day.day, day]));
  const intervals: Interval[] =
    unit === "day"
      ? Array.from({ length: 14 }, (_, index) => {
          const date = shift(from, index);
          const entry = daily.get(date);
          return {
            date,
            minutes: entry?.minutes ?? 0,
            problems: entry?.problems ?? 0,
          };
        })
      : record.weeks.map((week) => ({
          date: week.week,
          minutes: week.minutes,
        }));
  const first = intervals.findIndex(
    (entry) => entry.minutes > 0 || (entry.problems ?? 0) > 0,
  );
  const shown = first < 0 ? [] : intervals.slice(first);
  const label = (entry: Interval) =>
    unit === "week" ? `Week of ${shortDay(entry.date)}` : shortDay(entry.date);
  const detail = (entry: Interval) =>
    `${number(entry.minutes)} min${
      entry.problems === undefined
        ? ""
        : ` · ${entry.problems} ${entry.problems === 1 ? "problem" : "problems"}`
    }`;
  return (
    <section aria-labelledby="child-time" className={styles.activity}>
      <div className={styles.head}>
        <h2 id="child-time">Practice time</h2>
        <Segmented
          label="Time interval"
          compact
          dense
          value={unit}
          onChange={setUnit}
          options={[
            { value: "day", label: "Daily" },
            { value: "week", label: "Weekly" },
          ]}
        />
      </div>
      {unit === "day" && time.isPending ? (
        <Loading inline>Loading practice time…</Loading>
      ) : unit === "day" && time.isError ? (
        <p role="alert">
          Practice time didn’t load.{" "}
          <button onClick={() => void time.refetch()}>Try again</button>
        </p>
      ) : shown.length === 0 ? (
        <p>
          {unit === "day"
            ? "No practice in the past two weeks."
            : "No practice in the past twelve weeks."}
        </p>
      ) : shown.length === 1 ? (
        <p data-activity-summary>
          <strong>{detail(shown[0]!)}</strong>
          {" · "}
          {unit === "day" && shown[0]!.date === today
            ? "Today"
            : label(shown[0]!)}
        </p>
      ) : (
        <DailyBars
          key={`${learner}:${unit}`}
          intervals={shown}
          label={label}
          detail={detail}
          name={`${unit === "day" ? "Daily" : "Weekly"} practice time`}
          caption={`Minutes per ${unit}`}
          edge={(entry) => shortDay(entry.date)}
        />
      )}
    </section>
  );
}

/**
 * Minutes as columns, one an interval, each with its detail on hover, tap
 * and focus: the one practice-time chart (a child's page, the family's week).
 * A quiet interval is a faint tick on the baseline, so every slot shows.
 * Under the columns, either the first and last interval's names around a
 * caption, or (`mark`) each column's own short name, with `current` (today)
 * marked and the intervals after it dimmed and inert. Its height is fixed,
 * so nothing moves when it fills in.
 */
export function DailyBars({
  intervals,
  label,
  detail,
  name,
  caption,
  edge = label,
  mark,
  current,
}: {
  intervals: readonly Interval[];
  label: (entry: Interval) => string;
  detail: (entry: Interval) => string;
  /** What the chart shows, for a screen reader. */
  name: string;
  /** What the columns measure, between the end names (without `mark`). */
  caption?: string;
  /** The first and last interval's name under the chart. */
  edge?: (entry: Interval) => string;
  /** Each column's own short name under it (a day's initial). */
  mark?: (entry: Interval) => string;
  /** The interval that is now (today's date): marked; later ones inert. */
  current?: string;
}) {
  const largest = Math.max(1, ...intervals.map((entry) => entry.minutes));
  if (intervals.length === 0) return null;
  const ahead = (entry: Interval) =>
    current !== undefined && entry.date > current;
  return (
    <TipZone>
      <figure className={styles.figure}>
        <div className={styles.chart} role="group" aria-label={name}>
          {intervals.map((entry) => {
            const later = ahead(entry);
            const quiet = !entry.minutes && !entry.problems;
            return (
              <div
                key={entry.date}
                className={styles.column}
                data-current={entry.date === current || undefined}
                data-ahead={later || undefined}
                data-interval={entry.date}
                {...(later
                  ? { "aria-hidden": true }
                  : {
                      tabIndex: 0,
                      "aria-label": `${label(entry)}: ${detail(entry)}`,
                      "data-tip": `${label(entry)}: ${detail(entry)}`,
                    })}
              >
                <span
                  className={quiet ? styles.tick : styles.bar}
                  style={
                    quiet
                      ? undefined
                      : {
                          height: `${Math.max(4, (entry.minutes / largest) * 100)}%`,
                        }
                  }
                />
              </div>
            );
          })}
        </div>
        {mark ? (
          <div className={styles.marks} aria-hidden="true">
            {intervals.map((entry) => (
              <span
                key={entry.date}
                data-current={entry.date === current || undefined}
                data-ahead={ahead(entry) || undefined}
              >
                {mark(entry)}
              </span>
            ))}
          </div>
        ) : (
          <figcaption>
            <span>{edge(intervals[0]!)}</span>
            {caption && <span>{caption}</span>}
            <span>{edge(intervals.at(-1)!)}</span>
          </figcaption>
        )}
      </figure>
    </TipZone>
  );
}
