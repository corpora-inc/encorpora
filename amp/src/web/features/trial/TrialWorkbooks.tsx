import { useId } from "react";
import { TRIAL_WORKBOOK_EVERY } from "../../../learning/trial-workbooks";
import { Button } from "../../ui/Button";
import { Segmented } from "../../ui/Segmented";
import { Toast } from "../../ui/Toast";
import type { TrialSession, TrialWorkbooks as Status } from "./api";
import {
  useAssessmentWorkbook,
  useWorkbookPaper,
} from "./assessment-workbooks";
import styles from "./AssessmentWorkbooks.module.css";

/** An open book: the mark for free workbooks. */
export function WorkbookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className={styles.glyph}>
      <path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5Z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

/** On the progress map, beside the free meter: one stamp per free workbook
 * (made, ready, or the problem count that unlocks it), the paper size, and
 * the next step. Every state has the same geometry, so nothing moves when a
 * workbook unlocks, is made, or fails. */
export function TrialWorkbooks({
  session,
  status,
}: {
  session: TrialSession;
  status: Status;
}) {
  const heading = useId();
  const { paper, setPaper } = useWorkbookPaper();
  const { busy, message, clear, print } = useAssessmentWorkbook(session);
  if (status.total === 0) return null;
  const slots = Array.from({ length: status.total }, (_, index) => index);
  return (
    <section
      className={styles.strip}
      aria-labelledby={heading}
      data-trial-workbooks=""
    >
      <div className={styles.stripHead}>
        <div className={styles.stripTitle}>
          <h2 id={heading}>Free workbooks</h2>
          <p>
            Start with an age-based workbook to print. Answer problems to adapt
            future workbooks to this learner’s progress. One more unlocks every{" "}
            {TRIAL_WORKBOOK_EVERY} problems, up to five in all.
          </p>
        </div>
        <div className={styles.paper}>
          <Segmented
            compact
            label="Paper size"
            value={paper}
            onChange={setPaper}
            options={[
              { value: "letter", label: "Letter" },
              { value: "a4", label: "A4" },
            ]}
          />
        </div>
      </div>
      <div className={styles.stripBody}>
        <ol className={styles.stamps} aria-label="Free workbooks">
          {slots.map((index) => {
            const item = status.items[index];
            const at = index * TRIAL_WORKBOOK_EVERY;
            const key = `made:${item?.id ?? index}`;
            if (item)
              return (
                <li key={index}>
                  <button
                    type="button"
                    className={`${styles.stamp} ${styles.made}`}
                    disabled={!!busy}
                    aria-busy={busy === key}
                    aria-label={`Download workbook ${index + 1} again`}
                    onClick={() => void print(key, item)}
                  >
                    {busy === key ? "…" : "✓"}
                  </button>
                </li>
              );
            const ready = index < status.earned;
            return (
              <li key={index}>
                <span
                  className={`${styles.stamp} ${ready ? styles.ready : styles.locked}`}
                  aria-label={
                    ready
                      ? `Workbook ${index + 1} is ready`
                      : `Workbook ${index + 1} unlocks at ${at} problems`
                  }
                  role="img"
                >
                  {at === 0 ? "1" : at}
                </span>
              </li>
            );
          })}
        </ol>
        <div className={styles.next}>
          {status.available > 0 ? (
            <Button
              variant="secondary"
              className={styles.nextAction}
              disabled={!!busy}
              aria-busy={busy === "next"}
              onClick={() => void print("next")}
            >
              {busy === "next"
                ? "Preparing…"
                : `Download workbook ${status.made + 1}`}
            </Button>
          ) : (
            <p className={styles.nextNote}>
              {status.nextAt !== null
                ? `Next one at ${status.nextAt} problems.`
                : status.made > 0
                  ? "Tap a workbook to download it again."
                  : ""}
            </p>
          )}
        </div>
      </div>
      <Toast message={message} onDismiss={clear} />
    </section>
  );
}
