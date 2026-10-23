import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem, templates } from "../src/math/engine";
import {
  rationalEquationCase,
  rationalEquationTemplates,
} from "../src/math/rational-equation-practice";
import {
  geometryProofCase,
  geometryProofTemplates,
} from "../src/math/geometry-proof-practice";
import { generatedProblemSchema } from "../src/math/contracts";
import { skills } from "../src/curriculum/catalog";
import { templateGrade } from "../src/server/mixed-practice";
import { buildCoverageManifest } from "../src/content/coverage";
import { rationalEquationLessons } from "../src/content/rational-equation-lessons";
import { geometryProofLessons } from "../src/content/geometry-proof-lessons";
import { publicationHtml } from "../src/content/publications";
import {
  fixedHint,
  unnamedGivens,
  revealsAnswer,
  thin,
} from "./fixtures/hint-rules";

const added = [...geometryProofTemplates, ...rationalEquationTemplates];
test("new gap families match independently authored public-text oracles and central dispatch", () => {
  const cases = added.flatMap((t) =>
    Array.from({ length: 512 }, (_, i) => generateProblem(t.id, `gap-${i}`)),
  );
  for (const item of cases) generatedProblemSchema.parse(item);
  const modes = new Set(
    added
      .flatMap((t) =>
        Array.from(
          { length: 512 },
          (_, i) =>
            (t.id === "geometry-proof-step"
              ? geometryProofCase
              : rationalEquationCase)(t.id, `gap-${i}`).tags,
        ),
      )
      .flat(),
  );
  for (const tag of [
    "vertical",
    "linear-pair",
    "corresponding",
    "triangle-sum",
    "one-denominator",
    "unique",
    "excluded-candidate",
    "identity-on-domain",
    "contradiction",
    "fraction-answer",
    "integer-answer",
    "fraction-candidate",
    "negative-right-side",
  ])
    assert(modes.has(tag), tag);
  for (const t of added.filter((t) => t.requiredResponseCapability))
    assert.equal(
      new Set(
        cases.filter((c) => c.public.templateId === t.id).map((c) => c.answer),
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
assert set(data['ids'])==set(o['SUPPORTED']), 'Oracle registry mismatch'
print(o['review_rational_equation_fixtures']())
print(o['review_geometry_proof_fixtures']())
for p in data['cases']:
    if p['public']['templateId'] in o['GEOMETRY_PROOF']: o['review_geometry_proof_problem'](p)
    else: o['review_rational_equation_problem'](p)
    assert o['solve'](p['public'])==p['answer']
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
test("the new thread has graduated prerequisites and bounded coverage", () => {
  const nodes = new Map(skills.map((s) => [s.id, s]));
  assert.deepEqual(
    nodes.get("rational-equation-one-denominator")!.prerequisites,
    ["rational-expression-domain", "linear-equations", "fraction-division"],
  );
  assert(
    nodes
      .get("rational-equations")!
      .prerequisites.includes("rational-equation-one-denominator"),
  );
  assert.deepEqual(
    rationalEquationTemplates.map((t) => templateGrade(t, nodes)),
    [10.5, 11.25],
  );
  const coverage = buildCoverageManifest();
  assert.equal(coverage.valid, true);
  for (const t of added) {
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
        t.id,
      );
  }
});
test("proof and rational-equation lessons lead with meaning, then example, method, caution, and rule", () => {
  const expected = [
    {
      lesson: geometryProofLessons[0]!,
      headings: [
        "What makes a reason fit?",
        "A worked example",
        "Why the triangle sum is a straight angle",
        "Watch for",
        "The precise statements",
      ],
    },
    {
      lesson: rationalEquationLessons[0]!,
      headings: [
        "Which numbers can solve it?",
        "A worked example",
        "See the solution as a crossing",
        "When clearing gives a misleading candidate",
        "Watch for",
        "The precise rule",
      ],
    },
  ];
  for (const { lesson, headings } of expected) {
    const html = publicationHtml(lesson, "lesson");
    const positions = headings.map((heading) => {
      const position = html.indexOf(heading);
      assert(position >= 0, `Missing ${heading} in ${lesson.id}`);
      return position;
    });
    for (let i = 1; i < positions.length; i++)
      assert(positions[i - 1]! < positions[i]!, headings.join(" → "));
  }
});
