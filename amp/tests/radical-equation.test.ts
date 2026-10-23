import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem, templates } from "../src/math/engine";
import {
  radicalEquationCase,
  radicalEquationTemplates,
} from "../src/math/radical-equation-practice";
import { generatedProblemSchema } from "../src/math/contracts";
import { skills } from "../src/curriculum/catalog";
import { objectiveForSkill } from "../src/curriculum/selection";
import { templateGrade } from "../src/server/mixed-practice";
import { buildCoverageManifest } from "../src/content/coverage";
import { radicalEquationLessons } from "../src/content/radical-equation-lessons";
import { publicationHtml } from "../src/content/publications";
import {
  fixedHint,
  unnamedGivens,
  revealsAnswer,
  thin,
} from "./fixtures/hint-rules";

test("radical families agree with an independent public-prompt solver across boundary cases", () => {
  const cases = radicalEquationTemplates.flatMap((t) =>
    Array.from({ length: 512 }, (_, i) =>
      generateProblem(t.id, `radical-${i}`),
    ),
  );
  cases.forEach((p) => generatedProblemSchema.parse(p));
  const tags = new Set(
    radicalEquationTemplates
      .flatMap((t) =>
        Array.from(
          { length: 512 },
          (_, i) => radicalEquationCase(t.id, `radical-${i}`).tags,
        ),
      )
      .flat(),
  );
  for (const tag of [
    "isolated",
    "outside-addition",
    "outside-subtraction",
    "zero-root",
    "negative-coefficient",
    "fraction-answer",
    "integer-answer",
    "no-solutions",
    "one-solution",
    "two-solutions",
    "zero-boundary",
    "extraneous-candidate",
  ])
    assert(tags.has(tag), tag);
  assert.equal(
    new Set(
      cases
        .filter((p) => p.public.templateId === "radical-equation-check")
        .map((p) => p.answer),
    ).size,
    4,
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import json,sys,runpy
sys.path.insert(0,'scripts')
o=runpy.run_path('scripts/independent-math-review.py')
data=json.load(sys.stdin)
assert set(data['ids']) == set(o['SUPPORTED'])
print(o['review_radical_equation_fixtures']())
for p in data['cases']:
    o['review_radical_equation_problem'](p)
    assert o['solve'](p['public']) == p['answer']
print(len(data['cases']))`,
    ],
    {
      input: JSON.stringify({ ids: templates.map((t) => t.id), cases }),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1536/);
});

test("radical practice has a graduated prerequisite thread and bounded coverage", () => {
  const nodes = new Map(skills.map((s) => [s.id, s]));
  assert.deepEqual(nodes.get("square-root-equations")!.prerequisites, [
    "rational-exponents",
    "linear-equations",
  ]);
  assert(
    nodes
      .get("radical-equations")!
      .prerequisites.includes("square-root-equations"),
  );
  assert.deepEqual(
    radicalEquationTemplates.map((t) => templateGrade(t, nodes)),
    [10, 10.5, 11],
  );
  assert.equal(
    objectiveForSkill("square-root-equations")!.id,
    "powers-radicals",
  );
  assert.equal(objectiveForSkill("radical-equations")!.id, "powers-radicals");
  const coverage = buildCoverageManifest();
  assert.equal(coverage.valid, true, coverage.errors.join("\n"));
  for (const t of radicalEquationTemplates) {
    assert(
      coverage.facetMappings.some(
        (m) => m.templateId === t.id && m.extent === "partial",
      ),
    );
    assert.equal(fixedHint(t.id), false, t.id);
    assert.equal(unnamedGivens(t.id), false, t.id);
    assert.equal(thin(t.id), false, t.id);
    for (let i = 0; i < 32; i++)
      assert.equal(
        revealsAnswer(generateProblem(t.id, `hint-${i}`), false),
        false,
        `${t.id}/${i}`,
      );
  }
});

test("radical lesson builds from plain explanation through example and visualization to the precise rule", () => {
  const lesson = radicalEquationLessons[0]!;
  const html = publicationHtml(lesson, "lesson");
  const titles = [
    "Undo the root without losing its sign",
    "A worked example",
    "See where the two sides meet",
    "Zero or two solutions can also occur",
    "Watch for",
    "The precise rule",
  ];
  for (const title of titles) assert(html.includes(title), `Missing ${title}`);
  for (let i = 1; i < titles.length; i++)
    assert(html.indexOf(titles[i - 1]!) < html.indexOf(titles[i]!));
});
