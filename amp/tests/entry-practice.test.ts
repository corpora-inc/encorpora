import test from "node:test";
import assert from "node:assert/strict";
import {
  entryTemplates,
  generateEntryProblem,
} from "../src/math/entry-practice.js";
import {
  generatedProblemSchema,
  semanticFigureSchema,
} from "../src/math/contracts.js";
import { entryFigureDescription } from "../src/math/entry-models.js";

test("entry families preserve deterministic private answers and varied geometric givens", () => {
  const combinations = new Set<string>(),
    shapeCounts = new Set<number>();
  for (const template of entryTemplates)
    for (let n = 0; n < 1024; n++) {
      const p = generateEntryProblem(template.id, `entry-${n}`);
      assert.deepEqual(generatedProblemSchema.parse(p), p);
      assert.deepEqual(generateEntryProblem(template.id, `entry-${n}`), p);
      assert.ok(!("answer" in p.public));
      const figure = p.public.figure!;
      if (figure.kind === "aligned-strips")
        combinations.add(
          `${Math.sign(figure.lengths[0] - figure.lengths[1])}:${p.public.prompt.includes("longer")}:${figure.tone}`,
        );
      else if (figure.kind === "shape-outline") {
        shapeCounts.add(
          figure.outline.form === "round" ? 0 : figure.outline.vertices.length,
        );
        assert.doesNotMatch(
          entryFigureDescription(figure),
          /circle|triangle|square|option-/i,
        );
      } else assert.fail("Unexpected entry figure");
      const response = p.public.response;
      assert.equal(response.kind, "choice");
      if (response.kind !== "choice") throw new Error("Expected choice");
      assert.equal(response.options.filter((o) => o.id === p.answer).length, 1);
      assert.equal(Object.keys(p.choiceFeedback!).length, 2);
      for (const option of response.options)
        assert.equal(!!p.choiceFeedback![option.id], option.id !== p.answer);
    }
  assert.equal(combinations.size, 12);
  assert.deepEqual([...shapeCounts].sort(), [0, 3, 4]);
});
test("entry models reject ambiguous lengths, malformed polygons and answer-bearing extras", () => {
  for (const lengths of [
    [100, 101],
    [0, 80],
    [240, 400],
  ])
    assert.equal(
      semanticFigureSchema.safeParse({
        kind: "aligned-strips",
        lengths,
        tone: "teal-first",
      }).success,
      false,
    );
  for (const vertices of [
    [
      [40, 40],
      [80, 80],
      [120, 120],
    ],
    [
      [60, 30],
      [260, 30],
      [260, 100],
      [60, 100],
    ],
    [
      [60, 30],
      [260, 150],
      [60, 150],
      [260, 30],
    ],
    [
      [60, 30],
      [60, 30],
      [260, 150],
    ],
  ])
    assert.equal(
      semanticFigureSchema.safeParse({
        kind: "shape-outline",
        outline: { form: "polygon", vertices },
        tone: "teal",
      }).success,
      false,
    );
  assert.equal(
    semanticFigureSchema.safeParse({
      kind: "shape-outline",
      outline: { form: "round", radius: 40, answer: "Circle" },
      tone: "teal",
    }).success,
    false,
  );
});
