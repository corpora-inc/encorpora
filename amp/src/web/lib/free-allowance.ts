/** A learner no plan covers, with free problems left. */
type Covered = {
  hasAccess?: boolean;
  freeAllowance?: { problems: { remaining: number } };
};

/** "73 free problems left": the quiet count on a learner no plan covers. */
export const freeProblemsLeft = (left: number) =>
  `${left} free ${left === 1 ? "problem" : "problems"} left`;

/** The free problems left, or null once a plan covers the learner (or the
 * server doesn't say). */
export function freeLeft(learner: Covered | undefined | null) {
  if (!learner || learner.hasAccess || !learner.freeAllowance) return null;
  return learner.freeAllowance.problems.remaining;
}
