import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";

const seeds = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

test("a family simulation shows how each counted trial decodes", () => {
  // 787 has one girl: 8 is even. The worked solution must show that count
  // beside each trial it counts, so a learner can check the decoding.
  let families = 0;
  for (const seed of seeds(400, "family")) {
    const p = generateProblem("compound-event-simulation", seed);
    if (
      !/girl/.test(p.public.prompt) ||
      !/Here are \d+ trials/.test(p.public.prompt)
    )
      continue;
    families++;
    const line = p.explanation.find((s) => s.startsWith("Trials where"))!;
    for (const [, digits, girls] of line.matchAll(/(\d{3}) \((\d) girls?\)/g)) {
      const even = [...digits!].filter((d) => Number(d) % 2 === 0).length;
      assert.equal(Number(girls), even, `${digits} in ${seed}`);
    }
    assert.match(line, /\d{3} \(\d girls?\)/, seed);
  }
  assert.ok(families > 10);
});

test("a composite figure's corners are described accurately", () => {
  // An L, T or U shape has inward corners whose inside angle is 270°, so
  // "every corner is a right angle" is false; every turn is a square turn.
  for (const id of [
    "composite-area",
    "composite-face-prism-volume",
    "composite-face-prism-surface-area",
  ])
    for (const seed of seeds(60, id)) {
      const text = generateProblem(id, seed).explanation.join(" ");
      assert.doesNotMatch(
        text,
        /Every corner (of the front face )?is a right angle/,
        `${id} ${seed}`,
      );
    }
});

test("the least common multiple is the smallest positive common multiple", () => {
  for (const seed of seeds(40, "lcm")) {
    const text = generateProblem(
      "least-common-multiple",
      seed,
    ).explanation.join(" ");
    assert.match(text, /smallest positive/, seed);
  }
});
