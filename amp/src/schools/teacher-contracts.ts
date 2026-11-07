import { z } from "zod";

/* What the teacher's screens read: the reference for these routes, and what the
   client checks every response against. */
const day = z.iso.date();
const id = z.uuid();

export const classTabIds = [
  "today",
  "map",
  "gradebook",
  "time",
  "roster",
  "settings",
] as const;
export type ClassTabId = (typeof classTabIds)[number];

export const courseResource = z.object({
  label: z.string(),
  level: z.number(),
  from: z.number(),
  to: z.number(),
});
export type CourseResource = z.infer<typeof courseResource>;
export const classSummary = z.object({
  id,
  orgId: id,
  name: z.string(),
  orgName: z.string(),
  /** Null: each student is graded against their own grade. */
  course: courseResource.nullable(),
});
export type ClassSummary = z.infer<typeof classSummary>;
const person = z.object({ id, name: z.string() });

export const estimateResource = z.object({ level: z.number(), sd: z.number() });
export const studentLevelResource = z.object({
  overall: estimateResource,
  strands: z.record(z.string(), estimateResource),
});
export type StudentLevelResource = z.infer<typeof studentLevelResource>;

const todoAction = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("lesson"),
    templateId: z.string(),
    skillId: z.string(),
    label: z.string(),
  }),
  z.object({
    kind: z.literal("skill"),
    skillId: z.string(),
    label: z.string(),
  }),
  z.object({
    kind: z.literal("student"),
    personId: id,
    label: z.string(),
  }),
  z.object({
    kind: z.literal("tab"),
    tab: z.enum(["map", "time", "start", "settings"]),
    label: z.string(),
  }),
]);
export const todayTodoResource = z.object({
  /** Stable for the day, so checking it off survives a reload. */
  id: z.string(),
  kind: z.enum([
    "shared-gap",
    "stuck",
    "no-practice",
    "ready",
    "good-day",
    "start",
  ]),
  title: z.string(),
  detail: z.string(),
  students: z.array(person),
  action: todoAction,
});
export type TodayTodo = z.infer<typeof todayTodoResource>;
export const todayResponse = z.object({
  class: classSummary,
  teacherName: z.string().nullable(),
  today: day,
  partOfDay: z.enum(["morning", "afternoon", "evening"]),
  todos: z.array(todayTodoResource),
  week: z.object({
    from: day,
    minutes: z.number(),
    problems: z.number(),
    skills: z.number(),
    objectives: z.number(),
    working: z.number(),
    students: z.number(),
  }),
});
export type TodayResponse = z.infer<typeof todayResponse>;

export const strandResource = z.object({ id: z.string(), label: z.string() });
export const mapStudentResource = z.object({
  id,
  name: z.string(),
  first: z.string(),
  gradeLevel: z.number().nullable(),
  /** Null until there is work to estimate from. */
  level: studentLevelResource.nullable(),
  /** So little work yet that the estimate is mostly a starting guess. */
  provisional: z.boolean(),
  /** The ground this student is graded against; null when there isn't any. */
  reference: z.object({ from: z.number(), to: z.number() }).nullable(),
});
export type MapStudent = z.infer<typeof mapStudentResource>;
export const mapResponse = z.object({
  class: classSummary,
  /** Most evidence first. */
  strands: z.array(strandResource),
  students: z.array(mapStudentResource),
});
export type MapResponse = z.infer<typeof mapResponse>;

export const termResource = z.object({
  id,
  name: z.string(),
  startsOn: day,
  endsOn: day,
  state: z.enum(["upcoming", "open", "closed"]),
});
export type TermResource = z.infer<typeof termResource>;
const componentId = z.enum(["course", "growth", "practice", "retention"]);
export const suggestionResource = z.object({
  status: z.enum(["ready", "not-enough-work"]),
  low: z.number().nullable(),
  high: z.number().nullable(),
  /** "B to A−"; null without enough work. */
  letters: z.string().nullable(),
  components: z.array(
    z.object({ id: componentId, score: z.number().nullable() }),
  ),
});
export type SuggestionResource = z.infer<typeof suggestionResource>;
export const gradeRowResource = z.object({
  id,
  name: z.string(),
  first: z.string(),
  identifier: z.string().nullable(),
  suggestion: suggestionResource,
  final: z.string().nullable(),
});
export type GradeRow = z.infer<typeof gradeRowResource>;
export const gradebookResponse = z.object({
  class: classSummary,
  terms: z.array(termResource),
  term: termResource.nullable(),
  weeklyTargetMinutes: z.number().nullable(),
  /** Set above this class, so it can't be changed here. */
  targetLocked: z.boolean(),
  canEdit: z.boolean(),
  students: z.array(gradeRowResource),
});
export type GradebookResponse = z.infer<typeof gradebookResponse>;

export const workResultIds = [
  "independent",
  "hint",
  "missed",
  "paper",
] as const;
export const workItemResource = z.object({
  id: z.string(),
  day,
  prompt: z.string(),
  answer: z.string().nullable(),
  response: z.string().nullable(),
  result: z.enum(workResultIds),
  review: z.boolean(),
  skill: z.string(),
  strand: z.string(),
});
export type WorkItem = z.infer<typeof workItemResource>;
export const evidenceResponse = z.object({
  student: person.extend({ first: z.string() }),
  class: classSummary,
  term: termResource,
  canEdit: z.boolean(),
  final: z.string().nullable(),
  suggestion: suggestionResource,
  /** "Why a B?" */
  question: z.string(),
  lines: z.array(
    z.object({
      id: componentId,
      label: z.string(),
      weight: z.number(),
      score: z.number().nullable(),
      sentence: z.string(),
    }),
  ),
  /** When a student came or left inside the term; what counted starts there. */
  joined: day.nullable(),
  left: day.nullable(),
  objectives: z.array(
    z.object({
      skillId: z.string(),
      title: z.string(),
      strand: z.string(),
      day,
    }),
  ),
  work: z.array(workItemResource),
  nextOffset: z.number().nullable(),
});
export type EvidenceResponse = z.infer<typeof evidenceResponse>;

