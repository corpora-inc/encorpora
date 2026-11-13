import { z } from "zod";
import { optionalNickname } from "../learning/nickname.js";

/** Orgs an operator creates. A family (docs/families.md) is made by its
 * parent's first child, never by hand. */
export const schoolOrgKinds = ["district", "network", "school"] as const;
export const orgKinds = [...schoolOrgKinds, "family"] as const;
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
  "school.start",
  "pilot.manage",
  "pilot.read",
  "class.authorize",
  "class.import",
  "purchase.request",
  "org.read",
  "classes.read",
  "classes.create",
  "students.read",
  "students.add",
  "signin.read",
  "signin.manage",
  /** A class's new join code. */
  "signin.code",
  "grades.read",
  "grades.write",
  "setup.write",
  "invites.accept",
  "calendar.read",
  "calendar.write",
  "classes.update",
  "students.update",
  "students.transfer",
  "students.remove",
  "staff.read",
  "staff.manage",
  "license.read",
  "license.request",
  "roster.import",
  "overview.read",
  "schools.add",
  "year.rollover",
  "integrations.read",
  "integrations.manage",
  "privacy.read",
  "privacy.export",
  "privacy.delete",
  "activity.read",
  "settings.read",
  "settings.write",
  "workbooks.read",
  "workbooks.write",
  "share.manage",
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
    /** How many seconds until this is worth trying again. */
    public readonly retryAfter?: number,
    /** Where to go instead: `demo_moved` names the visitor's new demo. */
    public readonly path?: string,
    /** Open buyer requests overlapping the authorized classes being requested. */
    public readonly conflicts?: {
      requestId: string;
      holderName: string;
      classIds: string[];
    }[],
  ) {
    super(code);
  }
}

const name = z.string().trim().min(1).max(100);
export const plainName = name.refine(
  (value) => !/[\u0000-\u001f\u007f]/.test(value),
);
export const timezone = z
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
export const email = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email())
  .transform((value) => value.toLowerCase());
const identifier = z.string().trim().min(1).max(100);
/** K is 0; 13 is the college-level end of the learning model. */
export const gradeLevelSchema = z.number().int().min(0).max(13);

export const createOrgSchema = z.strictObject({
  kind: z.enum(schoolOrgKinds),
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

export const createStudentSchema = z
  .strictObject({
    givenName: plainName.optional(),
    familyName: plainName.optional(),
    displayName: plainName.optional(),
    email: email.optional(),
    identifier: identifier.optional(),
    gradeLevel: gradeLevelSchema.optional(),
    birthYear: z.number().int().min(1900).max(2100).optional(),
    classId: z.uuid().optional(),
    /** Without a name (no data agreement, as in a tutor's class): a nickname
     * or initials, or blank for "Student 3" (src/learning/nickname.ts). */
    nickname: optionalNickname,
  })
  .superRefine((input, context) => {
    if (input.givenName !== undefined) {
      if (input.nickname !== undefined)
        context.addIssue({
          code: "custom",
          path: ["nickname"],
          message: "A named student has no nickname",
        });
      return;
    }
    if (input.birthYear === undefined)
      context.addIssue({
        code: "custom",
        path: ["birthYear"],
        message: "A birth year is required",
      });
    for (const key of [
      "familyName",
      "displayName",
      "email",
      "identifier",
    ] as const)
      if (input[key] !== undefined)
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Names and contact details require consent",
        });
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
  classIds: z.array(z.uuid()).min(1).max(10000).optional(),
  seats: z.number().int().min(0).max(1_000_000),
  startsAt: z.iso.datetime({ offset: true }).optional(),
  endsAt: z.iso.datetime({ offset: true }),
  reference: z.string().trim().min(1).max(200).optional(),
});
export type IssueLicense = z.infer<typeof issueLicenseSchema>;

export const extendLicenseSchema = z.strictObject({
  licenseId: z.uuid(),
  endsAt: z.iso.datetime({ offset: true }),
});
export const setSeatsSchema = z.strictObject({
  licenseId: z.uuid(),
  seats: z.number().int().min(0).max(1_000_000),
});
export const issueStudentSessionSchema = z.strictObject({
  personId: z.uuid(),
  mode: z.enum(sessionModes),
});

/* Student sign-in. The pictures are stable names: a student's secret is built
   from them, so renaming one locks out everyone who chose it. */
