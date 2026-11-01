/** What a legacy-surface digest freezes: everything a problem gives the
 * learner and the grader (prompt, figure, response, answer, grading rules,
 * scenes), but not its teaching text. Explanations, hints and choice feedback
 * are rewritten as the curriculum improves (#1781); the grammar, typography
 * and instance-hint gates check that text, so a digest need not pin it. The
 * realized variant is recorded beside the problem and is left out too. */
export function legacySurface<T extends object>(problem: T) {
  const { variant, explanation, hint, choiceFeedback, ...surface } =
    problem as T & {
      variant?: unknown;
      explanation?: unknown;
      hint?: unknown;
      choiceFeedback?: unknown;
    };
  void variant;
  void explanation;
  void hint;
  void choiceFeedback;
  return surface;
}
