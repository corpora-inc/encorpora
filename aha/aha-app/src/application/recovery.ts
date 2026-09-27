import {
  createLearner, recordAttempt, rebuildProgress, validateActivity,
  type Activity, type AttemptEvidence, type Grade, type LearnerState,
} from '../learning';

export interface RecoveryProfile { id: string; grade: number }
export interface RecoveredLearning {
  learner: LearnerState;
  activity?: Activity;
  hintsUsed: number;
  sessionId: string;
  completed: number;
  /** Resumed answers always lose timed-recall eligibility. */
  interrupted: true;
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
function grade(value: unknown): Grade {
  if (!['K', 1, 2, 3, 4, 5, 6, 7, 8].includes(value as Grade)) fail('The starting grade is invalid.');
  return value as Grade;
}
interface ValidatedAttempt {
  id: string; activityId: string; sessionId: string; at: string;
  activity: Activity; input: { id: string; answer: string; at: string; hintsUsed: number; activeMs: number | null; interrupted: boolean };
}
function evidence(raw: unknown): Omit<ValidatedAttempt, 'sessionId'> {
  const e = object(raw, 'Attempt evidence');
  const attemptId = id(e.id, 'Attempt ID');
  const activityId = id(e.activityId, 'Activity ID');
  const at = time(e.at, 'Attempt timestamp');
  const validated = validateActivity({ version: 1, id: activityId, skillId: e.skillId, mode: e.mode, task: e.task,
    ...(e.choices === undefined ? {} : { choices: e.choices }) });
  if (!validated.ok) fail(`Attempt ${attemptId} contains an invalid activity.`);
  if (typeof e.answer !== 'string' || e.answer.length > 80) fail(`Attempt ${attemptId} has invalid answer data.`);
  const hintsUsed = integer(e.hintsUsed, 'Hint count', 100);
  if (e.activeMs !== null && (typeof e.activeMs !== 'number' || !Number.isFinite(e.activeMs) || e.activeMs < 0 || e.activeMs > 3_600_000)) fail('Active response time is invalid.');
  if (typeof e.interrupted !== 'boolean') fail('The timing interruption flag is invalid.');
  // Derived correct/expected/independent/variant values are deliberately ignored.
  // recordAttempt recomputes them using the canonical task and observed answer.
  return { id: attemptId, activityId, at, activity: validated.activity,
    input: { id: attemptId, answer: e.answer, at, hintsUsed, activeMs: e.activeMs as number | null, interrupted: e.interrupted } };
}
function signature(e: Omit<ValidatedAttempt, 'sessionId'>): string {
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
): RecoveredLearning {
  const learnerId = id(profile.id, 'Learner ID');
  const startGrade = grade(profile.grade === 0 ? 'K' : profile.grade);
  const observed = array(attempts, 'Attempt records').map((raw): ValidatedAttempt => {
    const envelope = object(raw, 'Attempt record');
    const verified = evidence(envelope.data);
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
      const e = evidence(item), authoritative = byId.get(e.id);
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
  if (session !== null && session !== undefined) {
    const envelope = object(session, 'Saved session');
    const data = object(envelope.data, 'Saved session data');
    sessionId = id(envelope.id, 'Saved session ID');
    time(envelope.updatedAt, 'Saved session timestamp');
    if (id(data.sessionId, 'Presentation session ID') !== sessionId) fail('Saved session identities disagree.');
    hintsUsed = integer(data.hintsUsed, 'Saved hint count', 100);
    integer(data.completed, 'Saved completion count');
    inspectProjection(data.learnerState, 'Saved session projection');
    if (data.activity !== null) {
      const checked = validateActivity(data.activity);
      if (!checked.ok) fail('The saved activity is malformed or no longer supported.');
      if (!activityIds.has(checked.activity.id) && !excluded.has(checked.activity.id)) {
        resumed = { ...checked.activity, source: object(data.activity, 'Saved activity').source === 'local' ? 'local' : 'ai' };
      }
    }
  }
  let learner = createLearner(learnerId, startGrade);
  try {
    // Stable chronological order is required for deterministic review projections.
    const ordered = observed.slice().sort((a, b) => a.at.localeCompare(b.at));
    for (const item of ordered) learner = recordAttempt(learner, item.activity, item.input);
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
  return { learner, activity: resumed, hintsUsed: resumed ? hintsUsed : 0, sessionId,
    completed: observed.filter(a => a.sessionId === sessionId).length, interrupted: true };
}
