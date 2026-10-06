import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtures } from '../activity/fixtures';
import { BATCH_WAIT_MS, wantsRedrill, wantsRepeat, MAX_QUEUE, PREFETCH_AT, REMIX_GAPS, batchSizeFor, activityIdFor, mergeBatch, prefetchBlocked, pruneQueue, settlesWithin, shouldPrefetch, stopToken, takeForSkip, takeNext, type QueuedActivity } from './aiQueue';

const item = (op: string, i: number): QueuedActivity => ({ activityId: activityIdFor(op, i), operationId: op, spec: fixtures[i % fixtures.length]! });
const none = { attempted: new Set<string>(), disputed: new Set<string>() };

test('prefetch is single-flight, signed-in only, respects the backoff, and refills the bank early (<=20 banked)', () => {
  const ready = { queueLength: PREFETCH_AT, inFlight: false, signedIn: true, aiDue: true };
  assert.equal(PREFETCH_AT, 20, 'refill long before a 50-70 s batch could run the bank dry');
  assert.equal(shouldPrefetch(ready), true);
  assert.equal(shouldPrefetch({ ...ready, queueLength: 0 }), true);
  assert.equal(shouldPrefetch({ ...ready, queueLength: PREFETCH_AT + 1 }), false, 'enough banked: no paid call yet');
  assert.equal(shouldPrefetch({ ...ready, inFlight: true }), false, 'never two batch requests at once');
  assert.equal(shouldPrefetch({ ...ready, signedIn: false }), false, 'signed-out practice never calls AI');
  assert.equal(shouldPrefetch({ ...ready, aiDue: false }), false, 'fallback backoff / Retry-After gate prefetch too');
});

test('a low queue that is not refilled always has a reason to log; otherwise there is nothing to explain', () => {
  const low = { queueLength: 0, inFlight: false, signedIn: true, aiDue: false };
  assert.equal(prefetchBlocked(low, 'backing off after 1 failed AI attempt'), 'backing off after 1 failed AI attempt');
  assert.equal(prefetchBlocked(low), 'AI is not due yet', 'a reason even without a detail');
  assert.equal(prefetchBlocked({ ...low, aiDue: true }), undefined, 'due: the prefetch starts, no skip to log');
  assert.equal(prefetchBlocked({ ...low, queueLength: PREFETCH_AT + 1 }), undefined, 'not low yet');
  assert.equal(prefetchBlocked({ ...low, inFlight: true }), undefined, 'a batch is already on its way');
  assert.equal(prefetchBlocked({ ...low, signedIn: false }), undefined, 'signed-out practice is local by design');
});

