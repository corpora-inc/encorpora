import { test } from "node:test";
import assert from "node:assert/strict";
import { createStubHost } from "./stubHost.ts";
import { add, cmp, eq, inBar, parseRat, rat, sub } from "./math/rational.ts";

const MIN_GAP = rat(1n, 12n);

function gap(a: ReturnType<typeof parseRat> | undefined, b: ReturnType<typeof parseRat> | undefined) {
  return cmp(a!, b!) >= 0 ? sub(a!, b!) : sub(b!, a!);
}

test("every question is answerable as a position inside one bar", () => {
  const h = createStubHost({ seed: "gates" });
  for (let i = 0; i < 400; i++) {
    if (i % 40 === 0) h.setFloor(i / 400);
    const q = h.next();
    const a = parseRat(q.answer);
    assert.ok(a, `answer not a fraction: ${q.answer}`);
    assert.ok(inBar(a), `answer outside (0,1]: ${q.answer} for ${q.prompt}`);
    assert.equal(q.distractors.length, 3, `wrong distractor count for ${q.prompt}`);
    for (const d of q.distractors) {
      const r = parseRat(d);
      assert.ok(r, `distractor not a fraction: ${d}`);
      assert.ok(inBar(r), `distractor outside (0,1]: ${d}`);
    }
  }
});

test("candidates stay far enough apart to be four legible targets", () => {
  const h = createStubHost({ seed: "spacing" });
  for (let i = 0; i < 400; i++) {
    h.setFloor((i % 100) / 100);
    const q = h.next();
    const all = [q.answer, ...q.distractors].map(parseRat);
    for (let a = 0; a < all.length; a++) {
      for (let b = a + 1; b < all.length; b++) {
        assert.ok(!eq(all[a]!, all[b]!), `duplicate candidate in ${q.prompt}: ${q.answer}`);
        assert.ok(
          cmp(gap(all[a], all[b]), MIN_GAP) >= 0,
          `candidates too close in ${q.prompt}: ${all[a]!.n}/${all[a]!.d} vs ${all[b]!.n}/${all[b]!.d}`,
        );
      }
    }
  }
});

test("the prompt actually evaluates to the stated answer", () => {
  const h = createStubHost({ seed: "arith" });
  for (let i = 0; i < 500; i++) {
    h.setFloor((i % 100) / 100);
    const q = h.next();
    const m = /^(\S+)\s*([+−×])\s*(\S+)$/u.exec(q.prompt);
    assert.ok(m, `unparseable prompt: ${q.prompt}`);
    const [, ls, op, rs] = m;
    const l = parseRat(ls!);
    const r = parseRat(rs!);
    assert.ok(l && r, `prompt operands not fractions: ${q.prompt}`);
    const expect =
      op === "+" ? add(l, r) : op === "−" ? sub(l, r) : rat(l.n * r.n, l.d * r.d);
    assert.ok(
      eq(expect, parseRat(q.answer)!),
      `${q.prompt} should be ${expect.n}/${expect.d} but says ${q.answer}`,
    );
  }
});

test("the same seed is the same run, a different seed is not", () => {
  const a = createStubHost({ seed: "same" });
  const b = createStubHost({ seed: "same" });
  const c = createStubHost({ seed: "other" });
  const pull = (h: ReturnType<typeof createStubHost>) =>
    Array.from({ length: 24 }, () => {
      const q = h.next();
      return `${q.prompt}=${q.answer}|${q.distractors.join(",")}`;
    });
  const ax = pull(a);
  assert.deepEqual(ax, pull(b));
  assert.notDeepEqual(ax, pull(c));
});

test("difficulty adapts up on right answers and down on wrong", () => {
  const h = createStubHost({ seed: "adapt", startDifficulty: 0.4 });
  const before = h.difficulty();
  for (let i = 0; i < 6; i++) {
    h.report({ questionId: `q${i}`, correct: true, ms: 900, answered: "1/2" });
  }
  assert.ok(h.difficulty() > before);
  const peak = h.difficulty();
  for (let i = 0; i < 6; i++) {
    h.report({ questionId: `w${i}`, correct: false, ms: 3000, answered: "2/6" });
  }
  assert.ok(h.difficulty() < peak);
  assert.equal(h.history().length, 12);
});

test("harder settings reach denominators the easy ones never do", () => {
  const denoms = (floor: number): Set<bigint> => {
    const h = createStubHost({ seed: "denoms" });
    h.setFloor(floor);
    const out = new Set<bigint>();
    for (let i = 0; i < 120; i++) {
      const q = h.next();
      for (const s of [q.answer, ...q.distractors]) out.add(parseRat(s)!.d);
    }
    return out;
  };
  const easy = denoms(0.05);
  const hard = denoms(0.95);
  assert.ok(Math.max(...[...hard].map(Number)) > Math.max(...[...easy].map(Number)));
});
