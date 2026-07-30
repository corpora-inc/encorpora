import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

import { comprehensionTarget, itemShape, opOf, MAX_DIGITS, MAX_TARGET } from "./comprehension.ts";

/**
 * The invariant `docs/PACING_AUDIT_2026-07.md` sets for the whole fleet:
 *
 *   > `window(d)` must be MONOTONE NON-DECREASING in item difficulty. A harder
 *   > question may never get less time than an easier one.
 *
 * VOLTA was inverted. The founder:
 *
 *   > "you have 5 seconds to do 2x1 and then 2 seconds to do 84302+4186"
 *
 * Measured through the real scheduler before this module existed: the gate's own
 * window was 5.40s on the opening gate, where the content is `5 − 2`, and 2.42s at
 * terminal velocity on the smallest quality tier, where the content is four- and
 * five-digit column arithmetic. Comprehension including the pre-read: 8.00s and
 * 4.02s. His numbers, and the direction is the defect.
 *
 * This file holds the item→seconds function. `pacing.test.ts` holds the other
 * half — that the seconds are actually delivered, and that no motion constant can
 * take them away.
 */

const item = (prompt: string, answer: string): { prompt: string; answer: string } => ({ prompt, answer });

test("the three anchors are the cadence table's own", () => {
  // docs/EXPERIENCE_DESIGN.md, p50: single-digit fact 2.8s, two-digit with
  // regrouping 6s, the `5,001 − 2,798` class 16s. Not approximately.
  assert.equal(comprehensionTarget(item("5 − 2", "3")), 2.8);
  assert.equal(comprehensionTarget(item("36 + 47", "83")), 6.0);
  assert.equal(comprehensionTarget(item("5001 − 2798", "2203")), 16.0);
});

test("the founder's two examples are now the right way round", () => {
  const easy = comprehensionTarget(item("2 × 1", "2"));
  const hard = comprehensionTarget(item("84302 + 4186", "88488"));
  assert.ok(hard > easy, `${hard}s for the five-digit sum against ${easy}s for 2 × 1`);
  assert.equal(easy, 2.8);
  // No column in `84302 + 4186` carries, which is why it is the plain row and not
  // the regrouping one. It is still five times the single-digit fact.
  assert.equal(hard, 14.0);
  assert.equal(itemShape(item("84302 + 4186", "88488")).regroup, false);
});

test("a single-digit fact is a single-digit fact even when it carries", () => {
  // `7 + 8` answers 15, and reading the answer's width instead of the operands'
  // would call that two-digit work. The cadence table calls it a fact: 2.8s.
  assert.equal(comprehensionTarget(item("7 + 8", "15")), 2.8);
  assert.equal(itemShape(item("7 + 8", "15")).digits, 1);
});

test("carrying and borrowing are detected per column, not guessed", () => {
  assert.equal(itemShape(item("21 + 34", "55")).regroup, false);
  assert.equal(itemShape(item("28 + 34", "62")).regroup, true);
  assert.equal(itemShape(item("85 − 23", "62")).regroup, false);
  assert.equal(itemShape(item("83 − 25", "58")).regroup, true);
  // Across a zero, which is the skill this pack's `pack.json` claims by name.
  assert.equal(itemShape(item("5001 − 2798", "2203")).regroup, true);
  // The larger operand second, which a host is free to write.
  assert.equal(itemShape(item("25 − 83", "−58")).regroup, true);
  // A borrow that only appears in a later column.
  assert.equal(itemShape(item("941 − 152", "789")).regroup, true);
});

test("a regrouping question is never given less time than the same width without", () => {
  for (let d = 1; d <= MAX_DIGITS + 2; d++) {
    const a = "1".repeat(d);
    const carry = "9".repeat(d);
    const plain = comprehensionTarget(item(`${a} + ${a}`, "x"));
    const regroup = comprehensionTarget(item(`${carry} + ${carry}`, "x"));
    assert.ok(regroup >= plain, `${String(d)} digits: ${regroup}s with a carry against ${plain}s without`);
  }
});

