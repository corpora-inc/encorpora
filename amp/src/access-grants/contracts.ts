import { z } from "zod";

/** One learner, or every child of the family that activates it (docs/complimentary-access.md). */
export const giftCoversSchema = z.enum(["learner", "family"]);
export const availableGiftSchema = z.object({
  id: z.uuid(),
  months: z.union([z.literal(1), z.literal(12)]),
  claimBy: z.string().nullable(),
  /** Absent means one learner. */
  covers: giftCoversSchema.optional(),
});
export const giftActivationSchema = z.object({
  id: z.uuid(),
  /** The learner it was activated for; null once that learner is deleted. */
  learnerId: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
});
export const issueGiftSchema = z.strictObject({
  email: z
    .email()
    .max(320)
    .transform((email) => email.trim().toLowerCase()),
  months: z.union([z.literal(1), z.literal(12)]),
  source: z.string().min(1).max(80).default("manual"),
  reference: z.string().min(1).max(160),
  campaign: z.string().min(1).max(160).optional(),
  claimBy: z.iso.datetime({ offset: true }).optional(),
  covers: giftCoversSchema.default("learner"),
});
export class AccessGiftError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
  ) {
    super(code);
  }
}
