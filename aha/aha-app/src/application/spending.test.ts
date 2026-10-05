import assert from 'node:assert/strict';
import test from 'node:test';
import { describeBudget, spendingSummary } from './spending';

test('the app budget reads as amount and period, or "No app budget"', () => {
  assert.equal(describeBudget(null), 'No app budget');
  assert.equal(describeBudget({period: 'total', limit2z: 500n}), '500 2Z in total');
  assert.equal(describeBudget({period: 'day', limit2z: 1n}), '1 2Z per day');
  assert.equal(describeBudget({period: 'week', limit2z: 25n}), '25 2Z per week');
  assert.equal(describeBudget({period: 'month', limit2z: 100n}), '100 2Z per month');
  assert.equal(describeBudget(undefined), undefined, 'unknown until a grant is read');
});
test('the summary shows the budget remainder only when a budget exists, and the batch cost from the settled charge first', () => {
  const month = {period: 'month' as const, limit2z: 100n};
  assert.deepEqual(spendingSummary(month, {capRemainingMilli2z: 97500n, batchEstimate2z: 4n, batchCharge2z: 3n}),
    {budget: '100 2Z per month', budgetLeft: '97.5 2Z', batchCost: 'About 3 2Z'});
  assert.deepEqual(spendingSummary(month, {batchEstimate2z: 4n}), {budget: '100 2Z per month', batchCost: 'Up to 4 2Z'});
  assert.deepEqual(spendingSummary(null, {capRemainingMilli2z: null, batchCharge2z: 2n}), {budget: 'No app budget', batchCost: 'About 2 2Z'});
  assert.deepEqual(spendingSummary(null, {capRemainingMilli2z: 5000n}), {budget: 'No app budget'}, 'no remainder without a budget');
  assert.deepEqual(spendingSummary(undefined, {}), {});
});
