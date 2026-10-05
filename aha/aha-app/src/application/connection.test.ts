import assert from 'node:assert/strict';
import test from 'node:test';
import { SdkError } from '@free2z/sdk';
import { TutorServiceError } from '../provider/free2z';
import { DiagnosticsLog } from '../diagnostics/log';
import { learningError, refusalAction, retryDeadline, SIGN_IN_NOT_COMPLETED, signInFailure } from './connection';

test('balance and app-budget exhaustion have distinct recovery instructions', () => {
  for (const cap of [learningError(new SdkError('cap_exceeded', {status: 403})), learningError(new TutorServiceError('cap_exceeded', 'x'))]) {
    assert.match(cap, /^App budget reached: raise it in Free2Z\./);
    assert.match(cap, /Adding 2Z alone does not change it/);
    assert.match(cap, /cost nothing/);
  }
  for (const low of [learningError(new SdkError('insufficient_balance', {status: 402})), learningError(new TutorServiceError('insufficient_balance', 'x'))]) {
    assert.match(low, /^Not enough 2Z: top up in Free2Z\./);
    assert.match(low, /cost nothing/);
    assert.doesNotMatch(low, /need/, 'no amount when Free2Z did not report one');
  }
});
test('a top-up message names the required amount when Free2Z reports it (native details or a local estimate)', () => {
  assert.match(learningError(new TutorServiceError('insufficient_balance', 'x', undefined, 7n)), /The next activities need 7 2Z\./);
  // The SDK decodes native refusal details with amounts as bigint (zuu #1136).
  assert.match(learningError(new SdkError('insufficient_balance', {status: 402, details: {required_2z: 12n, reason: 'insufficient_balance'}})), /need 12 2Z/);
  for (const odd of [0n, -1n, '12', 12, undefined])
    assert.doesNotMatch(learningError(new SdkError('insufficient_balance', {status: 402, details: {required_2z: odd}})), /need/, String(odd));
  // A budget refusal never claims that topping up fixes it, whatever amount it carries.
  assert.doesNotMatch(learningError(new TutorServiceError('cap_exceeded', 'x', undefined, 7n)), /top up/i);
});
test('only the two refusals offer a Free2Z action: top up, or raise the app budget', () => {
  assert.equal(refusalAction(new TutorServiceError('insufficient_balance', 'x')), 'top_up');
  assert.equal(refusalAction(new SdkError('insufficient_balance', {status: 402})), 'top_up');
  assert.equal(refusalAction(new TutorServiceError('cap_exceeded', 'x')), 'raise_budget');
  assert.equal(refusalAction(new SdkError('cap_exceeded', {status: 403})), 'raise_budget');
  for (const other of [new TutorServiceError('not_enough_2z', 'x'), new TutorServiceError('settlement_pending', 'x'), new SdkError('unavailable'), new Error('cap_exceeded'), undefined])
    assert.equal(refusalAction(other), undefined);
});
test('a platform that is not enforcing grants reads as AI not ready yet, with nothing charged', () => {
  assert.match(learningError(new TutorServiceError('ai_not_ready', 'x')), /isn’t switched on.*yet.*Nothing was charged/);
  assert.match(learningError(new TutorServiceError('budget_pending', 'x')), /still setting up.*Nothing was charged/);
});
test('capacity responses preserve wait requirements without exposing response metadata', () => {
  const error = new SdkError('unavailable', {retryAfterSeconds: 3.5, details: {private: 'DO_NOT_RENDER'}});
  assert.equal(retryDeadline(error, 100), 3600);
  assert.match(learningError(error), /Wait at least 4 seconds/);
  assert.doesNotMatch(learningError(error), /DO_NOT_RENDER/);
  assert.equal(retryDeadline(new SdkError('unavailable', {retryAfterSeconds: NaN})), undefined);
});

test('wrapped stream capacity errors still enforce Retry-After', () => {
  assert.equal(retryDeadline(new TutorServiceError('unavailable', 'Saved for recovery', 7), 200), 7200);
});

// Native sign-in failure shapes, read from tauri-plugin-f2z at d4d58ea3 (zuu #1138): a dismissed
// iOS ASWebAuthenticationSession or Android Custom Tab rejects `authorize` with `user_cancelled`,
// a session that could not be shown with `browser_unavailable`, the deadline with `timeout`, and
// anything else (and every rejection from an older plugin) with the `browser_error` fallback.
const signInLog = () => new DiagnosticsLog({echo: false});

