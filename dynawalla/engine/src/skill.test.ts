import assert from "node:assert/strict";
import test from "node:test";
import {
  CREDIT_INCORRECT,
  EVIDENCE_FULL,
  EVIDENCE_HALVED,
  MASTERED_MARGIN,
  PRACTICED_MARGIN,
  PREREQ_PROPAGATION,
  RETIREMENT_DAYS,
} from "./constants.ts";
import { ONE, ZERO, abs, add, fromInt, fromRatio, mul, sub } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";
import { sigmoid } from "./math/logistic.ts";
import {
  applyAttempt,
  masteryFor,
  predictP,
  propagateToPrerequisite,
  seedSkill,
  updateRate,
} from "./skill.ts";
import { NEW_SKILL_STATE } from "./types.ts";
import type { AttemptOutcome, SkillState } from "./types.ts";

const EASY = ZERO;
const DAY = 100;

function outcome(overrides: Partial<AttemptOutcome> = {}): AttemptOutcome {
  return {
    correct: true,
    latencyMs: 3000,
    revisions: 0,
    itemDifficulty: ZERO,
    guessFloor: ZERO,
    fromChoice: false,
    evidenceWeight: EVIDENCE_FULL,
    ...overrides,
  };
}

function state(overrides: Partial<SkillState> = {}): SkillState {
  return { ...NEW_SKILL_STATE, ...overrides };
}

test("predictP: free entry has no guess floor, choice does", () => {
  assert.equal(predictP(ZERO, ZERO, ZERO), sigmoid(ZERO), "σ(0) with no floor");
  // c + (1 − c)·σ(0) with c = 1/4 is 0.25 + 0.75·0.5 = 0.625.
  assert.equal(predictP(ZERO, ZERO, fromRatio(1, 4)), fromRatio(625, 1000));
  // A four-way choice can never predict below its own floor, however hard the item.
  assert.ok(predictP(fromInt(-8), fromInt(4), fromRatio(1, 4)) >= fromRatio(1, 4));
  // σ(8) = 0.999665: an easy item for a strong child is nearly certain, never certain.
  assert.ok(predictP(fromInt(4), fromInt(-4), ZERO) > fromRatio(999, 1000));
  assert.ok(predictP(fromInt(4), fromInt(-4), ZERO) < ONE);
});

test("predictP: ability above item difficulty predicts better than a coin flip", () => {
  const above = predictP(fromInt(1), ZERO, ZERO);
  const level = predictP(ZERO, ZERO, ZERO);
  const below = predictP(fromInt(-1), ZERO, ZERO);
  assert.ok(above > level && level > below);
  assert.equal(add(above, below), ONE, "and the model is symmetric about a matched item");
});

test("updateRate: U(n) = 0.9 / (1 + 0.06n)", () => {
  assert.equal(updateRate(0), fromRatio(9, 10));
  // 0.9 / 1.6 = 0.5625 at n = 10.
  assert.equal(updateRate(10), fromRatio(5625, 10000));
  // 0.9 / 4 = 0.225 at n = 50.
  assert.equal(updateRate(50), fromRatio(225, 1000));
  let previous = updateRate(0);
  for (let n = 1; n <= 500; n++) {
    const rate = updateRate(n);
    assert.ok(rate < previous, `U(${String(n)}) should be below U(${String(n - 1)})`);
    assert.ok(rate > ZERO, "the update never reaches zero");
    previous = rate;
  }
  assert.throws(() => updateRate(-1), RangeError);
});

test("applyAttempt: a correct answer raises θ by U·w·(1 − P)", () => {
  const before = state();
  const result = applyAttempt(before, outcome(), EASY, DAY);
  const expected = mul(updateRate(0), sub(ONE, result.predicted));
  assert.equal(result.delta, expected);
  assert.equal(result.state.theta, add(before.theta, expected));
  assert.equal(result.state.attempts, 1);
  assert.equal(result.state.correct, 1);
  assert.equal(result.state.consecutiveFailures, 0);
});

test("applyAttempt: credit is asymmetric, so one mis-tap never craters a child", () => {
  const up = applyAttempt(state(), outcome({ correct: true }), EASY, DAY);
  const down = applyAttempt(state(), outcome({ correct: false }), EASY, DAY);
  assert.ok(up.delta > ZERO && down.delta < ZERO);
  // Both residuals are 0.5 in magnitude at θ = b, so the ratio is exactly the
  // asymmetric credit: a wrong answer moves θ by 0.7 of what a right one does.
  assert.equal(abs(down.delta), mul(abs(up.delta), CREDIT_INCORRECT));
});

test("applyAttempt: evidence weight scales the update without changing its sign", () => {
  const full = applyAttempt(state(), outcome(), EASY, DAY);
  const halved = applyAttempt(state(), outcome({ evidenceWeight: EVIDENCE_HALVED }), EASY, DAY);
  assert.equal(halved.delta, mul(full.delta, EVIDENCE_HALVED));
  assert.ok(halved.delta > ZERO);
});

test("applyAttempt: the update shrinks as evidence accumulates", () => {
  let current = state();
  let previous: Fix | undefined;
  for (let i = 0; i < 20; i++) {
    const result = applyAttempt(current, outcome({ itemDifficulty: current.theta }), EASY, DAY);
    if (previous !== undefined) assert.ok(result.delta < previous, `step ${String(i)} did not shrink`);
    previous = result.delta;
    current = result.state;
  }
});

