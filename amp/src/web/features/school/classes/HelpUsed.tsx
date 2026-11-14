import type { HelpWeek } from "../../../../schools/help-contracts";
import { number, shortDay } from "./teacher-shared";
import styles from "./HelpUsed.module.css";

const KINDS = [
  ["lessons", "Lessons"],
  ["hints", "Hints"],
  ["videos", "Videos"],
  ["examples", "Examples"],
] as const;
const ANSWER_KINDS = [
  ["hint", "hint"],
  ["lesson", "lesson"],
  ["video", "video"],
  ["person", "with someone"],
] as const;

const used = (week: HelpWeek) =>
  KINDS.some(([kind]) => week[kind].count > 0 || week[kind].minutes > 0);
const minutesText = (minutes: number) =>
  minutes <= 0
    ? ""
    : minutes < 1
      ? "<1 min"
      : `${number(Math.round(minutes))} min`;

/**
 * Help a learner or a class used, a week to a row, newest first: how many
 * lessons, hints, videos and worked examples ("See why") were opened, the active
 * minutes on each, then how many answers came after help. Weeks with no help
 * are left out; with none at all it renders nothing.
 */
export function HelpUsed({
  weeks,
  className,
}: {
  weeks: readonly HelpWeek[];
  className?: string;
}) {
  const shown = weeks.filter(used).reverse();
  if (!shown.length) return null;
  const answers = shown.reduce((sum, week) => sum + week.answers, 0);
  const assisted = shown.reduce((sum, week) => sum + week.assisted, 0);
  const byKind = ANSWER_KINDS.map(
    ([kind, label]) =>
      [
        label,
        shown.reduce((sum, week) => sum + week.answersWith[kind], 0),
      ] as const,
  ).filter(([, count]) => count > 0);
  return (
    <section className={className} data-help-used>
      <h2>Help used</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            {KINDS.map(([kind, label]) => (
              <th key={kind} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((week) => (
            <tr key={week.week}>
              <th scope="row">{shortDay(week.week)}</th>
              {KINDS.map(([kind]) => {
                const { count, minutes } = week[kind];
                return (
                  <td key={kind}>
                    {count > 0 || minutes > 0 ? (
                      <>
                        <span className={styles.count}>{number(count)}</span>
                        <span className={styles.minutes}>
                          {minutesText(minutes)}
                        </span>
                      </>
                    ) : (
                      <span className={styles.none} aria-label="None">
                        –
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {answers > 0 && (
        <p className={styles.answers}>
          <span>
            Answers with help: {number(assisted)} of {number(answers)}
          </span>
          {byKind.map(([label, count]) => (
            <span key={label}>
              {label} {number(count)}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
