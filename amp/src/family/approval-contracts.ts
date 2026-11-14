import { z } from "zod";
import { freeAllowanceSchema } from "../learning/free-allowance.js";

/** Approval links for another family's child (docs/families.md, step 5). */

/** A row of the teacher's list: the child and the parent's address the
 * teacher typed, and the child's place in the class. */
export const approvalRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum([
    "waiting",
    "expired",
    "paused",
    "needs-access",
    "active",
    "unnamed",
  ]),
  parentEmail: z.string().nullable(),
  inviteUrl: z.string().nullable(),
  parentPageUrl: z.string().nullable(),
  expiresAt: z.string().nullable(),
  accessEndsAt: z.string().nullable(),
  /** An unnamed student of the class: their roster person, for the link. */
  personId: z.string().optional(),
  /** Free problems left, while no plan covers them. */
  freeLeft: z.number().int().min(0).optional(),
});
export type ApprovalRowResource = z.infer<typeof approvalRowSchema>;

/** What the link shows before anyone signs in. */
export const approvalLookupSchema = z.object({
  status: z.enum(["open", "used", "expired", "ended"]),
  childName: z.string().nullable(),
  className: z.string(),
  teachers: z.array(z.string()),
  teacherNames: z.array(z.string().nullable()).optional(),
});
export type ApprovalLookup = z.infer<typeof approvalLookupSchema>;

/** The approving parent's page about their child in the class. */
export const approvalViewSchema = z.object({
  id: z.string(),
  status: z.enum(["open", "expired", "approved", "ended"]),
  childName: z.string().nullable(),
  className: z.string(),
  teachers: z.array(z.string()),
  teacherNames: z.array(z.string().nullable()).optional(),
  consentActive: z.boolean(),
  canPractice: z.boolean().optional(),
  freeAllowance: freeAllowanceSchema.optional(),
  learnerId: z.string().nullable(),
  /** The approval adds a child new to the class: approving asks their birth
   * year, which sets where their practice starts. */
  asksBirthYear: z.boolean().optional(),
  access: z.object({ active: z.boolean(), endsAt: z.string().nullable() }),
});
export type ApprovalView = z.infer<typeof approvalViewSchema>;
