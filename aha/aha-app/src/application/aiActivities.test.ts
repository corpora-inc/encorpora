/** TEST FIXTURES only: hand-authored specs from src/activity/fixtures stand in for model text. Not live AI. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtures } from '../activity/fixtures';
import { correctResponse, type LearnerResponse } from '../activity/grade';
import type { ActivitySpec } from '../activity/spec';
import { createLearner, getSkill, quarantineActivity, recordSpecAttempt, type LearnerState } from '../learning';
import { buildBatchRequest, gradeSpecAttempt, parseBatch, specRestorer, verifySpecAttempt } from './aiActivities';
import { restoreLearning, needsSpecRestorer, LearningRecoveryError } from './recovery';

const fx = (id: string) => structuredClone(fixtures.find(f => f.id === id)!);
const allIds = (specs: ActivitySpec[]) => [...new Set(specs.flatMap(s => s.skillIds))];
const DAY = 86_400_000;
const at = (day: number, minute = 0) => new Date(Date.UTC(2026, 9, 1 + day, 10, minute)).toISOString();
/** Three distinct activities for one guided-only standard (K.CC.B.5 has no verified local task). */
function countingVariants(): ActivitySpec[] {
  return [0, 1, 2, 3, 4, 5].map(i => ({ ...fx('fx-k-count-apples'), id: `fx-k-count-apples-v${i}` }));
}
function answer(state: LearnerState, spec: ActivitySpec, n: number, options: { at: string; response?: LearnerResponse; hintsUsed?: number }) {
  const graded = gradeSpecAttempt(spec, options.response ?? correctResponse(spec));
  assert.ok(graded.attempt, 'readable response');
  return recordSpecAttempt(state, { id: `attempt-${n}`, activityId: `op:${n}`, at: options.at, hintsUsed: options.hintsUsed ?? 0, activeMs: 9000, interrupted: false, ...graded.attempt });
}

test('a batch with fences, chatter, an invalid activity and an out-of-window skill keeps exactly the valid subset', () => {
  const good = [fx('fx-3-fraction-bar'), fx('fx-2-coins'), fx('fx-5-plant-the-tree')];
  const broken = { ...fx('fx-3-area-tiles'), keyCheck: { value: '999' } }; // key disagrees with its own arithmetic
  const foreign = fx('fx-8-slope'); // skill not in the window the model was shown
  const text = 'Sure! Here you go:\n```json\n' + JSON.stringify({ rationale: 'Fractions, money and the plane.', activities: [good[0], broken, good[1], foreign, good[2]] }) + '\n```';
  const window = allIds([...good, broken]);
  const parsed = parseBatch(text, window, 'op-1');
  assert.deepEqual(parsed.items.map(i => i.spec.id), good.map(g => g.id));
  assert.deepEqual(parsed.items.map(i => i.activityId), ['op-1:0', 'op-1:1', 'op-1:2'], 'stable ids: a recovered batch maps to the same activities');
  assert.equal(parsed.rejected.length, 2);
  assert.ok(parsed.rejected.some(r => r.errors.some(e => e.includes('keyCheck'))));
  assert.ok(parsed.rejected.some(r => r.errors.some(e => e.includes('unknown skill'))));
  assert.deepEqual(parseBatch(text, window, 'op-1'), parsed, 'a recovered reply is parsed exactly like the fresh one');
});

test('a reply cut off by the output budget keeps its complete activities', () => {
  const specs = [fx('fx-1-take-away'), fx('fx-2-ruler'), fx('fx-3-pictograph')];
  const full = JSON.stringify({ rationale: 'r', activities: specs });
  const cut = full.slice(0, full.length - 120);
  const parsed = parseBatch(cut, allIds(specs), 'op-cut');
  assert.deepEqual(parsed.items.map(i => i.spec.id), specs.slice(0, 2).map(s => s.id));
  assert.ok(parsed.errors.some(e => e.includes('truncated')));
});

test('garbage text yields no activities and an explanation, never a throw', () => {
  for (const text of ['', 'I cannot help with that.', '{"rationale":"x","activities":[]}', '{"activities": "nope"}']) {
    const parsed = parseBatch(text, ['3.NF.A.1'], 'op');
    assert.equal(parsed.items.length, 0, text);
    assert.ok(parsed.errors.length, text);
  }
});

