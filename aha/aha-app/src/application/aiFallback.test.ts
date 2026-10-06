import assert from 'node:assert/strict';
import test from 'node:test';
import { SdkError } from '@free2z/sdk';
import { TutorServiceError } from '../provider/free2z';
import { AiBackoff, aiFallbackStatus, logAiFallback } from './aiFallback';

test('a fresh backoff tries AI immediately', () => {
  assert.equal(new AiBackoff().shouldTryAi(0), true);
});

test('after a failure, AI is retried only after N local tasks or M seconds', () => {
  const backoff = new AiBackoff({baseTasks: 3, baseMs: 60_000, maxTasks: 12, maxMs: 600_000});
  backoff.recordFailure(1_000);
  assert.equal(backoff.degraded, true);
  assert.equal(backoff.shouldTryAi(1_000), false, 'never retries on the very next task');
  backoff.recordLocalTask(); backoff.recordLocalTask();
  assert.equal(backoff.shouldTryAi(30_000), false, 'two tasks, thirty seconds is too soon');
  backoff.recordLocalTask();
  assert.equal(backoff.shouldTryAi(30_000), true, 'three local tasks re-enable an AI attempt');
  const timed = new AiBackoff({baseTasks: 3, baseMs: 60_000, maxTasks: 12, maxMs: 600_000});
  timed.recordFailure(0);
  assert.equal(timed.shouldTryAi(59_999), false);
  assert.equal(timed.shouldTryAi(60_000), true, 'sixty seconds re-enable an AI attempt without more tasks');
});

test('consecutive failures back off exponentially up to a cap; success resets', () => {
  const backoff = new AiBackoff({baseTasks: 3, baseMs: 60_000, maxTasks: 12, maxMs: 600_000});
  backoff.recordFailure(0);
  backoff.recordFailure(0);
  for (let i = 0; i < 5; i++) backoff.recordLocalTask();
  assert.equal(backoff.shouldTryAi(119_999), false, 'second failure doubles both the task and time gap');
  backoff.recordLocalTask();
  assert.equal(backoff.shouldTryAi(1), true);
  for (let i = 0; i < 10; i++) backoff.recordFailure(0);
  assert.equal(backoff.shouldTryAi(599_999), false);
  assert.equal(backoff.shouldTryAi(600_000), true, 'time gap is capped');
  backoff.recordSuccess();
  assert.equal(backoff.degraded, false);
  assert.equal(backoff.shouldTryAi(0), true);
});

test('a service Retry-After deadline is never shortened by the task gap', () => {
  const backoff = new AiBackoff({baseTasks: 1, baseMs: 1_000, maxTasks: 1, maxMs: 1_000});
  backoff.recordFailure(0, 30_000);
  backoff.recordLocalTask();
  assert.equal(backoff.shouldTryAi(29_999), false);
  assert.equal(backoff.shouldTryAi(30_000), true);
});

test('local tasks served while healthy do not accumulate credit for a later failure', () => {
  const backoff = new AiBackoff({baseTasks: 3, baseMs: 60_000, maxTasks: 12, maxMs: 600_000});
  for (let i = 0; i < 5; i++) backoff.recordLocalTask();
  backoff.recordFailure(0);
  assert.equal(backoff.shouldTryAi(1), false);
});

test('fallback status explains the cause and that local practice continues in this account', () => {
  const pending = aiFallbackStatus(new TutorServiceError('settlement_pending', 'An earlier AI request still needs receipt recovery. No new paid request was sent.'));
  assert.match(pending, /receipt recovery/);
  assert.match(pending, /Local practice continues in this account/);
  assert.doesNotMatch(pending, /Sign out/);
  const outage = aiFallbackStatus(new SdkError('unavailable', {details: {private: 'DO_NOT_RENDER'}}));
  assert.match(outage, /temporarily unavailable/);
  assert.doesNotMatch(outage, /DO_NOT_RENDER/);
  // A low balance is a neutral statement: said once, with no call to buy or add 2Z.
  const low = aiFallbackStatus(new SdkError('insufficient_balance', {status: 402}));
  assert.equal(low.match(/Local practice continues/g)?.length, 1, low);
  assert.match(low, /AI tutoring will be tried again on a later task\.$/);
  assert.doesNotMatch(low, /top up|top-up|buy|purchase|add(ing)? 2Z|\$/i);
});

test('fallback is logged visibly with context, without SDK response details', () => {
  const calls: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { calls.push(args); };
  try { logAiFallback('next activity', new SdkError('unavailable', {details: {private: 'DO_NOT_LOG'}})); }
  finally { console.error = original; }
  assert.equal(calls.length, 1);
  const text = JSON.stringify(calls[0]);
  assert.match(text, /local practice/i);
  assert.match(text, /next activity/);
  assert.match(text, /unavailable/);
  assert.doesNotMatch(text, /DO_NOT_LOG/);
});

test('a blocked attempt explains itself for the diagnostics log', () => {
  const backoff = new AiBackoff({baseTasks: 3, baseMs: 60_000, maxTasks: 12, maxMs: 600_000});
  assert.equal(backoff.blockedReason(0), undefined, 'fresh: due, nothing to explain');
  backoff.recordFailure(0);
  backoff.recordLocalTask();
  assert.equal(backoff.blockedReason(15_000), 'backing off after 1 failed AI attempt; retrying after 2 more local tasks or in 45 s');
  assert.equal(backoff.shouldTryAi(15_000), false);
  backoff.recordLocalTask(); backoff.recordLocalTask();
  assert.equal(backoff.blockedReason(15_000), undefined, 'due again exactly when shouldTryAi says so');
  const retry = new AiBackoff();
  retry.recordFailure(0, 30_000);
  assert.match(retry.blockedReason(10_000)!, /Free2Z asked to retry in 20 s/);
});
