import { test } from "node:test";
import assert from "node:assert/strict";
import { Rng, hashSeed } from "../core/rng.ts";
import {
  DIVIDE,
  MINUS,
  TIMES,
  evaluatePrompt,
  formsFor,
  noCarryAdd,
  questionFor,
  smallerFromLarger,
} from "./questions.ts";
import { createStubHost } from "./stubHost.ts";

test("every generated prompt evaluates exactly to its stated answer", () => {
  for (let d = 0; d <= 10; d++) {
    const rng = new Rng(hashSeed(`d${d}`));
    for (let v = 1; v <= 99; v++) {
      const q = questionFor(v, d / 10, rng, v);
      assert.equal(String(evaluatePrompt(q.prompt)), q.answer, `${q.prompt} != ${q.answer}`);
      assert.equal(q.answer, String(v));
    }
  }
});

test("no answer or distractor is ever a float", () => {
  const rng = new Rng(1234);
  for (let v = 1; v <= 120; v++) {
    const q = questionFor(v, 0.9, rng, v);
    assert.equal(Number.isInteger(Number(q.answer)), true, q.prompt);
    for (const d of q.distractors) {
      assert.equal(Number.isInteger(Number(d)), true, `${q.prompt} -> ${d}`);
      assert.ok(Number(d) > 0);
      assert.notEqual(d, q.answer);
    }
    assert.equal(new Set(q.distractors).size, q.distractors.length);
  }
});

test("division prompts always divide exactly", () => {
  const rng = new Rng(99);
  let saw = 0;
  for (let v = 2; v <= 60; v++) {
    for (let i = 0; i < 8; i++) {
      const q = questionFor(v, 0.7, rng, v);
      if (!q.prompt.includes(DIVIDE)) continue;
      saw++;
      const [m, d] = q.prompt.split(` ${DIVIDE} `).map(Number) as [number, number];
      assert.equal(m % d, 0, q.prompt);
      assert.equal(m / d, v);
    }
  }
  assert.ok(saw > 0, "expected some division prompts at difficulty 0.7");
});

test("generation is deterministic for a seed", () => {
  const a = new Rng(hashSeed("same"));
  const b = new Rng(hashSeed("same"));
  for (let v = 1; v < 40; v++) {
    assert.deepEqual(questionFor(v, 0.6, a, v), questionFor(v, 0.6, b, v));
  }
});

test("difficulty unlocks forms monotonically", () => {
  let prev = formsFor(0).length;
  for (let d = 0; d <= 10; d++) {
    const n = formsFor(d / 10).length;
    assert.ok(n >= prev, `forms shrank at ${d / 10}`);
    prev = n;
  }
  assert.deepEqual(formsFor(0), ["add"]);
  assert.ok(formsFor(0.9).includes("muladd"));
});

test("prompts use the real minus sign and multiplication sign", () => {
  const rng = new Rng(7);
  for (let v = 2; v <= 40; v++) {
    const q = questionFor(v, 0.5, rng, v);
    assert.equal(q.prompt.includes("-"), false, `hyphen in ${q.prompt}`);
    assert.equal(q.prompt.includes("*"), false);
    assert.equal(q.prompt.includes("x"), false);
  }
  assert.equal(MINUS.charCodeAt(0), 0x2212);
  assert.equal(TIMES.charCodeAt(0), 0x00d7);
});

test("mal-rules reproduce the real bugs", () => {
  // 42 − 17: the smaller-from-larger bug gives 35, not 25
  assert.equal(smallerFromLarger(42, 17), 35);
  assert.equal(42 - 17, 25);
  // 27 + 48: dropping the carry gives 65, not 75
  assert.equal(noCarryAdd(27, 48), 65);
});

test("the stub host honours focus and reports a tally", () => {
  const host = createStubHost("seed-a");
  host.focus?.({ key: 20, wanted: [7, 13, 4] });
  assert.equal(host.next().answer, "7");
  assert.equal(host.next().answer, "13");
  assert.equal(host.next().answer, "4");
  const free = host.next();
  assert.ok(Number(free.answer) >= 1 && Number(free.answer) < 20);

  host.report({ questionId: free.id, correct: true, ms: 900, answered: free.answer });
  host.report({ questionId: free.id, correct: false, ms: 100, answered: "0" });
  assert.deepEqual(host.tally(), { asked: 4, correct: 1, totalMs: 1000 });
});

test("two stub hosts on the same seed produce identical streams", () => {
  const a = createStubHost("twin");
  const b = createStubHost("twin");
  a.focus?.({ key: 24, wanted: [5, 19, 12] });
  b.focus?.({ key: 24, wanted: [5, 19, 12] });
  for (let i = 0; i < 20; i++) assert.deepEqual(a.next(), b.next());
});
