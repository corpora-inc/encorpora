import { z } from "zod";
import { divisionKinds, isIsoDate } from "./calendar.js";
import {
  gradeLevelSchema,
  orgKinds,
  ssoProviders,
  timezone,
} from "./contracts.js";

const isoDate = z.string().refine(isIsoDate);
const count = z.number().int().min(0);

/* The overview. */
export const usageResource = z.object({
  students: count,
  active: count,
  minutes: count,
  /** Median grades gained this term among placed students, either sign. */
  growth: z.number().nullable(),
  /** How many placed students that median is over. */
  placed: count.default(0),
});
export const attentionAction = z.object({
  label: z.string(),
  /** The org this opens, which in a district is often a school. */
  org: z.uuid(),
  /** After `/school/<org>`; empty for its overview. */
  path: z.string(),
  search: z.record(z.string(), z.string()).optional(),
});
export const attentionItem = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  action: attentionAction,
  /** How this is decided, in one sentence. */
  rule: z.string().optional(),
});
export const standingBin = z.object({
  /** Grades from the student's own, low edge. Null: everything below `to`. */
  from: z.number().nullable(),
  /** High edge. Null: everything at or above `from`. */
  to: z.number().nullable(),
  students: count,
});
export const overviewResponse = z.object({
  org: z.object({
    id: z.uuid(),
    name: z.string(),
    kind: z.enum(orgKinds),
    timezone: z.string(),
  }),
  today: z.string(),
  partOfDay: z.enum(["morning", "afternoon", "evening"]),
  personName: z.string().nullable(),
  term: z.object({
    name: z.string(),
    startsOn: z.string(),
    endsOn: z.string(),
  }),
  seats: z.object({
    seats: count,
    used: count,
    waiting: count,
    startsAt: z.string().nullable(),
    endsAt: z.string().nullable(),
    evaluation: z.boolean(),
    /** Set when the seats are a pool held above this school. */
    sharedWith: z.string().nullable(),
  }),
  week: z.object({
    students: count,
    active: count,
    minutes: count,
    lastActive: count,
    lastMinutes: count,
  }),
  trend: z.array(
    z.object({
      week: z.string(),
      minutes: count,
      /** Practiced that week (`practice-rules.ts`). */
      students: count,
      /** Problems answered, and of those, with a hint or lesson. */
      problems: count.default(0),
      assisted: count.default(0),
    }),
  ),
  standing: z.object({
    bins: z.array(standingBin),
    behind: count,
    at: count,
    ahead: count,
    /** Rostered with no grade on file, or fewer answers than placement. */
    unplaced: count,
  }),
  classes: z
    .array(
      usageResource.extend({
        id: z.uuid(),
        name: z.string(),
        teachers: z.array(z.string()),
      }),
    )
    .nullable(),
  schools: z
    .array(
      usageResource.extend({
        id: z.uuid(),
        name: z.string(),
        classes: count,
      }),
    )
    .nullable(),
  attention: z.array(attentionItem),
});
export type OverviewResponse = z.infer<typeof overviewResponse>;
export type AttentionItem = z.infer<typeof attentionItem>;
export type SchoolUsage = NonNullable<OverviewResponse["schools"]>[number];
export type ClassUsage = NonNullable<OverviewResponse["classes"]>[number];

export const schoolsResponse = z.object({
  schools: z.array(
    usageResource.extend({ id: z.uuid(), name: z.string(), classes: count }),
  ),
  /** A district timezone to start a new school from. */
  timezone: z.string(),
});
export const addSchoolSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  timezone,
});

export const yearsResponse = z.object({
  years: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      startsOn: z.string(),
      endsOn: z.string(),
      inUse: z.boolean(),
    }),
  ),
});
export type YearsResponse = z.infer<typeof yearsResponse>;
export const classesQuerySchema = z.object({
  year: z.uuid().optional().catch(undefined),
});
export const studentsQuerySchema = z.object({
  status: z.enum(["needs-seat", "never-signed-in"]).optional().catch(undefined),
});

/* Year rollover. */
export const rolloverOptionsResponse = z.object({
  current: z
    .object({
      id: z.uuid(),
      name: z.string(),
      startsOn: z.string(),
      endsOn: z.string(),
    })
    .nullable(),
  suggested: z.object({
    startsOn: z.string(),
    endsOn: z.string(),
    division: z.enum(divisionKinds).nullable(),
  }),
  classes: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      school: z.string(),
      teachers: z.array(z.string()),
      students: count,
    }),
  ),
  schools: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      grades: z.array(z.object({ grade: gradeLevelSchema, students: count })),
      /** The highest grade here: who most likely leaves. */
      graduating: gradeLevelSchema.nullable(),
    }),
  ),
});
export type RolloverOptions = z.infer<typeof rolloverOptionsResponse>;
export const rolloverSchema = z
  .strictObject({
    startsOn: isoDate,
    endsOn: isoDate,
    division: z.enum(divisionKinds).nullable(),
    classIds: z.array(z.uuid()).max(5000),
    /** Students come along into the new copy of each class. */
    keepStudents: z.boolean(),
    /** Per school, the grade that finishes this year; null means nobody does. */
    graduating: z.record(z.uuid(), gradeLevelSchema.nullable()),
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
export type RolloverInput = z.infer<typeof rolloverSchema>;
export const rolloverResponse = z.object({
  applied: z.boolean(),
  /** This same year was already rolled over; nothing changed this time. */
  alreadyDone: z.boolean(),
  year: z.object({
    id: z.uuid(),
    name: z.string(),
    startsOn: z.string(),
    endsOn: z.string(),
  }),
  terms: z.array(
    z.object({ name: z.string(), startsOn: z.string(), endsOn: z.string() }),
  ),
  classes: count,
  teachers: count,
  moved: count,
  advanced: count,
  advancing: z.array(
    z.object({
      from: gradeLevelSchema,
      to: gradeLevelSchema,
      students: count,
    }),
  ),
  graduated: count,
  graduates: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      grade: gradeLevelSchema,
      school: z.string(),
    }),
  ),
  /** The year still has days to run when this is confirmed. */
  yearRunning: z.boolean(),
  /** Classes whose terms were never closed, so their grades aren't frozen. */
  openClasses: count,
});
export type RolloverResult = z.infer<typeof rolloverResponse>;

