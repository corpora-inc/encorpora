import {
  divisionLabels,
  formatDay,
  splitYear,
  type DivisionKind,
  type SplitSession,
} from "../../../schools/calendar";
import styles from "./School.module.css";

const DAY = 86_400_000;
const time = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const MONTHS = "JFMAMJJASOND";

/** The school year as a bar the length of the page, cut into its terms. It
 * shows what "Trimesters" means for these dates, which a word can't. Sessions
 * are drawn to scale, month ticks and all, so an uneven calendar looks uneven. */
export function YearRibbon({
  startsOn,
  endsOn,
  division,
  sessions,
  list = true,
}: {
  startsOn: string;
  endsOn: string;
  division: DivisionKind | null;
  /** Actual sessions, when they've been edited away from equal parts. */
  sessions?: readonly SplitSession[];
  /** The terms in words below the bar; off where a screen lists them itself. */
  list?: boolean;
}) {
  const start = time(startsOn);
  const span = Math.max(DAY, time(endsOn) - start + DAY);
  const parts =
    sessions ?? (division ? splitYear(startsOn, endsOn, division) : []);
  const ticks: { label: string; at: number }[] = [];
  const cursor = new Date(start);
  cursor.setUTCDate(1);
  while (cursor.getTime() <= start + span) {
    const at = Math.max(0, (cursor.getTime() - start) / span);
    if (at < 1)
      ticks.push({
        label: MONTHS[cursor.getUTCMonth()]!,
        at,
      });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return (
    <figure
      className={styles.ribbon}
      aria-label={
        parts.length
          ? `${parts.length} ${division ? divisionLabels[division].plural.toLowerCase() : "terms"} from ${formatDay(startsOn)} to ${formatDay(endsOn)}`
          : `School year from ${formatDay(startsOn)} to ${formatDay(endsOn)}`
      }
    >
      <div className={styles.ribbonBar} aria-hidden="true">
        {parts.length ? (
          parts.map((part, index) => (
            <span
              key={part.name}
              className={styles.ribbonPart}
              data-tone={index % 2 ? "b" : "a"}
              style={{
                width: `${((time(part.endsOn) - time(part.startsOn) + DAY) / span) * 100}%`,
              }}
            />
          ))
        ) : (
          <span
            className={styles.ribbonPart}
            data-tone="a"
            style={{ width: "100%" }}
          />
        )}
      </div>
      <div className={styles.ribbonTicks} aria-hidden="true">
        {ticks.map((tick) => (
          <span
            key={tick.at}
            style={{ left: `${tick.at * 100}%` }}
            className={styles.ribbonTick}
          >
            {tick.label}
          </span>
        ))}
      </div>
      {list && (
        <ol className={styles.ribbonList}>
          {parts.map((part, index) => (
            <li key={part.name}>
              <span
                className={styles.ribbonSwatch}
                data-tone={index % 2 ? "b" : "a"}
              />
              <span className={styles.ribbonName}>{part.name}</span>
              <span className={styles.ribbonDates}>
                {formatDay(part.startsOn, false)} to{" "}
                {formatDay(part.endsOn, false)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}
