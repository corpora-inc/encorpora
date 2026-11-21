import { z } from "zod";
import { areaIds, type AreaId } from "../curriculum/areas.js";
import { freeAllowanceSchema } from "../learning/free-allowance.js";
import {
  classSummary,
  progressRecordResource,
  todayStudentResource,
  todayTodoResource,
  todayResponse,
} from "../schools/today-contracts.js";

export const familyRoleSchema = z.enum([
  "holder",
  "second-parent",
  "co-teacher",
]);
const teachingPlace = z
  .object({
    classId: z.uuid(),
    displayName: z.string(),
    scope: z.literal("whole-class"),
    path: z.string(),
  })
  .nullable();
export const familyPlacesSchema = z.object({
  families: z.array(
    z.object({
      familyId: z.uuid(),
      displayName: z.string().nullable(),
      classId: z.uuid().nullable(),
      orgId: z.uuid().nullable(),
      role: familyRoleSchema,
      teachingPlace,
      capabilities: z.object({
        readFamily: z.boolean(),
        readTeaching: z.boolean(),
      }),
    }),
  ),
  next: z.uuid().nullable(),
});
export const familyChildCapabilitiesSchema = z.object({
  readProgress: z.boolean(),
  readWorkbooks: z.boolean(),
  createWorkbook: z.boolean(),
  recordWorkbook: z.boolean(),
  practiceHere: z.boolean(),
  continuePurchase: z.boolean(),
  purchase: z.boolean(),
  rename: z.boolean(),
  changeBirthYear: z.boolean(),
  changePracticeSettings: z.boolean(),
  manageConsent: z.boolean(),
  delete: z.boolean(),
  readGrades: z.boolean(),
  editGrades: z.boolean(),
  manageDevices: z.boolean(),
});
const today = z.object({
  date: z.string(),
  tasks: z.array(todayTodoResource),
  week: todayResponse.shape.week,
});
export const familyProjectionSchema = z.object({
  familyId: z.uuid(),
  displayName: z.string().nullable(),
  holderName: z.string().nullable(),
  role: z.enum(["holder", "second-parent"]),
  teachingPlace,
  capabilities: z.object({
    readFamily: z.boolean(),
    addChildren: z.boolean(),
    manageConsent: z.boolean(),
    manageBilling: z.boolean(),
    inviteSecondParent: z.boolean(),
    manageSecondParent: z.boolean(),
    readTeaching: z.boolean(),
  }),
  children: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      birthYear: z.number().nullable(),
      gradeLevel: z.number().nullable(),
      access: z.object({
        grants: z.array(
          z.object({
            channel: z.string(),
            status: z.string(),
            startsAt: z.string(),
            endsAt: z.string(),
          }),
        ),
        hasAccess: z.boolean(),
        canPractice: z.boolean(),
        learningAllowed: z.boolean(),
        freeAllowance: freeAllowanceSchema,
      }),
      week: z.object({
        minutes: z.number(),
        problems: z.number(),
        lastPracticed: z.string().nullable(),
      }),
      nextUp: z.object({
        kind: z.enum(["adaptive-practice", "access", "consent"]),
        learnerId: z.string(),
        task: todayTodoResource.nullable(),
      }),
      capabilities: familyChildCapabilitiesSchema,
      classes: z.array(
        z.object({
          id: z.uuid(),
          name: z.string(),
          orgId: z.uuid(),
          personId: z.uuid(),
          hostedByFamily: z.boolean(),
          canOpen: z.boolean(),
        }),
      ),
      paths: z.object({
        progress: z.string(),
        workbooks: z.string().nullable(),
        practiceHere: z.string().nullable(),
        continue: z.string().nullable(),
      }),
    }),
  ),
  today,
});
export const familyChildProgressSchema = progressRecordResource.extend({
  id: z.string(),
  name: z.string(),
});
export const familyChildTimeSchema = z.object({
  id: z.string(),
  name: z.string(),
  group: z.string(),
  joined: z.iso.date().nullable(),
  timezone: z.string(),
  period: z.enum(["week", "weeks", "term"]),
  range: z.object({ from: z.iso.date(), to: z.iso.date() }),
  minutes: z.number(),
  problems: z.number(),
  days: z.array(
    z.object({ day: z.iso.date(), minutes: z.number(), problems: z.number() }),
  ),
});
export type FamilyChildTime = z.infer<typeof familyChildTimeSchema>;
export const familyTeachingSchema = z.object({
  familyId: z.uuid(),
  place: z.literal("teaching"),
  scope: z.literal("whole-class"),
  class: classSummary,
  students: z.array(todayStudentResource),
  today,
  approvals: z.array(
    z.object({
      id: z.uuid(),
      personId: z.uuid().nullable(),
      status: z.enum([
        "waiting",
        "opened",
        "expired",
        "approved",
        "withdrawn",
        "paused",
        "ended",
      ]),
      expiresAt: z.string(),
      approvedAt: z.string().nullable(),
      endedAt: z.string().nullable(),
    }),
  ),
  coTeachers: z.array(
    z.object({
      id: z.uuid(),
      name: z.string().nullable(),
      role: z.enum(["teacher", "aide"]),
      status: z.enum(["active", "invited"]),
      secondParent: z.boolean(),
    }),
  ),
  capabilities: z.object({
    readClass: z.boolean(),
    readStaff: z.boolean(),
    readApprovals: z.boolean(),
    manageApprovals: z.boolean(),
    manageStaff: z.boolean(),
    manageDevices: z.boolean(),
    editGrades: z.boolean(),
    createWorkbooks: z.boolean(),
  }),
});
/** Why AMP picked a child's recent problems, as keys a screen words:
 * `catching-up` (a missed prerequisite, or a skill missed lately),
 * `reviewing` (a strong skill whose review is due), `checking-earlier` (a
 * check of the ground below the level), `new-ground` (at or past the
 * level), `chosen` (a skill an adult or the child picked). */
