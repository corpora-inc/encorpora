import test from "node:test";
import assert from "node:assert/strict";
import { trialProgress, masteredSkills } from "../src/server/trial-progress";
import { freeProblemsSetting, trialLimits } from "../src/server/trials";
import { projectSkillEvidence } from "../src/server/evidence";
import type { Outcome } from "../src/server/repository";

let clock = Date.parse("2026-10-19T12:00:00Z");
const attempt = (skillId: string, correct: boolean, assisted = false) =>
  ({
    id: `a${clock}`,
    skillId,
    templateId: `${skillId}-t`,
    correct,
    assisted,
    createdAt: new Date((clock += 60000)).toISOString(),
  }) as Outcome;

test("the free run is placement, then adaptive practice, then complete", () => {
  const limits = trialLimits(100);
  assert.deepEqual(limits, { free: 100, placement: 20 });
  const run = (n: number) =>
    trialProgress(
      Array.from({ length: n }, () => attempt("a", true)),
      limits,
    );
  assert.equal(run(0).phase, "placement");
  assert.equal(run(19).phase, "placement");
  assert.equal(run(20).phase, "practice");
  assert.equal(run(99).phase, "practice");
  assert.equal(run(99).remaining, 1);
  assert.equal(run(100).phase, "complete");
  assert.equal(run(100).remaining, 0);
  assert.deepEqual(run(3).totals, {
    answered: 3,
    correct: 3,
    assisted: 0,
    skipped: 0,
  });
});

test("placement is a fifth of a small allowance and never more than twenty", () => {
  assert.deepEqual(trialLimits(10), { free: 10, placement: 2 });
  assert.deepEqual(trialLimits(3), { free: 3, placement: 1 });
  assert.deepEqual(trialLimits(1000), { free: 1000, placement: 20 });
});

test("AMP_FREE_PROBLEMS defaults to 100 and rejects malformed values", () => {
  assert.equal(freeProblemsSetting(undefined), 100);
  assert.equal(freeProblemsSetting(""), 100);
  assert.equal(freeProblemsSetting("12"), 12);
  for (const bad of ["0", "-5", "1.5", "abc", "1001", "12abc"])
    assert.throws(() => freeProblemsSetting(bad), /AMP_FREE_PROBLEMS/);
});

test("a skill counts as mastered only after an earlier miss and a review-ready streak", () => {
  const history = [
    attempt("fractions", false),
    attempt("fractions", true),
    attempt("fractions", true),
    attempt("fractions", true),
    // Never missed: already known, not mastered during the run.
    ...Array.from({ length: 5 }, () => attempt("known", true)),
    // Missed and still practicing.
    attempt("decimals", true, true),
    attempt("decimals", true),
  ];
  assert.deepEqual(masteredSkills(projectSkillEvidence(history)), []);
  const evidence = projectSkillEvidence([
    ...history,
    attempt("fractions", true),
  ]);
  assert.deepEqual(masteredSkills(evidence), ["fractions"]);
});
