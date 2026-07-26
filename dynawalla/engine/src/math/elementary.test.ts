/**
 * `ln`, `exp`, `pow` and `logit` against published values and against their own
 * identities.
 *
 * Published values are the oracle: an implementation checked only against itself
 * is checked against nothing. The identities catch the other half — a series that
 * is accurate near 1 and wrong at 10^-3 passes a spot check and fails
 * `exp(ln x) = x`.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ONE, abs, format, fromInt, fromMicro, fromRatio, mul, sub } from "./fixed.ts";
import type { Fix } from "./fixed.ts";
import { exp, ln, logit, pow } from "./elementary.ts";
import { sigmoid } from "./logistic.ts";

/** Tolerated absolute error, in millionths. Two ulp of the printed result. */
const TOLERANCE = 2;

function near(actual: Fix, expected: Fix, what: string, tolerance = TOLERANCE): void {
  const error = abs(sub(actual, expected));
  assert.ok(
    error <= tolerance,
    `${what}: got ${format(actual)}, expected ${format(expected)} (error ${String(error)} millionths)`,
  );
}

test("ln matches published values", () => {
  near(ln(fromInt(2)), fromMicro(693_147), "ln 2");
  near(ln(fromInt(10)), fromMicro(2_302_585), "ln 10");
  near(ln(ONE), fromMicro(0), "ln 1");
  near(ln(fromRatio(1, 2)), fromMicro(-693_147), "ln 0.5");
  near(ln(fromMicro(1_000)), fromMicro(-6_907_755), "ln 0.001");
  near(ln(fromInt(1000)), fromMicro(6_907_755), "ln 1000");
});

test("exp matches published values", () => {
  near(exp(ONE), fromMicro(2_718_282), "e");
  near(exp(fromInt(0)), ONE, "e^0");
  near(exp(fromInt(-1)), fromMicro(367_879), "e^-1");
  near(exp(fromInt(10)), fromMicro(22_026_465_795), "e^10", 40_000);
  near(exp(fromRatio(-9, 2)), fromMicro(11_109), "e^-4.5");
});

test("exp and ln invert each other across nine orders of magnitude", () => {
  for (const micro of [1_000, 10_000, 250_000, 999_999, 1_000_001, 3_000_000, 100_000_000, 1_000_000_000]) {
    const x = fromMicro(micro);
    // Relative rather than absolute: at x = 1000 a millionth of absolute error in
    // `ln` is amplified by `exp` to a thousandth, which is the mathematics and not
    // a defect.
    const back = exp(ln(x));
    const error = abs(sub(back, x));
    assert.ok(error * 1_000_000 <= x * 4, `exp(ln(${format(x)})) = ${format(back)}`);
  }
});

test("ln turns multiplication into addition", () => {
  const a = fromRatio(7, 3);
  const b = fromRatio(11, 5);
  near(ln(mul(a, b)), (ln(a) + ln(b)) as Fix, "ln(ab) = ln a + ln b", 3);
});

test("pow agrees with repeated multiplication on whole exponents", () => {
  const base = fromRatio(3, 2);
  near(pow(base, fromInt(2)), mul(base, base), "1.5^2", 3);
  near(pow(base, fromInt(3)), mul(mul(base, base), base), "1.5^3", 4);
  near(pow(fromInt(2), fromInt(10)), fromInt(1024), "2^10", 2000);
});

test("pow does the fractional exponents FSRS needs", () => {
  // S^-0.5 and the (1 + F·t/S)^-d forgetting curve are the two shapes Layer F
  // cannot be written without.
  near(pow(fromInt(4), fromRatio(-1, 2)), fromRatio(1, 2), "4^-0.5");
  near(pow(fromInt(9), fromRatio(1, 2)), fromInt(3), "9^0.5", 3);
  near(pow(fromRatio(9, 10), fromRatio(1, 5)), fromMicro(979_148), "0.9^0.2");
});

test("logit inverts the sigmoid the model predicts with", () => {
  // This is the identity the scheduler depends on: it picks `b = θ − logit(p*)`
  // and then the model must actually predict `p*` for that item.
  for (const micro of [100_000, 300_000, 500_000, 700_000, 800_000, 920_000, 990_000]) {
    const p = fromMicro(micro);
    near(sigmoid(logit(p)), p, `σ(logit(${format(p)}))`, 3);
  }
});

test("logit saturates rather than diverging at the ends", () => {
  assert.equal(logit(fromMicro(0)), -20_000_000);
  assert.equal(logit(ONE), 20_000_000);
  assert.equal(logit(fromRatio(1, 2)), 0);
});

test("ln rejects a non-positive argument rather than returning a number", () => {
  assert.throws(() => ln(fromMicro(0)), RangeError);
  assert.throws(() => pow(fromInt(-2), fromInt(2)), RangeError);
});