test('a user cancel of the native sign-in returns quietly with a neutral note', () => {
  // user_cancelled (zuu #1138) is the person's choice; browser_error is the fallback from older plugins and
  // unclassified browser failures, kept quiet as before; access_denied and cancelled are declines and stops.
  for (const code of ['user_cancelled', 'browser_error', 'access_denied', 'cancelled']) {
    const log = signInLog();
    const outcome = signInFailure(new SdkError(code, {retryable: false}), log);
    assert.equal(outcome.quiet, true, code);
    assert.ok(outcome.quiet && outcome.note === SIGN_IN_NOT_COMPLETED, code);
    assert.doesNotMatch(SIGN_IN_NOT_COMPLETED, /could not|error|fail/i);
    assert.ok(!/\n/.test(SIGN_IN_NOT_COMPLETED) && SIGN_IN_NOT_COMPLETED.length <= 80, 'at most one short line');
    assert.deepEqual(log.entries().map(e => e.level), [code === 'browser_error' ? 'warn' : 'info'], `${code} is recorded, never as an error`);
    assert.match(log.entries()[0].message, new RegExp(code));
  }
});

test('a browser that could not open and a sign-in that timed out get their own kind messages', () => {
  const cases: [string, RegExp][] = [
    ['browser_unavailable', /could not open a browser/],
    ['timeout', /took too long/],
  ];
  for (const [code, pattern] of cases) {
    const log = signInLog();
    const outcome = signInFailure(new SdkError(code, {retryable: false}), log);
    assert.equal(outcome.quiet, false, code);
    assert.ok(!outcome.quiet && pattern.test(outcome.message), `${code}: ${!outcome.quiet && outcome.message}`);
    assert.ok(!outcome.quiet && /Connect Free2Z/.test(outcome.message), `${code}: says how to try again`);
    assert.ok(!outcome.quiet && !outcome.message.includes(code), 'codes stay out of learner-facing copy');
    assert.equal(log.entries()[0].level, 'error');
    assert.match(log.entries()[0].message, new RegExp(`\\[${code}\\]`));
  }
  const unavailable = signInFailure(new SdkError('browser_unavailable'), signInLog());
  const generic = signInFailure(new SdkError('brand_new_code'), signInLog());
  assert.ok(!unavailable.quiet && !generic.quiet && unavailable.message !== generic.message, 'not the generic message');
});

test('known sign-in failures get specific, kind messages and are logged', () => {
  const expectations: Record<string, RegExp> = {
    authentication_busy: /already open/,
    timeout: /took too long/,
    transport_error: /could not reach Free2Z/,
    storage_unavailable: /could not keep the Free2Z sign-in/,
    invalid_authentication_response: /could not be verified/,
    temporarily_unavailable: /temporarily unavailable/,
    invalid_scope: /not set up correctly/,
  };
  for (const [code, pattern] of Object.entries(expectations)) {
    const log = signInLog();
    const outcome = signInFailure(new SdkError(code), log);
    assert.equal(outcome.quiet, false, code);
    assert.ok(!outcome.quiet && pattern.test(outcome.message), `${code}: ${!outcome.quiet && outcome.message}`);
    assert.ok(!outcome.quiet && !/Refresh connection/.test(outcome.message), 'never points at an account-only action');
    assert.equal(log.entries()[0].level, 'error');
    assert.match(log.entries()[0].message, new RegExp(`\\[${code}\\]`));
  }
});

test('an unknown sign-in code is logged with its code and shown a generic message', () => {
  const log = signInLog();
  const outcome = signInFailure(new SdkError('brand_new_code'), log);
  assert.equal(outcome.quiet, false);
  assert.ok(!outcome.quiet && /Free2Z sign-in did not finish/.test(outcome.message));
  assert.ok(!outcome.quiet && !/brand_new_code/.test(outcome.message), 'codes stay out of learner-facing copy');
  assert.deepEqual(log.entries().map(e => [e.level, e.source]), [['error', 'sign-in']]);
  assert.match(log.entries()[0].message, /\[brand_new_code\]/);
  // A non-SDK throwable is never silent either.
  const other = signInLog();
  assert.equal(signInFailure(new TypeError('bridge exploded'), other).quiet, false);
  assert.match(other.entries()[0].message, /TypeError: bridge exploded/);
});
