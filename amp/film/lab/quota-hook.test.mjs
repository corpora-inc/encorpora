import test from 'node:test';
import assert from 'node:assert/strict';
import { canReserve, remainingBudget } from './quota-hook.mjs';

test('the last permitted character leaves the full reserve', () => {
  const state = { initial_remaining: 60_000, reserved_characters: 0 };
  assert.equal(canReserve(state, 60_000, 10_000), true);
  assert.equal(canReserve(state, 60_000, 10_001), false);
});
test('a delayed provider counter cannot release locally reserved characters', () => {
  const state = { initial_remaining: 60_000, reserved_characters: 8_000 };
  assert.equal(remainingBudget(state, 60_000), 52_000);
  assert.equal(canReserve(state, 60_000, 2_001), false);
});
test('spending by another producer is reflected in the live quota', () => {
  const state = { initial_remaining: 60_000, reserved_characters: 0 };
  assert.equal(canReserve(state, 50_100, 101), false);
});
test('unknown quota and invalid requests fail closed', () => {
  const state = { initial_remaining: 60_000, reserved_characters: 0 };
  assert.throws(() => canReserve(state, NaN, 1));
  assert.throws(() => canReserve(state, 60_000, -1));
  assert.throws(() => canReserve({}, 60_000, 1));
});
test('a reserve stop also stops later smaller takes', () => {
  const state = { initial_remaining: 60_000, reserved_characters: 0, reserve_stopped: true };
  assert.equal(canReserve(state, 60_000, 1), false);
});
