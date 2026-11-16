import { signOut } from "../../auth";
import { useLearningView } from "../../lib/learning-view";
import { handedStudentDevice } from "../../lib/student-device";
import styles from "./StudentSignOut.module.css";

/** A school device passes to the next student with one tap, from anywhere:
 * in the corner of a page, or `inBar` beside the menu on a problem. */
export function StudentSignOut({ inBar = false }: { inBar?: boolean }) {
  const { account } = useLearningView({ records: false });
  const name =
    account?.account.kind === "student" ? account.learners[0]?.name : null;
  const family = handedStudentDevice();
  const label = family
    ? "Back to family"
    : name
      ? `Sign out ${name}`
      : "Sign out";
  return (
    <button
      type="button"
      className={`${styles.signOut} ${inBar ? styles.inBar : ""} ${family ? styles.familyReturn : ""}`}
      aria-label={label}
      title={family && name ? `${name}’s practice · Back to family` : label}
      data-student-sign-out
      onClick={() => {
        void signOut().catch((failure) =>
          console.error("Student sign-out failed", failure),
        );
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={
            family
              ? "m14 6-6 6 6 6"
              : "M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H10"
          }
        />
      </svg>
      {family && <span>Back to family</span>}
    </button>
  );
}
