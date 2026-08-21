import assert from "node:assert/strict";
import test from "node:test";
import { createStubHost } from "./host.ts";
import { parseLabel } from "./exact.ts";

test("a seed reproduces a run's arithmetic exactly", () => {
  const a = createStubHost({ seed: "run-1" });
  const b = createStubHost({ seed: "run-1" });
  for (let i = 0; i < 120; i++) {
    const qa = a.next();
    const qb = b.next();
    assert.deepEqual(qa, qb);
  }
});

test("different seeds diverge", () => {
  const a = createStubHost({ seed: "run-1" });
  const b = createStubHost({ seed: "run-2" });
  const seqA = Array.from({ length: 40 }, () => a.next().answer).join("|");
  const seqB = Array.from({ length: 40 }, () => b.next().answer).join("|");
  assert.notEqual(seqA, seqB);
});

test("a question never lists its own answer as a distractor", () => {
  const h = createStubHost({ seed: "distinct" });
  for (let i = 0; i < 400; i++) {
    const q = h.next();
    assert.ok(q.distractors.length >= 3, `${q.prompt} produced ${q.distractors.length} distractors`);
    assert.ok(!q.distractors.includes(q.answer));
    assert.equal(new Set(q.distractors).size, q.distractors.length);
    assert.ok(parseLabel(q.answer) !== null, `unparsable answer ${q.answer}`);
    assert.ok(q.id.length > 0);
    assert.ok(q.difficulty >= 0 && q.difficulty <= 1);
  }
});

test("questions arrive in epochs that share a condition, then rotate", () => {
  const h = createStubHost({ seed: "epochs", epochMin: 4, epochMax: 7 });
  const prompts = Array.from({ length: 200 }, () => h.next().prompt);
  let runs = 0;
  let runLen = 1;
  const lengths: number[] = [];
  for (let i = 1; i < prompts.length; i++) {
    if (prompts[i] === prompts[i - 1]) {
      runLen++;
    } else {
      lengths.push(runLen);
      runLen = 1;
      runs++;
    }
  }
  assert.ok(runs > 20, `expected many rotations, saw ${runs}`);
  for (const l of lengths) {
    assert.ok(l >= 4 && l <= 7, `epoch length ${l} outside [4,7]`);
  }
});

test("the run gets harder as it goes", () => {
  const h = createStubHost({ seed: "ramp" });
  for (let i = 0; i < 6; i++) h.next();
  const early = h.stats().level;
  for (let i = 0; i < 60; i++) {
    const q = h.next();
    h.report({ questionId: q.id, correct: true, ms: 900, answered: q.answer });
  }
  const late = h.stats().level;
  assert.ok(late > early, `level did not rise: ${early} -> ${late}`);
  assert.equal(h.stats().level, 6, "a perfect run should reach the top band");
});

test("a struggling learner is not pushed as fast", () => {
  const good = createStubHost({ seed: "band" });
  const bad = createStubHost({ seed: "band" });
  for (let i = 0; i < 40; i++) {
    const qg = good.next();
    good.report({ questionId: qg.id, correct: true, ms: 700, answered: qg.answer });
    const qb = bad.next();
    bad.report({ questionId: qb.id, correct: false, ms: 3000, answered: "0" });
  }
  assert.ok(bad.stats().level < good.stats().level, "accuracy must move the band");
});

test("haptics and reduced motion degrade silently with no browser", () => {
  const h = createStubHost({ seed: "degrade" });
  h.haptic("light");
  h.haptic("failure");
  assert.equal(h.prefersReducedMotion(), false);
});