test('the wait for a batch on its way is bounded and never rejects', async () => {
  assert.ok(BATCH_WAIT_MS > 0 && BATCH_WAIT_MS <= 10000, 'at most ten seconds (it ends at the first streamed activity)');
  assert.equal(await settlesWithin(Promise.resolve(), 50), true);
  assert.equal(await settlesWithin(Promise.reject(new Error('failed batch')), 50), true, 'a failed batch has settled too');
  assert.equal(await settlesWithin(new Promise(() => undefined), 20), false, 'a batch still on its way times out');
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

test('harder-than: a stretch above the shown difficulty takes the hardest harder one, or nothing (#877)', () => {
  const at = (id: string, difficulty: number): QueuedActivity => ({ ...item('op', 0), activityId: `op:${id}`, spec: { ...fixtures[0]!, difficulty } });
  const queue = [at('1', 3), at('2', 6), at('3', 8), at('4', 2)];
  assert.equal(takeNext(queue, true, 5).next?.activityId, 'op:3');
  assert.deepEqual(takeNext(queue, true, 5).rest.map(q => q.activityId), ['op:1', 'op:2', 'op:4']);
  const none = takeNext(queue, true, 8);
  assert.equal(none.next, undefined, 'an equal or easier activity is never offered as harder');
  assert.equal(none.rest.length, 4, 'nothing is dropped when nothing is taken');
  assert.equal(takeNext(queue, false, 8).next?.activityId, 'op:1', 'only a stretch filters');
});

test('requeueFront keeps a skipped activity first in line, once, with its spent assistance (#877)', () => {
  const box = new AiQueueBox([item('b', 1), item('b', 2)]);
  const skipped = { ...item('a', 0), hintsUsed: 2 };
  box.requeueFront(skipped);
  box.requeueFront(skipped);
  assert.deepEqual(box.items.map(q => q.activityId), ['a:0', 'b:1', 'b:2']);
  assert.equal(box.items[0]!.hintsUsed, 2);
});

// ---- Interleavings between a background batch delivery and the foreground (adversarial review) ----
import { AiQueueBox, deliverBatch, presentFromQueue } from './aiQueue';
function deferred<T = void>() { let resolve!: (v: T) => void, reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const tick = () => new Promise(r => setTimeout(r, 0));

test('HIGH: a batch delivered while the next activity is being saved is kept, not overwritten', async () => {
  const box = new AiQueueBox([item('a', 0)]);
  const write = deferred();
  const saved: string[][] = [];
  const showing = presentFromQueue(box, box.items[0]!, async rest => { saved.push(rest().map(q => q.activityId)); await write.promise; });
  await tick();
  box.merge([item('b', 1), item('b', 2)], none); // background delivery lands during the session write
  write.resolve();
  await showing;
  assert.deepEqual(box.items.map(q => q.activityId), ['b:1', 'b:2'], 'the paid batch stays queued');
  assert.deepEqual(saved, [[]]);
});

test('MED: a delivery that becomes stale during its awaits merges nothing and never acknowledges', async () => {
  const box = new AiQueueBox([]);
  const disputes = deferred<string[]>();
  let current = true; let acked = 0; let saves = 0;
  const delivering = deliverBatch(box, {
    operationId: 'op', items: [item('op', 0)],
    known: async () => ({ attempted: new Set<string>(), disputed: new Set(await disputes.promise) }),
    isCurrent: () => current,
    save: async () => { saves++; },
    acknowledge: async () => { acked++; },
  });
  current = false; // learner switch or sign-out while the disputes are loading
  disputes.resolve([]);
  assert.equal(await delivering, 'stale');
  assert.deepEqual(box.items, []);
  assert.equal(saves, 0); assert.equal(acked, 0, 'the completed reply stays saved for its own learner');
});

test('LOW: a failed queue save removes only what this delivery added and never acknowledges first', async () => {
  const box = new AiQueueBox([item('x', 0)]);
  const save = deferred();
  const order: string[] = [];
  const deps = {
    operationId: 'op', items: [item('op', 0), item('op', 1)],
    known: async () => none, isCurrent: () => true,
    save: async () => { order.push('save'); await save.promise; },
    acknowledge: async () => { order.push('ack'); },
  };
  const first = deliverBatch(box, deps);
  await tick();
  const second = deliverBatch(box, deps); // the same reply seen again by a foreground Continue
  box.remove('x:0'); // the learner moves on meanwhile
  save.reject(new Error('disk full'));
  await assert.rejects(first, /disk full/);
  await assert.rejects(second, /disk full/, 'the duplicate waits for the first save instead of acknowledging early');
  assert.deepEqual(box.items, [], 'rollback keeps the concurrent dequeue and removes only the undelivered batch');
  assert.deepEqual(order, ['save']);
});

test('a successful delivery saves once, then acknowledges; a duplicate only acknowledges', async () => {
  const box = new AiQueueBox([]);
  const order: string[] = [];
  const deps = { operationId: 'op', items: [item('op', 0)], known: async () => none, isCurrent: () => true,
    save: async () => { order.push('save'); }, acknowledge: async () => { order.push('ack'); } };
  assert.equal(await deliverBatch(box, deps), 'delivered');
  assert.equal(await deliverBatch(box, deps), 'delivered');
  assert.deepEqual(order, ['save', 'ack', 'ack']);
  assert.equal(box.items.length, 1);
});

test('a stop token stays stopped and releases a wait', async () => {
  const token = stopToken();
  assert.equal(token.stopped, false);
  const waiting = settlesWithin(Promise.race([new Promise(() => undefined), token.signal]), 1000);
  token.stop();
  assert.equal(await waiting, true, 'Stop ends the wait at once');
  assert.equal(token.stopped, true);
});

test('a skip takes a harder queued activity, else the next queued one, else nothing (#899)', () => {
  const at = (n: number, d: number): QueuedActivity => ({ ...item('op', n), spec: { ...item('op', n).spec, difficulty: d } });
  const onScreen = at(0, 5);
  const easy = at(1, 3), hard = at(2, 8), mid = at(3, 4);
  assert.equal(takeForSkip([easy, hard, mid], onScreen).next?.activityId, hard.activityId);
  assert.equal(takeForSkip([easy, mid], onScreen).next?.activityId, easy.activityId, 'no harder one: the next queued one');
  assert.deepEqual(takeForSkip([], onScreen), { rest: [] });
  assert.equal(takeForSkip([onScreen], onScreen).next, undefined, 'never returns the skipped activity itself');
});

test('a skipped activity requeues at the back, keeping its hints, without duplicates', () => {
  const a = item('op', 0), b = item('op', 1), c = item('op', 2);
  const box = new AiQueueBox([b, c]);
  box.requeueBack({ ...a, shown: true, hintsUsed: 2 });
  assert.deepEqual(box.items.map(q => q.activityId), [b.activityId, c.activityId, a.activityId]);
  assert.equal(box.items.at(-1)!.hintsUsed, 2);
  box.requeueBack({ ...a, shown: true, hintsUsed: 3 });
  assert.equal(box.length, 3);
  assert.equal(box.items.at(-1)!.hintsUsed, 3);
});

test('a set-aside activity is pruned from a restored queue', () => {
  const a = item('op', 0), b = item('op', 1);
  assert.deepEqual(pruneQueue([a, b], { attempted: new Set(), disputed: new Set([a.activityId]) }).map(q => q.activityId), [b.activityId]);
});

test('bank sizing: a small first batch on an empty bank, the model\'s full batch otherwise; a full refill always fits', async () => {
  const { FIRST_BATCH_ACTIVITIES, MAX_BATCH_ACTIVITIES } = await import('../provider/models.ts');
  assert.equal(batchSizeFor(0, 35), FIRST_BATCH_ACTIVITIES);
  assert.equal(batchSizeFor(0, 4), 4, 'never more than the model can write');
  assert.equal(batchSizeFor(3, 35), 35);
  assert.ok(MAX_QUEUE >= PREFETCH_AT + MAX_BATCH_ACTIVITIES, 'a refill landing at the threshold is never truncated');
  const banked = Array.from({ length: PREFETCH_AT }, (_, i) => item('old', i));
  const full = Array.from({ length: MAX_BATCH_ACTIVITIES }, (_, i) => item('new', i));
  assert.equal(mergeBatch(banked, full, none).added, MAX_BATCH_ACTIVITIES);
});

test('a missed activity returns later, unchanged and free, on a spaced schedule; a flag removes it and its remixes', () => {
  const box = new AiQueueBox(Array.from({ length: 40 }, (_, i) => item('op', i + 1)));
  const missed: QueuedActivity = { ...item('op', 0), hintsUsed: 2, shown: true };
  assert.equal(box.remix(missed), true);
  const at = box.items.findIndex(q => q.activityId === 'op:0:r1');
  assert.equal(at, REMIX_GAPS[0], 'after a few others');
  assert.equal(box.items[at]!.spec, missed.spec);
  assert.equal(box.items[at]!.hintsUsed, undefined, 'a fresh attempt: no carried hints');
  assert.equal(box.items[at]!.shown, undefined);
  assert.equal(box.remix(missed), false, 'the same content is already waiting');
  box.remove('op:0:r1');
  assert.equal(box.remix(box.items.length ? { ...missed, activityId: 'op:0:r1' } : missed), true, 'missed again: a second, longer gap');
  assert.equal(box.items.findIndex(q => q.activityId === 'op:0:r2'), REMIX_GAPS[1]);
  box.remove('op:0:r2');
  assert.equal(box.remix({ ...missed, activityId: 'op:0:r2' }), false, 'two rounds at most');
  box.remix(item('op', 50));
  assert.ok(box.items.some(q => q.activityId === 'op:50:r1'));
  box.removeContent('op:50');
  assert.ok(!box.items.some(q => q.activityId.startsWith('op:50')), 'a flagged activity never comes back, nor its remix');
});

test('re-present rule: retry-correct never repeats verbatim (re-drill instead); a final miss returns after ~12', () => {
  const corrected = { firstCorrect: false, finalCorrect: true, workedOpened: false };
  assert.equal(wantsRepeat(corrected), false, 'put right on the retry: no exact repeat');
  assert.equal(wantsRedrill(corrected), true, 'a fresh variant of the skill in the next batch instead');
  assert.equal(wantsRepeat({ ...corrected, finalCorrect: false }), true, 'final answer wrong: the exact activity returns');
  assert.equal(wantsRepeat({ ...corrected, workedOpened: true }), true, 'needed the worked explanation: it returns');
  assert.equal(wantsRedrill({ ...corrected, workedOpened: true }), false);
  assert.equal(wantsRepeat({ firstCorrect: true, finalCorrect: true, workedOpened: false }), false);
  assert.equal(wantsRedrill({ firstCorrect: true, finalCorrect: true, workedOpened: false }), false);
  const box = new AiQueueBox(Array.from({ length: 20 }, (_, i) => item('op', i + 1)));
  const shown: QueuedActivity = { ...item('op', 0), shown: true };
  // First answer wrong: the return is scheduled at once (durable), then withdrawn when the retry is right.
  box.remix(shown);
  assert.equal(box.items.findIndex(q => q.activityId === 'op:0:r1'), 12, 'a final miss comes back after ~12 others');
  assert.equal(box.unremix(shown), true);
  assert.ok(!box.items.some(q => q.activityId.startsWith('op:0')), 'corrected on the retry: never shown verbatim again');
  assert.equal(box.unremix(shown), false);
});

test('arrived() resolves when a streamed activity is banked', async () => {
  const box = new AiQueueBox();
  let landed = false;
  const wait = box.arrived().then(() => { landed = true; });
  box.merge([], none);
  await Promise.resolve();
  assert.equal(landed, false, 'nothing added: still waiting');
  box.merge([item('op', 0)], none);
  await wait;
  assert.equal(landed, true);
});
