import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearner, expectedAnswer, recordAttempt, validateActivity, type Activity } from '../learning';
import { restoreLearning, LearningRecoveryError } from './recovery';
const profile = { id: 'learner', grade: 4 };
const at = (i = 0) => new Date(Date.UTC(2026, 8, 27, 12, 0, i)).toISOString();
function question(i: number): Activity {
  const result = validateActivity({ version: 1, id: `activity-${i}`, skillId: '5.NF.A.1', mode: 'concept', task: { kind: 'arithmetic', operation: 'add', left: `1/${i + 3}`, right: '1/2' } });
  assert.ok(result.ok); if (!result.ok) throw new Error(); return { ...result.activity, source: 'local' };
}
function fixture() {
  let state = createLearner(profile.id, 4);
  for (let i = 0; i < 3; i++) {
    const q = question(i);
    state = recordAttempt(state, q, { id: `attempt-${i}`, answer: expectedAnswer(q.task), at: at(i), hintsUsed: 0, activeMs: 1000, interrupted: false });
  }
  const attempts = state.attempts.map(e => ({ id: e.id, activityId: e.activityId, sessionId: 'session', createdAt: e.at, data: e }));
  const session = { id: 'session', updatedAt: at(4), data: { sessionId: 'session', activity: question(10), hintsUsed: 2, completed: 999, learnerState: state } };
  return { state, attempts, session };
}
test('replays native evidence and restores an unanswered session with interrupted timing', () => {
  const f = fixture(); const original = JSON.stringify(f); const restored = restoreLearning(profile, f.state, f.session, f.attempts, []);
  assert.deepEqual(restored.learner, f.state); assert.equal(restored.activity?.id, 'activity-10'); assert.equal(restored.activity?.source, 'local');
  assert.equal(restored.completed, 3); assert.equal(restored.hintsUsed, 2); assert.equal(restored.interrupted, true);
  assert.equal(JSON.stringify(f), original); assert.deepEqual(restoreLearning(profile, f.state, f.session, f.attempts, []), restored);
});
test('new profiles return empty evidence without fabricated snapshots', () => {
  const restored = restoreLearning(profile, null, null, [], []); assert.deepEqual(restored.learner, createLearner(profile.id, 4)); assert.equal(restored.completed, 0);
});
test('fabricated derived mastery never becomes progress without recorded evidence', () => {
  const fake = { ...createLearner(profile.id, 4), progress: { '5.NF.A.1': { concept: 'provisional', retention: 'retained', independentSuccesses: 999 } } };
  assert.deepEqual(restoreLearning(profile, fake, null, [], []).learner.progress, {});
});
test('derived grading flags are recomputed from the observed answer', () => {
  const f = fixture(); const attempts = f.attempts.map(a => ({ ...a, data: { ...a.data, answer: '999', expected: '999', correct: true, independent: true, variant: 'fabricated' } }));
  const restored = restoreLearning(profile, null, null, attempts, []);
  assert.equal(restored.learner.attempts.every(a => !a.correct && !a.independent), true);
  assert.equal(restored.learner.progress['5.NF.A.1'].independentSuccesses, 0); assert.notEqual(restored.learner.attempts[0].expected, '999');
});
test('invalid snapshot shapes and unknown versions fail closed instead of resetting', () => {
  const f = fixture();
  for (const snapshot of [false, [], {}, { ...f.state, version: 99 }, { ...f.state, learnerId: 'someone-else' }, { ...f.state, attempts: null }, { ...f.state, progress: [] }, { ...f.state, startGrade: 99 }]) assert.throws(() => restoreLearning(profile, snapshot, null, f.attempts, []), LearningRecoveryError);
});
test('snapshot evidence cannot invent or contradict immutable native observations', () => {
  const f = fixture(); const forged = { ...f.state, attempts: f.state.attempts.map((a, i) => i ? a : { ...a, answer: '111' }) };
  assert.throws(() => restoreLearning(profile, forged, null, f.attempts, []), LearningRecoveryError);
  assert.throws(() => restoreLearning(profile, f.state, null, [], []), LearningRecoveryError);
});
test('older presentation snapshots can lag the authoritative attempt journal', () => {
  const f = fixture(); f.session.data.learnerState = { ...f.state, attempts: f.state.attempts.slice(0, 1), progress: {} };
  const restored = restoreLearning(profile, f.state, f.session, f.attempts, []);
  assert.equal(restored.learner.attempts.length, 3); assert.equal(restored.learner.progress['5.NF.A.1'].concept, 'provisional');
});
test('dispute before any answer prevents a saved activity from resuming', () => {
  const state = createLearner(profile.id, 4), activity = question(0);
  const session = { id: 'session', updatedAt: at(), data: { sessionId: 'session', activity, hintsUsed: 0, completed: 0, learnerState: state } };
  const restored = restoreLearning(profile, state, session, [], [{ id: 'dispute', activityId: activity.id, reason: 'Confusing wording', createdAt: at() }]);
  assert.equal(restored.activity, undefined); assert.deepEqual(restored.learner.progress, {});
});
test('disputes remove contributions while keeping attempts auditable', () => {
  const f = fixture(); const restored = restoreLearning(profile, f.state, f.session, f.attempts, [{ id: 'dispute', activityId: 'activity-0', reason: 'Misleading teaching text', createdAt: at(5) }]);
  assert.equal(restored.learner.attempts.length, 3); assert.ok(restored.learner.attempts[0].excluded);
  assert.equal(restored.learner.progress['5.NF.A.1'].concept, 'developing'); assert.equal(restored.learner.progress['5.NF.A.1'].independentSuccesses, 2);
});
test('answered activities do not resume for duplicate graded submission', () => {
  const f = fixture(); f.session.data.activity = question(0); assert.equal(restoreLearning(profile, f.state, f.session, f.attempts, []).activity, undefined);
});
test('corrupt session metadata and unsupported resumed tasks fail closed', () => {
  const f = fixture();
  for (const session of [{}, { ...f.session, id: 'different' }, { ...f.session, data: { ...f.session.data, hintsUsed: -1 } }, { ...f.session, data: { ...f.session.data, activity: { ...question(10), task: { kind: 'code', javascript: 'run()' } } } }]) assert.throws(() => restoreLearning(profile, f.state, session, f.attempts, []), LearningRecoveryError);
});
test('contradictory envelopes and duplicate immutable IDs fail closed', () => {
  const f = fixture();
  assert.throws(() => restoreLearning(profile, null, null, [...f.attempts, f.attempts[0]], []), LearningRecoveryError);
  assert.throws(() => restoreLearning(profile, null, null, [{ ...f.attempts[0], id: 'different' }], []), LearningRecoveryError);
  assert.throws(() => restoreLearning(profile, null, null, [{ ...f.attempts[0], createdAt: 'bad' }], []), LearningRecoveryError);
  assert.throws(() => restoreLearning(profile, null, null, [{ ...f.attempts[0], data: { ...f.attempts[0].data, hintsUsed: undefined } }], []), LearningRecoveryError);
});

test('paid curiosity answers survive presentation recovery without creating mastery', () => {
 const f=fixture();
 const curiosity={question:'Where is this useful?',answer:'Fractions help you share a recipe fairly.'};
 const session={...f.session,data:{...f.session.data,curiosity}};
 const restored=restoreLearning(profile,f.state,session,f.attempts,[]);
 assert.deepEqual(restored.curiosity,curiosity);
 assert.deepEqual(restored.learner.progress,f.state.progress);
 assert.throws(()=>restoreLearning(profile,f.state,{...session,data:{...session.data,curiosity:{...curiosity,answer:'x'.repeat(24001)}}},f.attempts,[]),LearningRecoveryError);
});
