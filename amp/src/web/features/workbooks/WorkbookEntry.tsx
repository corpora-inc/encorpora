import { Link } from "@tanstack/react-router";
import { buttonClass } from "../../ui/Button";
import { workbooksEnabled } from "./config";
import { localDate } from "./model";
import styles from "./WorkbookEntry.module.css";

/** Family → learner: today's workbook and past ones. Offered only when the
 * learner can practice, which is what the workbook routes require. */
export function WorkbookEntry({
  learner,
  enabled = workbooksEnabled,
}: {
  learner: { id: string; name: string; canPractice?: boolean };
  enabled?: boolean;
}) {
  if (!enabled || !learner.canPractice) return null;
  return (
    <section className={styles.entry} aria-labelledby={`wb-${learner.id}`}>
      <div>
        <h4 id={`wb-${learner.id}`}>Daily workbook</h4>
        <p>
          Printable practice chosen from {learner.name}'s progress, with an
          answer key.
        </p>
      </div>
      <div className={styles.links}>
        <Link
          to="/learners/$learnerId/workbooks/$date"
          params={{ learnerId: learner.id, date: localDate() }}
          className={buttonClass("primary")}
        >
          Download today's workbook
        </Link>
        <Link
          to="/learners/$learnerId/workbooks"
          params={{ learnerId: learner.id }}
          className={buttonClass("secondary")}
        >
          Past workbooks
        </Link>
      </div>
    </section>
  );
}
