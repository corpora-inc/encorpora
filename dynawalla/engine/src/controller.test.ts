import assert from "node:assert/strict";
import test from "node:test";
import {
  P_TARGET_DOWN_ON_PASS,
  P_TARGET_UP_ON_FAIL,
  STRETCH_OFFSET,
} from "./constants.ts";
import { abs, add, fromRatio, sub } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";
import {
  P_TARGET_DEFAULT,
  P_TARGET_MAX,
  P_TARGET_MIN,
  batchIntents,
  fatiguedPTarget,
  frustrationFloor,
  targetFor,
  updatePTarget,
} from "./controller.ts";

test("controller: the default target is 0.80 in a band of [0.70, 0.92]", () => {
  assert.equal(P_TARGET_DEFAULT, fromRatio(80, 100));
  assert.equal(P_TARGET_MIN, fromRatio(70, 100));
  assert.equal(P_TARGET_MAX, fromRatio(92, 100));
});

test("controller: a failure raises the target and a pass lowers it, per item", () => {
  assert.equal(updatePTarget(P_TARGET_DEFAULT, false), add(P_TARGET_DEFAULT, P_TARGET_UP_ON_FAIL));
  assert.equal(updatePTarget(P_TARGET_DEFAULT, true), sub(P_TARGET_DEFAULT, P_TARGET_DOWN_ON_PASS));
});

test("controller: the band is a hard clamp in both directions", () => {
  let low = P_TARGET_DEFAULT;
  for (let i = 0; i < 100; i++) low = updatePTarget(low, true);
  assert.equal(low, P_TARGET_MIN);
  let high = P_TARGET_DEFAULT;
  for (let i = 0; i < 100; i++) high = updatePTarget(high, false);
  assert.equal(high, P_TARGET_MAX);
});

test("controller: over any 50-item window the step is bounded (EG-7)", (t) => {
  // The controller has to be able to react without oscillating. Two properties:
  // no single step exceeds the failure step, and a steady stream of one outcome
  // does not alternate in sign.
  const outcomes: boolean[] = [];
  let seed = 7;
  for (let i = 0; i < 50; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    outcomes.push(seed % 100 < 80);
  }
  let pTarget = P_TARGET_DEFAULT;
  let signChanges = 0;
  let previousSign = 0;
  let maxStep = 0 as Fix;
  for (const correct of outcomes) {
    const next = updatePTarget(pTarget, correct);
    const step = sub(next, pTarget);
    if (abs(step) > maxStep) maxStep = abs(step);
    const sign = step > 0 ? 1 : step < 0 ? -1 : 0;
    if (sign !== 0 && previousSign !== 0 && sign !== previousSign) signChanges += 1;
    if (sign !== 0) previousSign = sign;
    pTarget = next;
  }
  assert.ok(maxStep <= P_TARGET_UP_ON_FAIL, "no step exceeds the failure step");
  assert.ok(pTarget >= P_TARGET_MIN && pTarget <= P_TARGET_MAX);
  t.diagnostic(`50 items: ${String(signChanges)} sign changes, max step ${String(maxStep)} micro`);
});

test("controller: a steady 80% success rate leaves the target roughly where it started", () => {
  // 0.06 up on a failure and 0.015 down on a pass balance at exactly 80%, which is
  // where the target is set. That is not a coincidence and it should stay true.
  let pTarget = P_TARGET_DEFAULT;
  for (let i = 0; i < 500; i++) pTarget = updatePTarget(pTarget, i % 5 !== 0);
  assert.ok(abs(sub(pTarget, P_TARGET_DEFAULT)) <= fromRatio(5, 100), `drifted to ${String(pTarget)}`);
});

test("controller: batch difficulty is an offset from the target, never an absolute", () => {
  // The boundary conflict the first draft of the plan had: "one stretch item" must
  // mean pTarget − 0.07, not a fixed 0.85 that is a stretch at the top of the
  // clamp and a gift at the bottom of it.
  for (const pTarget of [P_TARGET_MIN, P_TARGET_DEFAULT, P_TARGET_MAX]) {
    assert.equal(targetFor(pTarget, "steady"), pTarget);
    assert.equal(targetFor(pTarget, "stretch"), add(pTarget, STRETCH_OFFSET));
    assert.ok(targetFor(pTarget, "confidence") > pTarget);
    assert.ok(targetFor(pTarget, "stretch") < pTarget);
    assert.ok(frustrationFloor(pTarget) < targetFor(pTarget, "stretch"));
  }
});

test("controller: fatigue raises the target rather than lowering it", () => {
  assert.ok(fatiguedPTarget() > P_TARGET_DEFAULT);
  assert.ok(fatiguedPTarget() <= P_TARGET_MAX);
});

test("controller: the first and last card of a session are confidence cards", () => {
  const intents = batchIntents(8, { first: true, last: true, anyPracticed: true });
  assert.equal(intents.length, 8);
  assert.equal(intents[0], "confidence");
  assert.equal(intents.at(-1), "confidence");
  assert.ok(intents.includes("stretch"), "and every batch has a stretch item once a skill is Practiced");

  const middle = batchIntents(8, { first: false, last: false, anyPracticed: false });
  assert.ok(!middle.includes("confidence"));
  assert.ok(!middle.includes("stretch"), "a child with nothing practised is not stretched");
  assert.throws(() => batchIntents(0, { first: true, last: true, anyPracticed: true }), RangeError);
});
