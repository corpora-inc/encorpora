import assert from "node:assert/strict";
import test from "node:test";
import { fnv1a64, fnv1a64Hex } from "./hash.ts";
import { SEED_SEPARATOR, createRng, fnv1a32, seedFrom } from "./rng.ts";

test("fnv1a32: published test vectors", () => {
  // From the FNV reference test suite. These are an independent oracle: a typo in
  // the offset basis or the prime fails here rather than silently reshuffling
  // every generated exercise.
  assert.equal(fnv1a32(""), 0x811c9dc5);
  assert.equal(fnv1a32("a"), 0xe40c292c);
  assert.equal(fnv1a32("b"), 0xe70c2de5);
  assert.equal(fnv1a32("foobar"), 0xbf9cf968);
});

test("fnv1a64: published test vectors", () => {
  assert.equal(fnv1a64(""), 0xcbf29ce484222325n);
  assert.equal(fnv1a64("a"), 0xaf63dc4c8601ec8cn);
  assert.equal(fnv1a64("foobar"), 0x85944171f73967e8n);
  assert.equal(fnv1a64Hex("foobar"), "85944171f73967e8");
});

test("fnv1a64: hashes UTF-8 bytes, not UTF-16 code units", () => {
  // Two strings that differ only above the ASCII range must not collide because
  // of a lossy encoding step.
  assert.notEqual(fnv1a64Hex("é"), fnv1a64Hex("e"));
  assert.equal(fnv1a64Hex("é").length, 16);
});

test("rng: pinned known-answer vectors", () => {
  // A regression pin, not an oracle: these are what this implementation produces
  // today. Changing them changes every generated exercise, which is why CG-16
  // hashes generator output on two operating systems.
  assert.deepEqual(
    Array.from({ length: 6 }, () => createRng(0)).map((rng) => rng.nextUint32()),
    [1144304738, 1144304738, 1144304738, 1144304738, 1144304738, 1144304738],
  );
  const stream = createRng(0);
  assert.deepEqual(
    Array.from({ length: 6 }, () => stream.nextUint32()),
    [1144304738, 1416247, 958946056, 627933444, 2007157716, 2340967985],
  );
  const seeded = createRng(0x9e3779b9);
  assert.deepEqual(
    Array.from({ length: 4 }, () => seeded.nextUint32()),
    [1541420728, 454851044, 2900350524, 3942498910],
  );
});

test("rng: same seed, same stream; different seed, different stream", () => {
  const a = Array.from({ length: 64 }, () => 0);
  const first = createRng(12345);
  const second = createRng(12345);
  const third = createRng(12346);
  for (let i = 0; i < a.length; i++) {
    assert.equal(first.nextUint32(), second.nextUint32());
  }
  assert.notEqual(createRng(12345).nextUint32(), third.nextUint32());
});

test("rng: rejects a seed that is not a uint32", () => {
  assert.throws(() => createRng(-1), RangeError);
  assert.throws(() => createRng(4294967296), RangeError);
  assert.throws(() => createRng(1 / 3), RangeError);
});

test("rng: nextInt stays in range and counts its draws", () => {
  const rng = createRng(7);
  for (let i = 0; i < 10000; i++) {
    const value = rng.nextInt(-5, 5);
    assert.ok(value >= -5 && value <= 5, `out of range: ${String(value)}`);
    assert.ok(Number.isSafeInteger(value));
  }
  assert.ok(rng.draws() >= 10000, "every draw is counted");
  assert.equal(createRng(7).nextInt(3, 3), 3, "a single-value range consumes no draw");
  assert.equal(createRng(7).draws(), 0);
  assert.throws(() => createRng(7).nextInt(5, 4), RangeError);
});

test("rng: nextInt is close to uniform", (t) => {
  const rng = createRng(99);
  const buckets = new Array<number>(10).fill(0);
  const draws = 100000;
  for (let i = 0; i < draws; i++) {
    const index = rng.nextInt(0, 9);
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  const expected = draws / 10;
  for (const [index, count] of buckets.entries()) {
    // ±5% of the expected count. Rejection sampling makes this a statement about
    // the generator, not about the modulo.
    assert.ok(
      count * 100 >= expected * 95 && count * 100 <= expected * 105,
      `bucket ${String(index)} had ${String(count)}, expected about ${String(expected)}`,
    );
  }
  t.diagnostic(`uniformity checked over ${String(draws)} draws into 10 buckets`);
});

test("rng: sample takes distinct elements in order", () => {
  const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const rng = createRng(31337);
  for (let i = 0; i < 2000; i++) {
    const count = rng.nextInt(0, items.length);
    const drawn = rng.sample(items, count);
    assert.equal(drawn.length, count);
    assert.equal(new Set(drawn).size, count, "elements are distinct");
    assert.deepEqual([...drawn].sort((a, b) => a - b), drawn, "order is preserved");
  }
  assert.throws(() => createRng(1).sample(items, items.length + 1), RangeError);
  assert.throws(() => createRng(1).pick([]), RangeError);
});

test("rng: seedFrom is stable and separates its parts", () => {
  assert.equal(seedFrom("a", "b"), fnv1a32(`a${SEED_SEPARATOR}b`));
  // The separator matters: without one, ("ab","c") and ("a","bc") would be the
  // same seed, and two different exercises would be the same exercise.
  assert.notEqual(seedFrom("ab", "c"), seedFrom("a", "bc"));
  assert.ok(seedFrom("dw.add.regroup.subtract-across-zero", "2") < 4294967296);
});
