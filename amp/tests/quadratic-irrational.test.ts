import { skills } from "../src/curriculum/catalog";
import { templateGrade } from "../src/server/mixed-practice";
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { quadraticIrrationalCase } from "../src/math/quadratic-irrational-practice";
import { objectiveForSkill } from "../src/curriculum/selection";
import { buildCoverageManifest } from "../src/content/coverage";

const id = "quadratic-irrational-solutions";
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
test("exact roots satisfy independent sum/product identities and all bounded shapes occur", () => {
  const flags = new Set<string>(),
    positions = new Set<number>();
  for (let i = 0; i < 2048; i++) {
    const seed = `exact-roots-${i}`,
      c = quadraticIrrationalCase(seed),
      problem = generateProblem(id, seed);
    generatedProblemSchema.parse(problem);
    assert.deepEqual(problem.public, c.problem.public);
    assert.equal(problem.answer, c.problem.answer);
    const {
      a,
      b,
      c: constant,
      D,
      roots: { p, q, s, d },
    } = c;
    // Vieta's identities verify the pair by coefficients of its monic polynomial.
    assert.equal(2 * p * a, -b * d);
    assert.equal((p * p - q * q * s) * a, constant * d * d);
    assert.ok(D > 0 && !Number.isInteger(Math.sqrt(D)));
    assert.ok(q > 0 && d > 0 && s > 1);
    assert.equal(gcd(p, gcd(q, d)), 1);
    for (let k = 2; k * k <= s; k++) assert.notEqual(s % (k * k), 0);
    flags.add(a < 0 ? "negative-leading" : a === 1 ? "monic" : "nonmonic");
    flags.add(b < 0 ? "negative-linear" : "positive-linear");
    flags.add(constant < 0 ? "negative-constant" : "positive-constant");
    flags.add(d === 1 ? "integer-denominator" : "fraction-denominator");
    flags.add(s === D ? "squarefree-discriminant" : "square-extraction");
    if (d < 2 * Math.abs(a)) flags.add("fraction-reduction");
    const response = problem.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") throw new Error("Expected choices");
    assert.equal(new Set(response.options.map((o) => o.label)).size, 4);
    for (const o of response.options)
      assert.equal(gradeAnswer(problem, o.id), o.id === problem.answer);
    assert.equal(gradeAnswer(problem, "not-an-option"), false);
    positions.add(response.options.findIndex((o) => o.id === problem.answer));
    assert.ok(!("answer" in problem.public) && !("roots" in problem.public));
  }
  for (const flag of [
    "negative-leading",
    "monic",
    "nonmonic",
    "negative-linear",
    "positive-linear",
    "negative-constant",
    "positive-constant",
    "integer-denominator",
    "fraction-denominator",
    "squarefree-discriminant",
    "square-extraction",
    "fraction-reduction",
  ])
    assert.ok(flags.has(flag), flag);
  assert.equal(positions.size, 4);
});

test("the new family joins the existing objective and has bounded instructional coverage", () => {
  assert.equal(
    objectiveForSkill("quadratic-formula"),
    objectiveForSkill("quadratic-equations"),
  );
  const nodes = new Map(skills.map((s) => [s.id, s]));
  assert.equal(
    templateGrade(
      templates.find((t) => t.id === id)!,
      nodes,
    ),
    templateGrade(
      templates.find((t) => t.id === "quadratic-real-solution-count")!,
      nodes,
    ) + 0.5,
  );
  const manifest = buildCoverageManifest();
  assert.equal(manifest.valid, true, manifest.errors.join("\n"));
  assert.ok(
    manifest.facetMappings.some(
      (m) => m.templateId === id && m.extent === "partial",
    ),
  );
  assert.deepEqual(
    generateProblem(id, "repeat"),
    generateProblem(id, "repeat"),
  );
  assert.throws(() => generateProblem(id, ""));
  assert.throws(() => generateProblem(id, "x".repeat(129)));
});

test("separate prompt-based oracle certifies exact public choices and rejects corruptions", () => {
  const cases = Array.from({ length: 1024 }, (_, i) =>
    generateProblem(id, `quadratic-oracle-${i}`),
  );
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import json,sys,runpy
sys.path.insert(0,'scripts')
from quadratic_irrational_math_oracle import self_test, review_problem
central=runpy.run_path('scripts/independent-math-review.py')
print(self_test())
for p in json.load(sys.stdin):
    assert review_problem(p)==central['solve'](p['public'])==p['answer']
print('1024 exact quadratic cases passed')`,
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1024 exact quadratic cases passed/);
});
