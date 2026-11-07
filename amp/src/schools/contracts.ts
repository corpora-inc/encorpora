import { z } from "zod";

export const orgKinds = ["district", "network", "school"] as const;
export const orgRoles = [
  "admin",
  "teacher",
  "aide",
  "viewer",
  "student",
] as const;
export const staffRoles = ["admin", "teacher", "aide", "viewer"] as const;
export const enrollmentRoles = ["student", "teacher", "aide"] as const;
export const gradingKinds = [
  "year",
  "semester",
  "trimester",
  "quarter",
  "custom",
] as const;
export const sessionModes = ["shared", "personal"] as const;

/** Everything a school route can ask to do. `can` is the only reader. */
export const schoolActions = [
  "orgs.list",
  "org.read",
  "classes.read",
  "classes.create",
  "students.read",
  "students.add",
] as const;
export type OrgKind = (typeof orgKinds)[number];
export type OrgRole = (typeof orgRoles)[number];
export type StaffRole = (typeof staffRoles)[number];
export type EnrollmentRole = (typeof enrollmentRoles)[number];
export type GradingKind = (typeof gradingKinds)[number];
export type SessionMode = (typeof sessionModes)[number];
export type SchoolAction = (typeof schoolActions)[number];

/** A failure the caller can act on: `{error: code}` with this status. */
export class SchoolError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

const name = z.string().trim().min(1).max(100);
const plainName = name.refine((value) => !/[\u0000-\u001f\u007f]/.test(value));
const timezone = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  });
const email = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email())
  .transform((value) => value.toLowerCase());
const identifier = z.string().trim().min(1).max(100);
/** K is 0; 13 is the college-level end of the learning model. */
export const gradeLevelSchema = z.number().int().min(0).max(13);

export const createOrgSchema = z.strictObject({
  kind: z.enum(orgKinds),
  name: z.string().trim().min(1).max(200),
  timezone: timezone.optional(),
  parentId: z.uuid().optional(),
});
export type CreateOrg = z.infer<typeof createOrgSchema>;

export const dataAgreementSchema = z.strictObject({
  version: z.string().trim().min(1).max(40),
  signerName: plainName,
  signerTitle: plainName,
});
export type DataAgreement = z.infer<typeof dataAgreementSchema>;

export const createClassSchema = z.strictObject({
  name,
  courseBands: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  gradingKind: z.enum(gradingKinds).optional(),
  sessionId: z.uuid().optional(),
});
export type CreateClass = z.infer<typeof createClassSchema>;

export const createStudentSchema = z.strictObject({
  givenName: plainName,
  familyName: plainName.optional(),
  displayName: plainName.optional(),
  email: email.optional(),
  identifier: identifier.optional(),
  gradeLevel: gradeLevelSchema.optional(),
  classId: z.uuid().optional(),
});
export type CreateStudent = z.infer<typeof createStudentSchema>;

export const addStaffSchema = z.strictObject({
  orgId: z.uuid(),
  role: z.enum(staffRoles),
  givenName: plainName,
  familyName: plainName.optional(),
  email: email.optional(),
  accountId: z.string().min(1).max(300).optional(),
  classId: z.uuid().optional(),
});
export type AddStaff = z.infer<typeof addStaffSchema>;

export const issueLicenseSchema = z.strictObject({
  orgId: z.uuid(),
  seats: z.number().int().min(0).max(1_000_000),
  startsAt: z.iso.datetime({ offset: true }).optional(),
  endsAt: z.iso.datetime({ offset: true }),
  reference: z.string().trim().min(1).max(200).optional(),
});
export type IssueLicense = z.infer<typeof issueLicenseSchema>;

export const setSeatsSchema = z.strictObject({
  licenseId: z.uuid(),
  seats: z.number().int().min(0).max(1_000_000),
});
export const issueStudentSessionSchema = z.strictObject({
  personId: z.uuid(),
  mode: z.enum(sessionModes),
});

export const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
export type Page = z.infer<typeof pageSchema>;

/* API resources: the reference for what school routes return. */
export const orgResource = z.object({
  id: z.uuid(),
  kind: z.enum(orgKinds),
  name: z.string(),
  parentId: z.uuid().nullable(),
  timezone: z.string(),
  /** The caller's own active roles here; empty when access comes from above. */
  roles: z.array(z.enum(staffRoles)),
});
export const classResource = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  sessionId: z.uuid(),
  name: z.string(),
  courseBands: z.array(z.string()),
  gradingKind: z.enum(gradingKinds),
  joinCode: z.string(),
  studentCount: z.number().int(),
});
export const studentResource = z.object({
  id: z.uuid(),
  givenName: z.string(),
  familyName: z.string().nullable(),
  displayName: z.string().nullable(),
  handle: z.string(),
  identifier: z.string().nullable(),
  gradeLevel: z.number().int().nullable(),
  classIds: z.array(z.uuid()),
  /** False: rostered and shown as "needs a seat". */
  seated: z.boolean(),
});
export type OrgResource = z.infer<typeof orgResource>;
export type ClassResource = z.infer<typeof classResource>;
export type StudentResource = z.infer<typeof studentResource>;

const count = z.number().int().min(0);
const activityCounts = {
  problems: count,
  correct: count,
  independent: count,
  assisted: count,
  review: count,
  reviewIndependent: count,
  activeMinutes: z.number().min(0),
};
const dateString = z.iso.date();
export const activityRangeResource = z.object({
  from: dateString,
  to: dateString,
});
export const activityTotalsResource = z.object({
  personId: z.uuid(),
  ...activityCounts,
  daysActive: count,
  /** The latest day with any activity, in or out of the range. */
  lastActive: dateString.nullable(),
});
export const activityDayResource = z.object({
  personId: z.uuid(),
  day: dateString,
  ...activityCounts,
});
export const activitySkillResource = z.object({
  personId: z.uuid(),
  /** Empty: active time spent where no one problem was showing. */
  skillId: z.string(),
  ...activityCounts,
});
export const classActivityResponse = z.object({
  range: activityRangeResource,
  students: z.array(activityTotalsResource),
});
export const studentActivityResponse = z.object({
  range: activityRangeResource,
  totals: activityTotalsResource.nullable(),
  days: z.array(activityDayResource),
  skills: z.array(activitySkillResource),
});
export const levelEstimateResource = z.object({
  level: z.number(),
  sd: z.number(),
  answered: count,
  independent: count,
});
export const levelDayResource = z.object({
  personId: z.uuid(),
  day: dateString,
  policyVersion: z.string(),
  overall: levelEstimateResource,
  strands: z.record(z.string(), levelEstimateResource),
});
export const classLevelsResponse = z.object({
  on: dateString.nullable(),
  students: z.array(levelDayResource),
});
export type ClassActivityResponse = z.infer<typeof classActivityResponse>;
export type StudentActivityResponse = z.infer<typeof studentActivityResponse>;
export type ClassLevelsResponse = z.infer<typeof classLevelsResponse>;
