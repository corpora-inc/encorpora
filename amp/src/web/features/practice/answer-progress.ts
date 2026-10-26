import { z } from "zod";
import type { ProgressSnapshot } from "../../../server/progress";

export const answerProgressSchema: z.ZodType<ProgressSnapshot> = z.object({
  asOf: z.string(),
  skills: z.array(
    z.object({
      skillId: z.string(),
      attempts: z.number().int().nonnegative(),
      independentCorrect: z.number().int().nonnegative(),
      recentIndependentCorrect: z.number().int().min(0).max(5),
      independentOccasions: z.number().int().nonnegative(),
      status: z.enum(["new", "practicing", "review-ready"]),
      lastPracticedAt: z.string().nullable(),
      reviewDueAt: z.string().nullable(),
      recent: z
        .array(
          z.object({
            correct: z.boolean(),
            assisted: z.boolean(),
            at: z.string(),
          }),
        )
        .max(5),
    }),
  ),
});
