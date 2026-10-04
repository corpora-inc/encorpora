import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtures } from '../activity/fixtures';
import { MAX_QUEUE, PREFETCH_AT, activityIdFor, mergeBatch, pruneQueue, shouldPrefetch, takeNext, type QueuedActivity } from './aiQueue';

const item = (op: string, i: number): QueuedActivity => ({ activityId: activityIdFor(op, i), operationId: op, spec: fixtures[i % fixtures.length]! });
const none = { attempted: new Set<string>(), disputed: new Set<string>() };

test('prefetch is single-flight, signed-in only, respects the backoff, and fires at <=1 queued', () => {
  const ready = { queueLength: PREFETCH_AT, inFlight: false, signedIn: true, aiDue: true };
  assert.equal(PREFETCH_AT, 1);
  assert.equal(shouldPrefetch(ready), true);
  assert.equal(shouldPrefetch({ ...ready, queueLength: 0 }), true);
  assert.equal(shouldPrefetch({ ...ready, queueLength: 2 }), false, 'enough queued: no paid call yet');
  assert.equal(shouldPrefetch({ ...ready, inFlight: true }), false, 'never two batch requests at once');
  assert.equal(shouldPrefetch({ ...ready, signedIn: false }), false, 'signed-out practice never calls AI');
  assert.equal(shouldPrefetch({ ...ready, aiDue: false }), false, 'fallback backoff / Retry-After gate prefetch too');
});

test('a batch delivered twice is queued once; evidence, disputes and the current item are skipped', () => {
  const batch = [item('op1', 0), item('op1', 1), item('op1', 2)];
  const first = mergeBatch([], batch, none);
  assert.equal(first.added, 3);
  const again = mergeBatch(first.queue, batch, none);
  assert.equal(again.added, 0, 'restart between queue save and acknowledgement does not duplicate');
  assert.deepEqual(again.queue.map(q => q.activityId), batch.map(b => b.activityId));
  const filtered = mergeBatch([], batch, { attempted: new Set([batch[0]!.activityId]), disputed: new Set([batch[1]!.activityId]), current: batch[2]!.activityId });
  assert.equal(filtered.added, 0);
});

test('the queue is bounded so a runaway prefetch cannot grow the session record', () => {
  const many = Array.from({ length: MAX_QUEUE + 5 }, (_, i) => item('op', i));
  const merged = mergeBatch([], many, none);
  assert.equal(merged.queue.length, MAX_QUEUE);
  assert.equal(merged.added, MAX_QUEUE);
});

test('takeNext serves model order; a stretch takes the most challenging queued activity', () => {
  const queue = [item('op', 0), item('op', 39), item('op', 2)];
  assert.equal(takeNext(queue).next?.activityId, queue[0]!.activityId);
  assert.equal(takeNext(queue).rest.length, 2);
  const hardest = queue.reduce((a, b) => b.spec.difficulty > a.spec.difficulty ? b : a);
  assert.equal(takeNext(queue, true).next?.activityId, hardest.activityId);
  assert.deepEqual(takeNext([]), { rest: [] });
});

test('pruning drops answered and disputed activities after a backup restore', () => {
  const queue = [item('op', 0), item('op', 1), item('op', 2)];
  const pruned = pruneQueue(queue, { attempted: new Set([queue[0]!.activityId]), disputed: new Set([queue[2]!.activityId]) });
  assert.deepEqual(pruned.map(q => q.activityId), [queue[1]!.activityId]);
});
