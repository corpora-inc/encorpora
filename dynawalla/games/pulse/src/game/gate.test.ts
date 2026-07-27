import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGate } from "./gate.ts";
import { makeRng, hashSeed } from "../rng.ts";
import { createStubHost } from "../stubHost.ts";
import { parseRat, toFloat } from "../math/rational.ts";
import type { Question } from "../contract.ts";

const rng = () => makeRng(hashSeed("gate-test"));

test("a candidate's position in the bar IS its value", () => {
  const q: Question = {
    id: "q1",
    prompt: "1/2 + 1/4",
    answer: "3/4",
    distractors: ["2/6", "1/4", "1"],
    domain: "fractions-add",
    difficulty: 0.3,
  };
  const g = buildGate(q, rng());
  assert.ok(g.positional);
  for (const c of g.candidates) {
    assert.ok(Math.abs(c.pos - toFloat(parseRat(c.label)!)) < 1e-12, `${c.label} placed at ${c.pos}`);
  }
  const correct = g.candidates.filter((c) => c.correct);
  assert.equal(correct.length, 1);
  assert.equal(correct[0]!.label, "3/4");
  assert.ok(Math.abs(correct[0]!.pos - 0.75) < 1e-12);
});

test("candidates arrive in ascending order — the bar is a number line", () => {
  const h = createStubHost({ seed: "order" });
  const r = rng();
  for (let i = 0; i < 200; i++) {
    h.setFloor((i % 100) / 100);
    const g = buildGate(h.next(), r);
    for (let k = 1; k < g.candidates.length; k++) {
      assert.ok(g.candidates[k]!.pos > g.candidates[k - 1]!.pos, "candidates out of order");
    }
    assert.equal(g.candidates.filter((c) => c.correct).length, 1);
    assert.ok(g.candidates.length >= 2 && g.candidates.length <= 4);
    for (const c of g.candidates) assert.ok(c.pos > 0 && c.pos <= 1);
  }
});

test("a non-fractional host still plays; it just stops being a number line", () => {
  const q: Question = {
    id: "q2",
    prompt: "15 − 8",
    answer: "7",
    distractors: ["5", "4", "9"],
    domain: "add-sub",
    difficulty: 0.2,
  };
  const g = buildGate(q, rng());
  assert.equal(g.positional, false);
  assert.equal(g.candidates.length, 4);
  assert.equal(g.candidates.filter((c) => c.correct).length, 1);
  for (const c of g.candidates) assert.ok(c.pos > 0 && c.pos <= 1);
  assert.deepEqual(
    [...g.candidates].map((c) => c.pos).sort((a, b) => a - b),
    g.candidates.map((c) => c.pos).sort((a, b) => a - b),
  );
});

test("a decimal answer falls back rather than being silently mis-placed", () => {
  const q: Question = {
    id: "q3",
    prompt: "0.5 + 0.25",
    answer: "0.75",
    distractors: ["0.3", "0.7", "1.0"],
    domain: "decimals",
    difficulty: 0.5,
  };
  const g = buildGate(q, rng());
  assert.equal(g.positional, false);
  assert.ok(g.candidates.some((c) => c.correct && c.label === "0.75"));
});

test("the correct answer survives even when every distractor is unusable", () => {
  const q: Question = {
    id: "q4",
    prompt: "1/2 + 1/4",
    answer: "3/4",
    // Out of range, duplicated, and crowding the answer.
    distractors: ["9/4", "3/4", "19/24"],
    domain: "fractions-add",
    difficulty: 0.9,
  };
  const g = buildGate(q, rng());
  assert.ok(
    g.candidates.some((c) => c.correct && c.label === "3/4"),
    "the answer must survive — that is what this test is named for",
  );
  // It used to assert `candidates.length === 1`, which described what the code
  // did rather than what a child should be handed: a lone target drawn as a
  // full pie, unmissable. None of these three can sit on the bar, so the gate
  // now gives up the number line rather than the question.
  assert.ok(g.candidates.length >= 2, `only ${g.candidates.length} candidate(s)`);
  assert.equal(g.positional, false);
  // `3/4` was a distractor AND the answer. It must not appear twice, once
  // scoring right and once wrong.
  assert.equal(g.candidates.filter((c) => c.label === "3/4").length, 1, "answer duplicated");
  assert.equal(g.candidates.filter((c) => c.correct).length, 1, "exactly one correct");
});

test("a gate is never a single unmissable target", () => {
  // The bug this guards: the positional path admits a distractor only if it
  // lands in (0,1]. When the host serves column arithmetic — which it does
  // today, the ladder being `add`-only — the answer can be in the bar while
  // every distractor is outside it, and the child was handed one candidate
  // drawn as a full pie. Not a question; a formality.
  const q: Question = {
    id: "q-degenerate",
    prompt: "43 − 42",
    answer: "1",
    distractors: ["2", "11", "0"],
    domain: "add-sub",
    difficulty: 0.2,
  };
  const g = buildGate(q, rng());
  assert.ok(g.candidates.length >= 2, `only ${g.candidates.length} candidate(s)`);
  assert.equal(g.positional, false, "should fall back to the flat presentation");
  assert.equal(g.candidates.filter((c) => c.correct).length, 1, "exactly one correct");
});

test("column arithmetic never yields fewer than two candidates", () => {
  // The real host, not this game's stub. PULSE's own stub serves fractions, so
  // sweeping it would pass this vacuously — it can barely produce the
  // degenerate shape. The live curriculum ladder is `add`-only, so what PULSE
  // is actually handed is whole-number column arithmetic, where the answer
  // often lands in (0,1] only when it is exactly 1 and the distractors never
  // do. That is the case worth sweeping.
  const r = rng();
  let degenerateShapes = 0;
  for (let a = 0; a <= 60; a++) {
    for (let b = 0; b <= 60; b++) {
      const ansV = a - b;
      const q: Question = {
        id: `col-${a}-${b}`,
        prompt: `${a} − ${b}`,
        answer: String(ansV),
        distractors: [String(ansV + 1), String(ansV - 1), String(a + b)],
        domain: "add-sub",
        difficulty: 0.2,
      };
      const g = buildGate(q, r);
      assert.ok(g.candidates.length >= 2, `${q.prompt} gave ${g.candidates.length} candidate(s)`);
      assert.equal(g.candidates.filter((c) => c.correct).length, 1, `${q.prompt} correct-count`);
      const labels = g.candidates.map((c) => c.label);
      assert.equal(new Set(labels).size, labels.length, `${q.prompt} duplicated a label`);
      if (ansV === 1) degenerateShapes++;
    }
  }
  // Proves the sweep actually visited the shape it exists to catch.
  assert.ok(degenerateShapes > 0, "swept nothing that could degenerate");
});

test("the fraction stub host also always gives a real choice", () => {
  const h = createStubHost({ seed: "gate-degenerate-sweep" });
  const r = rng();
  for (let i = 0; i < 3000; i++) {
    const g = buildGate(h.next(), r);
    assert.ok(g.candidates.length >= 2, `${g.prompt} gave ${g.candidates.length} candidate(s)`);
    assert.equal(g.candidates.filter((c) => c.correct).length, 1, `${g.prompt} correct-count`);
  }
});
