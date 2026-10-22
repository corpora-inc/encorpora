import { z } from "zod";
import type { ProblemHint, PublicProblem } from "../../math/contracts";
import { stepsSchema } from "../../math/scene/timeline";

export const problemHintSchema = z.object({
  hint: z.string().min(1).max(4000),
  cue: stepsSchema.optional(),
});
export type HintedProblem = PublicProblem & { hintSupport?: ProblemHint };

/** Attach only this problem's help; older/native batches may omit it. */
export function withProblemHints<
  T extends {
    problems: PublicProblem[];
    hints?: Record<string, ProblemHint>;
  },
>(batch: T) {
  return {
    ...batch,
    problems: batch.problems.map((problem): HintedProblem => ({
      ...problem,
      ...(batch.hints?.[problem.id]
        ? { hintSupport: batch.hints[problem.id] }
        : {}),
    })),
  };
}
