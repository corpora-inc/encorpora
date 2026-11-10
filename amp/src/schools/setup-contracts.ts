import { z } from "zod";
import { isIsoDate, divisionKinds } from "./calendar.js";
import {
  email,
  gradeLevelSchema,
  gradingKinds,
  plainName,
  staffRoles,
  timezone,
} from "./contracts.js";
import { rosterRowSchema } from "./sources/rows.js";

const isoDate = z.string().refine(isIsoDate);
const orgName = z.string().trim().min(1).max(200);

/** Setup's first step: the name, who it's for and the time zone, which the
 * school's admin can change while setting up. */
export const schoolStepSchema = z.strictObject({
  name: orgName,
  shape: z.enum(["class", "school"]),
  timezone,
});
/** An operator's `create-school`: a school exists once we issue it a license,
 * by contract and invoice or PO, or as a pilot on purpose. Dates are whole days
 * in the school's time zone; the license runs through `endsOn`. */
export const createSchoolSchema = z
  .strictObject({
    name: orgName,
    adminEmail: email,
    seats: z.number().int().min(1).max(1_000_000),
    startsOn: isoDate,
    endsOn: isoDate,
    /** The PO or invoice number, or "Pilot" for a free pilot. */
    reference: z.string().trim().min(1).max(200),
    timezone: timezone.optional(),
  })
  .refine(({ startsOn, endsOn }) => endsOn >= startsOn, {
    error: "license_dates",
  });
export type CreateSchool = z.infer<typeof createSchoolSchema>;
export const calendarSchema = z
  .strictObject({
    startsOn: isoDate,
    endsOn: isoDate,
    division: z.enum(divisionKinds).nullable(),
  })
  .refine(
    ({ startsOn, endsOn }) => {
      const days =
        (Date.parse(`${endsOn}T00:00:00Z`) -
          Date.parse(`${startsOn}T00:00:00Z`)) /
        86_400_000;
      return days >= 30 && days <= 400;
    },
    { error: "calendar_dates" },
  );
export const addDivisionSchema = z.strictObject({
  kind: z.enum(divisionKinds),
});
export const sessionUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(100).optional(),
    startsOn: isoDate,
    endsOn: isoDate,
  })
  .refine(({ startsOn, endsOn }) => endsOn >= startsOn, {
    error: "calendar_dates",
  });
export const experiencePresets = ["quiet", "levels", "competition"] as const;
export type ExperiencePreset = (typeof experiencePresets)[number];
export const experienceSchema = z.strictObject({
  preset: z.enum(experiencePresets),
});
export const acceptAgreementSchema = z.strictObject({
  version: z.string().trim().min(1).max(40),
  signerName: plainName,
  signerTitle: plainName,
});
export const finishSetupSchema = z.strictObject({
  /** A class to start with; a school importing a roster may have none yet. */
  className: plainName.optional(),
  /** Students typed by hand, one name a line, into that class. */
  names: z.array(plainName).max(500).optional(),
  gradeLevel: gradeLevelSchema.optional(),
});

export const updateClassSchema = z.strictObject({
  name: plainName.optional(),
  gradingKind: z.enum(gradingKinds).optional(),
  courseBands: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});
export const updateStudentSchema = z.strictObject({
  displayName: plainName.nullable().optional(),
  gradeLevel: gradeLevelSchema.nullable().optional(),
});
export const setClassesSchema = z.strictObject({
  classIds: z.array(z.uuid()).max(40),
});
export const removeStudentSchema = z.strictObject({
  confirm: z.literal("remove"),
});

export const inviteStaffSchema = z.strictObject({
  email,
  role: z.enum(staffRoles),
  classIds: z.array(z.uuid()).max(40).optional(),
});
const inviteToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const inviteLookupSchema = z.strictObject({ token: inviteToken });
export const acceptInviteSchema = z.strictObject({
  token: inviteToken,
  /** In the mailed link only: whoever holds it can read that mailbox. */
  proof: inviteToken.optional(),
  name: plainName.optional(),
});

export const requestSeatsSchema = z.strictObject({
  seats: z.number().int().min(1).max(100_000),
  note: z.string().trim().max(1000).optional(),
});

