/**
 * Lazy runtime for AI-authored activities: prompt, batch validation, restore verification and
 * local grading. Loaded with `import('./aiActivities')` only on the signed-in AI path or when
 * stored AI evidence must be verified, so local-practice startup does not pay for zod or the
 * activity grammar.
 *
 * Trust: the model's text is untrusted. An activity reaches the learner only after the strict
 * schema, semantic and keyCheck validation in ../activity/spec. Correctness always comes from the
 * local grader, at answer time and again whenever stored evidence is restored.
 */
import type { Grade, LearnerState, SpecAttemptData } from '../learning/types';
import { skills } from '../learning/curriculum';
import { buildActivityPrompt } from '../activity/prompt';
import { buildLearnerSummary, specHash, type LearnerSummary } from '../activity/learnerState';
import { validateActivityBatch, validateActivitySpec, type ActivitySpec } from '../activity/spec';
import { gradeActivity, type GradeOutcome, type LearnerResponse } from '../activity/grade';
import { activityIdFor, type QueuedActivity } from './aiQueue';

/** Every skill in the bundled graph, including guided-only standards. */
const GRAPH_SKILL_IDS: ReadonlySet<string> = new Set(skills.map(s => s.id));
/** The spec prompt's output budget. The provider journal records it per operation (journal v2). */
export const BATCH_MAX_OUTPUT_TOKENS = 2600;
export const BATCH_SIZE = 4;

export interface BatchRequest {
  system: string;
  user: string;
  /** The standards window the model was shown; a fresh or recovered reply is validated against it. */
  allowedSkillIds: string[];
  maxOutputTokens: typeof BATCH_MAX_OUTPUT_TOKENS;
  summary: LearnerSummary;
}

/** The learner summary comes from the evidence ledger only: levels and results, never names or ids. */
export function buildBatchRequest(state: LearnerState, gradeHint: Grade, now = new Date().toISOString(), wantsHarder = false): BatchRequest {
  const summary = buildLearnerSummary({ gradeHint, ledger: state, now, wantsHarder });
  const prompt = buildActivityPrompt(summary, { count: BATCH_SIZE });
  return { system: prompt.system, user: prompt.user, allowedSkillIds: [...prompt.allowedSkillIds], maxOutputTokens: BATCH_MAX_OUTPUT_TOKENS, summary };
}

export interface ParsedBatch {
  items: QueuedActivity[];
  rejected: { index: number; errors: string[] }[];
  errors: string[];
}
/**
 * Parse the model's text exactly the same way for a fresh reply and for a recovered one. Invalid
 * activities are dropped, never repaired. Complete activities from a cut-off reply are kept.
 */
export function parseBatch(text: string, allowedSkillIds: readonly string[], operationId: string): ParsedBatch {
  const allowed = new Set(allowedSkillIds.filter(id => GRAPH_SKILL_IDS.has(id)));
  const result = validateActivityBatch(text, { skillIds: allowed });
  // Ids follow each activity's position in the model's batch, not its position among accepted
  // ones, so a redelivered reply maps to the same ids even if validation rules change in between.
  const rejected = new Set(result.rejected.map(r => r.index));
  const positions: number[] = [];
  for (let i = 0; positions.length < result.accepted.length; i++) if (!rejected.has(i)) positions.push(i);
  return {
    items: result.accepted.map((spec, n) => ({ activityId: activityIdFor(operationId, positions[n]!), operationId, spec })),
    rejected: result.rejected.map(r => ({ index: r.index, errors: r.errors.slice(0, 5) })),
    errors: result.errors.slice(0, 5),
  };
}

/** Re-validate a saved activity against the whole graph. */
export function verifySpec(raw: unknown): ActivitySpec | null {
  const checked = validateActivitySpec(raw, { skillIds: GRAPH_SKILL_IDS });
  return checked.ok ? checked.spec : null;
}

export interface GradedSpecAttempt {
  outcome: GradeOutcome;
  /** Present unless the input could not be read (then nothing is recorded). */
  attempt?: { correct: boolean; answer: string; spec: SpecAttemptData };
}
/** Grade locally and build the evidence payload that recordSpecAttempt stores. */
export function gradeSpecAttempt(spec: ActivitySpec, response: LearnerResponse): GradedSpecAttempt {
  const outcome = gradeActivity(spec, response);
  if (outcome.invalid) return { outcome };
  return {
    outcome,
    attempt: {
      correct: outcome.correct,
      answer: outcome.normalized.slice(0, 80),
      spec: {
        hash: specHash(spec), skillIds: [...spec.skillIds], difficulty: spec.difficulty, responseType: spec.response.type,
        response: structuredClone(response), ...(outcome.misconceptionTag ? { misconceptionTag: outcome.misconceptionTag.slice(0, 48) } : {}),
        content: structuredClone(spec),
      },
    },
  };
}

const MAX_RESPONSE_CHARS = 2000;
function readableResponse(value: unknown): value is LearnerResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof (value as { type?: unknown }).type !== 'string') return false;
  try { return JSON.stringify(value).length <= MAX_RESPONSE_CHARS; } catch { return false; }
}
/**
 * Restore check for stored AI evidence: the stored content must still validate against the graph,
 * hash to the stored hash and carry the stored tags; correctness is recomputed by the grader.
 * Throws on any mismatch so the caller fails closed instead of resetting progress.
 */
export function verifySpecAttempt(stored: SpecAttemptData): { correct: boolean; answer: string; spec: SpecAttemptData } {
  if (!stored || typeof stored !== 'object') throw new Error('AI evidence is missing its activity.');
  const spec = verifySpec(stored.content);
  if (!spec) throw new Error('AI evidence contains an activity that no longer validates.');
  if (specHash(spec) !== stored.hash) throw new Error('AI evidence does not match its activity hash.');
  if (!readableResponse(stored.response)) throw new Error('AI evidence has an unreadable response.');
  const graded = gradeSpecAttempt(spec, stored.response);
  if (!graded.attempt) throw new Error('AI evidence has a response the grader cannot read.');
  const fresh = graded.attempt.spec;
  if (JSON.stringify(fresh.skillIds) !== JSON.stringify(stored.skillIds) || fresh.difficulty !== stored.difficulty || fresh.responseType !== stored.responseType)
    throw new Error('AI evidence contradicts its activity.');
  return graded.attempt;
}

/** The restore boundary's view of this module (see application/recovery). */
export const specRestorer = { verifySpec, verifySpecAttempt };
export type SpecRestorer = typeof specRestorer;
