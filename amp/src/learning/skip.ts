/** A skip is a neutral pass: the learner sees the worked answer, and nothing
 * about their ability, mastery or progress changes. It is stored on the
 * problem record, never as an attempt.
 *
 * Whether a skip uses one of the free trial's problems. It does by default,
 * because the answer is revealed. Flip this one constant to make skips free;
 * the server's allowance and the trial meter both read it. */
export const SKIP_USES_FREE_PROBLEM = true;

/** A skip the planner sees: what was passed, and when. */
export type PracticeSkip = {
  templateId: string;
  skillId: string;
  createdAt: string;
};
