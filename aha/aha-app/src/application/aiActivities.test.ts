/** TEST FIXTURES only: hand-authored specs from src/activity/fixtures stand in for model text. Not live AI. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtures } from '../activity/fixtures';
import { correctResponse, type LearnerResponse } from '../activity/grade';
import type { ActivitySpec } from '../activity/spec';
import { createLearner, getSkill, quarantineActivity, recordSpecAttempt, type LearnerState } from '../learning';
import { buildBatchRequest, gradeSpecAttempt, parseBatch, specRestorer, verifySpecAttempt } from './aiActivities';
import { restoreLearning, needsSpecRestorer, LearningRecoveryError } from './recovery';
import { activityBatchStrictJsonSchema } from '../activity/schema';

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
  assert.deepEqual(parsed.items.map(i => i.activityId), ['op-1:0', 'op-1:2', 'op-1:4'], 'stable ids from batch positions: a recovered batch maps to the same activities');
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

test('a skipped activity keeps its spent assistance across a restart; a bad count is dropped (#877)', () => {
  const specs = [fx('fx-3-fraction-bar'), fx('fx-2-coins'), fx('fx-5-plant-the-tree')];
  const q = (i: number, extra: object = {}) => ({ activityId: `op-1:${i}`, operationId: 'op-1', spec: specs[i], ...extra });
  const session = { id: 'session', updatedAt: at(0, 5), data: { sessionId: 'session', activity: null, hintsUsed: 0, completed: 0,
    aiActivity: q(0), aiQueue: [q(1, { hintsUsed: 2 }), q(2, { hintsUsed: -1 })] } };
  const restored = restoreLearning({ id: 'learner', grade: 3 }, null, session, [], [], specRestorer);
  assert.deepEqual(restored.aiQueue.map(i => [i.activityId, i.hintsUsed]), [['op-1:1', 2]]);
  assert.equal(restored.droppedAi, 1);
});

test('activity ids follow the original batch position, so a stricter validator cannot shift them onto other activities', () => {
  const specs = [fx('fx-3-fraction-bar'), fx('fx-2-coins'), fx('fx-3-pictograph')];
  const text = JSON.stringify({ rationale: 'r', activities: specs });
  const lenient = parseBatch(text, allIds(specs), 'op');
  const strict = parseBatch(text, allIds(specs.slice(1)), 'op'); // the first activity is now rejected
  assert.deepEqual(lenient.items.map(i => i.activityId), ['op:0', 'op:1', 'op:2']);
  assert.deepEqual(strict.items.map(i => [i.activityId, i.spec.id]), [['op:1', specs[1]!.id], ['op:2', specs[2]!.id]]);
});

type Node = Record<string, any>;
/**
 * Shape a value the way OpenAI strict mode does with the gateway's schema: every property present (null when unused)
 * and, because the gateway forwards the schema with members sorted by name (zuu#1132), keys in alphabetical order.
 * `order` reorders each object's keys to prove nothing depends on key order.
 */
/** The canonical activity in the strict wire shape: keyCheck travels inside the response (schema.ts). */
const toWire = (spec: any) => { const { keyCheck, ...rest } = spec; return keyCheck ? { ...rest, response: { ...rest.response, keyCheck } } : rest; };
function strictify(batch: any, schema: Node, order: (keys: string[]) => string[] = keys => [...keys].sort()): any {
  return strictNode({ ...batch, activities: batch.activities.map(toWire) }, schema, order);
}
function strictNode(value: any, schema: Node, order: (keys: string[]) => string[]): any {
  if (value === null || value === undefined) return null;
  if (Array.isArray(schema.anyOf)) {
    const branch = schema.anyOf.find((b: Node) => b.type !== 'null' && (!b.properties || (typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).every(k => k in b.properties) && (!b.properties.type?.enum || b.properties.type.enum.includes(value.type)))));
    if (!branch) throw new Error(`no strict-schema branch fits ${JSON.stringify(value).slice(0, 80)}`);
    return strictNode(value, branch, order);
  }
  if (Array.isArray(value)) return value.map(v => strictNode(v, schema.items, order));
  if (schema.properties) {
    const missing = Object.keys(value).filter(k => !(k in schema.properties));
    if (missing.length) throw new Error(`strict schema lacks ${missing.join(', ')}`);
    return Object.fromEntries(order(Object.keys(schema.properties)).map(k => [k, k in value ? strictNode(value[k], schema.properties[k], order) : null]));
  }
  return value;
}

test('the batch request carries the strict schema and the grammar-free prompt for structured output (#884)', async () => {
  const { activityBatchStrictJsonSchema } = await import('../activity/schema');
  const { ACTIVITY_GRAMMAR, STRUCTURED_OUTPUT_RULES } = await import('../activity/prompt');
  const request = buildBatchRequest(createLearner('learner', 3), 3, at(0));
  assert.equal(request.structured.name, 'aha_activity_batch');
  assert.equal(request.structured.schema, activityBatchStrictJsonSchema);
  assert.ok(request.system.includes(ACTIVITY_GRAMMAR));
  assert.equal(request.structured.system, request.system.replace(ACTIVITY_GRAMMAR, () => STRUCTURED_OUTPUT_RULES));
});

