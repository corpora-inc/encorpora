import assert from 'node:assert/strict';
import test from 'node:test';
import { SdkError } from '@free2z/sdk';
import { TutorServiceError } from '../provider/free2z';
import { chooseTutorModel, learningError, retryDeadline } from './connection';

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
