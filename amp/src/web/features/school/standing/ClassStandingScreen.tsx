import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import type {
  ClassStandingResponse,
  StandingGrid,
} from "../../../../schools/standing-contracts";
import { AppError } from "../../../lib/AppError";
import { Button, buttonClass } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { StatTile } from "../../../ui/StatTile";
import { currentSession } from "../api";
import { OrgFrame } from "../OrgFrame";
import { orgPath } from "../paths";
import { across, CurveLegend, CurvePlot, GradeAxis, peakOf } from "./CurvePlot";
import {
  gradeName,
  gradesWords,
  intervalWords,
  plain,
  signed,
  students as studentsWord,
  withInterval,
} from "./format";
import {
  AxisEnds,
  CurveFacts,
  curveSentence,
  SettlingNote,
  TableDisclosure,
  UpLink,
} from "./parts";
import { classStandingOptions } from "./standing-api";
import styles from "./Standing.module.css";

type Student = ClassStandingResponse["students"][number];

/** A student's 95% range on the axis. */
const rangeOf = (student: Student) => ({
  low: student.mu - 1.96 * student.sd,
  high: student.mu + 1.96 * student.sd,
});

function StudentBand({
  student,
  grid,
  orgId,
  settleAt,
  showGrade,
}: {
  student: Student;
  grid: StandingGrid;
  orgId: string;
  settleAt: number;
  showGrade: boolean;
}) {
  const { low, high } = rangeOf(student);
  const settling = student.answered < settleAt;
  const words = `${student.name}: ${signed(student.mu)} grades from their own, 95% range ${signed(low)} to ${signed(high)}, from ${student.answered} ${student.answered === 1 ? "answer" : "answers"}${
    student.growth
      ? `. Growth this term ${signed(student.growth.mu)} (${signed(student.growth.mu - 1.96 * student.growth.sd)} to ${signed(student.growth.mu + 1.96 * student.growth.sd)})`
      : ". Not settled yet"
  }.`;
  return (
    <li>
      <Link
        to="/$"
        params={{ _splat: orgPath(orgId, `students/${student.id}`) }}
        className={styles.bandRow}
        aria-label={words}
        title={words}
      >
        <span className={styles.bandName}>
          <span>{student.name}</span>
          {showGrade && student.grade !== null && (
            <small>Gr {gradeName(student.grade)}</small>
          )}
        </span>
        <span className={styles.bandTrack} aria-hidden="true">
          <span
            className={styles.band}
            data-settling={settling ? "" : undefined}
            style={{
              left: `${across(grid, low)}%`,
              width: `${across(grid, high) - across(grid, low)}%`,
            }}
          />
          <span
            className={styles.dot}
            data-settling={settling ? "" : undefined}
            style={{ left: `${across(grid, student.mu)}%` }}
          />
        </span>
      </Link>
    </li>
  );
}

/**
 * One class: its curve and numbers, growth this term with its interval, and
 * every student as a band of where they likely are (95%), sorted, with a dot
 * at the estimate. A band from fewer answers is paler and wider; it
 * narrows as answers come in. Each row opens the student's page.
 */
