import { useQueries } from "@tanstack/react-query";
import { Button } from "../../ui/Button";
import { number, shortDay } from "../school/classes/teacher-shared";
import { practiceMinutes } from "../../lib/practice-minutes";
import { childTimeOptions } from "./api";
import { DailyBars, type Interval } from "./ChildActivity";
import type { FamilyPlace } from "./FamilyFrame";
import activity from "./ChildActivity.module.css";

const shift = (day: string, offset: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** A day's initial (M, T, W…), under its column. */
const initial = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "narrow",
    timeZone: "UTC",
  });

/**
 * The family's week on Today, compact: practice time each day this week,
 * every child's together, and the skills earned. Seven day slots, Monday
 * first, each day's initial under it and today's marked; a day without
 * practice is a faint tick. The same chart as a child's Practice time
 * (ChildActivity), from the same daily time each child's page reads. Nothing before the week's first practice, so an empty week is the
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
  const detail = (entry: Interval) =>
    entry.minutes || entry.problems
      ? `${practiceMinutes(entry.minutes, entry.problems ?? 0)} · ${
          entry.problems ?? 0
        } ${entry.problems === 1 ? "problem" : "problems"}`
      : "no practice";
  return (
    <section
      aria-labelledby="family-week"
      className={activity.activity}
      data-family-week=""
    >
      <div className={activity.head}>
        <h2 id="family-week">This week</h2>
        <p data-family-week-facts="">
          {number(week.minutes)} min
          {week.objectives > 0 &&
            ` · ${number(week.objectives)} ${
              week.objectives === 1 ? "skill earned" : "skills earned"
            }`}
        </p>
      </div>
      {failed ? (
        <p role="alert" className={activity.reserve}>
          Practice time didn’t load.{" "}
          <Button variant="quiet" onClick={() => void failed.refetch()}>
            Try again
          </Button>
        </p>
      ) : pending ? (
        <div
          className={`amp-skeleton ${activity.reserve}`}
          aria-busy="true"
          aria-label="Loading practice time"
        />
      ) : (
        <DailyBars
          intervals={days}
          label={(entry) =>
            entry.date === data.today.date ? "Today" : shortDay(entry.date)
          }
          mark={(entry) => initial(entry.date)}
          current={data.today.date}
          detail={detail}
          name="Practice time each day this week"
        />
      )}
    </section>
  );
}
