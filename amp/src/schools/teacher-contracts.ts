import { z } from "zod";
import { gradeCurveSchema, isValidCurve } from "./grade-curve.js";
import { helpWeekResource } from "./help-contracts.js";

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
  /** With no level stored yet: the starting estimate the learner's own view
   * shows (`startingShown`). */
  start: z.object({ level: z.number(), sd: z.number() }).nullable().optional(),
});
export type MapStudent = z.infer<typeof mapStudentResource>;
/** A teacher of the class who practices themselves (docs/families.md): a line
 * on the map, marked as the teacher, never one of its students. */
export const mapTeacherResource = z.object({
  id,
  name: z.string(),
  first: z.string(),
  /** The line is the reader's own, so it opens their own record. */
  you: z.boolean(),
  level: studentLevelResource.nullable(),
  provisional: z.boolean(),
  /** This class's course, when it has one. */
  reference: z.object({ from: z.number(), to: z.number() }).nullable(),
  start: z.object({ level: z.number(), sd: z.number() }).nullable().optional(),
});
export type MapTeacher = z.infer<typeof mapTeacherResource>;
export const mapResponse = z.object({
  class: classSummary,
  /** Most evidence first, from the students' work alone. */
  strands: z.array(strandResource),
  students: z.array(mapStudentResource),
  teachers: z.array(mapTeacherResource).default([]),
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
  /** "facts-only": enough work, and nothing to measure a letter against. */
  status: z.enum(["ready", "not-enough-work", "facts-only"]),
  low: z.number().nullable(),
  high: z.number().nullable(),
  /** "B to A−"; null without enough work. */
  letters: z.string().nullable(),
  components: z.array(
    z.object({ id: componentId, score: z.number().nullable() }),
  ),
  /** Set by the teacher's curve: the 80% interval of the student's place, and
   * the share of draws at each letter. */
  curve: z
    .object({
      ranked: z.number(),
      rankLow: z.number(),
      rankHigh: z.number(),
      letters: z.object({
        A: z.number(),
        B: z.number(),
        C: z.number(),
        D: z.number(),
        F: z.number(),
      }),
    })
    .nullable()
    .default(null),
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
  /** The class set its own; otherwise it follows `inheritedTargetMinutes`. */
  targetOwn: z.boolean().default(false),
  inheritedTargetMinutes: z.number().nullable().default(null),
  canEdit: z.boolean(),
  students: z.array(gradeRowResource),
  /** The teacher's curve for this term (frozen with a closed one), and a
   * starting curve from the class's own work for the whole roster. */
  curve: z
    .object({
      own: gradeCurveSchema.nullable(),
      proposed: gradeCurveSchema,
      /** How many students the standard scale puts at each letter now. */
      standard: z.object({
        A: z.number(),
        B: z.number(),
        C: z.number(),
        D: z.number(),
        F: z.number(),
      }),
    })
    .nullable()
    .default(null),
});
export type GradebookResponse = z.infer<typeof gradebookResponse>;

export const workResultIds = [
  "independent",
  "hint",
  "missed",
  "paper",
] as const;
export const workItemResource = z.object({
  /** The attempt's id: where its replay lives (`work/<id>`). */
  id: z.string(),
  day,
  /** When it was answered (ISO). */
  at: z.string(),
  prompt: z.string(),
  answer: z.string().nullable(),
  response: z.string().nullable(),
  result: z.enum(workResultIds),
  review: z.boolean(),
  skill: z.string(),
  strand: z.string(),
});
export type WorkItem = z.infer<typeof workItemResource>;
export const answerHelpKinds = [
  "hint",
  "lesson",
  "video",
  "example",
  "person",
] as const;
/** One answer replayed as the student saw it (`work-replay.ts`): the served
 * problem for the practice renderer, the answer marked as after Check, and
 * what surrounded it. Staff who can read the student, and a family's parent,
 * read it; a student never does. */
