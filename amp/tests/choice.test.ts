import test from "node:test";
import assert from "node:assert/strict";
import {
  generatedProblemSchema,
  publicProblemSchema,
} from "../src/math/contracts.js";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
} from "../src/math/engine.js";
import { choiceTemplates } from "../src/math/choice.js";
import { choiceLessons } from "../src/content/choice-lessons.js";
import { publicationHtml } from "../src/content/publications.js";

test("choice contracts preserve deterministic positions, private feedback and exact response identity", () => {
  for (const template of choiceTemplates) {
    const positions = new Set<string>();
    for (let seed = 0; seed < 256; seed++) {
      const p = generateProblem(template.id, `contract-${seed}`);
      assert.deepEqual(p, generateProblem(template.id, `contract-${seed}`));
      generatedProblemSchema.parse(p);
      publicProblemSchema.parse(p.public);
      assert.equal(p.public.response.kind, "choice");
      if (p.public.response.kind !== "choice")
        throw new Error("Missing choices");
      assert.equal("choiceFeedback" in p.public, false);
      assert.equal("answer" in p.public, false);
      assert.equal(
        Object.keys(p.choiceFeedback!).length,
        p.public.response.options.length - 1,
      );
      positions.add(p.answer);
      for (const option of p.public.response.options) {
        assert.ok(isValidResponse(p.public, option.id));
        assert.equal(gradeAnswer(p, option.id), option.id === p.answer);
        assert.equal(isValidResponse(p.public, option.label), false);
      }
      for (const invalid of [
        "option-z",
        "option-a ",
        "Option-a",
        "0",
        "",
        "<script>",
      ]) {
        assert.equal(isValidResponse(p.public, invalid), false);
        assert.equal(gradeAnswer(p, invalid), false);
      }
    }
    assert.equal(
      positions.size,
      template.id === "equation-solution-count" ? 3 : 4,
    );
  }
});
test("choice schemas reject ambiguous options and answer keys outside the displayed set", () => {
  const p = generateProblem("fraction-equivalence-choice", "invalid");
  if (p.public.response.kind !== "choice") throw new Error("Missing choices");
  const mutate = (change: (copy: typeof p) => void) => {
    const copy = structuredClone(p);
    change(copy);
    assert.equal(generatedProblemSchema.safeParse(copy).success, false);
  };
  mutate((copy) => {
    copy.answer = "option-z";
  });
  mutate((copy) => {
    copy.choiceFeedback![copy.answer] =
      "Correct answer leaked as misconception";
  });
  mutate((copy) => {
    if (copy.public.response.kind === "choice")
      copy.public.response.options[1]!.id = copy.public.response.options[0]!.id;
  });
  mutate((copy) => {
    if (copy.public.response.kind === "choice")
      copy.public.response.options[1]!.label =
        copy.public.response.options[0]!.label;
  });
  mutate((copy) => {
    if (copy.public.response.kind === "choice")
      copy.public.response.options = copy.public.response.options.slice(0, 1);
  });
  const numeric = generateProblem("add-within-20", "numeric");
  assert.equal(
    generatedProblemSchema.safeParse({
      ...numeric,
      choiceFeedback: { "option-a": "Unexpected" },
    }).success,
    false,
  );
  assert.equal(
    publicProblemSchema.safeParse({ ...p.public, answer: p.answer }).success,
    false,
  );
});
test("printed choice exercises include selectable statements and human-readable solutions", () => {
  for (const lesson of choiceLessons) {
    const workbook = publicationHtml(lesson, "workbook"),
      solutions = publicationHtml(lesson, "solutions");
    assert.equal((workbook.match(/class="print-choices"/g) ?? []).length, 12);
    assert.ok(!workbook.includes("Answer:"));
    assert.ok(!workbook.includes("option-"));
    assert.ok(!solutions.includes("option-"));
    assert.ok(solutions.includes("Answer:"));
  }
});
