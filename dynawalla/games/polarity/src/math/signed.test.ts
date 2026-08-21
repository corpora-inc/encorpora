import test from "node:test";
import assert from "node:assert/strict";
import {
  MINUS,
  absorbable,
  bandLoad,
  chainMult,
  coreAfter,
  fmtInt,
  fmtSigned,
  lockResult,
  overloaded,
  parseInt_,
  polarityOf,
  releaseYield,
} from "./signed.ts";

test("fmtSigned uses a real minus sign and an explicit plus", () => {
  assert.equal(fmtSigned(7), "+7");
  assert.equal(fmtSigned(0), "0");
  assert.equal(fmtSigned(-5), `${MINUS}5`);
  assert.throws(() => fmtSigned(1.5));
});

test("fmtInt / parseInt_ round-trip every integer we ever display", () => {
  for (let n = -99; n <= 99; n++) {
    assert.equal(parseInt_(fmtInt(n)), n);
    assert.equal(parseInt_(fmtSigned(n)), n);
  }
  assert.throws(() => parseInt_("seven"));
  assert.throws(() => parseInt_("1.5"));
});

test("zero is the origin: absorbable in either polarity", () => {
  assert.equal(polarityOf(0), 0);
  assert.equal(absorbable(0, 1), true);
  assert.equal(absorbable(0, -1), true);
  assert.equal(absorbable(4, 1), true);
  assert.equal(absorbable(4, -1), false);
  assert.equal(absorbable(-4, -1), true);
  assert.equal(absorbable(-4, 1), false);
});

test("absorbing is plain integer addition, including negatives", () => {
  assert.equal(coreAfter(0, -7), -7);
  assert.equal(coreAfter(-7, -7), -14);
  assert.equal(coreAfter(-14, 20), 6);
  // and it is exact for long chains
  let c = 0;
  const vs = [-9, 4, -3, 12, -1, -1, 8, -20, 7];
  for (const v of vs) c = coreAfter(c, v);
  assert.equal(
    c,
    vs.reduce((a, b) => a + b, 0),
  );
  assert.equal(c, -3);
});

test("the band is symmetric and exclusive at the edge", () => {
  assert.equal(overloaded(20, 20), false);
  assert.equal(overloaded(-20, 20), false);
  assert.equal(overloaded(21, 20), true);
  assert.equal(overloaded(-21, 20), true);
  assert.equal(bandLoad(-10, 20), 0.5);
  assert.equal(bandLoad(0, 20), 0);
  assert.equal(bandLoad(20, 20), 1);
});

test("release pays the accumulated total, both signs equally", () => {
  const pos = releaseYield(18, 20, 1);
  const neg = releaseYield(-18, 20, 1);
  assert.deepEqual(pos, neg, "sign must never change the payout");
  assert.equal(pos.perfect, true);
  assert.equal(releaseYield(2, 20, 1).darts, 0, "a fizzle below 3 stops spam");
  assert.equal(releaseYield(10, 20, 1).perfect, false);
  assert.equal(releaseYield(20, 20, 1).perfect, true);
  assert.equal(releaseYield(17, 20, 1).perfect, false);
  // perfect is worth exactly 3x the score of the same magnitude un-perfect
  assert.equal(releaseYield(18, 20, 1).score, 18 * 25 * 3);
  assert.equal(releaseYield(18, 40, 1).score, 18 * 25);
  // darts never exceed the pool budget
  assert.ok(releaseYield(120, 120, 9).darts <= 36);
});

test("chain multiplier is stepped and capped", () => {
  assert.equal(chainMult(0), 1);
  assert.equal(chainMult(5), 1);
  assert.equal(chainMult(6), 2);
  assert.equal(chainMult(48), 9);
  assert.equal(chainMult(9999), 9);
});

test("lock tolerance rewards exactness but still pays a near miss", () => {
  assert.equal(lockResult(-14, -14), "exact");
  assert.equal(lockResult(-12, -14), "near");
  assert.equal(lockResult(-16, -14), "near");
  assert.equal(lockResult(-11, -14), "miss");
  assert.equal(lockResult(14, -14), "miss");
});
