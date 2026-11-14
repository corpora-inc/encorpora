import { z } from "zod";
import { freeAllowanceSchema } from "../learning/free-allowance.js";
import {
  classSummary,
  progressRecordResource,
  todayStudentResource,
  todayTodoResource,
  todayResponse,
} from "../schools/teacher-contracts.js";

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
export type FamilyPlaces = z.infer<typeof familyPlacesSchema>;
export type FamilyProjection = z.infer<typeof familyProjectionSchema>;
export type FamilyTeaching = z.infer<typeof familyTeachingSchema>;
export type FamilyChildProgress = z.infer<typeof familyChildProgressSchema>;
