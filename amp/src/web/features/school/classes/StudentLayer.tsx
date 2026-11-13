import { useQuery } from "@tanstack/react-query";
import { PrintButton } from "../../../ui/PrintButton";
import { downloadPdf, paperFormat } from "../../../lib/pdf-download";
import { Loading } from "../../../ui/Loading";
import { Sheet } from "../../../ui/Sheet";
import { work } from "../../../nav/entities";
import { currentSession } from "../api";
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
}: {
  org: string;
  student: string;
  /** Under a full-screen layer (an answer) the sheet waits closed. */
  open: boolean;
  onClose: () => void;
}) {
  const session = useStaffSession();
  const record = useQuery(studentRecordOptions(session, student));
  const data = record.data;
  return (
    <Sheet
      open={open}
      tall
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={data?.student.name ?? "Student"}
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
    </Sheet>
  );
}
