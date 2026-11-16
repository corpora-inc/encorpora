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

type Interval = { date: string; minutes: number; problems?: number };

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
  const largest = Math.max(1, ...shown.map((entry) => entry.minutes));
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
        <TipZone key={`${learner}:${unit}`}>
          <figure className={styles.figure}>
            <div
              className={styles.chart}
              role="group"
              aria-label={`${unit === "day" ? "Daily" : "Weekly"} practice time`}
            >
              {shown.map((entry) => (
                <div
                  key={entry.date}
                  className={styles.column}
                  tabIndex={0}
                  aria-label={`${label(entry)}: ${detail(entry)}`}
                  data-tip={`${label(entry)}: ${detail(entry)}`}
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
            <figcaption>
              <span>{shortDay(shown[0]!.date)}</span>
              <span>Minutes per {unit}</span>
              <span>{shortDay(shown.at(-1)!.date)}</span>
            </figcaption>
          </figure>
        </TipZone>
      )}
    </section>
  );
}
