import { useState } from "react";
import { signOut } from "../../auth";
import { useLearningView } from "../../lib/learning-view";
import { handedStudentDevice, studentSession } from "../../lib/student-device";
import { StudentSignOut } from "../practice/StudentSignOut";
import styles from "./SessionMark.module.css";

/** Whose school session this is, and the way out, at the bar's end on every
 * screen: a student, or staff signed in through their school (Clever). A
 * school computer is shared, so the name is always in view and Sign out is
 * one tap. Other adults' bars are unchanged; a device a parent handed to
 * their child keeps its way home. */
export function SessionMark({ named }: { named?: string | null }) {
  const { account } = useLearningView({ records: false });
  const [busy, setBusy] = useState(false);
  // A student's way out holds its place from the first paint, before (or
  // without) their account: their session is on this device already.
  const student = !!studentSession();
  const kind = account?.account.kind ?? (student ? "student" : undefined);
  if (kind !== "student" && kind !== "provider") return null;
  if (kind === "student" && handedStudentDevice())
    return <StudentSignOut inBar />;
  const name =
    kind === "student"
      ? account?.learners[0]?.name
      : account?.account.displayName;
  // Named once: not again when the bar already shows it at the start.
  const shown = name && name !== named ? name : null;
  return (
    <div className={styles.mark} data-session-mark={kind}>
      {shown && (
        <span className={styles.name} title={shown} data-session-name="">
          {shown}
        </span>
      )}
      <button
        type="button"
        className={styles.signOut}
        aria-label={name ? `Sign out ${name}` : "Sign out"}
        title={name ? `Sign out ${name}` : "Sign out"}
        disabled={busy}
        aria-busy={busy || undefined}
        data-student-sign-out={kind === "student" ? "" : undefined}
        data-session-sign-out=""
        onClick={() => {
          setBusy(true);
          void signOut().catch((failure) => {
            console.error("Sign out did not finish", failure);
            setBusy(false);
          });
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H10" />
        </svg>
        <span className={styles.label}>Sign out</span>
      </button>
    </div>
  );
}
