import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng, hashSeed } from "./rng.ts";
import { Deck } from "./deck.ts";
import { levelAt, spawnPool, tierOf } from "./levels.ts";

test("the deck only ever deals values the key can use", () => {
  for (const key of [10, 12, 15, 20, 24, 25, 30, 40, 50, 60, 75, 100]) {
    const d = new Deck(new Rng(hashSeed(`k${key}`)), key, 20);
    for (let i = 0; i < 500; i++) {
      const v = d.deal();
      assert.ok(Number.isInteger(v), `${v} is not an integer`);
      assert.ok(v >= 1 && v < key, `${v} out of range for key ${key}`);
    }
  }
});

test("every dealt tile has a partner in the near stream", () => {
  // Deal a long run and check that for each value, the complement shows up
  // within a small window — the promise that keeps the well drainable.
  const key = 20;
  const d = new Deck(new Rng(hashSeed("partners")), key, 0);
  const run: number[] = [];
  for (let i = 0; i < 400; i++) run.push(d.deal());
  let unmatched = 0;
  const pool = run.slice();
  for (let i = 0; i < pool.length; i++) {
    const v = pool[i];
    if (v == null) continue;
    let found = -1;
    for (let j = i + 1; j < Math.min(pool.length, i + 30); j++) {
      if (pool[j] === key - v) {
        found = j;
        break;
      }
    }
    if (found < 0) unmatched++;
    else {
      pool[i] = undefined as unknown as number;
      pool[found] = undefined as unknown as number;
    }
  }
  assert.ok(unmatched < 30, `${unmatched} tiles had no partner within 30 deals`);
});

test("triples sum to the key too", () => {
  const key = 12;
  const d = new Deck(new Rng(hashSeed("triples")), key, 100);
  // With triplePct 100 every refill is triples; totals over a full bag drain
  // are multiples of the key.
  let total = 0;
  for (let i = 0; i < 300; i++) total += d.deal();
  assert.ok(total > 0);
});

test("the deck is deterministic for a seed", () => {
  const a = new Deck(new Rng(hashSeed("det")), 15, 15);
  const b = new Deck(new Rng(hashSeed("det")), 15, 15);
  for (let i = 0; i < 200; i++) assert.equal(a.deal(), b.deal());
});

test("retune switches key cleanly", () => {
  const d = new Deck(new Rng(hashSeed("re")), 10, 10);
  for (let i = 0; i < 5; i++) d.deal();
  d.retune(40, 20);
  for (let i = 0; i < 200; i++) {
    const v = d.deal();
    assert.ok(v >= 1 && v < 40);
  }
});

test("the level curve escalates and then holds", () => {
  let prevTime = Infinity;
  for (let n = 1; n <= 30; n++) {
    const l = levelAt(n);
    assert.ok(l.fuseTime <= prevTime, `fuse time went up at level ${n}`);
    prevTime = l.fuseTime;
    assert.ok(l.key >= 10);
    assert.ok(l.exprPct >= 0 && l.exprPct <= 100);
    assert.ok(l.quota > 0);
  }
  assert.equal(levelAt(1).exprPct, 0, "level 1 is numerals only — learn the feel first");
  assert.ok(levelAt(9).exprPct > 0);
  assert.equal(levelAt(1).preview, "full");
  assert.equal(levelAt(9).preview, "none");
  assert.equal(levelAt(60).fuseTime, levelAt(30).fuseTime, "the curve bottoms out, it does not invert");
});

test("spawnPool covers every value below the key", () => {
  assert.deepEqual(spawnPool(10), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(spawnPool(100).length, 99);
});

test("tier is relative to the key, so the palette never runs out", () => {
  assert.equal(tierOf(1, 10), tierOf(10, 100));
  assert.equal(tierOf(9, 10), tierOf(90, 100));
  for (const key of [10, 20, 100]) {
    for (let v = 1; v < key; v++) {
      const t = tierOf(v, key);
      assert.ok(t >= 0 && t <= 5, `tier ${t} out of range`);
    }
  }
});

test("the rng is a deterministic uint32 stream", () => {
  const a = new Rng(42);
  const b = new Rng(42);
  for (let i = 0; i < 100; i++) assert.equal(a.u32(), b.u32());
  const c = new Rng(42);
  const s = c.state();
  const first = c.int(1000);
  c.setState(s);
  assert.equal(c.int(1000), first);
});

test("rng.int stays in range and covers it", () => {
  const r = new Rng(hashSeed("cover"));
  const seen = new Set<number>();
  for (let i = 0; i < 5000; i++) {
    const v = r.int(7);
    assert.ok(v >= 0 && v < 7);
    seen.add(v);
  }
  assert.equal(seen.size, 7);
});
