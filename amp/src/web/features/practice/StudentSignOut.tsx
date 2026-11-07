import { signOut } from "../../auth";
import styles from "./StudentSignOut.module.css";

/** A school device passes to the next student with one tap, from anywhere:
 * in the corner of a page, or `inBar` beside the menu on a problem. */
export function StudentSignOut({ inBar = false }: { inBar?: boolean }) {
  return (
    <button
      type="button"
      className={`${styles.signOut} ${inBar ? styles.inBar : ""}`}
      aria-label="Sign out"
      title="Sign out"
      data-student-sign-out
      onClick={() => {
        void signOut().catch((failure) =>
          console.error("Student sign-out failed", failure),
        );
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H10" />
      </svg>
    </button>
  );
}
