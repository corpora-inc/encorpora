import { z } from "zod";
export const familySummarySchema = z.object({
  consent: z.object({
    status: z.enum(["active", "withdrawn", "not-recorded", "development"]),
    policyVersion: z.string().nullable(),
    recordedAt: z.string().nullable(),
    withdrawnAt: z.string().nullable(),
  }),
  learners: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      birthYear: z.number().int().nullable().optional(),
      deletedAt: z.string().nullable(),
      access: z.array(
        z.object({
          channel: z.string(),
          status: z.string(),
          startsAt: z.string(),
          endsAt: z.string(),
        }),
      ),
      stripeLinked: z.boolean(),
      canPractice: z.boolean().optional(),
    }),
  ),
  retained: z.object({
    identity: z.string(),
    financial: z.string(),
    backups: z.string(),
    privacyAuditDays: z.number(),
  }),
});
const accountSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
});
export const meSchema = z.discriminatedUnion("signedIn", [
  z.object({ signedIn: z.literal(false), next: z.literal("sign-in") }),
  z.object({
    signedIn: z.literal(true),
    account: accountSchema,
    consent: z.object({
      status: z.enum(["none", "pending", "active", "withdrawn"]),
      method: z.string().nullable(),
    }),
    learners: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        birthYear: z.number().nullable(),
        entitlement: z.object({
          active: z.boolean(),
          plan: z.string().nullable(),
          endsAt: z.string().nullable(),
        }),
      }),
    ),
    family: familySummarySchema,
    unassignedPurchase: z
      .object({
        id: z.string(),
        interval: z.enum(["month", "year"]),
        endsAt: z.string(),
      })
      .optional(),
    next: z.enum(["verify-email", "add-learner", "choose-plan", "practice"]),
  }),
]);
export type Me = z.infer<typeof meSchema>;
export type SignedInMe = Extract<Me, { signedIn: true }>;
