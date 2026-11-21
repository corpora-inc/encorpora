import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ProgressRecord } from "../../../schools/teacher-contracts";
import { Loading } from "../../ui/Loading";
import { Segmented } from "../../ui/Segmented";
import { shortDay, TipZone } from "../school/classes/teacher-shared";
import {
  intervalDetail,
  practiceTime,
  type Interval,
} from "../learners/week-words";
import { childTimeOptions } from "./api";
import type { FamilyPlace } from "./FamilyFrame";
import styles from "./ChildActivity.module.css";

const shift = (day: string, offset: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

// The words of a practice interval and what its chart column offers live
// with the learners' shared parts (learners/week-words.ts).
export { intervalDetail, practiceTime, type Interval };

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
  // Any practice on record: the daily chart has something to show.
  const practiced = record.weeks.some((week) => week.minutes > 0);
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
  const detail = (entry: Interval) => practiceTime(entry) ?? "no practice";
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
      {/* Every daily state (never practiced, the wait, a failure, a quiet
          fortnight, one day) holds the chart's height, so nothing below
          moves when the days arrive or the record refreshes. A child who
          has never practiced has nothing to wait for: their line shows at
          once. */}
      {unit === "day" && !practiced ? (
        <p className={styles.reserve}>No practice in the past two weeks.</p>
      ) : unit === "day" && time.isPending ? (
        <div className={styles.reserve} data-activity-reserve="">
          <Loading inline>Loading practice time…</Loading>
        </div>
      ) : unit === "day" && time.isError ? (
        <p role="alert" className={styles.reserve}>
          Practice time didn’t load.{" "}
          <button onClick={() => void time.refetch()}>Try again</button>
        </p>
      ) : shown.length === 0 ? (
        <p className={unit === "day" ? styles.reserve : undefined}>
          {unit === "day"
            ? "No practice in the past two weeks."
            : "No practice in the past twelve weeks."}
        </p>
      ) : shown.length === 1 ? (
        <p
          data-activity-summary
          className={unit === "day" ? styles.reserve : undefined}
        >
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
          edge={(entry) => shortDay(entry.date)}
        />
      )}
    </section>
  );
}

/**
 * Minutes as columns, one an interval, each with its detail on hover, tap
 * and focus: the one practice-time chart (a child's page, the family's week).
 * Its height is fixed, so nothing moves when it fills in.
 */
export function DailyBars({
  intervals,
  label,
  detail,
  name,
  edge = label,
  ahead,
}: {
  intervals: readonly Interval[];
  label: (entry: Interval) => string;
  detail: (entry: Interval) => string;
  /** What the chart shows, for a screen reader. */
  name: string;
  /** The first and last interval's name under the chart. */
  edge?: (entry: Interval) => string;
  /** An interval still to come, shown without detail (`intervalDetail`). */
  ahead?: (entry: Interval) => boolean;
}) {
  const largest = Math.max(1, ...intervals.map((entry) => entry.minutes));
  if (intervals.length === 0) return null;
  return (
    <TipZone>
      <figure className={styles.figure}>
        <div className={styles.chart} role="group" aria-label={name}>
          {intervals.map((entry) => (
            <div
              key={entry.date}
              className={styles.column}
              {...intervalDetail(
                `${label(entry)}: ${detail(entry)}`,
                ahead?.(entry),
              )}
            >
              <span
                className={styles.bar}
                style={{
                  height: entry.minutes
                    ? `${Math.max(4, (entry.minutes / largest) * 100)}%`
                    : 0,
                }}
              />
            </div>
          ))}
        </div>
        {/* The first and last interval's dates at the axis's ends; what
            the bars measure is the section's heading (Practice time). */}
        <figcaption>
          <span>{edge(intervals[0]!)}</span>
          <span>{edge(intervals.at(-1)!)}</span>
        </figcaption>
      </figure>
    </TipZone>
  );
}
