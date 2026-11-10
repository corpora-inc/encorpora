import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { currentSession, orgOptions } from "../api";
import { OrgFrame } from "../OrgFrame";
import { TransferSheet, useCanMove } from "../org/TransferSheet";
import { Avatar } from "../../../ui/Avatar";
import { Badge } from "../../../ui/Badge";
import { Button, buttonClass } from "../../../ui/Button";
import { PrintButton } from "../../../ui/PrintButton";
import { downloadPdf, paperFormat } from "../../../lib/pdf-download";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { AppError } from "../../../lib/AppError";
import { shareOptions } from "../../schools/share-api";
import { ShareWithFamily } from "../../schools/ShareWithFamily";
import { Suggested } from "./grade-parts";
import { studentRecordOptions } from "./teacher-api";
import {
  RecordLevels,
  RecordObjectives,
  RecordWeeks,
  RecordWork,
} from "./ProgressRecord";
import { classUrl } from "./teacher-shared";
import { TryAsStudent } from "../../profiles/TryAsStudent";
import styles from "./Teacher.module.css";

const lastSeenWords = (iso: string) => {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? `Today, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

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
  const navigate = useNavigate();
  const org = useQuery(orgOptions(session, params.org)).data;
  const canMove = useCanMove(
    params.student,
    org?.can?.includes("students.transfer") === true,
  );
  const [moving, setMoving] = useState(false);
  const record = useQuery(studentRecordOptions(session, params.student));
  // Loaded with the record, so the head's actions appear once, in place.
  const share = useQuery(shareOptions(session, params.student));
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
      {record.isPending || share.isPending ? (
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
              {/* Practice at this student's levels, on the reader's own
                  account: the student's record never changes. */}
              <TryAsStudent session={session} personId={data.student.id} />
              <ShareWithFamily
                session={session}
                student={data.student.id}
                first={first}
              />
              {canMove && (
                <Button variant="secondary" onClick={() => setMoving(true)}>
                  Move to another school
                </Button>
              )}
              <PrintButton
                download={() =>
                  downloadPdf({
                    path: `/school/students/${encodeURIComponent(params.student)}/record.pdf?format=${paperFormat()}`,
                    token: session.token,
                    name: "amp-progress-report.pdf",
                  })
                }
              >
                Print progress report
              </PrintButton>
            </div>
          </div>
          <p className={styles.printOnly}>
            Progress report from {data.orgName}
          </p>
          <div className={styles.recordColumns}>
            <section className={styles.recordSection}>
              <h2>Where {first} is</h2>
              <RecordLevels
                record={data}
                empty={`Levels appear here once ${first} has some work to read.`}
              />
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
              <RecordWeeks record={data} />
            </section>
            <section className={styles.recordSection}>
              <h2>Objectives gained</h2>
              <RecordObjectives record={data} />
            </section>
            <section className={styles.recordSection}>
              <h2>Recent work</h2>
              <RecordWork record={data} />
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
      {canMove && data && (
        <TransferSheet
          studentId={params.student}
          name={data.student.name}
          open={moving}
          onOpenChange={setMoving}
          onMoved={(school) => {
            setMoving(false);
            void navigate({
              to: "/$",
              params: {
                _splat: `school/${school.id}/students/${params.student}`,
              },
            });
          }}
        />
      )}
    </OrgFrame>
  );
}