test('the batch request summarizes levels and results from the ledger with no names, ids or exact times', () => {
  let state = createLearner('learner-Maya-secret', 3);
  const specs = countingVariants();
  state = answer(state, specs[0]!, 1, { at: at(0, 1) });
  state = answer(state, specs[1]!, 2, { at: at(0, 2), response: { type: 'numeric', value: '13' } });
  state = answer(state, specs[2]!, 3, { at: at(0, 3), response: { type: 'numeric', value: '1' } });
  const request = buildBatchRequest(state, 3, at(1));
  const text = request.system + request.user;
  for (const secret of ['learner-Maya-secret', 'Maya', 'attempt-1', 'op:1', at(0, 1), '2026-10-01T']) assert.ok(!text.includes(secret), secret);
  const summary = request.summary;
  assert.equal(summary.recent.attempts, 3);
  assert.equal(summary.recent.streak, -2, 'recent streak is fed back');
  const k = summary.frontier.find(f => f.id === 'K.CC.B.5');
  assert.ok(k, 'AI-tagged guided-only work appears on the frontier');
  assert.equal(k.missStreak, 2, 'repeated misses are fed back so the model changes approach (#860)');
  assert.ok(summary.recentActivities.every(a => a.type === 'numeric' && a.difficulty === 2));
  assert.ok(request.allowedSkillIds.includes('K.CC.B.5'));
  assert.equal(request.maxOutputTokens, 2600);
  assert.ok(text.length < 20_000, 'fits the provider context bound');
});

test('AI activities are real evidence: a guided-only standard becomes provisional, then retained, under the same rules', () => {
  assert.equal(getSkill('K.CC.B.5')?.coverage, 'guided-only');
  const specs = countingVariants();
  let state = createLearner('learner', 'K');
  state = answer(state, specs[0]!, 1, { at: at(0, 1) });
  state = answer(state, specs[1]!, 2, { at: at(0, 2), hintsUsed: 1 });
  assert.equal(state.progress['K.CC.B.5']!.independentSuccesses, 0, 'a hinted success is assisted, not independent');
  state = answer(state, specs[2]!, 3, { at: at(0, 3) });
  state = answer(state, specs[3]!, 4, { at: at(0, 4) });
  assert.equal(state.progress['K.CC.B.5']!.concept, 'developing', 'two distinct independent successes are not yet enough');
  state = answer(state, specs[4]!, 5, { at: at(0, 5) });
  const provisional = state.progress['K.CC.B.5']!;
  assert.equal(provisional.concept, 'provisional', 'three distinct independent successes since the last assisted answer');
  assert.equal(provisional.retention, 'unconfirmed');
  assert.equal(provisional.fluency, 'not-applicable');
  // Delayed reviews: an AI activity tagging the skill after its review date counts as the check.
  state = answer(state, specs[5]!, 6, { at: new Date(Date.parse(provisional.nextReviewAt!) + 60_000).toISOString() });
  assert.equal(state.progress['K.CC.B.5']!.reviewStage, 1);
  const second = { ...specs[5]!, id: 'fx-k-count-apples-v6' };
  state = answer(state, second, 7, { at: new Date(Date.parse(state.progress['K.CC.B.5']!.nextReviewAt!) + 60_000).toISOString() });
  assert.equal(state.progress['K.CC.B.5']!.retention, 'retained');
  const evidence = state.attempts.at(-1)!;
  assert.equal(evidence.source, 'ai-spec');
  if (evidence.source === 'ai-spec') {
    assert.match(evidence.spec.hash, /^[0-9a-f]{16}$/);
    assert.deepEqual(evidence.spec.skillIds, ['K.CC.B.5']);
    assert.equal(evidence.spec.difficulty, 2);
    assert.equal(evidence.spec.responseType, 'numeric');
    assert.deepEqual(evidence.spec.response, correctResponse(second));
    assert.equal(evidence.hintsUsed, 0);
    assert.equal(evidence.activeMs, 9000);
  }
});

test('the same spec repeated is one variant; a wrong answer resets and records its misconception', () => {
  const spec = fx('fx-k-count-apples');
  let state = createLearner('learner', 'K');
  for (let i = 0; i < 3; i++) state = answer(state, spec, i, { at: at(0, i) });
  assert.equal(state.progress['K.CC.B.5']!.concept, 'developing', 'repeating identical content never certifies');
  state = answer(state, { ...spec, id: 'other' }, 9, { at: at(0, 9), response: { type: 'numeric', value: '6' } });
  const last = state.attempts.at(-1)!;
  assert.equal(last.correct, false);
  assert.equal(last.source === 'ai-spec' && last.spec.misconceptionTag, 'skipped_object');
  assert.equal(state.progress['K.CC.B.5']!.independentSuccesses, 0);
});

