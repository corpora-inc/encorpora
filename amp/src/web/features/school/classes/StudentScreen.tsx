import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { levelRange } from "../../../../learning/level-check";
import type { StudentRecordResponse } from "../../../../schools/teacher-contracts";
import { currentSession } from "../api";
import { OrgFrame } from "../OrgFrame";
import { Avatar } from "../../../ui/Avatar";
import { Badge } from "../../../ui/Badge";
import { Button, buttonClass } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { levelScale, LevelTrack } from "../../../ui/LevelChart";
import { Loading } from "../../../ui/Loading";
import { AppError } from "../../../lib/AppError";
import { Suggested } from "./grade-parts";
import { studentRecordOptions } from "./teacher-api";
import {
  classUrl,
  number,
  shortDay,
  TipZone,
  WorkList,
} from "./teacher-shared";
import styles from "./Teacher.module.css";

const lastSeenWords = (iso: string) => {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? `Today, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function Levels({ record }: { record: StudentRecordResponse }) {
  const { level, reference } = record;
  if (!level)
    return (
      <p className={styles.quietLine}>
        Levels appear here once {record.student.first} has some work to read.
      </p>
    );
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

function Weeks({ record }: { record: StudentRecordResponse }) {
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

/** One student, everything a teacher reaches for: where they are, their grades,
 * their time, their recent work, and how they sign in. Prints as a progress
 * report. */
export function StudentScreen() {
  // This route is in the staff table, which is linked to through the splat.
  const params = useParams({ strict: false }) as {
    org: string;
    student: string;
  };
  const session = currentSession();
  const record = useQuery(studentRecordOptions(session, params.student));
  const data = record.data;
  const missing =
    record.error instanceof AppError && record.error.status === 404;
  const first = data?.student.first ?? "";
  return (
    <OrgFrame
      orgId={params.org}
      nav="students"
      title={data?.student.name ?? "Student"}
      crumbs={[
        { label: "Students", path: `school/${params.org}/students` },
        { label: data?.student.name ?? "Student" },
      ]}
    >
      {record.isPending ? (
        <Loading />
      ) : !data ? (
        <EmptyState
          title={
            missing
              ? "This student isn’t available to your account"
              : "This record didn’t load"
          }
          action={
            missing ? (
              <Link
                to="/$"
                params={{ _splat: `school/${params.org}/students` }}
                className={buttonClass("primary")}
              >
                See your students
              </Link>
            ) : (
              <Button variant="primary" onClick={() => void record.refetch()}>
                Try again
              </Button>
            )
          }
        >
          {missing
            ? "They may have left, or may not be in one of your classes."
            : "Check your connection, then try again."}
        </EmptyState>
      ) : (
        <div className={styles.record}>
          <div className={styles.recordHead}>
            <Avatar name={data.student.name} size="large" />
            <div className={styles.recordTitle}>
              <h1>{data.student.name}</h1>
              <p>
                {[
                  ...data.classes.map((entry) => entry.name),
                  data.student.identifier && `ID ${data.student.identifier}`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
            <div className={styles.recordAction}>
              <Button variant="secondary" onClick={() => window.print()}>
                Print progress report
              </Button>
            </div>
          </div>
          <p className={styles.printOnly}>
            Progress report from {data.orgName}
          </p>
          <div className={styles.recordColumns}>
            <section className={styles.recordSection}>
              <h2>Where {first} is</h2>
              <Levels record={data} />
            </section>
            <section className={styles.recordSection}>
              <h2>Grades</h2>
              {data.grades.length === 0 ? (
                <p className={styles.quietLine}>
                  Grades appear here once a term begins.
                </p>
              ) : (
                <ul className={styles.gradeLines}>
                  {data.grades.map((grade) => (
                    <li key={`${grade.classId}:${grade.termId}`}>
                      <span className={styles.gradeLineName}>
                        <Link
                          to="/$"
                          params={{
                            _splat: classUrl(
                              params.org,
                              grade.classId,
                              "gradebook",
                            ),
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
              )}
            </section>
            <section className={styles.recordSection}>
              <h2>Time, last 12 weeks</h2>
              <Weeks record={data} />
            </section>
            <section className={styles.recordSection}>
              <h2>Objectives gained</h2>
              {data.objectives.length === 0 ? (
                <p className={styles.quietLine}>None yet this year.</p>
              ) : (
                <ul className={styles.objectives}>
                  {data.objectives.map((objective) => (
                    <li key={objective.skillId} data-strand={objective.strand}>
                      <span className={styles.when}>
                        {shortDay(objective.day)}
                      </span>
                      <span className={styles.strandDot} aria-hidden="true" />
                      <span>{objective.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className={styles.recordSection}>
              <h2>Recent work</h2>
              {data.work.length === 0 ? (
                <p className={styles.quietLine}>No problems yet.</p>
              ) : (
                <WorkList work={data.work} />
              )}
            </section>
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
                    _splat: classUrl(params.org, data.classes[0].id, "roster"),
                  }}
                  className={buttonClass("quiet", "", "start")}
                >
                  Manage sign-in on the roster
                </Link>
              )}
            </section>
          </div>
        </div>
      )}
    </OrgFrame>
  );
}
