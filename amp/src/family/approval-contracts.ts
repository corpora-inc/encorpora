import { z } from "zod";

/** Approval links for another family's child (docs/families.md, step 5). */

/** A row of the teacher's list: the child and the parent's address the
 * teacher typed, and the child's place in the class. */
export const approvalRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["waiting", "expired", "paused", "needs-access", "active"]),
  parentEmail: z.string().nullable(),
  inviteUrl: z.string().nullable(),
  parentPageUrl: z.string().nullable(),
  expiresAt: z.string().nullable(),
  accessEndsAt: z.string().nullable(),
});
export type ApprovalRowResource = z.infer<typeof approvalRowSchema>;

/** What the link shows before anyone signs in. */
export const approvalLookupSchema = z.object({
  status: z.enum(["open", "used", "expired", "ended"]),
  childName: z.string().nullable(),
  className: z.string(),
  teachers: z.array(z.string()),
});
export type ApprovalLookup = z.infer<typeof approvalLookupSchema>;

/** The approving parent's page about their child in the class. */
export const approvalViewSchema = z.object({
  id: z.string(),
  status: z.enum(["open", "expired", "approved", "ended"]),
  childName: z.string().nullable(),
  className: z.string(),
  teachers: z.array(z.string()),
  consentActive: z.boolean(),
  learnerId: z.string().nullable(),
  access: z.object({ active: z.boolean(), endsAt: z.string().nullable() }),
});
export type ApprovalView = z.infer<typeof approvalViewSchema>;