/* Campus transfer. */
export const seatOutcomes = ["stays", "moves", "needs"] as const;
export const transferOptionsResponse = z.object({
  from: z.object({ id: z.uuid(), name: z.string() }),
  schools: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      /** What happens to the student's seat in this move, as of now. */
      seat: z.enum(seatOutcomes),
    }),
  ),
});
export type TransferOptions = z.infer<typeof transferOptionsResponse>;
export const transferSchema = z.strictObject({
  to: z.uuid(),
  /** A class at the new school, if the admin picked one in the same move. */
  classId: z.uuid().optional(),
});
export const transferResponse = z.object({
  to: z.object({ id: z.uuid(), name: z.string() }),
  seat: z.enum(seatOutcomes),
});

/* Integrations. */
export const integrationRequests = [
  "clever",
  "classlink",
  "google-classroom",
] as const;
export type IntegrationRequest = (typeof integrationRequests)[number];
export const integrationsResponse = z.object({
  rostered: count,
  classes: count,
  firstClass: z.uuid().nullable(),
  providers: z.array(
    z.object({
      id: z.enum(ssoProviders),
      /** This deployment has the client; otherwise it's "set this up with us". */
      available: z.boolean(),
      on: z.boolean(),
      schoolsOn: count,
      schools: count,
      /** Students who can sign in this way once it's on. */
      eligible: count,
      noEmail: count,
      sharedEmail: count,
      requestedAt: z.string().nullable(),
    }),
  ),
  requests: z.array(
    z.object({
      id: z.enum(integrationRequests),
      requestedAt: z.string().nullable(),
    }),
  ),
});
export type IntegrationsResponse = z.infer<typeof integrationsResponse>;
export const setProviderSchema = z.strictObject({
  provider: z.enum(ssoProviders),
  enabled: z.boolean(),
});
export const requestIntegrationSchema = z.strictObject({
  id: z.enum([...integrationRequests, ...ssoProviders]),
});

/* Privacy. */
export const privacyResponse = z.object({
  agreement: z
    .object({
      version: z.string(),
      signerName: z.string(),
      signerTitle: z.string(),
      acceptedAt: z.string(),
      /** The org that signed it, when that's one above this one. */
      signedBy: z.string().nullable(),
    })
    .nullable(),
  students: count,
  schools: z.array(z.object({ id: z.uuid(), name: z.string() })),
  /** A whole-school deletion that began and hasn't finished. */
  erasing: z.object({ startedAt: z.string(), remaining: count }).nullable(),
});
export type PrivacyResponse = z.infer<typeof privacyResponse>;
export const eraseSchema = z.strictObject({
  /** The school's name, typed. */
  confirm: z.string().trim().min(1).max(200),
});
export const eraseResponse = z.object({
  removed: count,
  remaining: count,
});
export type EraseResponse = z.infer<typeof eraseResponse>;

/* Activity. */
export const activityKinds = [
  "grades",
  "students",
  "classes",
  "staff",
  "sign-in",
  "calendar",
  "license",
  "privacy",
] as const;
export type ActivityKind = (typeof activityKinds)[number];
export const activityQuerySchema = z.object({
  before: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z_[0-9a-f-]{36}$/)
    .optional()
    .catch(undefined),
  person: z.uuid().optional().catch(undefined),
  kind: z.enum(activityKinds).optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
});
export type ActivityQuery = z.infer<typeof activityQuerySchema>;
export const activityResponse = z.object({
  events: z.array(
    z.object({
      id: z.uuid(),
      at: z.string(),
      /** The day and time at the school, already in its timezone. */
      day: z.string(),
      time: z.string(),
      sentence: z.string(),
    }),
  ),
  next: z.string().nullable(),
  /** Who the person filter names, so the screen can say so. */
  person: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});
export type ActivityResponse = z.infer<typeof activityResponse>;
export const activityPeopleSchema = z.strictObject({
  q: z.string().trim().min(1).max(80),
});
export const activityPeopleResponse = z.object({
  people: z.array(
    z.object({ id: z.uuid(), name: z.string(), role: z.string() }),
  ),
});
