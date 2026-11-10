import { availableGiftSchema } from "../access-grants/contracts.js";
import { purchaseMeasurementSchema } from "../advertising/permission-contracts.js";
import { z } from "zod";
import { freeAllowanceSchema } from "../learning/free-allowance.js";
import { practiceProfileSchema } from "../learning/practice-profiles.js";
export const familySummarySchema = z.object({
  purchaseMeasurement: purchaseMeasurementSchema.optional(),
  metaPurchaseMeasurement: purchaseMeasurementSchema.optional(),
  openaiPurchaseMeasurement: purchaseMeasurementSchema.optional(),
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
      satMathFocus: z.boolean().optional(),
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
      learningAllowed: z.boolean().optional(),
      hasAccess: z.boolean().optional(),
      namePending: z.boolean().optional(),
      pictureIdentity: z.string().nullable().optional(),
      freeAllowance: freeAllowanceSchema.optional(),
      /** The account holder's own learner (docs/families.md), not a child. */
      adult: z.literal(true).optional(),
      /** A practice profile: the adult practicing as someone else. */
      simulation: z.literal(true).optional(),
    }),
  ),
  retained: z.object({
    identity: z.string(),
    financial: z.string(),
    backups: z.string(),
    privacyAuditDays: z.number(),
  }),
});
/** A family's child as `/me` lists them. */
const childSchema = z.object({
  id: z.string(),
  name: z.string(),
  birthYear: z.number().nullable(),
  namePending: z.boolean().optional(),
  pictureIdentity: z.string().nullable().optional(),
  freeAllowance: freeAllowanceSchema.optional(),
  entitlement: z.object({
    /** Permission for online practice, including a free allowance. */
    active: z.boolean(),
    /** Actual grant coverage; absent on older providers. */
    licensed: z.boolean().optional(),
    plan: z.string().nullable(),
    endsAt: z.string().nullable(),
  }),
});
const accountSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  /** The parent must confirm the address before consent or purchase. The
   * account works meanwhile: sign-in, the free trial and Family. */
  confirmationRequired: z.boolean().optional(),
  /** Set for a school student, whose token and learner the school manages.
   * Staff are ordinary accounts: one person can be a teacher and a parent. */
  kind: z.literal("student").optional(),
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
    learners: z.array(childSchema),
    family: familySummarySchema,
    availableAccessGrant: availableGiftSchema.optional(),
    unassignedPurchase: z
      .object({
        id: z.string(),
        interval: z.enum(["month", "year"]),
        endsAt: z.string(),
      })
      .optional(),
    /** The school a student belongs to, and how it shows them their levels. */
    school: z
      .object({
        orgName: z.string(),
        className: z.string().optional(),
        levels: z.enum(["hidden", "choice", "shown"]),
        /** A current class has a board this student can open. */
        standings: z.boolean().optional(),
      })
      .optional(),
    /** Schools this account works at. A teacher can also be a parent, so this
     * sits beside learners rather than replacing them. */
    staffOf: z
      .array(
        z.object({
          orgId: z.string(),
          orgName: z.string(),
          role: z.enum(["admin", "teacher", "aide", "viewer"]),
          /** This admin hasn't finished the school's guided setup. */
          setupPending: z.literal(true).optional(),
          /** A demo place: made-up students, there to explore. */
          demo: z.literal(true).optional(),
        }),
      )
      .optional(),
    /** The family's class (docs/families.md): the parent teaches it, and
     * their children are its students. The family side opens on it. */
    familyClass: z
      .object({
        orgId: z.string(),
        classId: z.string(),
        className: z.string(),
        /** Show the line about how the children sign in now. */
        notice: z.boolean(),
      })
      .optional(),
    /** A link from another family's teacher (docs/families.md, step 5) this
     * parent opened and hasn't approved yet. */
    familyApproval: z.object({ id: z.string() }).optional(),
    /** Families this account is the second parent of (docs/families.md): their
     * class, which she teaches, and their children, whose progress she reads
     * and whom she can let practice on her device. Their purchases, consent
     * and names stay the account holder's. */
    secondParentOf: z
      .array(
        z.object({
          orgId: z.string(),
          classId: z.string(),
          className: z.string(),
          learners: z.array(childSchema),
        }),
      )
      .optional(),
    /** The adult's own practice, with a free allowance and access supplied by
     * their children or school. It is separate from the family's children. */
    adultPractice: z
      .object({
        /** May practice now: their access is active, or they may start. */
        eligible: z.boolean(),
        learner: z
          .object({
            id: z.string(),
            name: z.string(),
            active: z.boolean(),
          })
          .nullable(),
      })
      .optional(),
    /** Practice profiles (docs/families.md): the adult practicing as someone
     * else, newest first, each with its label and starting levels. */
    practiceProfiles: z.array(practiceProfileSchema).optional(),
    /** `start`: the account has no place yet, so it answers "What brings you
     * to AMP?". `practice`: it has one, and `/` opens it. `add-learner`: a
     * paid purchase no learner holds yet. `accept-gift`: an invitation's
     * access to accept. */
    next: z.enum(["start", "add-learner", "practice", "accept-gift"]),
  }),
]);
export type Me = z.infer<typeof meSchema>;
export type SignedInMe = Extract<Me, { signedIn: true }>;
