import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateModelStats, appendBatch, describeModelStats, MAX_BATCH_LOG, modelStatsLines, readBatchLog, type BatchRecord } from './modelStats.ts';

const batch = (op: string, model: string, kept: number, schema = 0, semantic = 0, extra: Partial<BatchRecord> = {}): BatchRecord =>
  ({op, model, day: '2026-10-05', structured: true, kept, schema, semantic, ...extra});

test('aggregates batches, rejections, flags, average charge and first-try correctness per model', () => {
  const stats = aggregateModelStats({
    batches: [batch('op-a', 'model-a', 4), batch('op-b', 'model-a', 2, 1, 1), batch('op-c', 'model-b', 0, 0, 0, {unreadable: true})],
    charges: [
      {operationId: 'op-a', model: 'model-a', charged2z: 3n}, {operationId: 'op-b', model: 'model-a', charged2z: 4n},
      {operationId: 'op-c', model: 'model-b', charged2z: 2n},
      {operationId: 'op-pending', model: 'model-b'}, // unsettled: no charge yet, not in the average
    ],
    answers: [
      {activityId: 'op-a:0', model: 'model-a', correct: true},
      {activityId: 'op-a:1', model: 'model-a', correct: false},
      {activityId: 'op-b:0', correct: true}, // written before attribution: the operation names the model
      {activityId: 'op-b:0', correct: false}, // the same activity again counts once
      {activityId: 'local-task', correct: true}, // local practice is not any model's
    ],
    flags: ['op-a:2', 'op-a:2', 'op-c:0', 'local-task'],
  });
  assert.deepEqual(stats.map(s => s.model), ['model-a', 'model-b']);
  const [a, b] = stats;
  assert.deepEqual({...a, charged2z: a!.charged2z.toString()}, {model: 'model-a', batches: 2, kept: 6, rejectedSchema: 1, rejectedSemantic: 1, unreadable: 0, flags: 1,
    chargedBatches: 2, charged2z: '7', answered: 3, firstTryCorrect: 2});
  assert.equal(b!.unreadable, 1); assert.equal(b!.flags, 1); assert.equal(b!.chargedBatches, 1);
  assert.equal(describeModelStats(a!), 'model-a: 2 sets · kept 6, rejected 1 schema + 1 semantic · 1 flagged · ≈ 3.5 2Z per set · 67% correct first try (3)');
  assert.equal(describeModelStats(b!), 'model-b: 1 set · kept 0, rejected 0 schema + 0 semantic, 1 unreadable · 1 flagged · ≈ 2 2Z per set · no answers yet');
});

test('a model known only from charges still appears; nothing at all gives one calm line', () => {
  const stats = aggregateModelStats({batches: [], charges: [{operationId: 'x', model: 'only-billed', charged2z: 5n}], answers: [], flags: []});
  assert.equal(describeModelStats(stats[0]!), 'only-billed: 0 sets · kept 0, rejected 0 schema + 0 semantic · 0 flagged · ≈ 5 2Z per set · no answers yet');
  assert.deepEqual(modelStatsLines([]), ['No AI activity sets yet.']);
});

test('the batch log appends once per operation, is bounded, and skips unreadable records', () => {
  let log: unknown = null;
  log = appendBatch(log, batch('op-1', 'm', 3));
  assert.equal(appendBatch(log, batch('op-1', 'm', 3)), undefined, 'a redelivered batch is not counted twice');
  assert.equal(appendBatch(log, {...batch('op-2', 'm', 3), model: 'bad id'}), undefined, 'invalid records are never written');
  assert.deepEqual(readBatchLog(log).map(b => b.op), ['op-1']);
  assert.deepEqual(readBatchLog({version: 1, batches: [batch('ok', 'm', 1), {op: 'x'}, 'junk', {...batch('extra', 'm', 1), name: 'Explorer'}]}).map(b => b.op), ['ok']);
  assert.deepEqual(readBatchLog({version: 2, batches: [batch('ok', 'm', 1)]}), [], 'unknown versions read as empty');
  for (let i = 0; i < MAX_BATCH_LOG + 5; i++) log = appendBatch(log, batch(`op-${i + 10}`, 'm', 1)) ?? log;
  const kept = readBatchLog(log);
  assert.equal(kept.length, MAX_BATCH_LOG);
  assert.equal(kept.at(-1)!.op, `op-${MAX_BATCH_LOG + 14}`, 'the most recent batches are kept');
});