test("applyAttempt: θ converges toward a child who gets a fixed item right about half the time", () => {
  // A crude but real behavioural check: alternating right and wrong on an item of
  // difficulty 1 should settle θ near 1, where P ≈ 0.5.
  let current = state({ theta: fromInt(-3) });
  for (let i = 0; i < 400; i++) {
    current = applyAttempt(current, outcome({ correct: i % 2 === 0, itemDifficulty: fromInt(1) }), EASY, DAY).state;
  }
  assert.ok(abs(sub(current.theta, fromInt(1))) < fromRatio(6, 10), `θ settled at ${String(current.theta)}`);
});

test("propagateToPrerequisite: a prerequisite takes 0.15× and nothing else", () => {
  const prereq = state({ theta: fromInt(1), attempts: 9, correct: 5 });
  const delta = fromRatio(4, 10);
  const moved = propagateToPrerequisite(prereq, delta);
  assert.equal(moved.theta, add(prereq.theta, mul(PREREQ_PROPAGATION, delta)));
  assert.equal(moved.attempts, prereq.attempts, "the prerequisite was not practised");
  assert.equal(moved.correct, prereq.correct);
  assert.equal(moved.level, prereq.level);
});

test("mastery: a choice item can never advance a skill past Practiced", () => {
  const strong = state({
    theta: add(EASY, add(MASTERED_MARGIN, fromInt(1))),
    attempts: 40,
    correct: 40,
    freeEntryEvidence: false,
  });
  assert.equal(masteryFor(strong, EASY, DAY), "practiced");
  assert.equal(masteryFor({ ...strong, freeEntryEvidence: true }, EASY, DAY), "mastered");
});

test("mastery: a correct free-entry answer is what unlocks the ceiling", () => {
  let current = state({
    theta: add(EASY, add(MASTERED_MARGIN, fromInt(2))),
    attempts: 40,
    correct: 40,
    level: "practiced",
    masteredSinceDay: DAY,
    lastFailureDay: DAY,
  });
  current = applyAttempt(current, outcome({ fromChoice: true, itemDifficulty: fromInt(-4) }), EASY, DAY).state;
  assert.equal(current.level, "practiced", "choice evidence alone stops here");
  current = applyAttempt(current, outcome({ fromChoice: false, itemDifficulty: fromInt(-4) }), EASY, DAY).state;
  assert.equal(current.level, "mastered");
});

test("mastery: promotion is never denied on latency alone (A-05)", () => {
  const base = state({
    theta: add(EASY, add(MASTERED_MARGIN, fromInt(1))),
    attempts: 40,
    correct: 40,
    freeEntryEvidence: true,
  });
  const slow = { ...base, phi: ZERO };
  const fluent = { ...base, phi: ONE };
  assert.equal(masteryFor(slow, EASY, DAY), masteryFor(fluent, EASY, DAY));
  assert.equal(masteryFor(slow, EASY, DAY), "mastered");
});

test("mastery: a Mastered skill unfailed for 21 days is Retired", () => {
  const mastered = state({
    theta: add(EASY, add(MASTERED_MARGIN, fromInt(1))),
    attempts: 40,
    correct: 40,
    freeEntryEvidence: true,
    level: "mastered",
    masteredSinceDay: DAY,
    lastFailureDay: DAY,
  });
  assert.equal(masteryFor(mastered, EASY, DAY + RETIREMENT_DAYS - 1), "mastered");
  assert.equal(masteryFor(mastered, EASY, DAY + RETIREMENT_DAYS), "retired");
  const recentlyFailed = { ...mastered, lastFailureDay: DAY + RETIREMENT_DAYS - 2 };
  assert.equal(masteryFor(recentlyFailed, EASY, DAY + RETIREMENT_DAYS), "mastered", "the clock restarts on a failure");
});

test("mastery: a retired skill comes back on a real failure, not on a quiet day", () => {
  const retired = state({
    theta: add(EASY, add(MASTERED_MARGIN, fromInt(1))),
    attempts: 40,
    correct: 40,
    freeEntryEvidence: true,
    level: "retired",
    consecutiveFailures: 0,
  });
  assert.equal(masteryFor(retired, EASY, DAY + 999), "retired");
  assert.equal(masteryFor({ ...retired, consecutiveFailures: 1 }, EASY, DAY), "practiced");
});

test("mastery: Practiced needs both attempts and ability", () => {
  const able = state({ theta: add(EASY, add(PRACTICED_MARGIN, fromInt(1))), attempts: 2 });
  assert.equal(masteryFor(able, EASY, DAY), "new", "two attempts is not evidence");
  assert.equal(masteryFor({ ...able, attempts: 6 }, EASY, DAY), "practiced");
  const practised = state({ theta: sub(EASY, fromInt(1)), attempts: 20 });
  assert.equal(masteryFor(practised, EASY, DAY), "new", "attempts without ability is not evidence either");
});

test("seedSkill: cold start places a child at a stated ability with no history", () => {
  const seeded = seedSkill(fromRatio(-4, 10), DAY);
  assert.equal(seeded.theta, fromRatio(-4, 10));
  assert.equal(seeded.attempts, 0);
  assert.equal(seeded.level, "new");
  assert.equal(seeded.lastSeenDay, DAY);
});

test("state: a skill record has no field that can grow", () => {
  // EG-3 is a claim about shape, not about usage: if every field is a bounded
  // scalar then 500 sessions cost exactly what 5 do.
  const populated = applyAttempt(state(), outcome(), EASY, DAY).state;
  for (const [key, value] of Object.entries(populated)) {
    assert.ok(
      typeof value === "number" || typeof value === "boolean" || typeof value === "string",
      `${key} is not a bounded scalar`,
    );
    if (typeof value === "string") {
      assert.ok(value.length <= 16, `${key} is an unbounded string`);
    }
  }
  assert.equal(Object.keys(populated).length, Object.keys(NEW_SKILL_STATE).length);
});