test("the target is monotone non-decreasing in every axis of difficulty", () => {
  // The fleet invariant, over the whole cross product this function can produce
  // rather than over the handful of prompts above.
  const widths = [1, 2, 3, 4, 5, 6, 9];
  const build = (d: number, regroup: boolean, op: string): { prompt: string; answer: string } => {
    const digit = regroup ? "9" : "1";
    return item(`${digit.repeat(d)} ${op} ${digit.repeat(d)}`, "x");
  };
  // A PARTIAL order, and deliberately so. Four digits with a borrow asks for 16s
  // and five digits without asks for 14s, because `5,001 − 2,798` really is harder
  // than `84302 + 4186` — the cadence table says so by name. What must hold is
  // monotonicity along each axis with the others fixed, not one total ranking.
  for (const op of ["+", "−"]) {
    for (const regroup of [false, true]) {
      let prev = -Infinity;
      for (const d of widths) {
        const t = comprehensionTarget(build(d, regroup, op));
        assert.ok(
          t >= prev,
          `${op} regroup=${String(regroup)}: ${String(d)} digits asks for ${t}s, less than the ${prev}s the narrower one got`,
        );
        prev = t;
      }
    }
  }
  // Multiplication and division are never cheaper than addition of the same width.
  for (const d of widths) {
    const add = comprehensionTarget(build(d, true, "+"));
    for (const op of ["×", "÷"]) {
      const t = comprehensionTarget(build(d, true, op));
      assert.ok(t >= add, `${op} at ${String(d)} digits is ${t}s against ${add}s for +`);
    }
  }
});

test("nothing a host can write makes the target smaller than the smallest fact", () => {
  // Every branch that cannot read the item has to fall to *more* time, never less.
  // A generous target costs a few seconds of runway; a stingy one is the defect.
  const odd = [
    item("", ""),
    item("what is left?", "4"),
    item("3/4 + 1/4", "1"),
    item("? + 5 = 12", "7"),
    item("1.5 + 2.25", "3.75"),
    item("−7 + −8", "−15"),
    item("12 × 34 ÷ 6", "68"),
    item("2 + 3 + 4", "9"),
    item("one hundred and four", "104"),
  ];
  for (const q of odd) {
    const t = comprehensionTarget(q);
    assert.ok(t >= 2.8, `"${q.prompt}" asks for only ${t}s`);
    assert.ok(t <= MAX_TARGET, `"${q.prompt}" asks for ${t}s, past the top of the table`);
    assert.ok(Number.isFinite(t));
  }
  // A prompt with no operands at all still gets a width from its answer rather
  // than defaulting to "easy".
  assert.equal(itemShape(item("how many?", "4821")).digits, 4);
});

test("the operator is read from the glyphs a host actually writes", () => {
  assert.equal(opOf("5 − 2"), "sub");
  assert.equal(opOf("5 - 2"), "sub");
  assert.equal(opOf("5 – 2"), "sub");
  assert.equal(opOf("5 + 2"), "add");
  assert.equal(opOf("5 × 2"), "mul");
  assert.equal(opOf("5 * 2"), "mul");
  assert.equal(opOf("6 ÷ 2"), "div");
  assert.equal(opOf("6 / 2"), "div");
  assert.equal(opOf("count the shells"), "other");
});

test("no motion constant can reach this function", () => {
  // The property that makes the fleet invariant enforceable rather than asserted:
  // there is nothing in this module's scope that a run can change. If it imported
  // `pacing.ts` it could see the speed curve, the draw distance and the corridor,
  // and the defect would be one edit away from returning.
  const src = readFileSync(new URL("./comprehension.ts", import.meta.url), "utf8");
  const imports = [...src.matchAll(/^\s*import\b[^;]*;/gm)].map((m) => m[0]);
  assert.equal(imports.length, 0, `comprehension.ts imports something: ${imports.join(" ")}`);
  for (const forbidden of ["speed", "travel", "elapsed", "far", "reduced", "surge", "tier", "Date", "performance"]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\b`).test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")),
      `comprehension.ts mentions "${forbidden}" outside its comments`,
    );
  }
});

test("the same item always asks for the same time", () => {
  // No randomness, no state, no drift between the two calls a frame apart that
  // `mount.ts` and the tests each make.
  const q = item("5001 − 2798", "2203");
  const first = comprehensionTarget(q);
  for (let i = 0; i < 50; i++) assert.equal(comprehensionTarget(q), first);
});
