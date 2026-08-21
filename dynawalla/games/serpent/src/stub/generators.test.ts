import assert from "node:assert/strict";
import test from "node:test";
import { makeCondition } from "./generators.ts";
import { fracLabel, parseLabel, satisfies } from "./exact.ts";
import { makeRng } from "./rng.ts";

const LEVELS = [0, 1, 2, 3, 4, 5, 6];

test("every generated label is exactly on the side of the condition it claims", () => {
  // Checked by an independent path: the generator builds labels from known
  // values, the parser recovers the value from the string, and the predicate
  // judges it. A generator bug and a parser bug would have to agree to hide.
  for (const level of LEVELS) {
    const rng = makeRng(`labels-${level}`);
    for (let i = 0; i < 300; i++) {
      const c = makeCondition(rng, level);
      for (const label of c.satisfying) {
        const v = parseLabel(label);
        assert.ok(v !== null, `unparsable satisfying label ${JSON.stringify(label)} (${c.prompt})`);
        assert.ok(satisfies(c.predicate, v), `${label} should satisfy ${c.prompt}`);
      }
      for (const label of c.failing) {
        const v = parseLabel(label);
        assert.ok(v !== null, `unparsable failing label ${JSON.stringify(label)} (${c.prompt})`);
        assert.ok(!satisfies(c.predicate, v), `${label} must NOT satisfy ${c.prompt}`);
      }
    }
  }
});

test("pools are big enough to fill an arena and hold no duplicates", () => {
  for (const level of LEVELS) {
    const rng = makeRng(`pools-${level}`);
    for (let i = 0; i < 200; i++) {
      const c = makeCondition(rng, level);
      assert.ok(c.satisfying.length >= 4, `${c.prompt} had ${c.satisfying.length} satisfying`);
      assert.ok(c.failing.length >= 8, `${c.prompt} had ${c.failing.length} failing`);
      assert.equal(new Set(c.satisfying).size, c.satisfying.length, `${c.prompt} repeats a satisfying label`);
      assert.equal(new Set(c.failing).size, c.failing.length, `${c.prompt} repeats a failing label`);
      for (const s of c.satisfying) assert.ok(!c.failing.includes(s), `${s} is in both pools of ${c.prompt}`);
    }
  }
});

test("wrong answers are near misses, not obvious rubbish", () => {
  // A distractor you can reject without arithmetic makes the round free. For
  // `= N`, at least half of the wrong values sit within 4 of the target.
  const rng = makeRng("nearness");
  let checked = 0;
  for (let i = 0; i < 400; i++) {
    const c = makeCondition(rng, 3);
    if (c.predicate.kind !== "eq") continue;
    checked++;
    const target = c.predicate.target.n;
    const near = c.failing.filter((l) => {
      const v = parseLabel(l);
      return v !== null && v.d === 1 && Math.abs(v.n - target) <= 4;
    });
    assert.ok(near.length * 2 >= c.failing.length, `${c.prompt}: only ${near.length}/${c.failing.length} near misses`);
  }
  assert.ok(checked > 20, "expected the equality family to appear at level 3");
});

test("multiples rounds never offer a multiple as a wrong answer", () => {
  const rng = makeRng("multiples");
  let seen = 0;
  for (let i = 0; i < 600; i++) {
    const c = makeCondition(rng, 5);
    if (c.predicate.kind !== "multiple") continue;
    seen++;
    const base = c.predicate.base;
    for (const l of c.failing) {
      const v = parseLabel(l);
      assert.ok(v !== null && v.d === 1);
      assert.notEqual(v.n % base, 0, `${l} is a multiple of ${base} but is listed as wrong`);
    }
  }
  assert.ok(seen > 20, "expected the multiples family at level 5");
});

test("fraction rounds ship the equal-value trap", () => {
  // `2/4` is not greater than `1/2`. That single orb is the point of the round.
  const rng = makeRng("fractions");
  let withTrap = 0;
  let total = 0;
  for (let i = 0; i < 800; i++) {
    const c = makeCondition(rng, 6);
    if (c.predicate.kind !== "gt" && c.predicate.kind !== "lt") continue;
    total++;
    const ref = c.predicate.ref;
    // Specifically an *unreduced* equal-value label: the string is not in
    // lowest terms, but its exact value is the reference itself.
    if (
      c.failing.some((l) => {
        const v = parseLabel(l);
        return v !== null && v.n * ref.d === ref.n * v.d && l !== fracLabel(v);
      })
    ) {
      withTrap++;
    }
  }
  assert.ok(total > 20, "expected fraction conditions at level 6");
  assert.ok(withTrap * 2 > total, `only ${withTrap}/${total} fraction rounds carried an equal-value trap`);
});

test("the same seed generates the same conditions", () => {
  const a = makeRng("determinism");
  const b = makeRng("determinism");
  for (let i = 0; i < 100; i++) {
    const ca = makeCondition(a, i % 7);
    const cb = makeCondition(b, i % 7);
    assert.equal(ca.key, cb.key);
    assert.deepEqual(ca.satisfying, cb.satisfying);
    assert.deepEqual(ca.failing, cb.failing);
  }
});

test("a mutation always changes the condition", () => {
  const rng = makeRng("avoid");
  let prev = makeCondition(rng, 4);
  for (let i = 0; i < 400; i++) {
    const next = makeCondition(rng, 4, prev.key);
    assert.notEqual(next.key, prev.key);
    prev = next;
  }
});
