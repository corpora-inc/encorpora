import { Link } from "@tanstack/react-router";
import { buttonClass } from "../../ui/Button";
import { workbooksEnabled } from "./config";
import {
  canReadWorkbooks,
  canMakeWorkbook,
  localDate,
  type WorkbookAccess,
} from "./model";
import styles from "./WorkbookEntry.module.css";

/** Family → learner: today's workbook and past ones. Offered only when the
 * learner has learning permission; printing uses its own allowance. */
export function WorkbookEntry({
  learner,
  enabled = workbooksEnabled,
}: {
  learner: { id: string; name: string } & WorkbookAccess;
  enabled?: boolean;
}) {
  if (!enabled || !canReadWorkbooks(learner)) return null;
  return (
    <section className={styles.entry} aria-labelledby={`wb-${learner.id}`}>
      <div>
        <h4 id={`wb-${learner.id}`}>Workbooks</h4>
        <p>
          Printable practice chosen from {learner.name}'s progress, with an
          answer key.
        </p>
      </div>
      <div className={styles.links}>
        {canMakeWorkbook(learner) && (
          <Link
            to="/learners/$learnerId/workbooks/$date"
            params={{ learnerId: learner.id, date: localDate() }}
            className={buttonClass("primary")}
          >
            Make a workbook
          </Link>
        )}
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