test('a strict structured-output reply (every key present, nulls, keys sorted by name) validates exactly like the prompt-only one', async () => {
  const specs = [fx('fx-3-fraction-bar'), fx('fx-2-coins'), fx('fx-5-plant-the-tree'), fx('fx-8-slope')];
  const promptOnly = JSON.stringify({ rationale: 'Mixed practice.', activities: specs });
  const strict = JSON.stringify(strictify({ rationale: 'Mixed practice.', activities: specs }, activityBatchStrictJsonSchema as Node));
  assert.ok(strict.indexOf('"activities"') < strict.indexOf('"rationale"'), 'alphabetical: activities before rationale');
  assert.ok(strict.includes(':null'), 'unused optional fields arrive as null');
  const window = allIds(specs);
  const a = parseBatch(promptOnly, window, 'op'), b = parseBatch(strict, window, 'op');
  assert.deepEqual(b.rejected, [], JSON.stringify(b.rejected));
  assert.deepEqual(b.items.map(i => i.activityId), a.items.map(i => i.activityId));
  assert.deepEqual(b.items.map(i => i.spec.id), specs.map(s => s.id));
});

test('a truncated structured-output reply keeps its complete activities, whatever the key order (zuu#1132)', () => {
  const specs = [fx('fx-3-fraction-bar'), fx('fx-2-coins'), fx('fx-5-plant-the-tree')];
  const window = allIds(specs);
  const orders: [string, (keys: string[]) => string[]][] = [['alphabetical', k => [...k].sort()], ['reverse alphabetical', k => [...k].sort().reverse()], ['rotated', k => [...k.slice(3), ...k.slice(0, 3)]]];
  for (const [name, order] of orders) {
    const full = JSON.stringify(strictify({ rationale: 'Mixed practice.', activities: specs }, activityBatchStrictJsonSchema as Node, order));
    // Cut inside the third activity, as a reply stopped by the output budget would be.
    const third = full.indexOf(JSON.stringify(specs[2]!.id));
    const parsed = parseBatch(full.slice(0, third + 5), window, 'op');
    assert.deepEqual(parsed.items.map(i => i.spec.id), [specs[0]!.id, specs[1]!.id], name);
    assert.deepEqual(parsed.items.map(i => i.activityId), ['op:0', 'op:1'], name);
    assert.equal(parsed.rejected.length, 1, name);
  }
});
test('only a reply cut off before its rationale may lack one; a missing or invalid rationale otherwise still rejects the batch', () => {
  const specs = [fx('fx-3-fraction-bar'), fx('fx-2-coins'), fx('fx-5-plant-the-tree')];
  const window = allIds(specs);
  const [a, b, c] = specs.map(s => JSON.stringify(s));
  // Not cut off (braces balance): one activity has a JSON slip and there is no rationale at all.
  // (An unbalanced slip cannot be told apart from a cut-off reply.)
  const slipped = `{"activities":[${a},${b!.replace('"id":', '"id"')},${c}]}`;
  assert.equal(parseBatch(slipped, window, 'op').items.length, 0);
  assert.equal(parseBatch(`{"rationale":"Mixed.","activities":[${a},${b!.replace('"id":', '"id"')},${c}]}`, window, 'op').items.length, 2, 'control: with a rationale the neighbours are kept');
  // Cut off, but the rationale that is present is not a string.
  assert.equal(parseBatch(`{"rationale":5,"activities":[${a},${b},${c!.slice(0, 40)}`, window, 'op').items.length, 0);
  // Cut off before any rationale: the complete activities are kept.
  assert.deepEqual(parseBatch(`{"activities":[${a},${b},${c!.slice(0, 40)}`, window, 'op').items.map(i => i.spec.id), [specs[0]!.id, specs[1]!.id]);
});
test('an id-first activity with a nested slip never costs its version-first neighbours (prompt-only recovery, #883 behaviour kept)', () => {
  const good = [fx('fx-k-count-apples'), fx('fx-2-coins'), fx('fx-5-plant-the-tree')];
  const { id, ...rest } = fx('fx-3-garden-perimeter');
  const idFirst = JSON.stringify({ id, ...rest }).replace('"points":[{"x"', '"points":["x"');
  const text = `{"rationale":"Mixed practice.","activities":[${good.map(g => JSON.stringify(g)).join(',')},${idFirst}]}`;
  const parsed = parseBatch(text, allIds([...good, fx('fx-3-garden-perimeter')]), 'op');
  assert.deepEqual(parsed.items.map(i => i.spec.id), good.map(g => g.id));
});
test('a structured reply cut off inside its trailing rationale keeps its complete activities; a complete invalid rationale still rejects', () => {
  const specs = [fx('fx-3-fraction-bar'), fx('fx-2-coins'), fx('fx-5-plant-the-tree')];
  const window = allIds(specs);
  const full = JSON.stringify(strictify({ rationale: 'Mixed practice.', activities: specs }, activityBatchStrictJsonSchema as Node));
  for (const end of ['"rati', '"rationale":', '"rationale":"', '"rationale":"Mixed p'])
    assert.equal(parseBatch(full.slice(0, full.indexOf('"rationale"')) + end, window, 'op').items.length, 3, end);
  const activitiesOnly = full.slice(0, full.indexOf(',"rationale"'));
  assert.equal(parseBatch(`${activitiesOnly},"rationale":"<b>x</b>"`, window, 'op').items.length, 0, 'a complete but invalid rationale rejects');
});
