/**
 * The two representation semantics a renderer has already got wrong once.
 *
 * Both bugs shipped in an earlier attempt at these representations and neither
 * was caught by reading the code. Both are properties of the **spec**, not of any
 * one renderer, so they are pinned here — in the library every pack imports —
 * rather than in a renderer that does not exist yet and will not be the last one.
 *
 * The renderers themselves went with the host (ADR-0022). These functions are
 * what replaces them: the number a tick stands for, and the pan that hangs lower.
 * A renderer that computes either for itself is free to reintroduce the bug; one
 * that asks is not.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { eq, rational, toString as rationalToString } from "../math/rational.ts";
import {
  balanceLowerPan,
  numberLinePoint,
  repSpecDefect,
  REP_BALANCE_SCALE,
  REP_COUNTING_BOARD,
  REP_NUMBER_LINE,
  V1_REPRESENTATIONS,
} from "./representations.ts";

test("the marked point is from + mark/denominator, not a whole part beside a fraction", () => {
  // Non-negative lines, where the two readings agree and the bug hides.
  assert.ok(eq(numberLinePoint(0, 3, 4), rational(3n, 4n)));
  assert.ok(eq(numberLinePoint(0, 4, 4), rational(1n)));
  assert.ok(eq(numberLinePoint(1, 5, 3), rational(8n, 3n)));
  assert.ok(eq(numberLinePoint(2, 0, 3), rational(2n)));

  // The case that broke. `{ from: -3, mark: 1, denominator: 4 }` is −11/4, and a
  // renderer that wrote its whole part beside its fraction produced "-3 1/4",
  // which parses back as −13/4: a different point, on a line drawn to teach
  // where points are.
  const point = numberLinePoint(-3, 1, 4);
  assert.equal(rationalToString(point), "-11/4");
  assert.ok(!eq(point, rational(-13n, 4n)), "the naive whole-part composition is a different number");

  // A mixed reading of it is "−2 3/4": the whole part is −2, not the line's
  // `from`, and the fractional part is 3/4, not `mark/denominator`.
  assert.ok(eq(numberLinePoint(-3, 1, 4), rational(-2n * 4n - 3n, 4n)));

  // Every other point on that line, so the assertion above is not one lucky case.
  assert.equal(rationalToString(numberLinePoint(-3, 0, 4)), "-3");
  assert.equal(rationalToString(numberLinePoint(-3, 2, 4)), "-5/2");
  assert.equal(rationalToString(numberLinePoint(-3, 4, 4)), "-2");
  assert.equal(rationalToString(numberLinePoint(-1, 1, 4)), "-3/4");
});

test("the heavier pan is the lower one", () => {
  assert.equal(balanceLowerPan(7, 3), -1, "the left pan is heavier, so the left pan hangs lower");
  assert.equal(balanceLowerPan(3, 7), 1, "the right pan is heavier, so the right pan hangs lower");
  assert.equal(balanceLowerPan(5, 5), 0, "equal pans balance, which is the whole idea");

  // Antisymmetry, over a small square of pan loads. A renderer whose beam angle
  // is signed the wrong way in screen space satisfies "the two angles are mirror
  // images" exactly as well as a correct one does, so mirror-image-ness is not
  // the property to assert — which side is lower is.
  for (let left = 0; left <= 6; left += 1) {
    for (let right = 0; right <= 6; right += 1) {
      const here = balanceLowerPan(left, right);
      const swapped = balanceLowerPan(right, left);
      // `0 === -0` is false under `Object.is`, which is what strict `assert`
      // compares with, so the balanced case is stated rather than negated.
      assert.equal(here, here === 0 ? swapped : -swapped);
      if (left > right) assert.equal(here, -1);
      if (left === right) assert.equal(here, 0);
    }
  }
});

test("a spec that cannot be drawn is rejected before anything draws it", () => {
  assert.equal(repSpecDefect(REP_NUMBER_LINE, { from: 0, to: 1, denominator: 4, mark: 3 }), null);
  assert.equal(repSpecDefect(REP_BALANCE_SCALE, { left: 4, right: 4 }), null);
  assert.equal(repSpecDefect(REP_COUNTING_BOARD, {}), null);

  assert.match(String(repSpecDefect("water-clock", {})), /no representation/);
  assert.match(String(repSpecDefect(REP_NUMBER_LINE, { from: 0, to: 1, denominator: 4 })), /missing mark/);
  assert.match(String(repSpecDefect(REP_NUMBER_LINE, { from: 2, to: 1, denominator: 4, mark: 0 })), /backwards/);
  assert.match(String(repSpecDefect(REP_NUMBER_LINE, { from: 0, to: 1, denominator: 0, mark: 0 })), /subdivision/);
  assert.match(String(repSpecDefect(REP_NUMBER_LINE, { from: 0, to: 1, denominator: 4, mark: 5 })), /off the line/);
  assert.match(String(repSpecDefect(REP_NUMBER_LINE, { from: 0, to: 5, denominator: 8, mark: 1 })), /24 intervals/);
  assert.match(String(repSpecDefect(REP_BALANCE_SCALE, { left: -1, right: 4 })), /negative/);

  // ADR-0006's float bug wearing a hat: a tick label of `0.30000000000000004`.
  const drifted = repSpecDefect(REP_NUMBER_LINE, { from: 0, to: 1, denominator: 3, mark: 1 / 3 });
  assert.match(String(drifted), /not a safe integer/);
});

test("every V1 representation declares what it requires", () => {
  for (const rep of V1_REPRESENTATIONS) {
    // The gear train is declared and unbuilt, and has no params table yet; the
    // other three must answer for themselves.
    if (rep === "gear-train") continue;
    assert.equal(repSpecDefect(rep, {}) === `no representation "${rep}"`, false, `${rep} has no params table`);
  }
});
