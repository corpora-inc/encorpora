import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FREE_PROBLEMS,
  TRIAL_WORKBOOK_EVERY,
  TRIAL_WORKBOOKS_MAX,
  trialWorkbookAllowance,
} from "../src/server/trials";
import { unlockedTrialWorkbook } from "../src/learning/trial-workbooks";

test("the first workbook is immediate, then every 20 problems up to five", () => {
  assert.equal(TRIAL_WORKBOOK_EVERY, 20);
  assert.equal(TRIAL_WORKBOOKS_MAX, 5);
  const free = DEFAULT_FREE_PROBLEMS;
  const earned = (used: number) => trialWorkbookAllowance(used, 0, free).earned;
  assert.deepEqual(
    [0, 1, 19, 20, 39, 40, 60, 80, 99, 100].map(earned),
    [1, 1, 1, 2, 2, 3, 4, 5, 5, 5],
  );
  // More free problems never earn more than five.
  assert.equal(trialWorkbookAllowance(1000, 0, 1000).earned, 5);
  assert.equal(trialWorkbookAllowance(1000, 0, 1000).total, 5);
  assert.equal(trialWorkbookAllowance(1000, 0, 1000).nextAt, null);
  // A smaller allowance (AMP_FREE_PROBLEMS) offers only what it can reach.
  assert.deepEqual(trialWorkbookAllowance(10, 0, 10), {
    total: 1,
    earned: 1,
    made: 0,
    available: 1,
    nextAt: null,
  });
  assert.equal(trialWorkbookAllowance(0, 0, 0).total, 0);
  assert.equal(trialWorkbookAllowance(30, 0, 30).total, 2);
  assert.equal(trialWorkbookAllowance(20, 0, 30).nextAt, null);
});

test("made workbooks use the allowance; the next unlock is named", () => {
  assert.deepEqual(trialWorkbookAllowance(45, 1, 100), {
    total: 5,
    earned: 3,
    made: 1,
    available: 2,
    nextAt: 60,
  });
  assert.deepEqual(trialWorkbookAllowance(45, 2, 100), {
    total: 5,
    earned: 3,
    made: 2,
    available: 1,
    nextAt: 60,
  });
  // Never negative, even if more were made (a learner adopted and licensed
  // keeps every workbook it made).
  assert.equal(trialWorkbookAllowance(20, 7, 100).available, 0);
  assert.deepEqual(trialWorkbookAllowance(100, 5, 100), {
    total: 5,
    earned: 5,
    made: 5,
    available: 0,
    nextAt: null,
  });
});

test("only the problem that crosses a multiple of 20 unlocks a workbook", () => {
  const unlocks = Array.from({ length: 101 }, (_, used) => [
    used,
    unlockedTrialWorkbook(used, 100),
  ]).filter(([, slot]) => slot !== null);
  assert.deepEqual(unlocks, [
    [20, 2],
    [40, 3],
    [60, 4],
    [80, 5],
  ]);
  assert.equal(unlockedTrialWorkbook(120, 200), null);
  assert.equal(unlockedTrialWorkbook(20, 10), null);
  assert.equal(unlockedTrialWorkbook(0, 100), null);
});
