import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
// @ts-expect-error plain .mjs dev script without type declarations
import { collectEntries, parseArgs } from './records.mjs';

function db() {
  const d = new DatabaseSync(':memory:');
  d.exec("CREATE TABLE records(account TEXT NOT NULL, profile TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(account,profile,kind,id))");
  const put = d.prepare('INSERT INTO records VALUES(?,?,?,?,?)');
  const spec = (id: string) => ({ version: 1, id, skillIds: ['3.OA.A.1'], prompt: [{ type: 'text', text: `Prompt ${id}` }, { type: 'figure', figureId: 'f' }] });
  put.run('acct', 'kid', 'activity', 'op1:0', JSON.stringify({ id: 'op1:0', createdAt: '2026-10-05T10:00:00.000Z', sessionId: 's', data: { id: 'op1:0', source: 'ai-spec', operationId: 'op1', spec: spec('a') } }));
  put.run('acct', 'kid', 'activity', 'op2:1', JSON.stringify({ id: 'op2:1', createdAt: '2026-10-05T11:00:00.000Z', sessionId: 's', data: { id: 'op2:1', source: 'ai-spec', operationId: 'op2', model: 'gpt-4o', spec: spec('b') } }));
  put.run('acct', 'kid', 'activity', 'op3:0', JSON.stringify({ id: 'op3:0', createdAt: '2026-10-05T12:00:00.000Z', sessionId: 's', data: { id: 'op3:0', source: 'ai-spec', operationId: 'op3', spec: spec('c') } }));
  put.run('acct', 'kid', 'activity', 'loc', JSON.stringify({ id: 'loc', createdAt: '2026-10-05T09:00:00.000Z', sessionId: 's', data: { id: 'loc', source: 'local', skillId: '5.NBT.A.3', prompt: 'Compare' } }));
  // The same activity id under another profile must not be joined to this profile's dispute.
  put.run('acct', 'other', 'activity', 'op1:0', JSON.stringify({ id: 'op1:0', createdAt: '2026-10-01T00:00:00.000Z', sessionId: 's', data: { id: 'op1:0', source: 'ai-spec', operationId: 'x', spec: spec('wrong') } }));
  put.run('acct', 'kid', 'dispute', 'd2', JSON.stringify({ id: 'd2', activityId: 'op2:1', createdAt: '2026-10-05T11:05:00.000Z', reason: 'Learner reported a problem' }));
  put.run('acct', 'kid', 'dispute', 'd1', JSON.stringify({ id: 'd1', activityId: 'op1:0', createdAt: '2026-10-05T10:05:00.000Z', reason: 'Learner reported a problem' }));
  put.run('acct', 'kid', 'dispute', 'd3', JSON.stringify({ id: 'd3', activityId: 'loc', createdAt: '2026-10-05T09:05:00.000Z', reason: 'Learner reported a problem' }));
  return d;
}

test('flags join their own activity, oldest first, with model and skill', () => {
  const entries = collectEntries(db());
  assert.deepEqual(entries.map((e: { flagId: string }) => e.flagId), ['d3', 'd1', 'd2']);
  const [local, a, b] = entries;
  assert.equal(a.spec.id, 'a'); assert.equal(a.model, null); assert.equal(a.activityCreatedAt, '2026-10-05T10:00:00.000Z');
  assert.equal(a.prompt, 'Prompt a'); assert.deepEqual(a.skillIds, ['3.OA.A.1']);
  assert.equal(b.model, 'gpt-4o'); assert.equal(b.flaggedAt, '2026-10-05T11:05:00.000Z');
  assert.equal(local.spec, null); assert.equal(local.source, 'local'); assert.deepEqual(local.skillIds, ['5.NBT.A.3']);
});

test('--all-ai adds unflagged AI activities once; --since filters by flag or creation time', () => {
  const all = collectEntries(db(), { allAi: true });
  assert.deepEqual(all.map((e: { activityId: string; flagged: boolean }) => `${e.activityId}:${e.flagged}`),
    ['op1:0:false', 'loc:true', 'op1:0:true', 'op2:1:true', 'op3:0:false']);
  assert.equal(all[0].profile, 'other');
  const recent = collectEntries(db(), { allAi: true, since: '2026-10-05T11:00:00.000Z' });
  assert.deepEqual(recent.map((e: { activityId: string }) => e.activityId), ['op2:1', 'op3:0']);
});

test('arguments: serial from flag or ANDROID_SERIAL, strict values', () => {
  assert.deepEqual(parseArgs([], { ANDROID_SERIAL: 'R3G' }), { serial: 'R3G', since: undefined, allAi: false });
  assert.deepEqual(parseArgs(['--serial', 'X', '--all-ai', '--since', '2026-10-05'], { ANDROID_SERIAL: 'R3G' }),
    { serial: 'X', since: '2026-10-05T00:00:00.000Z', allAi: true });
  assert.throws(() => parseArgs(['--since', 'yesterday']), /ISO/);
  assert.throws(() => parseArgs(['--serial']), /needs a value/);
  assert.throws(() => parseArgs(['--bogus']), /Unknown argument/);
});
