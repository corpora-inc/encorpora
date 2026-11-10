import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, MenuItem } from "../../../ui/Menu";
import { Toast } from "../../../ui/Toast";
import { useStaffSession } from "./api";
import { WeeklyTarget } from "./GradebookScreen";
import { gradebookOptions } from "./teacher-api";
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
  const to = (leaf: string, search: Record<string, unknown> = {}) =>
    void navigate({
      to: "/$",
      params: { _splat: `school/${orgId}/classes/${classId}/${leaf}` },
      search: search as never,
    });
  return (
    <section className={styles.calendarSection} aria-labelledby="grades">
      <div className={styles.calendarSectionHead}>
        <div>
          <h2 id="grades">Grades</h2>
          <p className={styles.quiet}>
            Each child’s grade is a line on the Map.
          </p>
        </div>
        {term && term.state !== "upcoming" && (
          <Menu label="Report cards and export">
            <MenuItem onSelect={() => to("report-cards", { term: term.id })}>
              Report cards
            </MenuItem>
            <MenuItem onSelect={() => to("gradebook", { export: 1 })}>
              Export grades
            </MenuItem>
            {term.state === "open" && book?.canEdit && (
              <MenuItem onSelect={() => to("gradebook", { close: 1 })}>
                Close {term.name}
              </MenuItem>
            )}
          </Menu>
        )}
      </div>
      {/* The stepper's height is held while the gradebook loads. */}
      <div className={styles.targetRow}>
        {book?.canEdit && (
          <WeeklyTarget
            session={session}
            place={place}
            book={book}
            onError={setError}
          />
        )}
      </div>
      <Toast message={error} onDismiss={() => setError("")} />
    </section>
  );
}
