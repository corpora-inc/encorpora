import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import {
  clauseVariants,
  generateClauseVariant,
} from "../src/math/clause-variants";
import {
  generateProblem,
  generateProblemFor,
  gradeAnswer,
  polishProblem,
  templates,
} from "../src/math/engine";
import {
  generatedProblemSchema,
  figureCapabilities,
  responseCapabilities,
} from "../src/math/contracts";
import { generateInferenceProblem } from "../src/math/inference-practice";
import { generateVectorMatrixProblem } from "../src/math/vectors-matrices-practice";
import { generateTrigonometryProblem } from "../src/math/trigonometry-practice";
import { triangleLawCase } from "../src/math/remaining-gap-practice";
import { problemLesson } from "../src/content/problem-lessons";
import { clauseVariantMethods } from "../src/content/clause-variant-methods";
import { layoutScene } from "../src/math/scene";

const metadata = (id: string) => templates.find((t) => t.id === id)!;
const forced = (id: string, variant: string, seed: string) =>
  generateClauseVariant(metadata(id), seed, variant)!;
const records = Object.entries(clauseVariants).flatMap(([id, variants]) =>
  variants.flatMap((variant) =>
    Array.from({ length: 40 }, (_, i) =>
      forced(id, variant, `clause-review-${i}`),
    ),
  ),
);

test("every clause surface has a valid, deterministic, gradeable existing response", () => {
  for (const p of records) {
    const id = `${p.public.templateId}/${p.variant!.id}/${p.public.seed}`;
    assert.doesNotThrow(() => generatedProblemSchema.parse(p), id);
    assert.deepEqual(
      p,
      forced(p.public.templateId, p.variant!.id, p.public.seed),
      id,
    );
    assert.ok(gradeAnswer(p, p.answer), id);
    assert.ok(!gradeAnswer(p, "not-an-answer"), id);
    assert.ok(p.hint.length > 20 && p.explanation.length >= 2, id);
    const response = p.public.response;
    const meta = metadata(p.public.templateId);
    const declared = new Set<string>(meta.requiredResponseCapabilities ?? []);
    if (meta.requiredResponseCapability)
      declared.add(meta.requiredResponseCapability);
    if (response.kind !== "number" && response.kind !== "fraction")
      assert.ok(
        declared.has(
          response.kind === "choice"
            ? "single-choice-v1"
            : `${response.kind}-v1`,
        ),
        `${id}: undeclared ${response.kind} response`,
      );
    if (response.kind === "choice" || response.kind === "figure-choice") {
      for (const option of response.options)
        assert.equal(gradeAnswer(p, option.id), option.id === p.answer, id);
    }
    if (p.public.figure?.kind === "scene") {
      const layout = layoutScene(p.public.figure.scene);
      assert.ok(
        Number.isFinite(layout.width) && Number.isFinite(layout.height),
        id,
      );
    }
    assert.ok(
      !Object.hasOwn(p.public, "answer") && !Object.hasOwn(p.public, "variant"),
      id,
    );
  }
});