test('a multi-skill activity is evidence for each tagged skill; a dispute quarantines it for all of them', () => {
  const spec = { ...fx('fx-2-coins'), skillIds: ['2.MD.C.8', '2.NBT.B.5'] };
  let state = createLearner('learner', 2);
  state = answer(state, spec, 1, { at: at(0, 1) });
  assert.ok(state.progress['2.MD.C.8'] && state.progress['2.NBT.B.5']);
  assert.equal(state.progress['2.NBT.B.5']!.independentSuccesses, 1);
  const quarantined = quarantineActivity(state, 'op:1', 'Learner reported a problem');
  assert.deepEqual(quarantined.progress, {}, 'disputed AI evidence never contributes');
  assert.ok(quarantined.attempts[0]!.excluded, 'but remains auditable');
});

function stored(state: LearnerState) {
  return state.attempts.map(e => ({ id: e.id, activityId: e.activityId, sessionId: 'session', createdAt: e.at, data: JSON.parse(JSON.stringify(e)) }));
}
test('restore re-validates and re-grades stored AI evidence; fabricated correctness is ignored', () => {
  const specs = countingVariants();
  let state = createLearner('learner', 'K');
  for (let i = 0; i < 3; i++) state = answer(state, specs[i]!, i, { at: at(0, i) });
  const records = stored(state);
  assert.equal(needsSpecRestorer(null, records), true);
  const restored = restoreLearning({ id: 'learner', grade: 0 }, null, null, records, [], specRestorer);
  assert.deepEqual(restored.learner, state);
  assert.throws(() => restoreLearning({ id: 'learner', grade: 0 }, null, null, records, []), LearningRecoveryError, 'fails closed without the verifier; nothing is reset');
  // A wrong stored answer flagged correct is re-graded as wrong.
  const forged = stored(answer(createLearner('learner', 'K'), specs[0]!, 1, { at: at(0, 1), response: { type: 'numeric', value: '13' } }));
  forged[0]!.data.correct = true; forged[0]!.data.independent = true;
  const regraded = restoreLearning({ id: 'learner', grade: 0 }, null, null, forged, [], specRestorer);
  assert.equal(regraded.learner.attempts[0]!.correct, false);
  // Content edited after the fact no longer matches its hash.
  const tampered = stored(state);
  (tampered[0]!.data.spec.content as ActivitySpec).response = { type: 'numeric', answer: 13, misconceptionAnswers: [] } as never;
  assert.throws(() => restoreLearning({ id: 'learner', grade: 0 }, null, null, tampered, [], specRestorer), LearningRecoveryError);
  const retagged = stored(state);
  retagged[0]!.data.spec.skillIds = ['8.G.B.7'];
  assert.throws(() => restoreLearning({ id: 'learner', grade: 0 }, null, null, retagged, [], specRestorer), LearningRecoveryError);
  assert.throws(() => verifySpecAttempt({ ...(state.attempts[0] as any).spec, response: { type: 'numeric', value: 'x'.repeat(5000) } }));
});

test('restore resumes the shown AI activity and its paid queue, dropping answered, disputed and invalid items', () => {
  const specs = [fx('fx-3-fraction-bar'), fx('fx-2-coins'), fx('fx-5-plant-the-tree'), fx('fx-4-add-eighths')];
  const q = (i: number) => ({ activityId: `op-1:${i}`, operationId: 'op-1', spec: specs[i] });
  let state = createLearner('learner', 3);
  state = answer(state, specs[1]!, 0, { at: at(0, 1) });
  const records = stored(state).map(r => ({ ...r, activityId: 'op-1:1', data: { ...r.data, activityId: 'op-1:1' } }));
  const session = { id: 'session', updatedAt: at(0, 5), data: { sessionId: 'session', activity: null, hintsUsed: 1, completed: 1,
    aiActivity: q(0), aiQueue: [q(1), q(2), q(3), { ...q(3) }, { activityId: 'op-1:9', operationId: 'op-1', spec: { ...specs[0], keyCheck: { value: '1/9' } } }, { activityId: 'x', operationId: 'op-2', spec: specs[0] }] } };
  assert.equal(needsSpecRestorer(session, []), true);
  const disputes = [{ id: 'd1', activityId: 'op-1:3', createdAt: at(0, 4), reason: 'Learner reported a problem' }];
  const restored = restoreLearning({ id: 'learner', grade: 3 }, null, session, records, disputes, specRestorer);
  assert.equal(restored.aiActivity?.activityId, 'op-1:0');
  assert.equal(restored.hintsUsed, 1, 'assistance on the shown activity survives a restart');
  assert.deepEqual(restored.aiQueue.map(i => i.activityId), ['op-1:2'], 'answered, disputed, duplicate and invalid items are not served');
  assert.equal(restored.droppedAi, 2);
  assert.equal(restored.activity, undefined);
  assert.throws(() => restoreLearning({ id: 'learner', grade: 3 }, null, session, records, disputes), LearningRecoveryError);
});