export const schoolPictures = [
  "fox",
  "moon",
  "turtle",
  "umbrella",
  "apple",
  "owl",
  "boat",
  "frog",
  "sun",
  "whale",
  "tree",
  "bee",
  "kite",
  "rabbit",
  "rocket",
  "fish",
] as const;
export type SchoolPicture = (typeof schoolPictures)[number];
export const JOIN_CODE_LENGTH = 6;
/** What a person types or a board shows: any case, with or without a hyphen. */
export const normalizeJoinCode = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "");
const joinCode = z.string().max(40).transform(normalizeJoinCode);
export const joinLookupSchema = z.strictObject({ code: joinCode });
export const joinPictureSchema = z.strictObject({
  code: joinCode,
  personId: z.uuid(),
  pictures: z
    .array(z.enum(schoolPictures))
    .length(3)
    .refine((picked) => new Set(picked).size === picked.length),
  /** The student is choosing these. Ignored once pictures are set. */
  set: z.boolean().optional(),
});
export const joinCardSchema = z.strictObject({
  token: z.string().max(200),
});
export const issueCardsSchema = z.strictObject({
  /** Only these students; otherwise the whole class. */
  personIds: z.array(z.uuid()).min(1).max(1000).optional(),
  /** Leave out students whose card still works. */
  missingOnly: z.boolean().optional(),
});

export const ssoProviders = ["google", "microsoft"] as const;
export type SsoProvider = (typeof ssoProviders)[number];
export const joinRosterResource = z.object({
  class: z.object({ name: z.string() }),
  /** Practice hasn't started, or has ended: no names to tap. */
  practice: z.enum(["waiting", "ended"]).optional(),
  /** Outside sign-ins this class's school has turned on. */
  signIn: z.array(z.enum(ssoProviders)).optional(),
  /** All a stranger with the code can learn: no learner data of any kind. */
  students: z.array(
    z.object({ id: z.uuid(), name: z.string(), picturesSet: z.boolean() }),
  ),
});
export const studentGrantResource = z.object({
  token: z.string(),
  accountId: z.string(),
  mode: z.enum(sessionModes),
  expiresAt: z.string(),
});
export const presenceResource = z.object({
  class: z.object({
    id: z.uuid(),
    name: z.string(),
    joinCode: z.string(),
    /** Sign-in is paused by guessing until then; a new code reopens it. */
    joinLockedUntil: z.string().nullable().optional(),
  }),
  /** Whether this person can make a new code (and so offer it). */
  canManage: z.boolean().optional(),
  students: z.array(
    z.object({ id: z.uuid(), name: z.string(), here: z.boolean() }),
  ),
});
export const signInRosterResource = z.object({
  class: z.object({
    id: z.uuid(),
    name: z.string(),
    joinCode: z.string(),
    /** Too many wrong pictures across the class: sign-in is paused until then. */
    joinLockedUntil: z.string().nullable(),
  }),
  /** Whether this person can change sign-in, or only read it. */
  canManage: z.boolean(),
  /** Whether this person can make the class a new code (never in a shared
   * demo, where one visitor's code would be everyone's). */
  canNewCode: z.boolean().optional(),
  /** Whether this person can send families their progress links; a
   * family's own class has none (its parents see it themselves). */
  canShare: z.boolean().optional(),
  students: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      cardIssuedAt: z.string().nullable(),
      picturesSet: z.boolean(),
      locked: z.boolean(),
      activeSessions: z.number().int(),
      lastSeenAt: z.string().nullable(),
    }),
  ),
});
export const issuedCardsResource = z.object({
  class: z.object({ name: z.string() }),
  cards: z.array(
    z.object({ personId: z.uuid(), name: z.string(), token: z.string() }),
  ),
});
export type JoinRoster = z.infer<typeof joinRosterResource>;
export type StudentGrant = z.infer<typeof studentGrantResource>;
export type Presence = z.infer<typeof presenceResource>;
export type SignInRoster = z.infer<typeof signInRosterResource>;
export type IssuedCards = z.infer<typeof issuedCardsResource>;

export const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  q: z.string().trim().max(80).optional(),
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
  /** "Just my class": the staff screens collapse. */
  solo: z.boolean().optional(),
  /** Still in guided setup. */
  setupPending: z.boolean().optional(),
  /** A demo place (docs/schools.md#demo-places): made-up students, there to
   * explore; the real class comes from the real onboarding. */
  demo: z.literal(true).optional(),
  /** What the caller can do here, so a screen offers only what will work. */
  can: z.array(z.enum(schoolActions)).optional(),
  /** Classes the caller teaches here, for the class-level actions in `can`. */
  teaches: z.array(z.uuid()).optional(),
  /** The caller's own name here (a teacher list says "You" for it). */
  personName: z.string().nullable().optional(),
  /** The orgs above this one that the caller can open, from the top down. */
  ancestors: z.array(z.object({ id: z.uuid(), name: z.string() })).optional(),
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
  /** Its teachers today, by name. */
  teachers: z.array(z.string()).default([]),
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
  /** How many students match, across all pages. */
  total: z.number().int().optional(),
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
