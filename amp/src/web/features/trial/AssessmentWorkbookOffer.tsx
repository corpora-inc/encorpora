import { useId, useState } from "react";
import { Button } from "../../ui/Button";
import { Toast } from "../../ui/Toast";
import type { TrialSession } from "./api";
import { useAssessmentWorkbook } from "./assessment-workbooks";
import { WorkbookGlyph } from "./TrialWorkbooks";
import styles from "./AssessmentWorkbooks.module.css";

/** Workbooks this page has made from an offer, so a remounted offer (or a
 * second tap) downloads the same one instead of using another. */
const offered = new Map<string, { id: string; date: string; number: number }>();

/** In the answer feedback, on the problem that unlocks a free workbook: a
 * compact offer that never blocks Next. Its size is the same while idle,
 * preparing, done or failed; a failure shows in the fixed toast. */
export function AssessmentWorkbookOffer({
  session,
  slot,
}: {
  session: TrialSession;
  /** Which free workbook this answer unlocked (1 to 5). */
  slot: number;
}) {
  const key = `${session.learnerId}:${slot}`;
  const [made, setMade] = useState(() => offered.get(key) ?? null);
  const { busy, message, clear, print } = useAssessmentWorkbook(session);
  const title = useId();
  async function download() {
    const workbook = await print(key, made ?? undefined);
    if (!workbook) return;
    offered.set(key, workbook);
    setMade(workbook);
  }
  return (
    <section
      className={styles.offer}
      aria-labelledby={title}
      data-workbook-offer=""
    >
      <span
        className={styles.offerMark}
        aria-hidden="true"
        data-done={made ? "" : undefined}
      >
        {made ? "✓" : <WorkbookGlyph />}
      </span>
      <span className={styles.offerText}>
        <strong id={title}>Workbook unlocked</strong>
        <span>Printable practice made for this learner.</span>
      </span>
      <Button
        variant="secondary"
        className={styles.offerAction}
        disabled={!!busy}
        aria-busy={!!busy}
        aria-describedby={title}
        onClick={() => void download()}
      >
        {busy ? "Preparing…" : "Download"}
      </Button>
      <Toast message={message} onDismiss={clear} />
    </section>
  );
}