export const ROSTER_CHUNK = 500;
export const rosterSources = ["csv", "oneroster"] as const;
export type RosterSource = (typeof rosterSources)[number];
export const planRosterSchema = z.strictObject({
  source: z.enum(rosterSources),
  rows: z.array(rosterRowSchema).max(ROSTER_CHUNK),
});
export const applyRosterSchema = planRosterSchema.extend({
  /** What an admin decided for rows held back, by line. */
  resolutions: z.record(z.string(), z.enum(["same", "new"])).optional(),
});

/* What the routes answer; the screens parse these. */
export const setupStateSchema = z.object({
  org: z.object({
    id: z.uuid(),
    name: z.string(),
    solo: z.boolean(),
    timezone: z.string(),
    setupPending: z.boolean(),
  }),
  calendar: z
    .object({
      startsOn: z.string(),
      endsOn: z.string(),
      division: z.enum(divisionKinds).nullable(),
    })
    .nullable(),
  experience: z.enum(experiencePresets).nullable(),
  agreement: z
    .object({
      version: z.string(),
      signerName: z.string(),
      signerTitle: z.string(),
      acceptedAt: z.string(),
    })
    .nullable(),
  firstClass: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  /** The seats issued for this school that haven't ended. */
  license: z
    .object({
      seats: z.number().int(),
      startsOn: z.string(),
      endsOn: z.string(),
    })
    .nullable(),
});
export type SetupState = z.infer<typeof setupStateSchema>;

export const sessionResource = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  kind: z.enum(gradingKinds),
  name: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
  /** Set by a district above: shown, not edited here. */
  inherited: z.boolean(),
});
export type SessionResource = z.infer<typeof sessionResource>;

export const staffResource = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string().nullable(),
  roles: z.array(z.enum(staffRoles)),
  classIds: z.array(z.uuid()),
  status: z.enum(["active", "invited"]),
  /** Only an admin gets these; `null` when the invite has to be sent again. */
  inviteUrl: z.string().nullable().optional(),
  inviteExpiresAt: z.string().nullable().optional(),
  self: z.boolean(),
  /** The family's second parent (docs/families.md), not a co-teacher. */
  secondParent: z.literal(true).optional(),
});
export type StaffResource = z.infer<typeof staffResource>;

export const inviteViewSchema = z.object({
  status: z.enum(["open", "used", "expired", "ended"]),
  orgName: z.string(),
  role: z.enum(staffRoles),
  email: z.string().nullable(),
  /** The school's own admin, invited to set it up. */
  setup: z.boolean(),
  /** A family's second parent (docs/families.md), invited to its class. She
   * accepts with the address the invitation went to. */
  secondParent: z.object({ className: z.string() }).optional(),
});
export type InviteView = z.infer<typeof inviteViewSchema>;

export const licenseViewSchema = z.object({
  seats: z.number().int(),
  used: z.number().int(),
  available: z.number().int(),
  waiting: z.number().int(),
  license: z
    .object({
      id: z.uuid(),
      startsAt: z.string(),
      endsAt: z.string(),
      reference: z.string().nullable(),
      evaluation: z.boolean(),
    })
    .nullable(),
});
export type LicenseView = z.infer<typeof licenseViewSchema>;

export const planResultSchema = z.object({
  line: z.number().int(),
  status: z.enum(["new", "unchanged", "changed", "held"]),
  /** Why it is held: an ID that now names someone else, or a likely match. */
  reason: z.enum(["name_changed", "possible_match"]).optional(),
  /** The student already on the roster that this row was compared with. */
  existing: z.string().optional(),
  /** What would change, in words a person can check. */
  changes: z.array(z.string()).optional(),
});
export type PlanResult = z.infer<typeof planResultSchema>;
export const applyResultSchema = z.object({
  line: z.number().int(),
  status: z.enum(["created", "updated", "unchanged", "held", "failed"]),
  /** False: rostered and waiting for a seat. */
  seated: z.boolean().optional(),
  code: z.string().optional(),
});
export type ApplyResult = z.infer<typeof applyResultSchema>;
