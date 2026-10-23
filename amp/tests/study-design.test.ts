import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { test } from "node:test";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { studyDesignCase } from "../src/math/study-design-practice";
import { buildCoverageManifest } from "../src/content/coverage";
import { objectiveForSkill } from "../src/curriculum/selection";

const id = "scope-of-inference-choice";
test("scope of inference is public-engine reachable under the existing objective", () => {
  assert.equal(templates.find((t) => t.id === id)?.skillId, "study-design");
  assert.equal(
    objectiveForSkill("study-design"),
    objectiveForSkill("sampling"),
  );
  const coverage = buildCoverageManifest();
  assert.deepEqual(coverage.errors, []);
});

test("all frames cross sampling and allocation; prompt-derived truth grades exactly one choice", () => {
  const crossed = new Set<string>(),
    positions = new Set<number>(),
    populations = new Set<string>();
  for (let i = 0; i < 1024; i++) {
    const seed = `scope-${i}`,
      c = studyDesignCase(seed),
      p = generateProblem(id, seed);
    assert.deepEqual(p, c.problem);
    const prompt = p.public.prompt;
    const randomlySelected = prompt.includes(
      "drawn at random without replacement",
    );
    const randomlyAssigned = prompt.includes(
      "researcher randomly assigns half",
    );
    const response = p.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") throw new Error("Expected choices");
    assert.equal(new Set(response.options.map((o) => o.label)).size, 4);
    const expected = response.options.filter((o) => {
      if (prompt.includes("which statement about generalizing"))
        return randomlySelected
          ? o.label.startsWith("The findings can be generalized to all ") &&
              o.label.endsWith("with sampling uncertainty.")
          : o.label.startsWith("The design alone");
      if (prompt.includes("does the comparison support attributing"))
        return randomlyAssigned
          ? o.label.startsWith(
              "Yes, because the participants were randomly assigned",
            )
          : o.label.startsWith("No, because participants chose");
      const [generalization, causation] = o.label.split("; ");
      return (
        generalization!.startsWith("Supports") === randomlySelected &&
        causation!.startsWith("supports") === randomlyAssigned
      );
    });
    assert.equal(expected.length, 1, prompt);
    assert.equal(p.answer, expected[0]!.id, prompt);
    for (const o of response.options)
      assert.equal(gradeAnswer(p, o.id), o.id === expected[0]!.id);
    assert.equal(gradeAnswer(p, "made-up-option"), false);
    crossed.add(`${c.frame}:${c.sampling}:${c.assigned}`);
    positions.add(response.options.findIndex((o) => o.id === p.answer));
    populations.add(
      prompt.match(/(?:all |of the )\d+ ([^.]+?)(?:;| who| volunteer)/)?.[1] ??
        prompt.slice(0, 85),
    );
    assert.ok(prompt.includes("Everyone completes the study"));
    assert.ok(
      !("answer" in p.public) &&
        !("sampling" in p.public) &&
        !("assigned" in p.public),
    );
    assert.ok(p.explanation.length >= 2);
  }
  assert.equal(
    crossed.size,
    18,
    "all three question frames, three selection modes and two allocation modes must occur",
  );
  assert.equal(positions.size, 4, "shuffle must reach every answer position");
  assert.ok(populations.size >= 3);
});

test("generation is repeatable and rejects invalid seed bounds", () => {
  assert.deepEqual(
    generateProblem(id, "repeat"),
    generateProblem(id, "repeat"),
  );
  assert.throws(() => generateProblem(id, ""));
  assert.throws(() => generateProblem(id, "x".repeat(129)));
});

test("independent public-prompt oracle checks fixtures, mutations and generated choices", () => {
  const cases = Array.from({ length: 1024 }, (_, i) =>
    generateProblem(id, `oracle-scope-${i}`),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import json,sys,runpy
sys.path.insert(0, 'scripts')
from study_design_math_oracle import self_test, review_problem
central = runpy.run_path('scripts/independent-math-review.py')
print(self_test())
for p in json.load(sys.stdin):
    assert review_problem(p) == central['solve'](p['public']) == p['answer']
print('1024 public-prompt cases passed')`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1024 public-prompt cases passed/);
});
