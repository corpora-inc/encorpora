import type { OverviewResponse } from "../../../../schools/org-contracts";
import { number, shortDay, TipZone } from "../classes/teacher-shared";
import styles from "./Org.module.css";

const DAY = 86_400_000;
/** The Monday of a plain calendar day. */
function weekStart(iso: string) {
  const time = Date.parse(`${iso}T00:00:00Z`);
  const weekday = (new Date(time).getUTCDay() + 6) % 7;
  return new Date(time - weekday * DAY).toISOString().slice(0, 10);
}

/** The tick above the largest value, on a round step. */
function roundUp(value: number) {
  if (value <= 0) return 10;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.5, 2, 3, 4, 5, 6, 8, 10])
    if (step * power >= value) return step * power;
  return 10 * power;
}
const axisNumber = (value: number) =>
  value >= 1_000_000
    ? `${Number((value / 1_000_000).toFixed(2))}M`
    : value >= 10_000
      ? `${Number((value / 1000).toFixed(1))}K`
      : number(value);

export type TrendMeasure = "minutes" | "problems";
type TrendWeek = OverviewResponse["trend"][number];
const valueOf = (week: TrendWeek, measure: TrendMeasure) =>
  measure === "minutes" ? week.minutes : week.problems;
const unit = (count: number, measure: TrendMeasure) =>
  measure === "minutes"
    ? count === 1
      ? "minute"
      : "minutes"
    : count === 1
      ? "problem"
      : "problems";

/** Weekly active minutes, or problems answered, across the term: one quiet
 * mark a week, future weeks held open so the term's length is plain, this week
 * labelled "so far". Problems stack what students did on their own under what
 * they did with a hint or lesson. Both draw on one axis frame, so switching
 * never moves the page. */
