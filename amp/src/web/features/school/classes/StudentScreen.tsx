import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { currentSession, orgOptions } from "../api";
import { OrgFrame } from "../OrgFrame";
import { TransferSheet, useCanMove } from "../org/TransferSheet";
import { Button, buttonClass } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { AppError } from "../../../lib/AppError";
import { shareOptions } from "../../schools/share-api";
import { ShareWithFamily } from "../../schools/ShareWithFamily";
import { studentRecordOptions } from "./teacher-api";
import { TryAsStudent } from "../../profiles/TryAsStudent";
import { StudentSections } from "./StudentSections";
import styles from "./Teacher.module.css";

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
              <Button variant="secondary" onClick={() => window.print()}>
                Print progress report
              </Button>
            </div>
          </div>
          <p className={styles.printOnly}>
            Progress report from {data.orgName}
          </p>
          <StudentSections data={data} org={params.org} />
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
