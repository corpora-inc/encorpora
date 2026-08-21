import { test } from "node:test";
import assert from "node:assert/strict";
import { add, cmp, eq, fmt, inBar, mul, ONE, parseRat, rat, sub, toFloat, ZERO } from "./rational.ts";

test("normalises to a single representation", () => {
  assert.deepEqual(rat(2, 4), rat(1, 2));
  assert.deepEqual(rat(-2, -4), rat(1, 2));
  assert.deepEqual(rat(2, -4), rat(-1, 2));
  assert.deepEqual(rat(0, 7), ZERO);
  assert.deepEqual(rat(5, 5), ONE);
});

test("addition is exact where floats are not", () => {
  assert.ok(eq(add(rat(1, 3), rat(1, 6)), rat(1, 2)));

  // 1/10 + 2/10 is 3/10. In IEEE doubles it is 0.30000000000000004, so a child who
  // answers correctly is marked wrong — deterministically, on every device.
  assert.ok(eq(add(rat(1, 10), rat(2, 10)), rat(3, 10)));
  assert.notEqual(0.1 + 0.2, 0.3);

  // 7/10 − 4/10 is 3/10; the float is 0.29999999999999993.
  assert.ok(eq(sub(rat(7, 10), rat(4, 10)), rat(3, 10)));
  assert.notEqual(0.7 - 0.4, 0.3);

  // Ten tenths is one. Accumulating 0.1 ten times is 0.9999999999999999.
  let acc = ZERO;
  let f = 0;
  for (let i = 0; i < 10; i++) {
    acc = add(acc, rat(1, 10));
    f += 0.1;
  }
  assert.ok(eq(acc, ONE));
  assert.notEqual(f, 1);
});

test("subtraction, multiplication, comparison", () => {
  assert.ok(eq(sub(rat(3, 4), rat(1, 4)), rat(1, 2)));
  assert.ok(eq(sub(ONE, rat(3, 8)), rat(5, 8)));
  assert.ok(eq(mul(rat(3), rat(1, 8)), rat(3, 8)));
  assert.equal(cmp(rat(1, 3), rat(1, 2)), -1);
  assert.equal(cmp(rat(2, 4), rat(1, 2)), 0);
  assert.equal(cmp(rat(5, 6), rat(4, 5)), 1);
});

test("comparison never consults a float", () => {
  // 1/3 and 33333333333333331/100000000000000000 collapse to the same double.
  const a = rat(1n, 3n);
  const b = rat(33333333333333331n, 100000000000000000n);
  assert.equal(toFloat(a), toFloat(b));
  assert.notEqual(cmp(a, b), 0);
});

test("canonical formatting and round-tripping", () => {
  assert.equal(fmt(rat(3, 4)), "3/4");
  assert.equal(fmt(rat(4, 4)), "1");
  assert.equal(fmt(rat(0, 9)), "0");
  assert.equal(fmt(rat(-1, 2)), "-1/2");
  for (const s of ["3/4", "1", "0", "-1/2", "12/16"]) {
    const r = parseRat(s);
    assert.ok(r);
    assert.ok(eq(parseRat(fmt(r))!, r));
  }
});

test("parse refuses anything that is not an integer fraction", () => {
  for (const s of ["0.75", "3 / four", "", "1/0", "7x", "1.5/2"]) {
    assert.equal(parseRat(s), null, `expected null for ${JSON.stringify(s)}`);
  }
  assert.deepEqual(parseRat(" 3 / 4 "), rat(3, 4));
});

test("inBar is the (0,1] window a bar position can hold", () => {
  assert.ok(inBar(rat(1, 8)));
  assert.ok(inBar(ONE));
  assert.ok(!inBar(ZERO));
  assert.ok(!inBar(rat(9, 8)));
  assert.ok(!inBar(rat(-1, 2)));
});
