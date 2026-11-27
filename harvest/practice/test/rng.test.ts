import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng, hashString, randInt, shuffle, weightedIndex } from "../src/index.ts";

test("same seed, same stream; different seed, different stream", () => {
  const a = createRng("x"), b = createRng("x"), c = createRng("y");
  const sa = Array.from({ length: 20 }, () => a.next());
  const sb = Array.from({ length: 20 }, () => b.next());
  const sc = Array.from({ length: 20 }, () => c.next());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  for (const v of sa) assert.ok(v >= 0 && v < 1);
});

test("hashString is stable", () => {
  assert.equal(hashString(""), 0x811c9dc5);
  assert.equal(hashString("a"), 0xe40c292c);
});

test("numeric seeds work and are distinct from string seeds", () => {
  assert.notEqual(createRng(1).next(), createRng(2).next());
});

test("randInt covers its range and rejects bad n", () => {
  const r = createRng(7);
  const seen = new Set<number>();
  for (let i = 0; i < 500; i++) seen.add(randInt(r, 5));
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4]);
  assert.throws(() => randInt(r, 0), RangeError);
  assert.throws(() => randInt(r, 1.5), RangeError);
});

test("shuffle is a permutation and leaves the input alone", () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(createRng(3), input);
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...out].sort((a, b) => a - b), input);
  assert.notDeepEqual(out, input);
});

test("weightedIndex follows the weights and never picks a zero weight", () => {
  const r = createRng(11);
  const counts = [0, 0, 0];
  for (let i = 0; i < 6000; i++) counts[weightedIndex(r, [1, 0, 3])]!++;
  assert.equal(counts[1], 0);
  const ratio = counts[2]! / counts[0]!;
  assert.ok(ratio > 2.6 && ratio < 3.4, `ratio ${ratio}`);
});

test("weightedIndex rejects bad weights", () => {
  const r = createRng(1);
  assert.throws(() => weightedIndex(r, []), RangeError);
  assert.throws(() => weightedIndex(r, [0, 0]), RangeError);
  assert.throws(() => weightedIndex(r, [1, -1]), RangeError);
  assert.throws(() => weightedIndex(r, [1, Number.NaN]), RangeError);
});
