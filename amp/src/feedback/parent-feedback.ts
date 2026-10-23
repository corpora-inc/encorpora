import { z } from "zod";
/** Parent-only product feedback. No account, learner, invoice or ad identifiers. */
export const parentFeedbackSchema = z.strictObject({
  requestId: z.uuid(),
  adult: z.literal(true),
  context: z.enum(["general", "plans", "invoice", "purchase"]),
  program: z.enum(["ar-efa", "az-esa"]).optional(),
  message: z.string().trim().min(1).max(2000),
});
