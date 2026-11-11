import type { TodayResponse } from "../../../../../schools/teacher-contracts";
import { number } from "../teacher-shared";
import styles from "./Today.module.css";

/** A class's week reads in the thousands; a smaller count says nothing. */
const PROBLEMS_WORTH_STATING = 1000;

/** The week so far in one line of figures. Nothing until there's work: an
 * empty week is the children's rows saying "Not yet", never a row of zeros. */
export function WeekFacts({
  week,
  family,
  target = null,
}: {
  week: TodayResponse["week"];
  family: boolean;
  /** The weekly target for each learner, set in Settings. */
  target?: number | null;
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
              {week.objectives === 1
                ? "skill shown twice on its own"
                : "skills shown twice on their own"}
            </dt>
            <dd>{number(week.objectives)}</dd>
          </div>
        )}
        {target !== null && week.students > 0 && (
          <div>
            <dt>minutes each, of the target</dt>
            <dd>
              {number(Math.round(week.minutes / week.students))} of{" "}
              {number(target)}
            </dd>
          </div>
        )}
        <div>
          <dt>{family ? "children practiced" : "students working"}</dt>
          <dd>
            {week.working} of {week.students}
          </dd>
        </div>
      </dl>
    </section>
  );
}