test("independent Python oracle solves every surface from public givens and rejects changed keys", () => {
  // Production polishing can simplify 1x to x or change notation. Check the
  // actual engine output as well as forced raw surfaces.
  const polished = Object.keys(clauseVariants)
    .flatMap((id) =>
      Array.from({ length: 50 }, (_, i) =>
        generateProblem(id, `polished-${i}`),
      ),
    )
    .filter((p) => p.variant?.axes?.clause);
  const reviewed = [...records, ...polished];
  const review = spawnSync("python3", ["scripts/clause_variants_oracle.py"], {
    input: reviewed.map((p) => JSON.stringify(p)).join("\n"),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(review.status, 0, review.stderr || review.stdout);
  assert.match(review.stdout, new RegExp(`${reviewed.length} cases passed`));
  // These are public-data solvers: removing all private teaching/grading
  // information except the key must not affect their result.
  const stripped = records
    .filter((_, i) => i % 40 === 0)
    .map((p) => ({ public: p.public, answer: p.answer }));
  const separate = spawnSync("python3", ["scripts/clause_variants_oracle.py"], {
    input: stripped.map((p) => JSON.stringify(p)).join("\n"),
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  assert.equal(separate.status, 0, separate.stderr);
  const routed = spawnSync(
    "python3",
    [
      "-c",
      "import sys,json,importlib.util; sys.path.insert(0,'scripts'); spec=importlib.util.spec_from_file_location('review','scripts/independent-math-review.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m); cases=[json.loads(line) for line in sys.stdin]; assert all(m.is_clause_variant(p['public']) and m.solve_family(p['public']) == m.solve_clause_variant(p['public']) for p in cases); print(len(cases))",
    ],
    {
      input: stripped.map((p) => JSON.stringify(p)).join("\n"),
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(routed.status, 0, routed.stderr);
  assert.equal(Number(routed.stdout.trim()), stripped.length);
  const mutant = { ...stripped[0]!, answer: "wrong-key" };
  const rejected = spawnSync("python3", ["scripts/clause_variants_oracle.py"], {
    input: JSON.stringify(mutant),
    encoding: "utf8",
  });
  assert.notEqual(rejected.status, 0);
});

test("version 1 retains original generators while current sampling reaches every added surface", () => {
  const originals: [
    string,
    (id: string, seed: string) => ReturnType<typeof generateProblem>,
  ][] = [
    ["representative-sample-choice", generateInferenceProblem],
    ["sample-proportion-estimate", generateInferenceProblem],
    ["sample-estimates-plot", generateInferenceProblem],
    ...[
      "vector-components",
      "vector-resultant",
      "matrix-data-reading",
      "matrix-operations",
      "matrix-laws",
      "matrix-linear-system",
    ].map(
      (id) =>
        [id, generateVectorMatrixProblem] as [
          string,
          typeof generateVectorMatrixProblem,
        ],
    ),
    ...[
      "special-angle-exact-value",
      "trig-identity-value",
      "oblique-triangle-solve",
    ].map(
      (id) =>
        [id, generateTrigonometryProblem] as [
          string,
          typeof generateTrigonometryProblem,
        ],
    ),
  ];
  for (const [id, original] of originals)
    for (let i = 0; i < 15; i++) {
      const seed = `legacy-${i}`,
        current = generateProblem(id, seed, 1),
        old = polishProblem(original(id, seed));
      assert.deepEqual(current.public, old.public, id);
      assert.equal(current.answer, old.answer, id);
      assert.deepEqual(current.explanation, old.explanation, id);
    }
  for (const [id, variants] of Object.entries(clauseVariants)) {
    assert.ok(
      metadata(id).version >= 2,
      `${id}: clause version remains available`,
    );
    assert.equal(metadata(id).reprintsFrom, 1);
    const seen = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const p = generateProblem(id, `reach-${i}`);
      if (p.variant?.axes?.clause) seen.add(p.variant.axes.clause);
    }
    for (const variant of variants)
      assert.ok(seen.has(variant), `${id}/${variant}`);
  }
  // A client without scenes falls back to the original axis value.
  for (let i = 0; i < 20; i++) {
    const p = generateProblemFor("sample-estimates-plot", `old-client-${i}`, [
      "data-displays-v1",
    ]);
    assert.equal(p.variant?.axes?.clause, undefined);
  }
});

test("same-seed supported inference uses the parent's numeric estimate", () => {
  for (let i = 0; i < 100; i++) {
    const seed = `twin-${i}`,
      p = forced("sample-proportion-estimate", "supported-inference", seed),
      old = generateInferenceProblem("sample-proportion-estimate", seed);
    assert.equal(p.public.response.kind, "choice");
    if (p.public.response.kind === "choice")
      assert.match(
        p.public.response.options.find((o) => o.id === p.answer)!.label,
        new RegExp(`about ${old.answer}\\.`),
      );
  }
});

test("legacy response clients receive original surfaces; capable clients receive additions", () => {
  for (const [id] of Object.entries(clauseVariants))
    for (let i = 0; i < 25; i++) {
      const seed = `capability-${i}`;
      const old = generateProblemFor(
        id,
        seed,
        figureCapabilities,
        undefined,
        [],
      );
      assert.equal(old.variant?.axes?.clause, undefined, id);
      // The original surface, recorded at the version it was generated at:
      // version 1 when a clause draw fell back, else the current version.
      const original = generateProblem(id, seed, 1);
      assert.deepEqual(
        old,
        {
          ...original,
          public: {
            ...original.public,
            templateVersion: old.public.templateVersion,
          },
        },
        id,
      );
      assert.deepEqual(
        generateProblem(id, seed, old.public.templateVersion),
        old,
        id,
      );
      const current = generateProblemFor(
        id,
        seed,
        figureCapabilities,
        undefined,
        responseCapabilities,
      );
      assert.deepEqual(current, generateProblem(id, seed), id);
    }
});

test("sampling piles vary over 1000 seeds and their population ranges are exact", () => {
  const piles = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    const p = forced(
      "sample-estimates-plot",
      "estimate-variation",
      `range-${i}`,
    );
    const f = p.public.figure;
    assert.equal(f?.kind, "line-plot");
    if (f?.kind !== "line-plot") continue;
    const range = Math.max(...f.values) - Math.min(...f.values);
    assert.ok(range >= 3 && range <= 7);
    const [n, N] = [
      ...p.public.prompt.matchAll(/(?:samples of|school of) (\d+)/g),
    ].map((m) => Number(m[1]));
    assert.equal(Number(JSON.parse(p.answer)[0][0]), (range * N!) / n!);
    const key = JSON.stringify(f.values);
    assert.ok(!piles.has(key), `Repeated independent pile at ${i}`);
    piles.add(key);
  }
});

test("special derivations exercise tangent and 45 degrees, and law-of-sines proofs retain exposure", () => {
  const cuts = records.filter((p) => p.variant?.id === "cut-derivation");
  assert.ok(
    cuts.filter((p) => p.public.prompt.includes("\\tan(")).length /
      cuts.length >=
      0.2,
  );
  assert.ok(
    cuts.filter((p) => p.public.prompt.includes("45°")).length / cuts.length >=
      0.2,
  );
  let sines = 0;
  for (let i = 0; i < 100; i++) {
    const seed = `law-weight-${i}`,
      p = generateProblem("triangle-law-reasoning", seed);
    if (!p.variant?.axes?.clause && triangleLawCase(seed).variant < 3) sines++;
  }
  assert.ok(sines >= 30, `Only ${sines}/100 sine-derivation instances`);
});

test("every added surface has a matching lesson method and same-surface worked example", () => {
  for (const [id, variants] of Object.entries(clauseVariants))
    for (const variant of variants) {
      assert.ok(clauseVariantMethods[variant], variant);
      const p = forced(id, variant, "lesson-learner");
      const lesson = problemLesson(
        id,
        "clause-help",
        p.public.prompt,
        p.public.response,
        p,
      );
      assert.equal(lesson.goal, clauseVariantMethods[variant]!.goal);
      assert.ok(lesson.method.length >= 3 && lesson.watch);
      assert.ok(lesson.example.steps.length >= 2);
    }
});

test("original surfaces keep their original lesson methods", () => {
  for (const [id, variants] of Object.entries(clauseVariants)) {
    const p = generateProblem(id, "legacy-lesson", 1);
    const lesson = problemLesson(
      id,
      "legacy-help",
      p.public.prompt,
      p.public.response,
      p,
    );
    for (const variant of variants)
      assert.notEqual(
        lesson.goal,
        clauseVariantMethods[variant]!.goal,
        `${id}/${variant}`,
      );
  }
});
