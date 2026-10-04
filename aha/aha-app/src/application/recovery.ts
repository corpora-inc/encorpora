import {
  createLearner, recordAttempt, recordSpecAttempt, rebuildProgress, validateActivity,
  type Activity, type AttemptEvidence, type Grade, type LearnerState, type SpecAttemptData, type SpecAttemptInput,
} from '../learning';
import { MAX_QUEUE, pruneQueue, type QueuedActivity } from './aiQueue';
import type { SpecRestorer } from './aiActivities';

export interface RecoveryProfile { id: string; grade: number }
export interface RecoveredLearning {
  learner: LearnerState;
  activity?: Activity;
  hintsUsed: number;
  sessionId: string;
  completed: number;
  curiosity?: {question: string; answer: string};
  /** The AI-authored activity that was on screen, re-validated. */
  aiActivity?: QueuedActivity;
  /** Paid, validated AI activities not yet shown. Restoring them never buys them again. */
  aiQueue: QueuedActivity[];
  /** Saved AI activities that no longer validate and were set aside (logged by the caller). */
  droppedAi: number;
  /** First incorrect answer on the resumed activity: its one forgiving retry is still pending. */
  firstAnswer?: string;
  /** Resumed answers always lose timed-recall eligibility. */
  interrupted: true;
}
/** Stored session/evidence contains AI-authored activities, so restore needs the lazy verifier. */
export function needsSpecRestorer(session: unknown, attempts: unknown): boolean {
  const data = (session as {data?: Record<string, unknown>} | null)?.data;
  if (data && typeof data === 'object' && (data.aiActivity !== undefined || data.aiQueue !== undefined)) return true;
  return Array.isArray(attempts) && attempts.some(a => (a as {data?: {source?: unknown}})?.data?.source === 'ai-spec');
}
type ObjectValue = Record<string, unknown>;
export class LearningRecoveryError extends Error {
  readonly code = 'learning_recovery_required';
  constructor(message: string) {
    super(`Local learning data needs recovery: ${message} No progress was reset.`);
    this.name = 'LearningRecoveryError';
  }
}
function fail(message: string): never { throw new LearningRecoveryError(message); }
function object(value: unknown, label: string): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object.`);
  return value as ObjectValue;
}
function id(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9._:-]{1,100}$/.test(value)) fail(`${label} is invalid.`);
  return value;
}
function integer(value: unknown, label: string, max = 1_000_000): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) fail(`${label} is invalid.`);
  return value;
}
function time(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length > 40 || !Number.isFinite(Date.parse(value))) fail(`${label} is invalid.`);
  return new Date(value).toISOString();
}
function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > 50_000) fail(`${label} must be a bounded list.`);
  return value;
}
function answerText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 80;
}
function grade(value: unknown): Grade {
  if (!['K', 1, 2, 3, 4, 5, 6, 7, 8].includes(value as Grade)) fail('The starting grade is invalid.');
  return value as Grade;
}
interface AttemptInputs { id: string; answer: string; at: string; hintsUsed: number; activeMs: number | null; interrupted: boolean; firstAnswer?: string }
type ValidatedAttempt =
  | { kind: 'task'; id: string; activityId: string; sessionId: string; at: string; activity: Activity; input: AttemptInputs }
  | { kind: 'spec'; id: string; activityId: string; sessionId: string; at: string; input: SpecAttemptInput };
type Unsessioned = ValidatedAttempt extends infer T ? T extends ValidatedAttempt ? Omit<T, 'sessionId'> : never : never;
function evidence(raw: unknown, specs?: SpecRestorer): Unsessioned {
  const e = object(raw, 'Attempt evidence');
  const attemptId = id(e.id, 'Attempt ID');
  const activityId = id(e.activityId, 'Activity ID');
  const at = time(e.at, 'Attempt timestamp');
  if (typeof e.answer !== 'string' || e.answer.length > 80) fail(`Attempt ${attemptId} has invalid answer data.`);
  const hintsUsed = integer(e.hintsUsed, 'Hint count', 100);
  if (e.activeMs !== null && (typeof e.activeMs !== 'number' || !Number.isFinite(e.activeMs) || e.activeMs < 0 || e.activeMs > 3_600_000)) fail('Active response time is invalid.');
  if (typeof e.interrupted !== 'boolean') fail('The timing interruption flag is invalid.');
  if (e.source === 'ai-spec') {
    if (!specs) fail(`Attempt ${attemptId} is an AI activity and needs the activity verifier.`);
    let verified: { correct: boolean; answer: string; spec: SpecAttemptData };
    // Stored correctness and tags are ignored: the stored content is re-validated and re-graded.
    try { verified = specs.verifySpecAttempt(e.spec as SpecAttemptData); }
    catch (error) { fail(`Attempt ${attemptId}: ${error instanceof Error ? error.message : 'AI evidence is invalid.'}`); }
    return { kind: 'spec', id: attemptId, activityId, at, input: { id: attemptId, activityId, at, hintsUsed, activeMs: e.activeMs as number | null,
      interrupted: e.interrupted, correct: verified.correct, answer: verified.answer, spec: verified.spec } };
  }
  if (e.source !== undefined) fail(`Attempt ${attemptId} has an unknown evidence source.`);
  if (e.firstAnswer !== undefined && !answerText(e.firstAnswer)) fail(`Attempt ${attemptId} has an invalid first answer.`);
  const validated = validateActivity({ version: 1, id: activityId, skillId: e.skillId, mode: e.mode, task: e.task,
    ...(e.choices === undefined ? {} : { choices: e.choices }) });
  if (!validated.ok) fail(`Attempt ${attemptId} contains an invalid activity.`);
  // Derived correct/expected/independent/variant values are deliberately ignored.
  // recordAttempt recomputes them using the canonical task and observed answer.
  return { kind: 'task', id: attemptId, activityId, at, activity: validated.activity,
    input: { id: attemptId, answer: e.answer, at, hintsUsed, activeMs: e.activeMs as number | null, interrupted: e.interrupted,
      ...(e.firstAnswer === undefined ? {} : { firstAnswer: e.firstAnswer as string }) } };
}
function signature(e: Unsessioned): string {
  if (e.kind === 'spec') return JSON.stringify({ kind: e.kind, ...e.input });
  return JSON.stringify({ activityId: e.activityId, skillId: e.activity.skillId, mode: e.activity.mode,
    task: e.activity.task, choices: e.activity.choices, ...e.input });
}
/** Pure restore boundary: native append-only records, not imported projection claims, own evidence. */
export function restoreLearning(
  profile: RecoveryProfile,
  snapshot: unknown,
  session: unknown,
  attempts: unknown,
  disputes: unknown,
  specs?: SpecRestorer,
): RecoveredLearning {
  const learnerId = id(profile.id, 'Learner ID');
  const startGrade = grade(profile.grade === 0 ? 'K' : profile.grade);
  const observed = array(attempts, 'Attempt records').map((raw): ValidatedAttempt => {
    const envelope = object(raw, 'Attempt record');
    const verified = evidence(envelope.data, specs);
    if (id(envelope.id, 'Record ID') !== verified.id || id(envelope.activityId, 'Record activity ID') !== verified.activityId || time(envelope.createdAt, 'Record timestamp') !== verified.at) fail('An attempt envelope contradicts its immutable evidence.');
    return { ...verified, sessionId: id(envelope.sessionId, 'Attempt session ID') };
  });
  const byId = new Map<string, ValidatedAttempt>();
  const activityIds = new Set<string>();
  for (const item of observed) {
    if (byId.has(item.id) || activityIds.has(item.activityId)) fail('Duplicate attempt or activity evidence was found.');
    byId.set(item.id, item); activityIds.add(item.activityId);
  }
  const disputeIds = new Set<string>();
  const excluded = new Map<string, { reason: string; at: string }>();
  for (const raw of array(disputes, 'Dispute records')) {
    const dispute = object(raw, 'Dispute'); const disputeId = id(dispute.id, 'Dispute ID');
    if (disputeIds.has(disputeId)) fail('Duplicate dispute IDs were found.');
    disputeIds.add(disputeId);
    const activityId = id(dispute.activityId, 'Disputed activity ID');
    if (typeof dispute.reason !== 'string' || !dispute.reason.trim() || dispute.reason.length > 2000) fail('A dispute reason is invalid.');
    const at = time(dispute.createdAt, 'Dispute timestamp');
    // Multiple reports of an item remain quarantined; choose a stable earliest report.
    if (!excluded.has(activityId) || at < excluded.get(activityId)!.at) excluded.set(activityId, { reason: dispute.reason, at });
  }
  function inspectProjection(raw: unknown, label: string): void {
    if (raw === null || raw === undefined) return;
    const projection = object(raw, label);
    if (projection.version !== 1 || projection.learnerId !== learnerId) fail(`${label} has an unsupported version or belongs to another learner.`);
    grade(projection.startGrade); object(projection.progress, `${label} progress`);
    const seen = new Set<string>();
    for (const item of array(projection.attempts, `${label} evidence`)) {
      const e = evidence(item, specs), authoritative = byId.get(e.id);
      if (seen.has(e.id) || !authoritative || signature(e) !== signature(authoritative)) fail(`${label} contradicts the recorded attempts.`);
      seen.add(e.id);
    }
    // An older presentation-session projection can be a subset after interruption.
    // Its progress fields never contribute to restoration.
  }
  inspectProjection(snapshot, 'Learning snapshot');
  let sessionId = crypto.randomUUID() as string;
  let hintsUsed = 0;
  let resumed: Activity | undefined;
  let curiosity: RecoveredLearning['curiosity'];
  let aiActivity: QueuedActivity | undefined;
  let aiQueue: QueuedActivity[] = [];
  let droppedAi = 0;
  let firstAnswer: string | undefined;
  if (session !== null && session !== undefined) {
    const envelope = object(session, 'Saved session');
    const data = object(envelope.data, 'Saved session data');
    sessionId = id(envelope.id, 'Saved session ID');
    time(envelope.updatedAt, 'Saved session timestamp');
    if (id(data.sessionId, 'Presentation session ID') !== sessionId) fail('Saved session identities disagree.');
    hintsUsed = integer(data.hintsUsed, 'Saved hint count', 100);
    integer(data.completed, 'Saved completion count');
    inspectProjection(data.learnerState, 'Saved session projection');
    if (data.curiosity !== undefined) {
      const saved = object(data.curiosity, 'Saved curiosity answer');
      if (Object.keys(saved).some(k=>!['question','answer'].includes(k)) || typeof saved.question !== 'string' ||
          !saved.question.trim() || saved.question.length > 600 || typeof saved.answer !== 'string' || saved.answer.length > 24_000)
        fail('Saved curiosity answer is invalid.');
      curiosity = {question:saved.question, answer:saved.answer};
    }
    if (data.firstAnswer !== undefined) {
      // A pending retry was saved together with its assistance; never resume it as a fresh first try.
      if (!answerText(data.firstAnswer) || hintsUsed < 1) fail('Saved retry state is invalid.');
      firstAnswer = data.firstAnswer;
    }
    if (data.activity !== null) {
      if (data.aiActivity !== undefined) fail('The saved session shows two activities at once.');
      const checked = validateActivity(data.activity);
      if (!checked.ok) fail('The saved activity is malformed or no longer supported.');
      if (!activityIds.has(checked.activity.id) && !excluded.has(checked.activity.id)) {
        resumed = { ...checked.activity, source: object(data.activity, 'Saved activity').source === 'local' ? 'local' : 'ai' };
      }
    }
    if (data.aiActivity !== undefined || data.aiQueue !== undefined) {
      if (!specs) fail('Saved AI activities need the activity verifier.');
      const restore = (raw: unknown): QueuedActivity | null => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
        const item = raw as ObjectValue;
        if (Object.keys(item).some(k => !['activityId','operationId','spec'].includes(k))) return null;
        if (typeof item.activityId !== 'string' || typeof item.operationId !== 'string' || !/^[a-zA-Z0-9._:-]{1,100}$/.test(item.activityId) ||
            !/^[a-zA-Z0-9._-]{1,80}$/.test(item.operationId) || !item.activityId.startsWith(`${item.operationId}:`)) return null;
        const spec = specs.verifySpec(item.spec);
        return spec ? { activityId: item.activityId, operationId: item.operationId, spec } : null;
      };
      if (data.aiActivity !== undefined) {
        const current = restore(data.aiActivity);
        if (!current) droppedAi++;
        else if (!activityIds.has(current.activityId) && !excluded.has(current.activityId)) aiActivity = current;
      }
      if (data.aiQueue !== undefined) {
        const queued = array(data.aiQueue, 'Saved AI activity queue');
        if (queued.length > MAX_QUEUE * 2) fail('The saved AI activity queue is too long.');
        const unique = new Map<string, QueuedActivity>();
        for (const raw of queued) {
          const item = restore(raw);
          if (!item) droppedAi++;
          else if (!unique.has(item.activityId)) unique.set(item.activityId, item);
        }
        aiQueue = pruneQueue([...unique.values()], { attempted: activityIds, disputed: new Set(excluded.keys()), current: aiActivity?.activityId }).slice(0, MAX_QUEUE);
      }
    }
  }
  let learner = createLearner(learnerId, startGrade);
  try {
    // Stable chronological order is required for deterministic review projections.
    const ordered = observed.slice().sort((a, b) => a.at.localeCompare(b.at));
    for (const item of ordered) learner = item.kind === 'spec' ? recordSpecAttempt(learner, item.input) : recordAttempt(learner, item.activity, item.input, { replay: true });
    if (excluded.size) {
      const evidenceWithDisputes: AttemptEvidence[] = learner.attempts.map(e => {
        const dispute = excluded.get(e.activityId);
        return dispute ? { ...e, excluded: dispute } : e;
      });
      learner = rebuildProgress({ ...learner, attempts: evidenceWithDisputes });
    }
  } catch (error) {
    if (error instanceof LearningRecoveryError) throw error;
    fail(error instanceof Error ? error.message : 'Attempt evidence cannot be replayed.');
  }
  return { learner, activity: resumed, ...(curiosity ? {curiosity} : {}), ...(resumed && firstAnswer !== undefined ? {firstAnswer} : {}),
    ...(aiActivity ? {aiActivity} : {}), aiQueue, droppedAi,
    hintsUsed: resumed || aiActivity ? hintsUsed : 0, sessionId,
    completed: observed.filter(a => a.sessionId === sessionId).length, interrupted: true };
}
