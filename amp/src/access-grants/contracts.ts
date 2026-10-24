import { z } from "zod";

export const availableGiftSchema = z.object({
  id: z.uuid(),
  months: z.union([z.literal(1), z.literal(12)]),
  claimBy: z.string().nullable(),
});
export const giftActivationSchema = z.object({
  id: z.uuid(),
  learnerId: z.string(),
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
});
export class AccessGiftError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
  ) {
    super(code);
  }
}
