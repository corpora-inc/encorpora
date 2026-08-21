import assert from "node:assert/strict";
import test from "node:test";
import { ONE, ZERO, fromInt, fromMicro, fromRatio, neg, sub } from "./fixed.ts";
import type { Fix } from "./fixed.ts";
import { HALF, SIGMOID_DOMAIN, expNeg, sigmoid } from "./logistic.ts";

/**
 * Published values of the logistic function, rounded to the millionth. These are
 * an oracle independent of the implementation: they come from the mathematics, not
 * from running this code, so a wrong series or a wrong reduction fails here.
 *
 *   σ(0.1)  = 0.524979187478…
 *   σ(0.25) = 0.562176500885…
 *   σ(0.5)  = 0.622459331201…
 *   σ(1)    = 0.731058578630…
 *   σ(2)    = 0.880797077978…
 *   σ(3)    = 0.952574126822…
 *   σ(4)    = 0.982013790038…
 *   σ(5)    = 0.993307149076…
 *   σ(8)    = 0.999664649318…
 *   σ(10)   = 0.999954602131…
 */
const KNOWN: readonly (readonly [Fix, number])[] = [
  [fromRatio(1, 10), 524_979],
  [fromRatio(1, 4), 562_177],
  [fromRatio(1, 2), 622_459],
  [fromInt(1), 731_059],
  [fromInt(2), 880_797],
  [fromInt(3), 952_574],
  [fromInt(4), 982_014],
  [fromInt(5), 993_307],
  [fromInt(8), 999_665],
  [fromInt(10), 999_955],
];

test("logistic: matches published values of σ to the millionth", () => {
  assert.equal(sigmoid(ZERO), HALF);
  for (const [x, expected] of KNOWN) {
    assert.equal(sigmoid(x), expected, `σ(${String(x)} micro)`);
    assert.equal(sigmoid(neg(x)), ONE - expected, `σ(-${String(x)} micro)`);
  }
});

test("logistic: symmetry about zero is exact, not approximate", (t) => {
  let cases = 0;
  for (let micro = -8_000_000; micro <= 8_000_000; micro += 1301) {
    const x = fromMicro(micro);
    assert.equal(sigmoid(x), sub(ONE, sigmoid(neg(x))), `σ(-x) = 1 - σ(x) at ${String(micro)}`);
    cases += 1;
  }
  t.diagnostic(`symmetry checked at ${String(cases)} points`);
});

test("logistic: monotone increasing, bounded, and saturating", (t) => {
  let previous = -1;
  let cases = 0;
  for (let micro = -25_000_000; micro <= 25_000_000; micro += 977) {
    const value = sigmoid(fromMicro(micro));
    assert.ok(value >= previous, `not monotone at ${String(micro)}`);
    assert.ok(value >= ZERO && value <= ONE, `out of range at ${String(micro)}`);
    previous = value;
    cases += 1;
  }
  assert.equal(sigmoid(SIGMOID_DOMAIN), ONE, "saturates to certainty at the domain edge");
  assert.equal(sigmoid(neg(SIGMOID_DOMAIN)), ZERO);
  assert.equal(sigmoid(fromInt(1000)), ONE, "and clamps beyond it rather than overflowing");
  t.diagnostic(`monotonicity checked at ${String(cases)} points`);
});

test("logistic: the derivative peaks at the middle, as it must", () => {
  // A crude but genuine shape check: the central difference over a window of 0.1
  // is largest when the window is centred on zero. It has to be symmetric, so the
  // difference is taken about the point rather than forward from it.
  const slopeAt = (tenths: number): number =>
    sigmoid(fromRatio(2 * tenths + 1, 20)) - sigmoid(fromRatio(2 * tenths - 1, 20));
  const middle = slopeAt(0);
  for (const tenths of [1, 2, 5, 10, 20, -1, -2, -5, -10, -20]) {
    assert.ok(slopeAt(tenths) < middle, `slope at ${String(tenths)}/10 should be below the slope at 0`);
  }
  assert.equal(slopeAt(3), slopeAt(-3), "and the slope is symmetric about zero");
});

test("logistic: e^-x matches published values", () => {
  //   e^-0 = 1, e^-1 = 0.367879441171…, e^-2 = 0.135335283237…,
  //   e^-5 = 0.006737946999…, e^-10 = 0.000045399929…
  assert.equal(expNeg(ZERO), ONE);
  assert.equal(expNeg(fromInt(1)), 367_879);
  assert.equal(expNeg(fromInt(2)), 135_335);
  assert.equal(expNeg(fromInt(5)), 6_738);
  assert.equal(expNeg(fromInt(10)), 45);
  assert.equal(expNeg(fromRatio(1, 2)), 606_531, "e^-0.5 = 0.606530659…");
  assert.throws(() => expNeg(fromInt(-1)), RangeError);
});

test("logistic: σ and e^-x agree with each other", (t) => {
  // σ(x)·(1 + e^-x) = 1. Computed through two different code paths, so this
  // catches a reduction or series error that a single-path test would not.
  let cases = 0;
  for (let micro = 0; micro <= 6_000_000; micro += 7919) {
    const x = fromMicro(micro);
    const sigma = sigmoid(x);
    const exponential = expNeg(x);
    const product = (BigInt(sigma) * (BigInt(ONE) + BigInt(exponential))) / BigInt(ONE);
    const drift = product - BigInt(ONE);
    assert.ok(drift < 4n && drift > -4n, `σ(x)(1 + e^-x) drifted by ${drift.toString()} at ${String(micro)}`);
    cases += 1;
  }
  t.diagnostic(`cross-checked σ against e^-x at ${String(cases)} points`);
});
