import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../../../ui/Button";
import { PrintButton } from "../../../ui/PrintButton";
import { downloadPdf, paperFormat } from "../../../lib/pdf-download";
import { Loading } from "../../../ui/Loading";
import { Sheet } from "../../../ui/Sheet";
import { OPEN_KEY, work, writeStack } from "../../../nav/entities";
import { currentSession, orgOptions } from "../api";
import { TransferSheet, useCanMove } from "../org/TransferSheet";
import { ShareWithFamily } from "../../schools/ShareWithFamily";
import { TryAsStudent } from "../../profiles/TryAsStudent";
import { useStaffSession } from "./api";
import { StudentSections } from "./StudentSections";
import { studentRecordOptions } from "./teacher-api";
import { LoadFailed } from "./teacher-shared";
import styles from "./Teacher.module.css";

/** One student, as a layer over any class or school page (nav/LayerHost):
 * their whole record in one column, with trying their level and printing.
 * Their answers and skills open over it in turn. */
export function StudentLayer({
  org,
  student,
  open,
  onClose,
  back,
  school = false,
}: {
  org: string;
  student: string;
  /** Under a full-screen layer (an answer) the sheet waits closed. */
  open: boolean;
  onClose: () => void;
  /** The layer under this one, where X returns. */
  back?: string;
  /** Over a school's page (not a class's): the admin's actions too,
   * sharing with the family and moving to another school. */
  school?: boolean;
}) {
  const session = useStaffSession();
  const record = useQuery(studentRecordOptions(session, student));
  const data = record.data;
  // Over a school's page, an admin can also move the student to another
  // school of the district.
  const can = useQuery({
    ...orgOptions(currentSession(), org),
    enabled: school,
  }).data?.can;
  const canMove = useCanMove(
    student,
    school && can?.includes("students.transfer") === true,
  );
  const [moving, setMoving] = useState(false);
  const navigate = useNavigate();
  return (
    <Sheet
      open={open}
      tall
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={data?.student.name ?? "Student"}
      back={back}
      description={
        data ? data.classes.map((entry) => entry.name).join(", ") : undefined
      }
      returnFocus={() =>
        document.querySelector<HTMLElement>(
          `[data-map-student="${student}"], [data-entity-student="${student}"]`,
        )
      }
    >
      {!data ? (
        record.isError ? (
          <LoadFailed
            what="This record"
            onRetry={() => void record.refetch()}
          />
        ) : (
          <Loading />
        )
      ) : (
        <div className={styles.sheetRecord} data-map-student-record={student}>
          <div className={styles.recordAction}>
            <TryAsStudent
              session={currentSession()}
              personId={data.student.id}
            />
            {school && (
              <ShareWithFamily
                session={currentSession()}
                student={data.student.id}
                first={data.student.first}
              />
            )}
            {canMove && (
              <Button variant="quiet" onClick={() => setMoving(true)}>
                Move to another school
              </Button>
            )}
            <PrintButton
              variant="quiet"
              download={() =>
                downloadPdf({
                  path: `/school/students/${encodeURIComponent(data.student.id)}/record.pdf?format=${paperFormat()}`,
                  token: currentSession().token,
                  name: "amp-progress-report.pdf",
                })
              }
            >
              Print progress report
            </PrintButton>
          </div>
          <StudentSections
            data={data}
            org={org}
            single
            workPath={(attempt) => work(data.student.id, attempt)}
          />
        </div>
      )}
      {canMove && data && (
        <TransferSheet
          studentId={student}
          name={data.student.name}
          open={moving}
          onOpenChange={setMoving}
          onMoved={(to) => {
            setMoving(false);
            // The student goes with the move: their record, over their new
            // school's Students.
            void navigate({
              to: "/school/$org/students",
              params: { org: to.id },
              search: {
                [OPEN_KEY]: writeStack([{ kind: "student", id: student }]),
              },
            } as never);
          }}
        />
      )}
    </Sheet>
  );
}
