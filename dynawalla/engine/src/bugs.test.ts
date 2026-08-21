import assert from "node:assert/strict";
import test from "node:test";
import { BUG_ACTIVE_THRESHOLD, BUG_DECAY, MAX_TRACKED_BUGS } from "./constants.ts";
import { ONE, ZERO, add, fromInt, fromRatio, mul } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";
import { classifyError, firingsToActivate, isBugActive, latencyShape, pruneBugs, updateBug } from "./bugs.ts";
import { NEW_BUG_STATE, bugKey } from "./types.ts";
import type { AttemptOutcome, BugState } from "./types.ts";

function outcome(overrides: Partial<AttemptOutcome> = {}): AttemptOutcome {
  return {
    correct: false,
    latencyMs: 5000,
    revisions: 0,
    itemDifficulty: ZERO,
    guessFloor: ZERO,
    fromChoice: false,
    evidenceWeight: ONE,
    ...overrides,
  };
}

test("bugs: β ← 0.9·β + 1 when the bug fires, and decays when it does not", () => {
  const first = updateBug(undefined, true);
  assert.equal(first.beta, ONE);
  assert.equal(first.firings, 1);

  const second = updateBug(first, true);
  assert.equal(second.beta, add(mul(BUG_DECAY, ONE), ONE), "0.9·1 + 1 = 1.9");
  assert.equal(second.beta, fromRatio(19, 10));

  const decayed = updateBug(second, false);
  assert.equal(decayed.beta, mul(BUG_DECAY, second.beta), "0.9·1.9 = 1.71");
  assert.equal(decayed.firings, 2, "a decay is not a firing");
});

test("bugs: three consecutive firings activate, and it takes a while to fall silent", () => {
  assert.equal(firingsToActivate(), 3);

  let state: BugState | undefined;
  assert.equal(isBugActive(state), false);
  state = updateBug(state, true);
  assert.equal(isBugActive(state), false, "one wrong answer is not a misconception");
  state = updateBug(state, true);
  assert.equal(isBugActive(state), false, "nor are two");
  state = updateBug(state, true);
  assert.equal(isBugActive(state), true, "β = 2.71");
  assert.ok(state.beta >= BUG_ACTIVE_THRESHOLD);

  let quiet = 0;
  while (isBugActive(state) && quiet < 20) {
    state = updateBug(state, false);
    quiet += 1;
  }
  // 2.71 → 2.439 → 2.195: two clean items put the bug back below the threshold,
  // so a child who stops making the mistake stops being treated as though they do.
  assert.equal(quiet, 2);
});

test("bugs: the tracker never subtracts from ability — it has no access to θ", () => {
  // Structural rather than behavioural: `updateBug` takes a bug state and a
  // boolean. There is no path from Layer B to θ, which is the point.
  assert.deepEqual(Object.keys(NEW_BUG_STATE).sort(), ["beta", "firings"]);
  assert.equal(updateBug(undefined, false).beta, ZERO);
});

test("bugs: a self-corrected answer is a slip and never increments a bug", () => {
  assert.equal(classifyError(outcome({ revisions: 2, misconception: "mis.add.borrow-across-zero" })), "slip");
  assert.equal(classifyError(outcome({ revisions: 0, misconception: "mis.add.borrow-across-zero" })), "misconception");
  assert.equal(classifyError(outcome({ revisions: 0 })), "unclassified");
  assert.equal(classifyError(outcome({ correct: true })), "unclassified");
  assert.equal(classifyError(outcome({ correct: true, revisions: 1 })), "slip");
});

test("bugs: the tracker is sparse and hard-capped", () => {
  const bugs: Record<string, BugState> = {};
  for (let i = 0; i < MAX_TRACKED_BUGS * 2; i++) {
    bugs[bugKey(`dw.add.regroup.skill-${String(i)}`, "mis.add.carry-dropped")] = {
      beta: fromInt(i) as Fix,
      firings: i,
    };
  }
  const pruned = pruneBugs(bugs);
  assert.equal(Object.keys(pruned).length, MAX_TRACKED_BUGS);
  const smallest = Math.min(...Object.values(pruned).map((state) => state.beta));
  assert.equal(smallest, fromInt(MAX_TRACKED_BUGS), "the least current evidence is what gets dropped");
  assert.equal(Object.keys(pruneBugs({})).length, 0);
});

test("bugs: latency shape separates a slip from a confident error from no idea", () => {
  assert.equal(latencyShape(ZERO), "fast");
  assert.equal(latencyShape(fromRatio(9, 10)), "fast");
  assert.equal(latencyShape(fromInt(1)), "confident");
  assert.equal(latencyShape(fromRatio(19, 10)), "confident");
  assert.equal(latencyShape(fromInt(2)), "stalled");
  assert.equal(latencyShape(fromInt(9)), "stalled");
});
