import assert from "node:assert/strict";
import test from "node:test";
import { cmp, eq, frac, fracLabel, int, parseLabel, predicateKey, promptFor, satisfies } from "./exact.ts";

test("fractions are stored reduced with a positive denominator", () => {
  assert.deepEqual(frac(6, 8), { n: 3, d: 4 });
  assert.deepEqual(frac(2, -4), { n: -1, d: 2 });
  assert.deepEqual(frac(5, 1), { n: 5, d: 1 });
});

test("comparison is exact where floating point is not", () => {
  // 0.1 + 0.2 !== 0.3 in binary floating point. Here it is exactly equal, and
  // the equality holds for every representation of the same rational.
  const tenth = frac(1, 10);
  const fifth = frac(1, 5);
  const threeTenths = frac(3, 10);
  assert.equal(cmp({ n: tenth.n * fifth.d + fifth.n * tenth.d, d: tenth.d * fifth.d }, threeTenths), 0);
  assert.ok(eq(frac(2, 4), frac(1, 2)));
  assert.equal(cmp(frac(5, 8), frac(3, 4)), -1);
  assert.equal(cmp(frac(7, 9), frac(3, 4)), 1);
  assert.equal(cmp(frac(1, 3), frac(2, 6)), 0);
});

test("labels parse back to their exact value", () => {
  assert.deepEqual(parseLabel("12"), { n: 12, d: 1 });
  assert.deepEqual(parseLabel("7 + 5"), { n: 12, d: 1 });
  assert.deepEqual(parseLabel("20 − 8"), { n: 12, d: 1 });
  assert.deepEqual(parseLabel("3 × 4"), { n: 12, d: 1 });
  assert.deepEqual(parseLabel("48 ÷ 4"), { n: 12, d: 1 });
  assert.deepEqual(parseLabel("3/4"), { n: 3, d: 4 });
  assert.deepEqual(parseLabel("6/8"), { n: 3, d: 4 });
});

test("the parser refuses what it does not fully understand", () => {
  for (const bad of ["", "  ", "7 +", "7 + 5 + 1", "seven", "1/0", "3 - 4", "x × 2"]) {
    assert.equal(parseLabel(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test("predicates accept exactly what their prompt says", () => {
  const twelve = { kind: "eq", target: int(12) } as const;
  assert.ok(satisfies(twelve, int(12)));
  assert.ok(!satisfies(twelve, int(13)));
  assert.ok(!satisfies(twelve, frac(23, 2)));
  assert.equal(promptFor(twelve), "= 12");

  const sixes = { kind: "multiple", base: 6 } as const;
  assert.ok(satisfies(sixes, int(18)));
  assert.ok(!satisfies(sixes, int(20)));
  assert.ok(!satisfies(sixes, frac(18, 5)));
  assert.ok(!satisfies(sixes, int(0)), "zero is not an interesting multiple and never spawns");
  assert.equal(promptFor(sixes), "6 × ?");

  const overThreeQuarters = { kind: "gt", ref: frac(3, 4) } as const;
  assert.ok(satisfies(overThreeQuarters, frac(7, 8)));
  assert.ok(!satisfies(overThreeQuarters, frac(6, 8)), "equal is not greater");
  assert.ok(!satisfies(overThreeQuarters, frac(5, 8)));
  assert.equal(promptFor(overThreeQuarters), "> 3/4");

  const underHalf = { kind: "lt", ref: frac(1, 2) } as const;
  assert.ok(satisfies(underHalf, frac(5, 11)));
  assert.ok(!satisfies(underHalf, frac(6, 11)));
  assert.ok(!satisfies(underHalf, frac(2, 4)), "equal is not less");
});

test("predicate keys and labels are stable identities", () => {
  assert.equal(predicateKey({ kind: "eq", target: int(12) }), "eq:12/1");
  assert.equal(predicateKey({ kind: "multiple", base: 7 }), "mul:7");
  assert.equal(predicateKey({ kind: "gt", ref: frac(3, 4) }), "gt:3/4");
  assert.equal(fracLabel(frac(4, 2)), "2");
});
