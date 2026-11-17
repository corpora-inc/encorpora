import { z } from "zod";
import { workItemResource } from "./skill-contracts.js";

/* A class's Today and one learner's progress record: what a family's
   projection reads (family/projection-contracts.ts), apart from the rest of
   teacher-contracts.ts, which re-exports them. */

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
/** A person as the teacher's screens name them. */
export const person = z.object({ id, name: z.string() });

export const estimateResource = z.object({
  level: z.number(),
  sd: z.number(),
  /** The likely range (`Estimate.low`/`high`), where it was stored. */
  low: z.number().optional(),
  high: z.number().optional(),
  /** Answers behind it (the overall estimate): none means not measured
   * yet (`measured`, learning/level-check.ts). */
  answered: z.number().int().nonnegative().optional(),
});
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
  /** A shared gap can also go on paper: this skill, for these students. */
  groupSheet: z.object({ skillId: z.string(), label: z.string() }).optional(),
  /** How this item is decided, in one sentence. */
  rule: z.string().optional(),
  /** "Keeps missing": each student's latest miss on the skill, to replay. */
  misses: z
    .array(z.object({ personId: id, attempt: z.string(), skillId: z.string() }))
    .optional(),
});
export type TodayTodo = z.infer<typeof todayTodoResource>;
/** One student's day at a glance: where they work and what they did today. */
export const todayStudentResource = z.object({
  id,
  /** Only in a family's class, where the reader's own children are matched
   * to their learners (practice here, access). */
  learnerId: z.string().optional(),
  name: z.string(),
  gradeLevel: z.number().nullable(),
  /** Null until there is work to estimate from. */
  level: estimateResource.nullable(),
  /** So little work yet that the estimate is mostly a starting guess. */
  provisional: z.boolean(),
  todayMinutes: z.number(),
  todayProblems: z.number(),
  weekMinutes: z.number(),
  weekProblems: z.number(),
  /** The latest day with any practice in the last five weeks. */
  lastActive: day.nullable().default(null),
});
export type TodayStudentResource = z.infer<typeof todayStudentResource>;
export const todayResponse = z.object({
  class: classSummary,
  /** A family's class, whose screens speak to a parent. */
  family: z.boolean().default(false),
  students: z.array(todayStudentResource).default([]),
  /** Minutes a week each learner aims for; null when none is set. */
  weeklyTargetMinutes: z.number().nullable().default(null),
  teacherName: z.string().nullable(),
  /** This person can print workbooks for the class. */
  canPrint: z.boolean(),
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

/** One learner's own progress as a record shows it: the part of a student
 * record an adult's own record shares (`readProgress`). */
export const progressRecordResource = z.object({
  level: studentLevelResource.nullable(),
  reference: z.object({ from: z.number(), to: z.number() }).nullable(),
  strands: z.array(strandResource),
  weeks: z.array(z.object({ week: day, minutes: z.number() })),
  /** Every skill earned, ever (learning/earned.ts): on a record that lists
   * them all (a family's child, an adult's own), the count Pathways shows.
   * A teacher's record counts objectives as a grade does, and omits it. */
  earned: z.number().int().nonnegative().optional(),
  objectives: z.array(
    z.object({
      skillId: z.string(),
      title: z.string(),
      strand: z.string(),
      day,
    }),
  ),
  work: z.array(workItemResource),
});
export type ProgressRecord = z.infer<typeof progressRecordResource>;
