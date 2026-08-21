import assert from "node:assert/strict";
import test from "node:test";
import { createRng } from "../rng/rng.ts";
import type { Rational } from "./rational.ts";
import {
  ONE,
  ZERO,
  abs,
  add,
  asInteger,
  cmp,
  div,
  eq,
  floor,
  fromSafeInt,
  fromScaled,
  gt,
  inv,
  isInteger,
  isZero,
  max,
  min,
  mul,
  neg,
  parseRational,
  pow10,
  rational,
  sign,
  sub,
  toDecimalString,
  toScaled,
  toString as rationalToString,
} from "./rational.ts";

const PROPERTY_CASES = 5000;

test("rational: normalizes to a single representation", () => {
  assert.deepEqual(rational(2n, 4n), { n: 1n, d: 2n });
  assert.deepEqual(rational(-2n, 4n), { n: -1n, d: 2n });
  assert.deepEqual(rational(2n, -4n), { n: -1n, d: 2n });
  assert.deepEqual(rational(-2n, -4n), { n: 1n, d: 2n });
  assert.deepEqual(rational(0n, 7n), ZERO);
  assert.deepEqual(rational(0n, -7n), ZERO);
  assert.deepEqual(rational(6n, 3n), { n: 2n, d: 1n });
});

test("rational: rejects a zero denominator and a reciprocal of zero", () => {
  assert.throws(() => rational(1n, 0n), RangeError);
  assert.throws(() => div(ONE, ZERO), RangeError);
  assert.throws(() => inv(ZERO), RangeError);
});

test("rational: rejects a JS number that is not a safe integer", () => {
  assert.equal(rationalToString(fromSafeInt(-7)), "-7");
  assert.throws(() => fromSafeInt(1 / 3), RangeError);
  assert.throws(() => fromSafeInt(Number.MAX_SAFE_INTEGER + 2), RangeError);
});

test("rational: 0.1 + 0.2 is exactly 0.3", () => {
  // The whole reason this module exists. In IEEE doubles this comparison is false,
  // and a decimal generator built on doubles marks correct work wrong for ever.
  const tenth = parseRational("0.1");
  const fifth = parseRational("0.2");
  const threeTenths = parseRational("0.3");
  assert.ok(eq(add(tenth, fifth), threeTenths));
  assert.deepEqual(add(tenth, fifth), { n: 3n, d: 10n });
  assert.equal(toDecimalString(add(tenth, fifth), 1), "0.3");
});

test("rational: 0.3 - 0.1 is exactly 0.2, and a tenth times three is three tenths", () => {
  assert.ok(eq(sub(parseRational("0.3"), parseRational("0.1")), parseRational("0.2")));
  assert.ok(eq(mul(parseRational("0.1"), fromSafeInt(3)), parseRational("0.3")));
  assert.ok(eq(add(add(parseRational("0.1"), parseRational("0.1")), parseRational("0.1")), parseRational("0.3")));
});

test("rational: parses integers, fractions and decimals", () => {
  assert.deepEqual(parseRational("42"), { n: 42n, d: 1n });
  assert.deepEqual(parseRational("-42"), { n: -42n, d: 1n });
  assert.deepEqual(parseRational("+42"), { n: 42n, d: 1n });
  assert.deepEqual(parseRational("-3/4"), { n: -3n, d: 4n });
  assert.deepEqual(parseRational("6/4"), { n: 3n, d: 2n });
  assert.deepEqual(parseRational("0.75"), { n: 3n, d: 4n });
  assert.deepEqual(parseRational(".5"), { n: 1n, d: 2n });
  assert.deepEqual(parseRational("-0.125"), { n: -1n, d: 8n });
  assert.deepEqual(parseRational("  7  "), { n: 7n, d: 1n });
  assert.throws(() => parseRational("1.2.3"), SyntaxError);
  assert.throws(() => parseRational("one"), SyntaxError);
  assert.throws(() => parseRational(""), SyntaxError);
});

test("rational: parsing never loses precision on long decimals", () => {
  const value = parseRational("0.12345678901234567890123456789");
  assert.equal(toDecimalString(value, 29), "0.12345678901234567890123456789");
  assert.equal(value.d, pow10(29));
});

test("rational: scaled construction and recovery", () => {
  assert.deepEqual(fromScaled(2503n, 2), { n: 2503n, d: 100n });
  assert.equal(toScaled(fromScaled(2503n, 2), 2), 2503n);
  assert.equal(toScaled(fromScaled(2503n, 2), 3), 25030n);
  assert.equal(toScaled(rational(1n, 3n), 2), null);
  assert.equal(toDecimalString(rational(1n, 3n), 2), null);
  assert.equal(toDecimalString(rational(5n, 2n), 2), "2.50");
  assert.equal(toDecimalString(rational(-5n, 2n), 1), "-2.5");
  assert.equal(toDecimalString(rational(1n, 100n), 2), "0.01");
  assert.equal(toDecimalString(fromSafeInt(7), 0), "7");
});

