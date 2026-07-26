import assert from "node:assert/strict";
import test from "node:test";
import {
  FIX_SCALE,
  ONE,
  ZERO,
  abs,
  add,
  clamp,
  cmp,
  div,
  format,
  fromInt,
  fromMicro,
  fromRatio,
  isqrt,
  max,
  min,
  mul,
  neg,
  scale,
  sqrt,
  sub,
  toRoundedInt,
} from "./fixed.ts";
import type { Fix } from "./fixed.ts";

const CASES = 20000;

/** A deterministic integer stream, so this file needs no randomness of its own. */
function* lcg(seed: number): Generator<number> {
  let state = seed >>> 0;
  for (;;) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    yield state;
  }
}

test("fixed: constructors and constants", () => {
  assert.equal(ONE, FIX_SCALE);
  assert.equal(ZERO, 0);
  assert.equal(fromInt(3), 3_000_000);
  assert.equal(fromInt(-3), -3_000_000);
  assert.equal(fromMicro(1), 1);
  assert.equal(fromRatio(1, 2), 500_000);
  assert.equal(fromRatio(-1, 2), -500_000);
  assert.equal(fromRatio(1, 3), 333_333, "rounds to the nearest millionth");
  assert.equal(fromRatio(2, 3), 666_667);
  assert.throws(() => fromInt(1 / 3), RangeError);
  assert.throws(() => fromRatio(1, 0), RangeError);
  assert.throws(() => div(ONE, ZERO), RangeError);
});

test("fixed: arithmetic rounds half away from zero", () => {
  assert.equal(mul(fromRatio(1, 2), fromRatio(1, 2)), 250_000);
  assert.equal(mul(ONE, fromMicro(7)), 7);
  assert.equal(mul(fromMicro(1), fromMicro(1)), 0, "a millionth of a millionth is below the grid");
  assert.equal(mul(fromMicro(1), fromRatio(1, 2)), 1, "and half a millionth rounds away from zero");
  assert.equal(mul(fromMicro(-1), fromRatio(1, 2)), -1);
  assert.equal(div(ONE, fromInt(3)), 333_333);
  assert.equal(div(fromInt(2), fromInt(3)), 666_667);
  assert.equal(scale(fromInt(7), 1, 3), 2_333_333);
  assert.equal(add(fromInt(2), fromRatio(1, 4)), 2_250_000);
  assert.equal(sub(fromInt(2), fromRatio(1, 4)), 1_750_000);
  assert.equal(neg(fromInt(2)), -2_000_000);
  assert.equal(abs(fromInt(-2)), 2_000_000);
  assert.equal(toRoundedInt(fromRatio(3, 2)), 2);
  assert.equal(toRoundedInt(fromRatio(-3, 2)), -2);
  assert.equal(toRoundedInt(fromRatio(4, 3)), 1);
});

test("fixed: every value is an integer, always", (t) => {
  const stream = lcg(20260725);
  let cases = 0;
  for (let i = 0; i < CASES; i++) {
    const a = fromMicro((stream.next().value % 20_000_001) - 10_000_000);
    const b = fromMicro((stream.next().value % 20_000_001) - 10_000_000);
    for (const value of [add(a, b), sub(a, b), mul(a, b), neg(a), abs(a), min(a, b), max(a, b)]) {
      assert.ok(Number.isSafeInteger(value), `not an integer: ${String(value)}`);
    }
    if (b !== 0) assert.ok(Number.isSafeInteger(div(a, b)));
    cases += 1;
  }
  t.diagnostic(`${String(cases)} fixed-point operand pairs checked`);
});

test("fixed: algebraic identities hold", (t) => {
  const stream = lcg(4711);
  let cases = 0;
  for (let i = 0; i < CASES; i++) {
    const a = fromMicro((stream.next().value % 2_000_001) - 1_000_000);
    const b = fromMicro((stream.next().value % 2_000_001) - 1_000_000);
    assert.equal(add(a, b), add(b, a));
    assert.equal(mul(a, b), mul(b, a));
    assert.equal(sub(add(a, b), b), a, "addition is exact, so it is invertible");
    assert.equal(add(a, ZERO), a);
    assert.equal(mul(a, ONE), a);
    assert.equal(mul(a, ZERO), ZERO);
    assert.equal(cmp(a, b), -cmp(b, a) as -1 | 0 | 1);
    assert.equal(clamp(a, b, b), b);
    cases += 1;
  }
  t.diagnostic(`${String(cases)} identity checks`);
});

test("fixed: multiplication matches exact rational arithmetic", (t) => {
  // The claim this module rests on: `mul` is the exact product rounded once. The
  // oracle is BigInt, computed a different way (numerator/denominator) from the
  // implementation.
  const stream = lcg(99991);
  let cases = 0;
  for (let i = 0; i < CASES; i++) {
    const a = (stream.next().value % 4_000_001) - 2_000_000;
    const b = (stream.next().value % 4_000_001) - 2_000_000;
    const exactNumerator = BigInt(a) * BigInt(b);
    const scaled = exactNumerator * 2n;
    const rounded =
      scaled >= 0n
        ? (scaled + BigInt(FIX_SCALE)) / (2n * BigInt(FIX_SCALE))
        : -((-scaled + BigInt(FIX_SCALE)) / (2n * BigInt(FIX_SCALE)));
    assert.equal(BigInt(mul(fromMicro(a), fromMicro(b))), rounded, `${String(a)} * ${String(b)}`);
    cases += 1;
  }
  t.diagnostic(`${String(cases)} products compared against exact BigInt arithmetic`);
});

test("fixed: overflow is refused, not silently wrong", () => {
  const huge = fromMicro(Number.MAX_SAFE_INTEGER - 1);
  assert.throws(() => mul(huge, huge), RangeError);
  assert.throws(() => add(huge, huge), RangeError);
  assert.throws(() => fromInt(Number.MAX_SAFE_INTEGER), RangeError);
});

test("fixed: integer square root is exact", () => {
  assert.equal(isqrt(0n), 0n);
  assert.equal(isqrt(1n), 1n);
  assert.equal(isqrt(15n), 3n);
  assert.equal(isqrt(16n), 4n);
  assert.equal(isqrt(10n ** 30n), 10n ** 15n);
  for (let n = 0n; n < 2000n; n++) {
    const root = isqrt(n);
    assert.ok(root * root <= n && (root + 1n) * (root + 1n) > n, `isqrt(${n.toString()})`);
  }
  assert.throws(() => isqrt(-1n), RangeError);
});

test("fixed: square root, to the millionth", () => {
  assert.equal(sqrt(fromInt(4)), fromInt(2));
  assert.equal(sqrt(ZERO), ZERO);
  assert.equal(sqrt(fromInt(2)), 1_414_213, "√2 = 1.414213562…, floored to the millionth");
  assert.equal(sqrt(fromRatio(1, 4)), 500_000);
  assert.throws(() => sqrt(fromInt(-1) as Fix), RangeError);
});

test("fixed: formatting is exact and never invents precision", () => {
  assert.equal(format(fromRatio(1, 2)), "0.500000");
  assert.equal(format(fromRatio(1, 2), 2), "0.50");
  assert.equal(format(fromRatio(1, 3), 3), "0.333");
  assert.equal(format(fromRatio(2, 3), 3), "0.667");
  assert.equal(format(fromInt(-2), 1), "-2.0");
  assert.equal(format(fromInt(7), 0), "7");
  assert.equal(format(fromMicro(-1), 0), "0", "a signed zero prints as zero");
  assert.throws(() => format(ONE, 9), RangeError);
});
