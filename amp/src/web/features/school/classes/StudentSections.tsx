import type { Entity } from "../../../nav/entities";
import { Link } from "@tanstack/react-router";
import type { StudentRecordResponse } from "../../../../schools/teacher-contracts";
import { Badge } from "../../../ui/Badge";
import { buttonClass } from "../../../ui/Button";
import { Suggested } from "./grade-parts";
import {
  RecordLevels,
  RecordObjectives,
  RecordWeeks,
  RecordWork,
} from "./ProgressRecord";
import { classUrl, number } from "./teacher-shared";
import { HelpUsed } from "./HelpUsed";
import styles from "./Teacher.module.css";

const lastSeenWords = (iso: string) => {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? `Today, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * One student's record, as its sections: where they are, their grades, their
 * time, objectives, recent work and how they sign in. The student page and
 * the class map's student sheet both show these, so they never drift apart.
 * `single` keeps one column (a sheet); each part shows only once it has
 * something to say, and time is one line until two weeks have some.
 */
export function StudentSections({
  data,
  org,
  single = false,
  workPath,
}: {
  data: StudentRecordResponse;
  org: string;
  single?: boolean;
  /** Where one answer's replay lives, without the leading slash. */
  workPath?: (attempt: string) => string | Entity;
}) {
  const first = data.student.first;
  const weeks = data.weeks.filter((week) => week.minutes > 0);
  const minutes = weeks.reduce((sum, week) => sum + week.minutes, 0);
  return (
    <div
      className={single ? styles.recordSingle : styles.recordColumns}
      data-student-sections
    >
      <section className={styles.recordSection}>
        <h2>Where {first} is</h2>
        <RecordLevels
          record={data}
          empty={`We’ll find ${first}’s level in a few minutes of practice.`}
          openAreas
        />
      </section>
      {data.grades.length > 0 && (
        <section className={styles.recordSection}>
          <h2>Grades</h2>
          <ul className={styles.gradeLines}>
            {data.grades.map((grade) => (
              <li key={`${grade.classId}:${grade.termId}`}>
                <span className={styles.gradeLineName}>
                  <Link
                    to="/$"
                    params={{
                      _splat: classUrl(org, grade.classId, "gradebook"),
                    }}
                    search={
                      {
                        term: grade.termId,
                        student: data.student.id,
                      } as never
                    }
                  >
                    {grade.className}, {grade.termName}
                  </Link>
                  {grade.state === "closed" && <Badge>Closed</Badge>}
                </span>
                <span className={styles.gradeLineSuggested}>
                  <Suggested suggestion={grade.suggestion} />
                </span>
                <span className={styles.gradeLineFinal}>
                  {grade.final ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {minutes > 0 && (
        <section className={styles.recordSection}>
          <h2>Time</h2>
          <p className={styles.quietLine}>
            {number(Math.round(minutes))} active minutes over the last{" "}
            {data.weeks.length} weeks
          </p>
          {weeks.length >= 2 && <RecordWeeks record={data} />}
        </section>
      )}
      <HelpUsed weeks={data.help} className={styles.recordSection} />
      {data.objectives.length > 0 && (
        <section className={styles.recordSection}>
          <h2>Skills shown on their own</h2>
          <RecordObjectives record={data} openSkills />
        </section>
      )}
      {data.work.length > 0 && (
        <section className={styles.recordSection}>
          <h2>Recent work</h2>
          <RecordWork record={data} workPath={workPath} />
        </section>
      )}
      <section className={`${styles.recordSection} ${styles.noPrint}`}>
        <h2>Signing in</h2>
        <dl className={styles.signIn}>
          <div>
            <dt>Card</dt>
            <dd>
              {data.signIn.cardIssuedAt
                ? `Issued ${lastSeenWords(data.signIn.cardIssuedAt)}`
                : "No card yet"}
            </dd>
          </div>
          <div>
            <dt>Pictures</dt>
            <dd>
              {data.signIn.locked ? (
                <Badge tone="warning">Locked for now</Badge>
              ) : data.signIn.picturesSet ? (
                "Set"
              ) : (
                "Not chosen yet"
              )}
            </dd>
          </div>
          <div>
            <dt>Last seen</dt>
            <dd>
              {data.signIn.lastSeenAt
                ? lastSeenWords(data.signIn.lastSeenAt)
                : "Not yet"}
            </dd>
          </div>
        </dl>
        {data.classes[0] && (
          <Link
            to="/$"
            params={{
              _splat: classUrl(org, data.classes[0].id, "roster"),
            }}
            className={buttonClass("quiet", "", "start")}
          >
            Manage sign-in on the roster
          </Link>
        )}
      </section>
    </div>
  );
}
