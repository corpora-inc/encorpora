import { strict as assert } from "node:assert";
import { test } from "node:test";

import { generate, distractorsFor } from "./generate.ts";

/**
 * An independent, precedence-aware integer evaluator for the *displayed*
 * prompt. Nothing in `generate.ts` is reused here on purpose: if the prompt and
 * the stored answer ever drift apart, this is what catches it, and a shared
 * helper would drift with them.
 */
function evaluatePrompt(prompt: string): number {
  const tokens = prompt.trim().split(/\s+/);
  const values: number[] = [];
  const ops: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] as string;
    if (i % 2 === 0) {
      assert.match(token, /^\d+$/, `operand expected, got ${token} in "${prompt}"`);
      values.push(Number(token));
    } else {
      assert.ok(["+", "−", "×", "÷"].includes(token), `operator expected, got ${token}`);
      ops.push(token);
    }
  }
  // × and ÷ first, left to right, then + and −.
  for (let i = 0; i < ops.length; ) {
    const op = ops[i] as string;
    if (op === "×" || op === "÷") {
      const a = values[i] as number;
      const b = values[i + 1] as number;
      const out = op === "×" ? a * b : a / b;
      assert.ok(Number.isInteger(out), `non-integer division in "${prompt}"`);
      values.splice(i, 2, out);
      ops.splice(i, 1);
    } else i++;
  }
  let total = values[0] as number;
  for (let i = 0; i < ops.length; i++) {
    total = ops[i] === "+" ? total + (values[i + 1] as number) : total - (values[i + 1] as number);
  }
  return total;
}

const DIFFICULTIES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

test("every generated question's prompt evaluates to its own answer", () => {
  for (const difficulty of DIFFICULTIES) {
    for (let i = 0; i < 300; i++) {
      const q = generate(0xc0ffee, i, difficulty);
      assert.equal(
        String(evaluatePrompt(q.prompt)),
        q.answer,
        `${q.prompt} should be ${q.answer}`,
      );
    }
  }
});

test("answers are non-negative integers written canonically", () => {
  for (const difficulty of DIFFICULTIES) {
    for (let i = 0; i < 200; i++) {
      const q = generate(7, i, difficulty);
      assert.match(q.answer, /^(0|[1-9]\d*)$/, `bad answer "${q.answer}" for ${q.prompt}`);
      assert.ok(Number(q.answer) >= 0);
    }
  }
});

test("distractors are plentiful, distinct, non-negative and never the answer", () => {
  for (const difficulty of DIFFICULTIES) {
    for (let i = 0; i < 300; i++) {
      const q = generate(99, i, difficulty);
      assert.ok(q.distractors.length >= 5, `${q.prompt} gave ${q.distractors.length}`);
      const seen = new Set(q.distractors);
      assert.equal(seen.size, q.distractors.length, `duplicate distractor in ${q.prompt}`);
      assert.ok(!seen.has(q.answer), `${q.prompt} listed its own answer as a distractor`);
      for (const d of q.distractors) {
        assert.match(d, /^(0|[1-9]\d*)$/, `bad distractor "${d}" for ${q.prompt}`);
      }
    }
  }
});

test("most distractors share the answer's digit count, so silhouette is not a tell", () => {
  let sameWidth = 0;
  let total = 0;
  for (const difficulty of DIFFICULTIES) {
    for (let i = 0; i < 200; i++) {
      const q = generate(1234, i, difficulty);
      // The game only ever shows four of them.
      for (const d of q.distractors.slice(0, 4)) {
        total++;
        if (d.length === q.answer.length) sameWidth++;
      }
    }
  }
  assert.ok(sameWidth / total > 0.9, `only ${((sameWidth / total) * 100).toFixed(1)}% matched`);
});

test("generation is deterministic and seed-dependent", () => {
  const a = generate(42, 3, 0.5);
  const b = generate(42, 3, 0.5);
  assert.deepEqual(a, b);
  const c = generate(43, 3, 0.5);
  assert.notDeepEqual(a, c);
});

test("distractorsFor pads to six even when every mal-rule collides", () => {
  const out = distractorsFor(7, [7, 7, 7, -3, 1.5]);
  assert.equal(out.length, 6);
  assert.equal(new Set(out).size, 6);
  assert.ok(!out.includes("7"));
});

test("difficulty selects harder shapes", () => {
  const easy = new Set<string>();
  const hard = new Set<string>();
  for (let i = 0; i < 60; i++) {
    easy.add(generate(5, i, 0.05).domain);
    hard.add(generate(5, i, 0.95).domain);
  }
  assert.deepEqual([...easy], ["add-sub"]);
  assert.ok(hard.has("two-step"));
  assert.ok(!hard.has("add-sub"));
});