export const timePeriods = ["week", "month", "term"] as const;
export type TimePeriod = (typeof timePeriods)[number];
export const timeResponse = z.object({
  class: classSummary,
  period: z.enum(timePeriods),
  range: z.object({ from: day, to: day }),
  /** Each Monday in the range. */
  weeks: z.array(day),
  weeklyTargetMinutes: z.number().nullable(),
  students: z.array(
    z.object({
      id,
      name: z.string(),
      first: z.string(),
      minutes: z.number(),
      problems: z.number(),
      days: z.array(z.object({ day, minutes: z.number() })),
    }),
  ),
  skills: z.array(
    z.object({
      skillId: z.string(),
      title: z.string(),
      strand: z.string(),
      minutes: z.number(),
      problems: z.number(),
    }),
  ),
});
export type TimeResponse = z.infer<typeof timeResponse>;
export const studentTimeResponse = z.object({
  student: person.extend({ first: z.string() }),
  range: z.object({ from: day, to: day }),
  days: z.array(z.object({ day, minutes: z.number(), problems: z.number() })),
  skills: z.array(
    z.object({
      skillId: z.string(),
      title: z.string(),
      strand: z.string(),
      minutes: z.number(),
      problems: z.number(),
    }),
  ),
});
export type StudentTimeResponse = z.infer<typeof studentTimeResponse>;

export const reportCardsResponse = z.object({
  school: z.string(),
  class: z.object({ name: z.string(), course: z.string() }),
  term: termResource,
  teachers: z.array(z.string()),
  students: z.array(
    z.object({
      id,
      name: z.string(),
      identifier: z.string().nullable(),
      final: z.string().nullable(),
      minutes: z.number(),
      objectivesGained: z.number(),
      /** The likely range of the working level at the end of the term. */
      levelFrom: z.number().nullable(),
      levelTo: z.number().nullable(),
    }),
  ),
});
export type ReportCardsResponse = z.infer<typeof reportCardsResponse>;

export const studentRecordResponse = z.object({
  student: person.extend({
    first: z.string(),
    gradeLevel: z.number().nullable(),
    identifier: z.string().nullable(),
  }),
  orgName: z.string(),
  classes: z.array(
    z.object({ id, name: z.string(), course: courseResource.nullable() }),
  ),
  level: studentLevelResource.nullable(),
  reference: z.object({ from: z.number(), to: z.number() }).nullable(),
  strands: z.array(strandResource),
  grades: z.array(
    z.object({
      classId: id,
      className: z.string(),
      termId: id,
      termName: z.string(),
      state: z.enum(["open", "closed"]),
      suggestion: suggestionResource,
      final: z.string().nullable(),
    }),
  ),
  weeks: z.array(z.object({ week: day, minutes: z.number() })),
  objectives: z.array(
    z.object({
      skillId: z.string(),
      title: z.string(),
      strand: z.string(),
      day,
    }),
  ),
  work: z.array(workItemResource),
  signIn: z.object({
    cardIssuedAt: z.string().nullable(),
    picturesSet: z.boolean(),
    locked: z.boolean(),
    activeSessions: z.number(),
    lastSeenAt: z.string().nullable(),
  }),
});
export type StudentRecordResponse = z.infer<typeof studentRecordResponse>;

/** A final grade as a teacher writes it: B+, 87, 3, Pass. Empty clears it. */
export const finalGradeSchema = z.strictObject({
  term: id,
  value: z
    .string()
    .trim()
    .max(24)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
});
export const closeTermSchema = z.strictObject({ term: id });
export const weeklyTargetSchema = z.strictObject({
  minutes: z.number().int().min(1).max(10_080).nullable(),
});
export const gradebookQuerySchema = z.strictObject({ term: id.optional() });
export const evidenceQuerySchema = z.strictObject({
  term: id,
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});
export const timeQuerySchema = z.strictObject({
  period: z.enum(timePeriods).default("month"),
});
export const gradebookColumns = [
  "sis",
  "name",
  "final",
  "low",
  "high",
  "course",
  "growth",
  "practice",
  "retention",
  "minutes",
] as const;
export type GradebookColumn = (typeof gradebookColumns)[number];
export const gradebookExportSchema = z.strictObject({
  term: id,
  /** Comma-separated, in the order wanted; every column when absent. */
  columns: z
    .string()
    .max(200)
    .transform((value, ctx) => {
      const columns = value.split(",").filter(Boolean);
      if (
        !columns.length ||
        new Set(columns).size !== columns.length ||
        !columns.every((column) =>
          (gradebookColumns as readonly string[]).includes(column),
        )
      ) {
        ctx.addIssue({ code: "custom", message: "columns" });
        return z.NEVER;
      }
      return columns as GradebookColumn[];
    })
    .optional(),
});
export const oneRosterExportSchema = z.strictObject({ term: id });