test("rational: comparison, sign, floor and integrality", () => {
  assert.equal(cmp(rational(1n, 3n), rational(1n, 2n)), -1);
  assert.equal(cmp(rational(1n, 2n), rational(2n, 4n)), 0);
  assert.equal(cmp(rational(-1n, 3n), rational(-1n, 2n)), 1);
  assert.equal(sign(rational(-1n, 3n)), -1);
  assert.equal(sign(ZERO), 0);
  assert.ok(isZero(sub(rational(3n, 7n), rational(3n, 7n))));
  assert.ok(isInteger(rational(4n, 2n)));
  assert.equal(asInteger(rational(4n, 2n)), 2n);
  assert.equal(asInteger(rational(1n, 2n)), null);
  assert.equal(floor(rational(7n, 2n)), 3n);
  assert.equal(floor(rational(-7n, 2n)), -4n);
  assert.equal(floor(rational(-4n, 2n)), -2n);
  assert.ok(gt(max(rational(1n, 3n), rational(1n, 4n)), min(rational(1n, 3n), rational(1n, 4n))));
});

test("rational: huge values stay exact where doubles would not", () => {
  const big = rational(BigInt(Number.MAX_SAFE_INTEGER) * 1000n + 1n);
  assert.ok(eq(sub(add(big, ONE), ONE), big));
  assert.ok(eq(sub(big, big), ZERO));
  // 2^53 + 1 is not representable as a double; as a rational it is just an integer.
  const beyondDouble = rational(9007199254740993n);
  assert.equal(rationalToString(beyondDouble), "9007199254740993");
  assert.ok(!eq(beyondDouble, rational(9007199254740992n)));
});

function randomRational(rng: ReturnType<typeof createRng>): Rational {
  return rational(BigInt(rng.nextInt(-1000, 1000)), BigInt(rng.nextInt(1, 1000)));
}

test("rational: field laws hold over generated triples", (t) => {
  const rng = createRng(20260725);
  let cases = 0;

  for (let i = 0; i < PROPERTY_CASES; i++) {
    const a = randomRational(rng);
    const b = randomRational(rng);
    const c = randomRational(rng);
    cases += 1;

    // Canonical form: positive denominator, fully reduced, zero is 0/1.
    for (const value of [a, b, c, add(a, b), mul(a, b), sub(a, b)]) {
      assert.ok(value.d > 0n, "denominator must be positive");
      if (value.n === 0n) assert.equal(value.d, 1n, "zero has one representation");
    }

    assert.ok(eq(add(a, b), add(b, a)), "addition commutes");
    assert.ok(eq(mul(a, b), mul(b, a)), "multiplication commutes");
    assert.ok(eq(add(add(a, b), c), add(a, add(b, c))), "addition associates");
    assert.ok(eq(mul(mul(a, b), c), mul(a, mul(b, c))), "multiplication associates");
    assert.ok(eq(mul(a, add(b, c)), add(mul(a, b), mul(a, c))), "multiplication distributes");
    assert.ok(eq(sub(add(a, b), b), a), "subtraction undoes addition");
    assert.ok(eq(add(a, neg(a)), ZERO), "a + (-a) = 0");
    assert.ok(eq(add(a, ZERO), a), "0 is the additive identity");
    assert.ok(eq(mul(a, ONE), a), "1 is the multiplicative identity");
    if (!isZero(b)) {
      assert.ok(eq(mul(div(a, b), b), a), "division undoes multiplication");
      assert.ok(eq(div(b, b), ONE), "b / b = 1");
    }

    // Comparison is a total order that agrees with subtraction.
    assert.equal(cmp(a, b), -cmp(b, a) as -1 | 0 | 1, "comparison is antisymmetric");
    assert.equal(cmp(a, b), sign(sub(a, b)), "comparison agrees with subtraction");
    if (cmp(a, b) <= 0 && cmp(b, c) <= 0) assert.ok(cmp(a, c) <= 0, "comparison is transitive");
    assert.ok(!isZero(abs(a)) || isZero(a));
    assert.ok(cmp(abs(a), ZERO) >= 0, "absolute value is non-negative");
  }

  t.diagnostic(`field laws checked over ${String(cases)} generated triples`);
  assert.equal(cases, PROPERTY_CASES);
});

test("rational: decimal round-trip is exact for every value with a finite expansion", (t) => {
  const rng = createRng(4711);
  let cases = 0;

  for (let i = 0; i < PROPERTY_CASES; i++) {
    const places = rng.nextInt(0, 4);
    const scaled = BigInt(rng.nextInt(-99999, 99999));
    const value = fromScaled(scaled, places);
    const text = toDecimalString(value, places);
    assert.ok(text !== null, "a value built from a scaled integer must print at that scale");
    assert.ok(eq(parseRational(text), value), `round-trip failed for ${text}`);
    assert.equal(toScaled(value, places), scaled);
    cases += 1;
  }

  t.diagnostic(`decimal round-trip checked over ${String(cases)} generated values`);
  assert.equal(cases, PROPERTY_CASES);
});
