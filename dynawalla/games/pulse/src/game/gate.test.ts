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
  assert.equal(g.candidates.length, 1);
  assert.ok(g.candidates[0]!.correct);
});
