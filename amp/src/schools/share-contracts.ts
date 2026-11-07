import { z } from "zod";
import { strandResource, studentLevelResource } from "./teacher-contracts.js";

/** The API shapes of the public school pages and a family's progress link.
 * Shared by the routes and their screens. */
const day = z.iso.date();

/* The curriculum, as the public pages show it. */
const strandRun = z.object({ strand: z.string(), objectives: z.number() });
export const curriculumLevelSummary = z.object({
  id: z.string(),
  label: z.string(),
  objectives: z.number(),
  problemTypes: z.number(),
  /** The level's objectives in order, grouped by strand. */
  strands: z.array(strandRun),
});
export const curriculumSummaryResource = z.object({
  objectives: z.number(),
  problemTypes: z.number(),
  lessons: z.number(),
  levels: z.array(curriculumLevelSummary),
});
export type CurriculumSummary = z.infer<typeof curriculumSummaryResource>;
export const scopeObjective = z.object({
  id: z.string(),
  strand: z.string(),
  strandLabel: z.string(),
  title: z.string(),
  standards: z.array(z.string()),
  prerequisites: z.array(z.string()),
});
export type ScopeObjective = z.infer<typeof scopeObjective>;
export const scopeLevel = curriculumLevelSummary.extend({
  rows: z.array(scopeObjective),
});
export type ScopeLevel = z.infer<typeof scopeLevel>;
export const scopeResource = z.object({
  title: z.string(),
  lead: z.string(),
  points: z.array(z.string()),
  objectives: z.number(),
  problemTypes: z.number(),
  lessons: z.number(),
  levels: z.array(scopeLevel),
});
export type ScopeAndSequence = z.infer<typeof scopeResource>;

/* A family's read-only link. */
export const shareTokenSchema = z.strictObject({
  token: z.string().max(200),
});
export const shareStateResource = z.object({
  /** This person can make, copy and revoke the link. */
  canManage: z.boolean(),
  /** The student is in a class, so a link would show something. */
  available: z.boolean(),
  /** Only ever sent to someone who can manage it. */
  link: z
    .object({
      url: z.string(),
      createdAt: z.string(),
      expiresAt: z.string().nullable(),
    })
    .nullable(),
});
export type ShareState = z.infer<typeof shareStateResource>;

/** What a family sees: one student, read-only, and nothing about anyone else. */
export const parentViewResource = z.object({
  student: z.object({ name: z.string(), first: z.string() }),
  schoolName: z.string(),
  classes: z.array(z.string()),
  level: studentLevelResource.nullable(),
  /** Where the class's course, or the student's grade, sits on the chart. */
  reference: z.object({ from: z.number(), to: z.number() }).nullable(),
  strands: z.array(strandResource),
  term: z
    .object({
      name: z.string(),
      startsOn: day,
      activeMinutes: z.number(),
      objectives: z.number(),
    })
    .nullable(),
  objectives: z.array(z.object({ title: z.string(), strand: z.string(), day })),
  /** Only grades a teacher has entered. A suggestion never shows here. */
  grades: z.array(
    z.object({
      className: z.string(),
      termName: z.string(),
      final: z.string(),
    }),
  ),
});
export type ParentView = z.infer<typeof parentViewResource>;
