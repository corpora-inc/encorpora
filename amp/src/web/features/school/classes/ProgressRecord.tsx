import { EntityLink } from "../../../nav/links";
import {
  gradeName,
  levelRange as likelyRange,
  measured,
} from "../../../../learning/level-check";
import type { Entity } from "../../../nav/entities";
import type {
  ProgressRecord,
  StudentTimeResponse,
  WorkItem,
} from "../../../../schools/teacher-contracts";
import {
  fitScale,
  LevelRows,
  WHOLE_SCALE,
  type RowLink,
} from "../../../ui/level-range";
import { StatRow, StatTile } from "../../../ui/StatTile";
import {
  fullDay,
  number,
  shortDay,
  TipZone,
  WorkList,
  type RecordReader,
} from "./teacher-shared";
import styles from "./Teacher.module.css";

/* One learner's progress, as a record shows it. A teacher's student record and
   an adult's own record are the same parts on the same facts; only who reads
   them differs. */

/** Each row of a level opens its area as a layer over the page
 * (`?open=area:<strand>`, nav/AreaLayer.tsx): the one row link every level
 * view shares. */
export const areaRowLink: RowLink = (area, { children, ...props }) => (
  <EntityLink entity={{ kind: "area", id: area }} {...props}>
    {children}
  </EntityLink>
);

/** Levels on every strand: overall first, then each strand by the work in
 * it, as error bars on one fitted scale (ui/level-range), over the
 * student's own grade when there is one. Before any work, the overall row
 * is not measured yet: the whole scale, searching, with one line under it,
 * and nothing opens. With `openAreas`, each measured row opens its area. */
export function RecordLevels({
  record,
  empty,
  openAreas = false,
  holdFirst = false,
  found,
}: {
  record: ProgressRecord;
  /** The line under the level before there's any work to read it from. */
  empty: string;
  /** Each row opens its area over the page (the page hosts the layer). */
  openAreas?: boolean;
  /** The page opened before the first answer (CP-5 r2 #2): when the level
   * arrives the same overall bar glides from the whole scale to it, in
   * place, and the line under it says what was found. The whole record
   * shows on the next visit. */
  holdFirst?: boolean;
  /** What was found, as the line under the held bar says it. */
  found?: (best: string, from: string, to: string) => string;
}) {
  const { level, reference } = record;
  const isMeasured = !!level && measured(level.overall);
  if (!isMeasured || holdFirst) {
    const range = isMeasured ? likelyRange(level!.overall) : null;
    return (
      <div className={styles.levelsNotYet} data-levels-not-yet>
        <LevelRows
          overall={isMeasured ? level!.overall : null}
          areas={[]}
          scale={WHOLE_SCALE}
          moving
        />
        {/* Both lines share one cell, so the change moves nothing. */}
        <div className={styles.levelsLines}>
          <p
            className={styles.quietLine}
            aria-hidden={isMeasured || undefined}
            data-hidden={isMeasured || undefined}
          >
            {empty}
          </p>
          {isMeasured && range && (
            <p className={styles.quietLine} data-levels-found>
              {(found ?? foundLine)(
                gradeName(level!.overall.level),
                gradeName(range[0]),
                gradeName(range[1]),
              )}
            </p>
          )}
        </div>
      </div>
    );
  }
  const areas = record.strands.flatMap((strand) => {
    const estimate = level!.strands[strand.id];
    return estimate ? [{ id: strand.id, label: strand.label, estimate }] : [];
  });
  const grade = reference ? ([reference.from, reference.to] as const) : null;
  const scale = fitScale(
    [level!.overall, ...areas.map((area) => area.estimate)],
    { minSpan: 5, include: grade ? [...grade] : [] },
  );
  return (
    <LevelRows
      overall={level!.overall}
      areas={areas}
      scale={scale}
      grade={grade}
      rowLink={openAreas ? areaRowLink : undefined}
    />
  );
}

/** The held bar's line once the level is found. */
const foundLine = (best: string, from: string, to: string) =>
  from === to
    ? `Best guess ${best}.`
    : `Best guess ${best}, likely ${from} to ${to}.`;

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
export function RecordObjectives({
  record,
  openSkills = false,
}: {
  record: ProgressRecord;
  /** Each skill opens over the page (a staff reader's record). */
  openSkills?: boolean;
}) {
  if (record.objectives.length === 0)
    return <p className={styles.quietLine}>None yet this year.</p>;
  return (
    <ul className={styles.objectives}>
      {record.objectives.map((objective) => (
        <li key={objective.skillId} data-strand={objective.strand}>
          <span className={styles.when}>{shortDay(objective.day)}</span>
          <span className={styles.strandDot} aria-hidden="true" />
          {openSkills ? (
            <EntityLink
              entity={{ kind: "skill", id: objective.skillId }}
              className={styles.objectiveLink}
            >
              {objective.title}
            </EntityLink>
          ) : (
            <span>{objective.title}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The latest problems and how each went. `reader="self"` when the learner
 * reads their own record. */
export function RecordWork({
  record,
  reader = "other",
  workPath,
}: {
  record: ProgressRecord;
  reader?: RecordReader;
  /** Where a row opens: a path, a layer over this page, or (undefined)
   * nowhere. */
  workPath?: (attempt: string, item: WorkItem) => string | Entity | undefined;
}) {
  if (record.work.length === 0)
    return <p className={styles.quietLine}>No problems yet.</p>;
  return (
    <WorkList
      work={record.work}
      reader={reader}
      href={
        workPath &&
        ((item) => {
          const target = workPath(item.id, item);
          return target === undefined
            ? undefined
            : typeof target === "string"
              ? { path: target }
              : { entity: target };
        })
      }
    />
  );
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
  // Where the time went: every skill worked, by its time; a skill with a
  // few quick answers still shows, as under a minute or as its problems.
  const skills = time.skills.filter(
    (skill) => skill.minutes > 0 || skill.problems > 0,
  );
  const largestSkill = Math.max(1, ...skills.map((s) => s.minutes));
  const spent = (skill: (typeof skills)[number]) =>
    skill.minutes >= 1
      ? `${number(Math.round(skill.minutes))} min`
      : skill.minutes > 0
        ? "under 1 min"
        : `${number(skill.problems)} ${skill.problems === 1 ? "problem" : "problems"}`;
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
                <span className={styles.skillValue}>{spent(skill)}</span>
                <span className={styles.skillTrack}>
                  <span
                    className={styles.skillFill}
                    style={{
                      width: `${Math.max(2, (skill.minutes / largestSkill) * 100)}%`,
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