export function ClassStandingScreen() {
  const params = useParams({ strict: false }) as {
    org: string;
    class: string;
  };
  const standing = useQuery(
    classStandingOptions(currentSession(), params.class),
  );
  const data = standing.data;
  const missing =
    standing.error instanceof AppError && standing.error.status === 404;
  const only = data && data.grades.length === 1 ? data.grades[0]! : null;
  const bandLabel =
    only === null
      ? "Their grade"
      : only === 0
        ? "Kindergarten"
        : `Grade ${gradeName(only)}`;
  return (
    <OrgFrame
      orgId={params.org}
      nav="overview"
      title={data?.class.name ?? "Class"}
    >
      {standing.isPending ? (
        <Loading />
      ) : !data ? (
        <EmptyState
          title={
            missing
              ? "This class isn’t available to your account"
              : "These curves didn’t load"
          }
          action={
            missing ? (
              <Link
                to="/$"
                params={{ _splat: orgPath(params.org, "standing") }}
                className={buttonClass("primary")}
              >
                See every class
              </Link>
            ) : (
              <Button variant="primary" onClick={() => void standing.refetch()}>
                Try again
              </Button>
            )
          }
        >
          {missing
            ? "It may have been archived, or be in another school."
            : "Check your connection, then try again."}
        </EmptyState>
      ) : (
        <div className={styles.screen}>
          <UpLink to={orgPath(params.org, "standing")}>
            Where students stand
          </UpLink>
          <header className={styles.title}>
            <h1>{data.class.name}</h1>
            <p>
              {[gradesWords(data.grades), studentsWord(data.curve.n)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>
          {data.curve.n === 0 ? (
            <p className={styles.settling}>
              No students in this class have a grade on file yet.
            </p>
          ) : (
            <>
              <div className={styles.lead}>
                <figure className={styles.figure}>
                  <CurvePlot
                    grid={data.grid}
                    curve={data.curve}
                    top={peakOf([data.curve])}
                    bandLabel={bandLabel}
                    label={curveSentence(data.curve)}
                    name={data.class.name}
                    hover
                  />
                  <GradeAxis grid={data.grid} grade={only} />
                  <AxisEnds />
                  <CurveLegend />
                </figure>
                <div className={styles.leadFacts}>
                  <CurveFacts curve={data.curve} label={data.class.name}>
                    <StatTile
                      value={data.growth ? signed(data.growth.median) : "—"}
                      label={`growth, ${data.term.name}`}
                      detail={
                        data.growth
                          ? `95%: ${intervalWords(data.growth)}, ${studentsWord(data.growth.n)}`
                          : "Not settled yet"
                      }
                    />
                  </CurveFacts>
                  <SettlingNote curve={data.curve} settleAt={data.settleAt} />
                </div>
              </div>
              <section aria-labelledby="standing-students">
                <h2 id="standing-students" className={styles.sectionTitle}>
                  Each student
                </h2>
                <div className={styles.bands}>
                  <div className={styles.bandAxis}>
                    <span />
                    <GradeAxis grid={data.grid} grade={only} />
                  </div>
                  <div className={styles.bandList}>
                    <span className={styles.bandColumnFrame} aria-hidden="true">
                      <span
                        className={styles.bandColumn}
                        style={{
                          left: `${across(data.grid, -0.5)}%`,
                          width: `${across(data.grid, 0.5) - across(data.grid, -0.5)}%`,
                        }}
                      />
                    </span>
                    <ul>
                      {data.students.map((student) => (
                        <StudentBand
                          key={student.id}
                          student={student}
                          grid={data.grid}
                          orgId={data.class.org}
                          settleAt={data.settleAt}
                          showGrade={data.grades.length > 1}
                        />
                      ))}
                    </ul>
                  </div>
                  <div className={styles.bandAxis}>
                    <span />
                    <div>
                      <GradeAxis grid={data.grid} grade={only} />
                      <AxisEnds />
                    </div>
                  </div>
                </div>
                <p className={styles.legend}>
                  <span>
                    <i data-key="band" aria-hidden="true" />
                    95% range
                  </span>
                  <span>
                    <i data-key="dot" aria-hidden="true" />
                    Estimate
                  </span>
                  <span>
                    <i data-key="settling" aria-hidden="true" />
                    Fewer than {data.settleAt} answers
                  </span>
                </p>
              </section>
              <TableDisclosure caption={`${data.class.name}, each student`}>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Grade</th>
                    <th scope="col">Estimate (95%)</th>
                    <th scope="col">sd</th>
                    <th scope="col">Answers</th>
                    <th scope="col">Growth this term (95%)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((student) => {
                    const { low, high } = rangeOf(student);
                    return (
                      <tr key={student.id}>
                        <th scope="row">{student.name}</th>
                        <td>
                          {student.grade === null
                            ? "—"
                            : gradeName(student.grade)}
                        </td>
                        <td>
                          {signed(student.mu)} ({signed(low)} to {signed(high)})
                        </td>
                        <td>{plain(student.sd)}</td>
                        <td>{student.answered.toLocaleString("en-US")}</td>
                        <td>
                          {student.growth
                            ? withInterval({
                                median: student.growth.mu,
                                low:
                                  student.growth.mu - 1.96 * student.growth.sd,
                                high:
                                  student.growth.mu + 1.96 * student.growth.sd,
                              })
                            : <span title="Not settled yet">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableDisclosure>
            </>
          )}
        </div>
      )}
    </OrgFrame>
  );
}