export const focusKeys = [
  "catching-up",
  "reviewing",
  "checking-earlier",
  "new-ground",
  "chosen",
] as const;
export type FocusKey = (typeof focusKeys)[number];
const skillRef = z.object({ id: z.string(), title: z.string() });
/** A level on the grade axis (K = 0 … Precalculus = 12): the best guess,
 * the likely range and the answers behind it. Numbers only; a screen
 * decides whether to name a grade (`gradeLevelShown`). */
const dashboardLevel = z.object({
  level: z.number(),
  low: z.number(),
  high: z.number(),
  answered: z.number().int().nonnegative(),
});
export const familyDashboardSchema = z.object({
  familyId: z.uuid(),
  /** The family's date, and the week so far (Monday through today). */
  today: z.iso.date(),
  week: z.object({ from: z.iso.date(), to: z.iso.date() }),
  /** How the children get in on their own devices, for a reader who may
   * manage them, while the family's class is open: the code as shown and
   * the app path it opens (`/join/ABC-234`). */
  join: z.object({ code: z.string(), path: z.string() }).nullable(),
  children: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      /** The parent's switch: whether this child's screens name grades. */
      gradeLevelShown: z.boolean(),
      week: z.object({
        days: z.number().int().nonnegative(),
        minutes: z.number(),
        problems: z.number().int().nonnegative(),
        correct: z.number().int().nonnegative(),
        independent: z.number().int().nonnegative(),
        lastPracticed: z.iso.date().nullable(),
      }),
      /** Every day of the week so far, oldest first, zeros included. */
      daily: z.array(
        z.object({
          day: z.iso.date(),
          minutes: z.number(),
          problems: z.number().int().nonnegative(),
        }),
      ),
      /** The overall level; null before the first answer. */
      level: dashboardLevel.nullable(),
      /** The five areas, always in `curriculum/areas.ts` order. */
      areas: z.array(
        z.object({
          area: z.enum(areaIds as [AreaId, ...AreaId[]]),
          title: z.string(),
          /** This area's own level; null before an answer in it. */
          level: dashboardLevel.nullable(),
          /** The skills of the whole grades just below the level (the
           * area's, else the overall one), each in one bucket. Null with no
           * level or nothing below it. */
          checked: z
            .object({
              /** Inclusive whole grades checked. */
              from: z.number().int(),
              to: z.number().int(),
              skills: z.number().int().nonnegative(),
              strong: z.number().int().nonnegative(),
              earned: z.number().int().nonnegative(),
              tried: z.number().int().nonnegative(),
              notAsked: z.number().int().nonnegative(),
              /** Not asked yet, nearest the level first. */
              nearestNotAsked: z.array(skillRef),
            })
            .nullable(),
        }),
      ),
      /** Why the last answered problems were picked. */
      focus: z.object({
        answered: z.number().int().nonnegative(),
        mix: z.array(
          z.object({
            key: z.enum(focusKeys),
            count: z.number().int().positive(),
            /** The skills behind it, most often first. */
            skills: z.array(skillRef),
          }),
        ),
      }),
    }),
  ),
});
export type FamilyDashboard = z.infer<typeof familyDashboardSchema>;
export type FamilyPlaces = z.infer<typeof familyPlacesSchema>;
export type FamilyProjection = z.infer<typeof familyProjectionSchema>;
export type FamilyTeaching = z.infer<typeof familyTeachingSchema>;
export type FamilyChildProgress = z.infer<typeof familyChildProgressSchema>;
