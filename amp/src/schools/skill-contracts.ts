import { z } from "zod";

/* A student's answers and their counts on one skill: what a skill layer
   reads (nav/SkillLayer, lib/learning-view.ts). Kept apart from
   teacher-contracts.ts, which re-exports them, so the app's entry carries
   only these. */

const day = z.iso.date();

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
