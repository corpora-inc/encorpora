/**
 * Points: one for every right answer without help, ever. The same evidence
 * as an earned skill (`learning/earned.ts`) and the "+1" on a right answer:
 * each skill's `independentCorrect`, summed. Never a separate ledger, so a
 * total can't drift from the record, and a reset level or a miss never
 * takes a point away.
 */
export const pointsOf = (
  evidence: readonly { independentCorrect?: number }[],
) => evidence.reduce((sum, entry) => sum + (entry.independentCorrect ?? 0), 0);

/** Whether an answer earns a point: right, without help, and answered (a
 * skip's reveal is never an answer). The "+1" and the total agree. */
export const earnsPoint = (outcome: {
  correct: boolean;
  assisted: boolean;
  skipped?: boolean;
}) => outcome.correct && !outcome.assisted && !outcome.skipped;
