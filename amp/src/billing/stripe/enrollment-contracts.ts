import { z } from "zod";
import { noticeSchema } from "../../parent-consent/contracts.js";

/** Parent-facing offer. Amounts are display data from server configuration. */
export const annualOfferSchema = z.object({
  id: z.string().length(64),
  mode: z.enum(["test", "live"]),
  currency: z.literal("USD"),
  amountMinor: z.number().int().positive(),
  formattedAmount: z.string().min(1).max(40),
  interval: z.enum(["year", "month"]),
  learnerCount: z.literal(1),
});
export const offerViewSchema = z.object({
  available: z.boolean(),
  offer: annualOfferSchema.optional(),
  offers: z.array(annualOfferSchema).max(2).optional(),
});
export const enrollmentPhases = [
  "checkout-open",
  "processing",
  "paid",
  "assigned",
  "expired",
  "payment-inactive",
  "requires-review",
] as const;
export type EnrollmentPhase = (typeof enrollmentPhases)[number];
/** GET /api/v1/billing/enrollment: purchase-backed consent state, adult data only. */
export const enrollmentViewSchema = z.object({
  available: z.boolean(),
  notice: noticeSchema.nullable(),
  noticeDigest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  purchase: z
    .object({
      id: z.uuid(),
      interval: z.enum(["year", "month"]),
      phase: z.enum([...enrollmentPhases, "ready"]),
      learnerId: z.string().nullable(),
      url: z.string().nullable(),
    })
    .nullable(),
});
export type EnrollmentView = z.infer<typeof enrollmentViewSchema>;