export const workReplayResponse = z.object({
  student: z.object({ id, first: z.string() }),
  item: workItemResource,
  skillId: z.string(),
  /** The problem as it was served (`served`), rebuilt from its template,
   * version and seed when the stored copy is incomplete (`rebuilt`), or not
   * drawable at all (`unavailable`): then only `item`'s text is shown. */
  source: z.enum(["served", "rebuilt", "unavailable"]),
  /** A `PublicProblem`, checked by the renderer's own types. */
  problem: z.record(z.string(), z.unknown()).nullable(),
  /** Where the problem came from: its template, version and seed, and a
   * digest of what was drawn. Null when the stored attempt lacks them. */
  origin: z
    .object({
      templateId: z.string(),
      version: z.number().nullable(),
      seed: z.string(),
      digest: z.string(),
    })
    .nullable(),
  outcome: z.object({
    correct: z.boolean(),
    assisted: z.boolean(),
    response: z.string(),
    answer: z.string(),
    explanation: z.array(z.string()),
    parts: z.array(z.boolean()).optional(),
    /** A paper mark entered by an adult, not an answer in the app. */
    paper: z.boolean(),
  }),
  /** The help this answer had; null for answers stored before it was
   * recorded. */
  help: z.array(z.enum(answerHelpKinds)).nullable(),
  /** Seconds since the student's answer before, when that was in the same
   * sitting; null otherwise. */
  seconds: z.number().nullable(),
  /** Every answer to this same problem (template and seed), oldest first. */
  tries: z.array(
    z.object({ id: z.string(), at: z.string(), result: z.enum(workResultIds) }),
  ),
  /** The student's answer before and after this one (in `skill` when the
   * replay is narrowed to one skill). */
  previous: z.string().nullable(),
  next: z.string().nullable(),
  /** The skill's lesson on Pathways, with this problem type's short lesson
   * when it has one. */
  lesson: z.object({ skillId: z.string(), templateId: z.string().nullable() }),
});
export type WorkReplayResponse = z.infer<typeof workReplayResponse>;
export const evidenceResponse = z.object({
  student: person.extend({ first: z.string() }),
  class: classSummary,
  term: termResource,
  canEdit: z.boolean(),
  final: z.string().nullable(),
  suggestion: suggestionResource,
  /** "Why a B?" */
  question: z.string(),
  /** Where the teacher's curve put the student, in one sentence. */
  basis: z.string().nullable().default(null),
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
  /** Help the class used, a week at a time (`help-events.ts`). */
  help: z.array(helpWeekResource),
  students: z.array(
    z.object({
      id,
      name: z.string(),
      first: z.string(),
      minutes: z.number(),
      problems: z.number(),
      /** In this class over these days: before `from`, not on its roster. */
      from: day.optional(),
      to: day.optional(),
      days: z.array(
        z.object({ day, minutes: z.number(), problems: z.number().default(0) }),
      ),
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

/** One learner's own progress as a record shows it: the part of a student
 * record an adult's own record shares (`readProgress`). */
export const progressRecordResource = z.object({
  level: studentLevelResource.nullable(),
  reference: z.object({ from: z.number(), to: z.number() }).nullable(),
  strands: z.array(strandResource),
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
});
export type ProgressRecord = z.infer<typeof progressRecordResource>;
export const studentRecordResponse = progressRecordResource.extend({
  student: person.extend({
    first: z.string(),
    gradeLevel: z.number().nullable(),
    identifier: z.string().nullable(),
  }),
  orgName: z.string(),
  classes: z.array(
    z.object({ id, name: z.string(), course: courseResource.nullable() }),
  ),
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
  /** Help the student used over the record's 12 weeks. */
  help: z.array(helpWeekResource),
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
/** A curve for one open term, or null for the standard scale. */
export const gradeCurveWriteSchema = z.strictObject({
  term: id,
  curve: gradeCurveSchema
    .refine(isValidCurve, { message: "The ranges can't hold the class" })
    .nullable(),
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

/** One skill's evidence, the way a skill layer reads it (nav/SkillLayer):
 * the counts the engine keeps per learner and skill. */
export const skillEvidenceResource = z.object({
  attempts: z.number(),
  independentCorrect: z.number(),
  /** The engine's status for the skill ("new" before any work). */
  status: z.string(),
  lastPracticedAt: z.string().nullable(),
});
/** A student on one skill: the counts and their latest answers on it. */
export const studentSkillResponse = z.object({
  skillId: z.string(),
  evidence: skillEvidenceResource,
  work: z.array(workItemResource),
});
export type StudentSkillResponse = z.infer<typeof studentSkillResponse>;
/** A class on one skill: each student's counts, in roster order. */
export const classSkillResponse = z.object({
  skillId: z.string(),
  students: z.array(
    z.object({
      id,
      name: z.string(),
      first: z.string(),
      evidence: skillEvidenceResource,
    }),
  ),
});
export type ClassSkillResponse = z.infer<typeof classSkillResponse>;
