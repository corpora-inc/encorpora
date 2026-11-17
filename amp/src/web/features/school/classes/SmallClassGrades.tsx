import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { sheetState } from "../../../nav/sheet";
import { Menu, MenuItem } from "../../../ui/Menu";
import { Toast } from "../../../ui/Toast";
import { useStaffSession } from "./api";
import { WeeklyTarget } from "./GradebookScreen";
import { gradebookOptions } from "./teacher-api";
import { useOpenView } from "../view-store";
import styles from "../School.module.css";

/** A small class's grades in its Settings (docs/design/ia.md): the weekly
 * target its Today counts against, and report cards, the export and closing
 * the term in one menu. Each learner's grade is a line on the Map. */
export function SmallClassGrades({
  orgId,
  classId,
}: {
  orgId: string;
  classId: string;
}) {
  const session = useStaffSession();
  const place = { org: orgId, class: classId };
  const book = useQuery(gradebookOptions(session, place, undefined)).data;
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const term = book?.term;
  const openView = useOpenView();
  const path = (leaf: string) => `school/${orgId}/classes/${classId}/${leaf}`;
  /** One term's report cards: the term chosen there before going. */
  const toCards = (termId: string) => {
    openView(path("report-cards"), { term: termId });
    void navigate({ to: "/$", params: { _splat: path("report-cards") } });
  };
  /** The gradebook with one of its sheets open (nav/sheet.ts). */
  const toSheet = (sheet: "export" | "close") =>
    void navigate({
      to: "/$",
      params: { _splat: path("gradebook") },
      state: sheetState(sheet) as never,
    });
  return (
    <section className={styles.calendarSection} aria-labelledby="grades">
      <div className={styles.calendarSectionHead}>
        <div>
          <h2 id="grades">Grades</h2>
        </div>
        {term && term.state !== "upcoming" && (
          <Menu label="Report cards and export">
            <MenuItem onSelect={() => toCards(term.id)}>
              Report cards
            </MenuItem>
            <MenuItem onSelect={() => toSheet("export")}>
              Export grades
            </MenuItem>
            {term.state === "open" && book?.canEdit && (
              <MenuItem onSelect={() => toSheet("close")}>
                Close {term.name}
              </MenuItem>
            )}
          </Menu>
        )}
      </div>
      {/* The stepper's height is held while the gradebook loads. */}
      <div className={styles.targetRow}>
        {book?.canEdit && (
          <WeeklyTarget place={place} book={book} onError={setError} />
        )}
      </div>
      <Toast message={error} onDismiss={() => setError("")} />
    </section>
  );
}
