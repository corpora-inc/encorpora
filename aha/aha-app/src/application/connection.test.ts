import assert from 'node:assert/strict';
import test from 'node:test';
import { SdkError } from '@free2z/sdk';
import { TutorServiceError } from '../provider/free2z';
import { DiagnosticsLog } from '../diagnostics/log';
import { chooseTutorModel, learningError, retryDeadline, SIGN_IN_NOT_COMPLETED, signInFailure } from './connection';

test('only advertised usable model IDs are selected, with sufficient output capacity', () => {
  assert.equal(chooseTutorModel({catalog_version: 1n, models: [
    {id: ''}, {id: 'tiny', max_output_tokens: 500n}, {id: 'current', max_output_tokens: 4096n},
  ]}), 'current');
  assert.throws(() => chooseTutorModel({catalog_version: 1n, models: []}), /No suitable/);
});
test('balance and consent exhaustion have distinct recovery instructions', () => {
  const cap = learningError(new SdkError('cap_exceeded'));
  assert.match(cap, /authorization/);
  assert.match(cap, /adding balance alone does not/);
  assert.match(learningError(new SdkError('insufficient_balance')), /balance cannot cover/);
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

// Native sign-in failure shapes, read from tauri-plugin-f2z at e95becd6: the Android
// Custom Tab (back/close/expiry) and iOS ASWebAuthenticationSession (cancel) both
// reject `authorize`, which the Rust mobile session turns into Error::Browser,
// serialized as {code: 'browser_error', retryable: false}.
const signInLog = () => new DiagnosticsLog({echo: false});

test('a user cancel of the native sign-in returns quietly with a neutral note', () => {
  for (const code of ['browser_error', 'access_denied', 'cancelled']) {
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
