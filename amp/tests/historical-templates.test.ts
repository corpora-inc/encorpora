import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { problemLesson } from "../src/content/problem-lessons";
import { lessons } from "../src/content/lessons";
import { skills } from "../src/curriculum/catalog";
import { objectiveForSkill } from "../src/curriculum/selection";
import { templateGrade } from "../src/learning/item-calibration";
import { publicProblemSchema } from "../src/math/contracts";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { guessChanceOf } from "../src/math/guess-chance";
import {
  historicalTemplates,
  templateReplacements,
} from "../src/math/historical-templates";
import { answerPathways } from "../src/web/features/practice/answer-pathways";

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
// Captured from the original generators before replacing their active IDs.
// Keeping a legacy generator callable is insufficient if its output changes.
const frozen = [
  [
    "inequality-from-context",
    6,
    0.25,
    "9569a71a9ea2611097067d1757abea46a73425fc008020bdac51d6897252d3de",
  ],
  [
    "fl-equation-truth-mult-div",
    3.1,
    0.25,
    "6382e0b9b2b95c262ae16134e304298db26488e8099ef834b371ab928ec61bec",
  ],
  [
    "fl-equation-truth-whole",
    3.2,
    0.25,
    "98f4e467f47c4725b85fbe3cad1666caba697b3996d199781304ef73c366168e",
  ],
  [
    "true-equation-choice",
    3.3,
    0.25,
    "b51f579e6ea7f3f49c25f27f71fcebb854a664f3f6282c3455fa2c685562697b",
  ],
  [
    "equal-factor-equations-select",
    3.2,
    1 / 6,
    "3df3b6889a727c57d1dacc91381d93da6706872fc65baf717e73eecb2ba4490a",
  ],
  [
    "mcas-true-fact-equations",
    3.3,
    0.05,
    "0c8d0a27b562e77a85cadde421b5b183c57b846093de3549f379e80b9df97bba",
  ],
] as const;

test("retired v1 families replay unchanged and keep their original evidence metadata", () => {
  assert.deepEqual(
    new Set(historicalTemplates.map((t) => t.id)),
    new Set(frozen.map(([id]) => id)),
  );
  for (const [id, grade, chance, digest] of frozen) {
    const archived = historicalTemplates.find((t) => t.id === id)!;
    assert.ok(
      !templates.some((t) => t.id === id),
      `${id} cannot be selected anew`,
    );
    assert.ok(templates.some((t) => t.id === templateReplacements[id]));
    assert.equal(templateGrade(archived, nodes), grade, id);
    assert.equal(guessChanceOf(id), chance, id);
    const hash = createHash("sha256");
    for (let i = 0; i < 64; i++) {
      const problem = generateProblem(id, `immutable:${i}`);
      hash.update(JSON.stringify(problem) + "\n");
      assert.equal(problem.public.skillId, archived.skillId);
      publicProblemSchema.parse(problem.public);
      assert.ok(
        gradeAnswer(problem, problem.answer),
        `${id} saved answer is gradeable`,
      );
    }
    assert.equal(hash.digest("hex"), digest, id);
  }
});

test("saved problems retain a complete lesson without changing their template identity", () => {
  for (const [id] of frozen) {
    const problem = generateProblem(id, "saved-problem");
    const lesson = problemLesson(
      id,
      problem.public.seed,
      problem.public.prompt,
    );
    assert.equal(lesson.templateId, id);
    assert.ok(
      lesson.intuition && lesson.principle && lesson.method.length >= 2,
      id,
    );
    assert.ok(lesson.example.steps.length > 0, id);
    assert.notEqual(lesson.example.prompt, problem.public.prompt, id);
  }
});

test("published reference lesson URLs retain their identities", () => {
  for (const [lessonId, templateId] of [
    ["inequality-from-context", "inequality-context-bound"],
    ["true-equation-choice", "whole-number-equality-choice"],
    ["equal-factor-equations-select-lesson", "equal-factor-truth-select"],
  ]) {
    const lesson = lessons.find((l) => l.id === lessonId);
    assert.ok(lesson?.templateIds.includes(templateId!), lessonId);
  }
});

test("equation truth has grade-appropriate equality skills, facets and the existing exposure budget", () => {
  const expected = [
    [
      "multiplication-division-equation-truth",
      "multiplication-division-equality",
      3.1,
    ],
    ["whole-number-equation-truth", "whole-number-equality", 4.2],
    ["whole-number-equality-choice", "whole-number-equality", 4.3],
    ["equal-factor-truth-select", "multiplication-division-equality", 3.2],
    ["fact-equation-truth-select", "multiplication-division-equality", 3.3],
  ] as const;
  const objective = objectiveForSkill("missing-factor");
  assert.equal(objective?.id, "linear-equations");
  assert.equal(objective.importance, 6);
  assert.equal(objective.assessmentEmphasis, 6);
  for (const [id, skillId, grade] of expected) {
    const template = templates.find((t) => t.id === id)!;
    assert.equal(template.skillId, skillId);
    assert.equal(templateGrade(template, nodes), grade);
    assert.equal(generateProblem(id, "new-equality").public.skillId, skillId);
    assert.equal(objectiveForSkill(skillId), objective);
    const facets = actualFacetMappings.filter((m) => m.templateId === id);
    assert.deepEqual(
      facets.map((m) => m.facetId),
      [`${skillId}.core`],
    );
  }
});

test("Missing Factor navigation offers an unknown factor, and equality has connected next steps", () => {
  const route = answerPathways(
    "one-step-equations",
    skills,
    templates,
  ).buildsOn.find((s) => s.id === "missing-factor");
  assert.ok(route);
  assert.equal(route.templateId, "missing-factor-fact");
  const foundation = answerPathways(
    "multiplication-division-equality",
    skills,
    templates,
  );
  assert.ok(foundation.buildsOn.some((s) => s.id === "equality"));
  assert.ok(foundation.leadsTo.some((s) => s.id === "whole-number-equality"));
  assert.ok(
    answerPathways("whole-number-equality", skills, templates).leadsTo.some(
      (s) => s.id === "one-step-equations",
    ),
  );
});
