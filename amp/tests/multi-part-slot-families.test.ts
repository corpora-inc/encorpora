import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generatedProblemSchema,
  publicProblemSchema,
} from "../src/math/contracts";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import {
  gradeMultiPart,
  multiPartChoiceResponseSchema,
  type MultiPartChoiceResponse,
} from "../src/math/multi-part-choice";
import { objectiveForSkill } from "../src/curriculum/selection";
import { templateArchetypes } from "../src/curriculum/template-archetypes";
import { problemLesson } from "../src/content/problem-lessons";
import { numberOrderSlotsAxes } from "../src/math/number-order-slots-practice";
import { placeValueBlanksAxes } from "../src/math/place-value-blanks-practice";
import { equationSlotsAxes } from "../src/math/equation-slots-practice";
import { quantityPairBlanksAxes } from "../src/math/quantity-pair-blanks-practice";
import { statementBlanksAxes } from "../src/math/statement-blanks-practice";
import { formBlanksAxes } from "../src/math/form-blanks-practice";
import type { AxisSet } from "../src/math/variation/axes";

/** Every template of the multi-part slot families: one entry per template with
 * its axes. A new family adds its axes map here. */
const families: Record<string, Record<string, AxisSet>> = {
  "number-order-slots": numberOrderSlotsAxes,
  "place-value-blanks": placeValueBlanksAxes,
  "equation-slots": equationSlotsAxes,
  "quantity-pair-blanks": quantityPairBlanksAxes,
  "statement-blanks": statementBlanksAxes,
  "form-and-model-blanks": formBlanksAxes,
};
const ids = Object.values(families).flatMap((axes) => Object.keys(axes));
const SEEDS = 300;
const seeds = Array.from({ length: SEEDS }, (_, i) => `slots:${i}`);
const PLACEHOLDER = /\$\{|\bundefined\b|\bNaN\b|\bnull\b|\[object/;

test("every template is registered with a skill, an archetype and a lesson", () => {
  for (const id of ids) {
    const t = templates.find((x) => x.id === id);
    assert.ok(t, `${id}: registered`);
    assert.equal(t.requiredResponseCapability, "multi-part-choice-v1");
    assert.ok(objectiveForSkill(t.skillId), `${id}: exposure objective`);
    assert.ok(templateArchetypes[id]?.length, `${id}: archetype`);
    const p = generateProblem(id, "lesson-check");
    assert.ok(
      problemLesson(id, p.public.seed, p.public.prompt).example.steps.length,
    );
  }
});

test("problems are deterministic, valid and reach every axis value", () => {
  for (const [family, axesOf] of Object.entries(families))
    for (const [id, axes] of Object.entries(axesOf)) {
      const reached = new Map<string, Set<string>>();
      const prompts = new Set<string>();
      for (const seed of seeds) {
        const problem = generateProblem(id, seed);
        assert.deepEqual(generateProblem(id, seed), problem, `${id} ${seed}`);
        generatedProblemSchema.parse(problem);
        publicProblemSchema.parse(problem.public);
        assert.ok(
          multiPartChoiceResponseSchema.safeParse(problem.public.response)
            .success,
          `${family}/${id} ${seed}`,
        );
        assert.match(problem.variant!.id, /^[a-z0-9][a-z0-9-]{0,63}$/);
        const response = problem.public.response as MultiPartChoiceResponse;
        prompts.add(
          problem.public.prompt +
            JSON.stringify(problem.public.figure ?? null) +
            JSON.stringify(
              response.sentence ?? response.blanks.map((b) => b.label),
            ) +
            JSON.stringify(
              response.blanks.map((b) => b.options.map((o) => o.label).sort()),
            ),
        );
        for (const [axis, value] of Object.entries(problem.variant!.axes!))
          reached.set(axis, (reached.get(axis) ?? new Set()).add(value));
        const text = JSON.stringify(problem);
        assert.equal(
          PLACEHOLDER.test(text),
          false,
          `${id} ${seed}: placeholder`,
        );
      }
      for (const [axis, { values }] of Object.entries(axes))
        assert.deepEqual(
          [...(reached.get(axis) ?? [])].sort(),
          [...values].sort(),
          `${id}: ${axis}`,
        );
      assert.ok(
        prompts.size >= 30,
        `${id}: only ${prompts.size} distinct problems`,
      );
    }
});

test("each blank has one correct option, grading needs every blank, and hints do not leak", () => {
  for (const id of ids)
    for (const seed of seeds) {
      const problem = generateProblem(id, seed);
      const response = problem.public.response as MultiPartChoiceResponse;
      assert.equal(response.kind, "multi-part-choice");
      assert.equal(gradeAnswer(problem, problem.answer), true, `${id} ${seed}`);
      const key = JSON.parse(problem.answer) as Record<string, string>;
      assert.deepEqual(
        Object.keys(key),
        response.blanks.map((b) => b.id),
      );
      const shown =
        problem.public.prompt +
        JSON.stringify(problem.public.figure ?? null) +
        response.blanks.map((b) => b.label).join(" ");
      for (const blank of response.blanks) {
        const labels = blank.options.map((o) => o.label);
        assert.equal(
          new Set(labels).size,
          labels.length,
          `${id} ${seed}: distinct labels`,
        );
        for (const o of blank.options) {
          if (o.id === key[blank.id]) continue;
          assert.equal(
            gradeMultiPart(
              response,
              problem.answer,
              JSON.stringify({ ...key, [blank.id]: o.id }),
            ),
            false,
          );
        }
        const correct = blank.options.find(
          (o) => o.id === key[blank.id],
        )!.label;
        if (correct.length > 2 && !shown.includes(correct))
          assert.equal(
            problem.hint.includes(correct),
            false,
            `${id} ${seed}: hint states ${correct}`,
          );
      }
      assert.ok(problem.hint.length > 30 && problem.explanation.length >= 2);
    }
});

test("hints vary across seeds", () => {
  for (const id of ids) {
    const hints = new Set(
      seeds.slice(0, 60).map((s) => generateProblem(id, s).hint),
    );
    assert.ok(hints.size >= 5, `${id}: ${hints.size} hints`);
  }
});
