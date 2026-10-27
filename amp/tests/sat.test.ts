import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReferenceLesson } from "../src/content/ReferenceLesson";
import { satCompletionLessons } from "../src/content/sat-completion-lessons";
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { templates, generateProblem } from "../src/math/engine";
import { satCompletionTemplates } from "../src/math/sat-completion-practice";
import { satPracticeEligible } from "../src/curriculum/sat";
import { buildSatCoverage } from "../src/curriculum/sat-coverage";
import { planMixedPractice } from "../src/server/mixed-practice";
import { skills } from "../src/curriculum/catalog";
import { estimateFrontier } from "../src/learning/frontier";
import { projectSkillEvidence } from "../src/server/evidence";
import type { Outcome } from "../src/server/repository";

test("published SAT demands have runnable families and instruction; every new family belongs to the checklist", () => {
  const report = buildSatCoverage();
  assert.deepEqual(report.errors, []);
  assert.equal(report.valid, true);
  assert.deepEqual(
    new Set(report.tasks.map((t) => t.domain)),
    new Set(["algebra", "advanced-math", "data", "geometry"]),
  );
  const included = new Set(report.tasks.flatMap((t) => t.templateIds));
  for (const t of satCompletionTemplates) assert(included.has(t.id), t.id);
});

test("SAT focus removes beyond-SAT content while retaining foundations and SAT-adjacent work in shared skills", () => {
  for (const id of [
    "logarithm-value",
    "exponential-log-solution",
    "log-equation",
    "complex-multiplication",
    "geometric-series-sum",
    "expected-value",
    "composition-value",
  ]) {
    const template = templates.find((t) => t.id === id)!;
    assert(template, id);
    assert.equal(satPracticeEligible(template), false, id);
  }
  for (const id of [
    "add-within-20",
    "multiply-fractions",
    "same-base-equation",
    "radian-arc-ratio",
    ...satCompletionTemplates.map((t) => t.id),
  ]) {
    const template = templates.find((t) => t.id === id)!;
    assert(template, id);
    assert.equal(satPracticeEligible(template), true, id);
  }
});

test("focused selection supports weak foundations, mature work, skips, errors, and review without excluded fallback", () => {
  const supported = templates.filter(satPracticeEligible);
  for (const start of [1, 6, 10, 12]) {
    const attempts: Outcome[] = [];
    const forbidden = generateProblem("logarithm-value", `sat-test-${start}`);
    attempts.push({
      id: "old",
      problemId: forbidden.public.id,
      requestId: "old",
      skillId: forbidden.public.skillId,
      templateId: forbidden.public.templateId,
      correct: false,
      assisted: false,
      response: "999",
      explanation: [],
      answer: forbidden.answer,
      createdAt: new Date().toISOString(),
    });
    const frontier = estimateFrontier({
      start,
      observations: [],
      gradeOf: () => start,
      guessOf: () => 0,
      strandOf: () => "algebra",
    });
    for (let i = 0; i < 30; i++) {
      const choices = planMixedPractice({
        templates: supported,
        skills,
        attempts,
        evidence: projectSkillEvidence(attempts),
        frontier,
        count: 3,
        seed: `sat-${start}-${i}`,
        skips: [
          {
            templateId: "logarithm-value",
            skillId: "logarithms",
            createdAt: new Date().toISOString(),
          },
        ],
      });
      assert.equal(choices.length, 3);
      assert(choices.every((c) => satPracticeEligible(c.template)));
      if (start === 1)
        assert(choices.every((c) => c.template.gradeBand !== "9–12"));
    }
  }
});

test("SAT generators match the independent public-prompt solver and reject corrupted answers and choices", () => {
  const cases = satCompletionTemplates.flatMap((t) =>
    Array.from({ length: 64 }, (_, i) =>
      generateProblem(t.id, `sat-unit-${i}`),
    ),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import json,sys,runpy
sys.path.insert(0,'scripts')
o=runpy.run_path('scripts/independent-math-review.py')
data=json.load(sys.stdin)
assert set(data['ids'])==set(o['SUPPORTED'])
sat=o['family_oracle']('sat_completion_math_oracle')
print(sat.self_test())
for p in data['cases']:
 sat.review_problem(p)
 assert o['solve'](p['public'])==p['answer']
print(len(data['cases']))`,
    ],
    {
      input: JSON.stringify({ ids: templates.map((t) => t.id), cases }),
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1024/);
});

test("reference examples render their exact figures and candidate answers in screen and print editions", () => {
  for (const lesson of satCompletionLessons)
    for (const print of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(ReferenceLesson, { lesson, print }),
      );
      const example = lesson.workedExample;
      if (example.figure?.kind === "scene")
        assert(html.includes(example.figure.scene.title!), lesson.id);
      if (example.choices) {
        const list = html.match(
          /<ul class="worked-example-choices">(.*?)<\/ul>/s,
        );
        assert(list, lesson.id);
        assert.equal(
          (list[1]!.match(/<li>/g) ?? []).length,
          example.choices.length,
          lesson.id,
        );
      }
    }
});
