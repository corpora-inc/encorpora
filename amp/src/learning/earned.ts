/**
 * When a skill is earned: its first correct answer without help (a hint, a
 * lesson or an example before answering makes it assisted). The one
 * definition every learner-facing count reads: Pathways' map and its "n of
 * 335 skills earned", a family's child page and its week on Today, and an
 * adult's own record. Earned stays earned: a later miss or a reset level
 * never takes it back (docs/pathways-map.md).
 *
 * A teacher's grade counts objectives its own way, by the grade policy
 * (`schools/grade-policy.ts` `demonstratedSuccesses`, above the student's
 * working level less a reach); that is a grade's evidence, not "earned".
 */
export const EARNED_AFTER = 1;

/** A skill's evidence, earned or not. */
export const isEarned = (evidence: { independentCorrect?: number } | undefined) =>
  (evidence?.independentCorrect ?? 0) >= EARNED_AFTER;

/** How many skills a learner has earned, from their per-skill evidence. */
export const earnedCount = (
  evidence: readonly { independentCorrect?: number }[],
) => evidence.filter(isEarned).length;