export function TrendChart({
  weeks,
  today,
  measure = "minutes",
}: {
  weeks: OverviewResponse["trend"];
  today: string;
  measure?: TrendMeasure;
}) {
  const current = weekStart(today);
  const past = weeks.filter((week) => week.week <= current);
  const top = roundUp(
    Math.max(0, ...past.map((week) => valueOf(week, measure))),
  );
  const peak = past.reduce<TrendWeek | null>(
    (best, week) =>
      week.week !== current &&
      (!best || valueOf(week, measure) > valueOf(best, measure))
        ? week
        : best,
    null,
  );
  const peakIndex = peak ? weeks.indexOf(peak) : -1;
  const currentIndex = weeks.findIndex((week) => week.week === current);
  const labelled = new Set<string>();
  if (currentIndex >= 0) labelled.add(current);
  // Two labels side by side would run together: the week in hand wins.
  if (
    peak &&
    valueOf(peak, measure) > 0 &&
    Math.abs(peakIndex - currentIndex) > 2
  )
    labelled.add(peak.week);
  const total = past.reduce((sum, week) => sum + valueOf(week, measure), 0);
  const helped = past.reduce((sum, week) => sum + week.assisted, 0);
  const problems = measure === "problems";
  const tipFor = (week: TrendWeek, state: string) => {
    if (state === "future")
      return `Week of ${shortDay(week.week)}: still to come`;
    const soFar = state === "current" ? " so far" : "";
    return problems
      ? `Week of ${shortDay(week.week)}: ${number(week.problems)} ${unit(week.problems, measure)}${soFar}, ${number(week.problems - week.assisted)} on their own, ${number(week.assisted)} with help`
      : `Week of ${shortDay(week.week)}: ${number(week.minutes)} ${unit(week.minutes, measure)}${soFar}, ${number(week.students)} ${week.students === 1 ? "student" : "students"} practiced`;
  };
  return (
    <figure className={styles.chart}>
      <TipZone className={styles.plotFrame}>
        <div
          className={styles.yAxis}
          aria-hidden="true"
          data-chart-axis={measure}
        >
          {[top, top / 2, 0].map((tick) => (
            <span key={tick}>{axisNumber(tick)}</span>
          ))}
        </div>
        <div
          className={styles.plot}
          role="img"
          aria-label={
            problems
              ? `${number(total)} problems so far this term, ${number(total - helped)} on their own and ${number(helped)} with help. The table that follows has each week.`
              : `${number(total)} active minutes so far this term. The table that follows has each week.`
          }
        >
          <span className={styles.gridLine} style={{ bottom: "100%" }} />
          <span className={styles.gridLine} style={{ bottom: "50%" }} />
          <div className={styles.columns}>
            {weeks.map((week, index) => {
              const state =
                week.week > current
                  ? "future"
                  : week.week === current
                    ? "current"
                    : "past";
              const value = valueOf(week, measure);
              // The week in hand reads to its right, over the weeks still to
              // come, so a taller week before it never runs into its label.
              const edge =
                index === 0 || (state === "current" && index < weeks.length - 2)
                  ? "start"
                  : index === weeks.length - 1
                    ? "end"
                    : undefined;
              return (
                <span
                  key={week.week}
                  className={styles.column}
                  data-tip={tipFor(week, state)}
                >
                  <span
                    className={styles.bar}
                    data-state={state}
                    style={{
                      height:
                        state === "future"
                          ? undefined
                          : value
                            ? `${Math.max(1.5, (value / top) * 100)}%`
                            : 0,
                    }}
                  >
                    {problems && state !== "future" && week.assisted > 0 && (
                      <span
                        className={styles.barHelp}
                        style={{
                          height: `${(week.assisted / Math.max(1, week.problems)) * 100}%`,
                        }}
                      />
                    )}
                    {labelled.has(week.week) && (
                      <span className={styles.barLabel} data-edge={edge}>
                        {number(value)}
                        {state === "current" ? " so far" : ""}
                      </span>
                    )}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </TipZone>
      <div className={styles.xAxis} aria-hidden="true">
        <span>{weeks[0] ? shortDay(weeks[0].week) : ""}</span>
        {problems ? (
          <span className={styles.legend}>
            <span className={styles.legendKey} data-series="own" />
            On their own
            <span className={styles.legendKey} data-series="help" />
            With help
          </span>
        ) : null}
        <span>{weeks.at(-1) ? shortDay(weeks.at(-1)!.week) : ""}</span>
      </div>
      <table className={styles.hiddenTable}>
        <caption>
          {problems ? "Problems by week" : "Active minutes by week"}
        </caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            {problems ? (
              <>
                <th scope="col">On their own</th>
                <th scope="col">With help</th>
              </>
            ) : (
              <>
                <th scope="col">Minutes</th>
                <th scope="col">Students who practiced</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {past.map((week) => (
            <tr key={week.week}>
              <th scope="row">{shortDay(week.week)}</th>
              {problems ? (
                <>
                  <td>{week.problems - week.assisted}</td>
                  <td>{week.assisted}</td>
                </>
              ) : (
                <>
                  <td>{week.minutes}</td>
                  <td>{week.students}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const binWords = (from: number | null, to: number | null) => {
  if (from === null) return `3 or more grades behind`;
  if (to === null) return `3 or more grades ahead`;
  if (to <= 0) return `${Math.abs(to)} to ${Math.abs(from)} grades behind`;
  return `${from} to ${to} grades ahead`;
};
const TICKS = [
  { at: 1, label: "−3" },
  { at: 3, label: "−2" },
  { at: 5, label: "−1" },
  { at: 7, label: "0" },
  { at: 9, label: "+1" },
  { at: 11, label: "+2" },
  { at: 13, label: "+3" },
];

/** Where students stand against their own grade, in half-grade columns: the same
 * pale band a class map draws a grade as runs up the middle. */
export function StandingChart({
  standing,
}: {
  standing: OverviewResponse["standing"];
}) {
  const { bins } = standing;
  const placed = standing.behind + standing.at + standing.ahead;
  const top = Math.max(1, ...bins.map((bin) => bin.students));
  const share = (count: number) =>
    placed ? Math.round((count / placed) * 100) : 0;
  return (
    <figure className={styles.chart}>
      <TipZone className={styles.standingFrame}>
        <div
          className={styles.standing}
          role="img"
          aria-label={`${share(standing.at)}% of students are within half a grade of their own, ${share(standing.ahead)}% are ahead and ${share(standing.behind)}% are behind. The table that follows has each group.`}
        >
          <span className={styles.gradeBand} aria-hidden="true">
            <span>Their grade</span>
          </span>
          <div className={styles.columns}>
            {bins.map((bin) => (
              <span
                key={`${bin.from}`}
                className={styles.column}
                data-tip={`${number(bin.students)} ${bin.students === 1 ? "student" : "students"}, ${binWords(bin.from, bin.to)}`}
              >
                <span
                  className={styles.bar}
                  data-state="past"
                  style={{
                    height: bin.students
                      ? `${Math.max(1.5, (bin.students / top) * 100)}%`
                      : 0,
                  }}
                />
              </span>
            ))}
          </div>
        </div>
      </TipZone>
      <div className={styles.standingAxis} aria-hidden="true">
        {TICKS.map((tick) => (
          <span
            key={tick.at}
            style={{ left: `${(tick.at / bins.length) * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      <div className={styles.standingEnds} aria-hidden="true">
        <span>Grades behind</span>
        <span>Grades ahead</span>
      </div>
      <table className={styles.hiddenTable}>
        <caption>Students by distance from their own grade</caption>
        <thead>
          <tr>
            <th scope="col">Distance</th>
            <th scope="col">Students</th>
          </tr>
        </thead>
        <tbody>
          {bins.map((bin) => (
            <tr key={`${bin.from}`}>
              <th scope="row">{binWords(bin.from, bin.to)}</th>
              <td>{bin.students}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
