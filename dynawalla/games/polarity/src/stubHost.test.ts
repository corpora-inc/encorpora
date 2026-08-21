import test from "node:test";
import assert from "node:assert/strict";
import { VALUE_MAX, VALUE_MIN, chooseDistractors, makeStubHost } from "./stubHost.ts";
import { makeRng } from "./core/rng.ts";
import { parseInt_ } from "./math/signed.ts";

// The host runs in the browser; `navigator` and `matchMedia` are absent under
// node. haptic()/prefersReducedMotion() are only touched by the game, not here.
test("every generated question is a well-formed signed-integer question", () => {
  const h = makeStubHost({ seed: 1234 });
  const domains = new Set<string>();
  for (let i = 0; i < 4000; i++) {
    // Sweep the difficulty band. The generator table is chosen by difficulty
    // (EASY < 0.3 <= MID < 0.68 <= HARD), and `hard` only climbs in response to
    // report(). A loop that just calls next() never leaves EASY, so it can only
    // ever observe 3 of the 6 families and never exercises the MID/HARD ones.
    const q = h.next({ difficulty: (i % 100) / 99 });
    domains.add(q.domain);

    const a = parseInt_(q.answer); // throws if not an exact integer
    assert.ok(a >= VALUE_MIN && a <= VALUE_MAX, `answer out of orb range: ${q.answer}`);

    assert.equal(q.distractors.length, 3, `wanted 3 distractors, got ${q.distractors.length}`);
    const vals = q.distractors.map(parseInt_);
    for (const v of vals) {
      assert.ok(v >= VALUE_MIN && v <= VALUE_MAX, `distractor out of orb range: ${v}`);
      assert.notEqual(v, a, `distractor equals the answer in ${q.prompt}`);
    }
    assert.equal(new Set(vals).size, 3, `duplicate distractors in ${q.prompt}`);

    assert.ok(q.prompt.length > 0 && q.prompt.length <= 22, `prompt too long: ${q.prompt}`);
    assert.doesNotMatch(q.prompt, /-/, "use U+2212, never a hyphen");
    assert.ok(q.id.length > 0);
    assert.ok(q.difficulty >= 0 && q.difficulty <= 1);
  }
  // the whole family table is reachable across a long run
  assert.ok(domains.size >= 5, `only saw domains ${[...domains].join(",")}`);
});

test("prompts are arithmetically true", () => {
  const h = makeStubHost({ seed: 77 });
  const norm = (s: string): string => s.replace(/−/g, "-").replace(/×/g, "*");
  let checked = 0;
  for (let i = 0; i < 1500; i++) {
    // Sweep difficulty here too, so the int-chain / int-mul / int-dist branches
    // below are actually reached rather than passing vacuously.
    const q = h.next({ difficulty: (i % 100) / 99 });
    const a = parseInt_(q.answer);
    const p = norm(q.prompt);
    if (q.domain === "int-dist") {
      const m = /^(-?\d+) to (-?\d+)$/.exec(p);
      assert.ok(m, p);
      assert.equal(a, Math.abs(Number(m[2]) - Number(m[1])));
    } else if (q.domain === "int-missing") {
      const m = /^(-?\d+) \+ \? = (-?\d+)$/.exec(p);
      assert.ok(m, p);
      assert.equal(Number(m[1]) + a, Number(m[2]));
    } else {
      // add / sub / chain / mul are plain infix over integers
      assert.match(p, /^[-()\d+*\s]+$/, p);
      // eslint-disable-next-line no-new-func -- test-only evaluation of our own generated infix
      const v = Function(`"use strict";return (${p})`)() as number;
      assert.equal(v, a, `${q.prompt} should be ${a}, computed ${v}`);
    }
    checked++;
  }
  assert.ok(checked === 1500);
});

test("seeded runs are byte-identical", () => {
  const a = makeStubHost({ seed: 99 });
  const b = makeStubHost({ seed: 99 });
  for (let i = 0; i < 500; i++) assert.deepEqual(a.next(), b.next());
});

test("difficulty adapts up on fast-correct and down on wrong", () => {
  const h = makeStubHost({ seed: 5, difficulty: 0.5 });
  for (let i = 0; i < 10; i++)
    h.report({ questionId: "x", correct: true, ms: 1200, answered: "1" });
  assert.ok(h.difficulty() > 0.5);
  for (let i = 0; i < 20; i++)
    h.report({ questionId: "x", correct: false, ms: 4000, answered: "1" });
  assert.equal(h.difficulty(), 0);
  assert.ok(h.next().difficulty === 0);
});

test("a pinned domain is honoured", () => {
  const h = makeStubHost({ seed: 3 });
  for (let i = 0; i < 60; i++) assert.equal(h.next({ domain: "int-mul" }).domain, "int-mul");
});

test("chooseDistractors prefers same-sign mal-rules — the dangerous ones", () => {
  const rng = makeRng(11);
  // answer −5, mal-rules offering −11 (sign-of-larger) and +11, +13
  const d = chooseDistractors(-5, [-11, 11, 13, -3], rng).map(parseInt_);
  assert.equal(d.length, 3);
  assert.ok(d.includes(-11) && d.includes(-3), `same-sign first: got ${d.join(",")}`);
});

test("chooseDistractors always fills to three even when mal-rules collide", () => {
  const rng = makeRng(12);
  const d = chooseDistractors(4, [4, 4, 4], rng).map(parseInt_);
  assert.equal(new Set(d).size, 3);
  assert.ok(!d.includes(4));
});
