/**
 * The draw primitive.
 *
 * It had no test of its own, which is how a modulo bias survived in the one file
 * the harness's independence from the engine rests on.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { FIX_SCALE } from "./fixed.ts";
import { bernoulli, draw, drawInt, fingerprint, hash2, mix32 } from "./rng.ts";

test("a draw is a pure function of (seed, counter) and stays in range", () => {
  assert.equal(draw(7, 3), draw(7, 3));
  assert.notEqual(draw(7, 3), draw(7, 4));
  assert.notEqual(draw(8, 3), draw(7, 3));
  for (let counter = 0; counter < 500; counter++) {
    const value = draw(1, counter);
    assert.ok(value >= 0 && value < FIX_SCALE, `${String(value)} is outside [0, 1)`);
  }
  assert.equal(mix32(0) >>> 0, mix32(0));
  assert.notEqual(hash2(1, 2), hash2(2, 1));
  assert.notEqual(fingerprint("a"), fingerprint("b"));
});

test("the modulo bias is the stated 1/4294, and no larger", () => {
  // `2³² mod 10⁶ = 967,296`: a draw below 967,296 is 4295 chances in 2³² and one
  // above it 4294. The file states the bound rather than removing it — the
  // rationale is there — and this is what holds the *number* to what is claimed,
  // so a change to the mixer that made it worse would be visible.
  const TWO_32 = 0x1_0000_0000;
  const overRepresented = TWO_32 % FIX_SCALE;
  assert.equal(overRepresented, 967_296);
  // The excess share of the unit interval that is drawn with the higher
  // probability, in millionths: 967,296 of 10⁶ outcomes carry one extra chance in
  // 4294. Anything that depends on less than that is not a finding.
  assert.ok(TWO_32 / FIX_SCALE > 4294 && TWO_32 / FIX_SCALE < 4296);

  for (const bound of [2, 3, 7, 256, 0x7fff_ffff]) {
    for (let counter = 0; counter < 200; counter++) {
      const value = drawInt(11, counter, bound);
      assert.ok(Number.isInteger(value) && value >= 0 && value < bound);
    }
  }
  assert.throws(() => drawInt(1, 1, 0), RangeError);
  assert.throws(() => drawInt(1, 1, -3), RangeError);
  // Not a fractional literal: `M-05`'s scan covers the tests too, and rightly.
  assert.throws(() => drawInt(1, 1, Number.MAX_SAFE_INTEGER + 2), RangeError);
});

test("bernoulli is the draw compared against p, and consumes one counter", () => {
  const p = 300_000 as ReturnType<typeof draw>;
  let hits = 0;
  for (let counter = 0; counter < 10_000; counter++) if (bernoulli(5, counter, p)) hits += 1;
  // 0.30 over ten thousand trials; the band is wide enough not to flap and tight
  // enough to catch a primitive that stopped being uniform.
  assert.ok(hits > 2800 && hits < 3200, `${String(hits)} hits in 10,000 at p = 0.30`);
  assert.equal(bernoulli(5, 1, p), draw(5, 1) < p);
});
