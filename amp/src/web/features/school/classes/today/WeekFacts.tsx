import type { CSSProperties } from "react";
import { summarize } from "../../../../../schools/practice-stats";
import type { TodayResponse } from "../../../../../schools/teacher-contracts";
import { HeatCell, HeatLegend, StatsLine } from "../../practice/heat";
import { InfoPopover } from "../../../../ui/InfoPopover";
import { number, TipZone } from "../teacher-shared";
import styles from "./Today.module.css";
import type { SpaceWords } from "../../../spaces/words";

/** A class's week reads in the thousands; a smaller count says nothing. */
const PROBLEMS_WORTH_STATING = 1000;

/** The week so far in one line of figures, then every student's minutes on
 * the cold-to-hot scale, the distribution's n, median, mean and sd a tap away. No
 * verdict. Nothing until there's work: an empty week is the children's rows
 * saying "Not yet", never a row of zeros. */
export function WeekFacts({
  week,
  words,
  target = null,
  students,
  earned = ["skill shown twice on its own", "skills shown twice on their own"],
}: {
  /** What a skill earned this week is called, one and several, in the
   * space's words. */
  earned?: readonly [string, string];
  week: TodayResponse["week"];
  /** Who practiced, in the space's words (features/spaces/words.ts). */
  words: Pick<SpaceWords, "learner" | "learners">;
  /** The weekly target for each learner, set in Settings. */
  target?: number | null;
  /** A class's students, for the spread of the week. */
  students?: TodayResponse["students"];
}) {
  if (week.minutes <= 0 && week.problems <= 0) return null;
  return (
    <section className={styles.week} aria-labelledby="today-week">
      <h2 id="today-week" className={styles.sectionTitle}>
        This week
      </h2>
      <dl className={styles.weekFacts}>
        <div>
          <dt>active minutes</dt>
          <dd>{number(week.minutes)}</dd>
        </div>
        {week.problems >= PROBLEMS_WORTH_STATING ? (
          <div>
            <dt>problems</dt>
            <dd>{number(week.problems)}</dd>
          </div>
        ) : (
          <div>
            <dt>
              {week.skills === 1 ? "skill practiced" : "skills practiced"}
            </dt>
            <dd>{number(week.skills)}</dd>
          </div>
        )}
        {week.objectives > 0 && (
          <div>
            <dt>
              {week.objectives === 1 ? earned[0] : earned[1]}
            </dt>
            <dd>{number(week.objectives)}</dd>
          </div>
        )}
        <div>
          <dt>{words.learners} practiced</dt>
          <dd>
            {week.working} of {week.students}
          </dd>
        </div>
      </dl>
      {students && students.length > 1 && target !== null && (
        <Spread students={students} target={target} words={words} />
      )}
    </section>
  );
}

/** Each student's active minutes this week, most first, one cell each. */
function Spread({
  students,
  target,
  words,
}: {
  students: NonNullable<TodayResponse["students"]>;
  words: Pick<SpaceWords, "learner" | "learners">;
  target: number;
}) {
  const sorted = [...students].sort(
    (a, b) => b.weekMinutes - a.weekMinutes || a.name.localeCompare(b.name),
  );
  const stats = summarize(students.map((student) => student.weekMinutes))!;
  return (
    <div className={styles.spread}>
      {/* The spread's n, median, mean and sd, a tap away. */}
      <InfoPopover
        title={`Active minutes by ${words.learner}, the numbers`}
        details={<StatsLine label="Minutes" {...stats} />}
      >
        <h3 className={styles.spreadTitle}>
          Active minutes by {words.learner}
        </h3>
      </InfoPopover>
      <TipZone>
        <span
          className={styles.spreadStrip}
          style={{ "--spread-columns": sorted.length } as CSSProperties}
          role="img"
          aria-label={`${sorted.length} ${words.learners}: median ${Math.round(stats.median)}, mean ${Math.round(stats.mean)} active minutes this week.`}
        >
          {sorted.map((student) => (
            <HeatCell
              key={student.id}
              value={student.weekMinutes}
              midpoint={target}
              tip={`${student.name}: ${number(student.weekMinutes)} active ${student.weekMinutes === 1 ? "minute" : "minutes"}, ${number(student.weekProblems)} ${student.weekProblems === 1 ? "problem" : "problems"} this week`}
            />
          ))}
        </span>
      </TipZone>
      <HeatLegend midpoint={target} midpointWord="target" />
    </div>
  );
}
