import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { RosterSource } from "../../../schools/setup-contracts";
import type { SourceResult } from "../../../schools/sources/rows";
import { useLoggedError } from "../../feedback";
import { AppError } from "../../lib/AppError";
import { Button } from "../../ui/Button";
import { classroomApi, classroomStatusOptions, currentSession } from "./api";
import styles from "./ClassroomImport.module.css";

const returned: Record<string, string> = {
  declined:
    "Google Classroom access wasn’t granted. Choose Connect to try again.",
  scopes:
    "Google Classroom needs all three read-only permissions to list your courses and students. Choose Connect and leave them ticked.",
  failed:
    "Google Classroom couldn’t be connected. Choose Connect to try again.",
};

/** Import one Google Classroom course as a roster: connect, pick a course, and
 * hand its students to the same review as a file. Shown only when the feature
 * is on for this school and the person may import. */
export function ClassroomImport({
  orgId,
  classId,
  returnedAs,
  onLoaded,
}: {
  orgId: string;
  classId?: string;
  /** `?google=` on the way back from Google. */
  returnedAs?: string;
  onLoaded: (loaded: {
    source: RosterSource;
    fileName: string;
    result: SourceResult;
  }) => void;
}) {
  const session = currentSession();
  const status = useQuery(classroomStatusOptions(session, orgId));
  const [courses, setCourses] = useState<{ id: string; name: string }[] | null>(
    null,
  );
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    returnedAs ? (returned[returnedAs] ?? "") : "",
  );
  useLoggedError(error);
  const fail = (failure: unknown, fallback: string) => {
    console.error("Google Classroom import failed", failure);
    setError(failure instanceof AppError ? failure.message : fallback);
  };
  if (!status.data?.enabled) return null;
  const authorized = status.data.authorized && returnedAs !== "failed";
  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const { url } = await classroomApi.authorize(session, orgId, classId);
      window.location.assign(url);
    } catch (failure) {
      fail(failure, "Google Classroom couldn’t be reached. Try again.");
      setBusy(false);
    }
  };
  const load = async () => {
    setBusy(true);
    setError("");
    try {
      setCourses(await classroomApi.courses(session, orgId));
    } catch (failure) {
      fail(failure, "Your courses couldn’t be loaded. Choose Connect again.");
      void status.refetch();
    } finally {
      setBusy(false);
    }
  };
  const preview = async () => {
    setBusy(true);
    setError("");
    try {
      const found = await classroomApi.students(
        session,
        orgId,
        picked,
        classId,
      );
      void status.refetch();
      onLoaded({
        source: found.source as RosterSource,
        fileName: found.courseName,
        result: {
          rows: found.rows,
          issues: found.issues,
          skipped: found.skipped,
          inactive: found.inactive,
        },
      });
    } catch (failure) {
      fail(failure, "That course’s students couldn’t be loaded. Try again.");
      setBusy(false);
    }
  };
  return (
    <section className={styles.panel} aria-label="Google Classroom">
      <h2>Google Classroom</h2>
      {courses === null ? (
        <>
          <p>
            Read-only: AMP lists your active courses and the students in the one
            you choose. Nothing is saved until you’ve seen every change.
          </p>
          {authorized ? (
            <Button
              variant="secondary"
              aria-busy={busy}
              disabled={busy}
              onClick={() => void load()}
            >
              Choose a course
            </Button>
          ) : (
            <Button
              variant="secondary"
              aria-busy={busy}
              disabled={busy}
              onClick={() => void connect()}
            >
              Import from Google Classroom
            </Button>
          )}
        </>
      ) : courses.length === 0 ? (
        <p>
          You have no active Google Classroom courses as a teacher. Use a file
          instead.
        </p>
      ) : (
        <>
          <ul className={styles.courses} aria-label="Your courses">
            {courses.map((course) => (
              <li key={course.id}>
                <button
                  type="button"
                  className={styles.course}
                  aria-pressed={picked === course.id}
                  onClick={() => setPicked(course.id)}
                >
                  {course.name || "Untitled course"}
                </button>
              </li>
            ))}
          </ul>
          <Button
            variant="primary"
            aria-busy={busy}
            disabled={busy || !picked}
            onClick={() => void preview()}
          >
            Preview changes
          </Button>
        </>
      )}
      <p className={styles.error} role={error ? "alert" : undefined}>
        {error}
      </p>
    </section>
  );
}
