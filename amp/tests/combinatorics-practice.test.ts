import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem } from "../src/math/engine.js";

const words = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}
const frac = (n: number, d: number) => {
  const g = gcd(n, d);
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
};

test("ordered probability and the distribution mean stay exact, and version 1 does not use them", () => {
  let ordered = 0;
  let means = 0;
  for (let i = 0; i < 160; i++) {
    const oldOrder = generateProblem("combination-probability", `ord:${i}`, 1);
    assert.equal(oldOrder.public.prompt.includes("random order"), false);
    const order = generateProblem("combination-probability", `ord:${i}`);
    if (order.public.prompt.includes("random order")) {
      ordered++;
      assert.equal(order.variant?.id, "ordered-probability");
      assert.equal(order.public.response.kind, "fraction");
      const n = Number(/^(\d+)/.exec(order.public.prompt)![1]);
      const books = order.public.prompt.includes("dictionary");
      const answer = books ? frac(1, n) : frac(1, n * (n - 1));
      assert.equal(order.answer, answer);
      const combo = (n * (n - 1)) / 2;
      assert.notEqual(answer, frac(1, combo));
      assert.equal(order.hint.includes(order.answer), false);
      for (const text of [order.public.prompt, order.hint, ...order.explanation])
        for (const sentence of words(text))
          assert.ok(sentence.split(/\s+/).length <= 35, sentence);
    }
    const oldMean = generateProblem("expected-value", `mean:${i}`, 1);
    assert.equal(
      oldMean.public.prompt.includes("mean of the probability distribution"),
      false,
    );
    const mean = generateProblem("expected-value", `mean:${i}`);
    if (!mean.public.prompt.includes("mean of the probability distribution"))
      continue;
    means++;
    assert.equal(mean.variant?.id, "mean-of-the-distribution");
    const listed = /showing (.+)\. Imagine (\d+)/.exec(mean.public.prompt)!;
    const sections = listed[1]!.replace(" and ", ", ").split(", ").map(Number);
    assert.equal(sections.length, Number(listed[2]));
    const sum = sections.reduce((a, b) => a + b, 0);
    const distinct = [...new Set(sections)];
    assert.equal(mean.answer, frac(sum, sections.length));
    assert.notEqual(
      mean.answer,
      frac(
        distinct.reduce((a, b) => a + b, 0),
        distinct.length,
      ),
    );
    assert.ok(Math.min(...sections) * sections.length < sum);
    assert.ok(sum < Math.max(...sections) * sections.length);
    assert.ok(!distinct.some((v) => v * sections.length === sum));
    assert.equal(mean.hint.includes(mean.answer), false);
    for (const text of [mean.public.prompt, mean.hint, ...mean.explanation])
      for (const sentence of words(text))
        assert.ok(sentence.split(/\s+/).length <= 35, sentence);
  }
  assert.ok(ordered > 10 && means > 10);
});
