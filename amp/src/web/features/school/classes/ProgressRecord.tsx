import { levelRange } from "../../../../learning/level-check";
import type {
  ProgressRecord,
  StudentTimeResponse,
} from "../../../../schools/teacher-contracts";
import { levelScale, LevelTrack } from "../../../ui/LevelChart";
import { StatRow, StatTile } from "../../../ui/StatTile";
import { fullDay, number, shortDay, TipZone, WorkList } from "./teacher-shared";
import styles from "./Teacher.module.css";

/* One learner's progress, as a record shows it. A teacher's student record and
   an adult's own record are the same parts on the same facts; only who reads
   them differs. */

/** Levels on every strand: overall first, then each strand by the work in it. */
export function RecordLevels({
  record,
  empty,
}: {
  record: ProgressRecord;
  /** What shows before there's any work to read a level from. */
  empty: string;
}) {
  const { level, reference } = record;
  if (!level) return <p className={styles.quietLine}>{empty}</p>;
  const center = reference
    ? (reference.from + reference.to) / 2
    : level.overall.level;
  const scale = levelScale(center, [
    level.overall,
    ...Object.values(level.strands),
  ]);
  const row = (id: string, label: string, strand?: string) => {
    const estimate = strand ? level.strands[strand]! : level.overall;
    const [from, to] = levelRange(estimate);
    return (
      <li key={id} className={styles.levelRow} data-strand={strand}>
        <span className={styles.levelName}>{label}</span>
        <span
          className={styles.levelTrack}
          role="img"
          aria-label={`${label}: likely grade ${from.toFixed(1)} to ${to.toFixed(1)}`}
        >
          <LevelTrack
            estimate={estimate}
            scale={scale}
            reference={!!reference}
          />
        </span>
        <span className={styles.levelNumbers}>
          {from.toFixed(1)}–{to.toFixed(1)}
        </span>
      </li>
    );
  };
  return (
    <ul className={styles.levelRows}>
      {row("overall", "Overall")}
      {record.strands.map((strand) => row(strand.id, strand.label, strand.id))}
    </ul>
  );
}

/** Active minutes for each of the last 12 weeks. */
export function RecordWeeks({ record }: { record: ProgressRecord }) {
  const largest = Math.max(1, ...record.weeks.map((week) => week.minutes));
  const total = record.weeks.reduce((sum, week) => sum + week.minutes, 0);
  return (
    <TipZone>
      <div
        className={styles.dayChart}
        role="img"
        aria-label={`${number(total)} active minutes over the last ${record.weeks.length} weeks`}
      >
        {record.weeks.map((week) => (
          <span
            key={week.week}
            className={styles.dayColumn}
            data-tip={`Week of ${shortDay(week.week)}: ${number(week.minutes)} active minutes`}
          >
            <span
              className={styles.dayBar}
              style={{
                height: week.minutes
                  ? `${Math.max(6, (week.minutes / largest) * 100)}%`
                  : 0,
              }}
            />
          </span>
        ))}
      </div>
      <div className={styles.dayAxis} aria-hidden="true">
        <span>{shortDay(record.weeks[0]!.week)}</span>
        <span>{shortDay(record.weeks.at(-1)!.week)}</span>
      </div>
    </TipZone>
  );
}

/** Objectives gained over the last year, newest first. */
export function RecordObjectives({ record }: { record: ProgressRecord }) {
  if (record.objectives.length === 0)
    return <p className={styles.quietLine}>None yet this year.</p>;
  return (
    <ul className={styles.objectives}>
      {record.objectives.map((objective) => (
        <li key={objective.skillId} data-strand={objective.strand}>
          <span className={styles.when}>{shortDay(objective.day)}</span>
          <span className={styles.strandDot} aria-hidden="true" />
          <span>{objective.title}</span>
        </li>
      ))}
    </ul>
  );
}

/** The latest problems and how each went. */
export function RecordWork({ record }: { record: ProgressRecord }) {
  if (record.work.length === 0)
    return <p className={styles.quietLine}>No problems yet.</p>;
  return <WorkList work={record.work} />;
}

const DAY = 86_400_000;
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);

/** Days and skills over a range: minutes on each of its last six weeks of
 * days, and where the time went. */
export function TimeDetail({
  time,
  who,
}: {
  time: Pick<StudentTimeResponse, "range" | "days" | "skills">;
  /** Whose time, for the chart's spoken summary. */
  who: string;
}) {
  const largest = Math.max(1, ...time.days.map((d) => d.minutes));
  const total = time.days.reduce((sum, d) => sum + d.minutes, 0);
  const days = Array.from(
    {
      length:
        Math.round(
          (Date.parse(`${time.range.to}T00:00:00Z`) -
            Date.parse(`${time.range.from}T00:00:00Z`)) /
            DAY,
        ) + 1,
    },
    (_, index) => addDays(time.range.from, index),
  ).slice(-42);
  // Where the time went: skills with measured time, not answers alone.
  const skills = time.skills.filter((skill) => skill.minutes > 0);
  const largestSkill = Math.max(1, ...skills.map((s) => s.minutes));
  // Its parts sit in the caller's own stack, as the sheet's did.
  return (
    <>
      <StatRow>
        <StatTile value={number(Math.round(total))} label="active minutes" />
        <StatTile value={number(time.days.length)} label="days worked" />
      </StatRow>
      <section>
        <h3>By day</h3>
        <TipZone>
          <div
            className={styles.dayChart}
            role="img"
            aria-label={`${who}: ${Math.round(total)} active minutes across ${time.days.length} days. Largest day ${Math.round(largest)} minutes.`}
          >
            {days.map((day) => {
              const minutes =
                time.days.find((entry) => entry.day === day)?.minutes ?? 0;
              return (
                <span
                  key={day}
                  className={styles.dayColumn}
                  data-tip={`${fullDay(day)}: ${Math.round(minutes)} active minutes`}
                >
                  <span
                    className={styles.dayBar}
                    style={{
                      height: minutes
                        ? `${Math.max(6, (minutes / largest) * 100)}%`
                        : 0,
                    }}
                  />
                </span>
              );
            })}
          </div>
          <div className={styles.dayAxis} aria-hidden="true">
            <span>{shortDay(days[0]!)}</span>
            <span>{shortDay(days.at(-1)!)}</span>
          </div>
        </TipZone>
      </section>
      {skills.length > 0 && (
        <section>
          <h3>Where the time went</h3>
          <ul className={styles.skillBars}>
            {skills.map((skill) => (
              <li key={skill.skillId}>
                <span className={styles.skillName}>{skill.title}</span>
                <span className={styles.skillValue}>
                  {number(skill.minutes)} min
                </span>
                <span className={styles.skillTrack}>
                  <span
                    className={styles.skillFill}
                    style={{
                      width: `${(skill.minutes / largestSkill) * 100}%`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
