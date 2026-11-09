import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import {
  clientCanDraw,
  generatedProblemSchema,
  responseCapabilities,
  figureCapabilities,
} from "../src/math/contracts";
import {
  clauseEntries,
  generateClauseVariant,
  withClauseMetadata,
} from "../src/math/clause-variants";
import { withTemplateVersion } from "../src/math/variation/axes";
import { clauseTemplates } from "../src/math/clause-practice";
import { triangleConstructionBank } from "../src/math/clause-geometry-variants";
import { decimalExpansion } from "../src/math/clause-real-variants";
import { layoutScene } from "../src/math/scene";
import { buildCoverageManifest } from "../src/content/coverage";
import {
  guessChance,
  guessChanceTable,
  problemGuessChance,
} from "../src/math/guess-chance";
import {
  fixedHint,
  unnamedGivens,
  revealsAnswer,
  sample as hintSample,
  figureEncodesAnswer,
} from "./fixtures/hint-rules";
import { typographyIssues, ownerContexts } from "./fixtures/math-typography";
import {
  clauseLessons,
  clauseMethods,
  clausePrinciples,
} from "../src/content/clause-practice-lessons";

const ids = [
  ...Object.keys(clauseEntries),
  ...clauseTemplates.map((t) => t.id),
];
const sample = (id: string, n = 200) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `clause-test-${i}`));

test("clause registration preserves a valid coverage manifest", () => {
  assert.deepEqual(buildCoverageManifest().errors, []);
});

test("mixed clause formats retain numeric coverage and discount guessable answers", () => {
  for (const id of [
    "right-triangle",
    "right-triangle-missing-leg",
    "signed-story",
    "integer-addition",
  ]) {
    const meta = templates.find((t) => t.id === id)!;
    assert.equal(meta.requiredResponseCapability, undefined, id);
    const chance = guessChance(meta);
    assert.ok(chance > 0, id);
    assert.equal(guessChanceTable([meta])[id], chance, id);
    for (const p of sample(id, 160))
      assert.ok(chance >= problemGuessChance(p), `${id}: ${p.public.seed}`);
  }
});

test("clause surfaces are deterministic, valid, gradeable and reachable", () => {
  for (const id of ids) {
    const seen = new Set<string>();
    for (const p of sample(id)) {
      generatedProblemSchema.parse(p);
      assert.equal(gradeAnswer(p, p.answer), true, `${id}: ${p.public.prompt}`);
      assert.deepEqual(p, generateProblem(id, p.public.seed));
      if (p.variant?.axes?.clause) seen.add(p.variant.axes.clause);
      if (p.public.response.kind === "choice")
        for (const o of p.public.response.options)
          assert.equal(gradeAnswer(p, o.id), o.id === p.answer);
    }
    for (const variant of clauseEntries[id]?.values ?? [])
      if (variant !== "legacy")
        assert.ok(seen.has(variant), `${id} missing ${variant}`);
  }
});

test("worked examples can request each signed-number and geometry clause", () => {
  for (const [id, entry] of Object.entries(clauseEntries)) {
    const meta = templates.find((template) => template.id === id)!;
    for (const variant of entry.values) {
      if (variant === "legacy") continue;
      const problem = generateClauseVariant(meta, "clause-lesson", variant);
      assert.equal(problem?.public.templateId, id);
      assert.equal(problem?.variant?.axes?.clause, variant, `${id}/${variant}`);
      assert.ok(gradeAnswer(problem!, problem!.answer), `${id}/${variant}`);
    }
  }
});

test("saved catalog versions keep the pre-clause surfaces", () => {
  // Captured from the unmodified engine at 8bad63b75, including teaching text.
  const digests = JSON.parse(
    readFileSync(
      new URL("./fixtures/clause-legacy-digests.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, string>;
  for (const id of Object.keys(clauseEntries)) {
    const meta = templates.find((t) => t.id === id)!;
    assert.ok(meta.reprintsFrom! < meta.version);
    assert.equal(
      createHash("sha256")
        .update(
          JSON.stringify(
            Array.from({ length: 5 }, (_, i) =>
              generateProblem(id, `clause-reprint-${i}`, 1),
            ),
          ),
        )
        .digest("hex"),
      digests[id],
      id,
    );
    for (let i = 0; i < 30; i++) {
      const p = generateProblem(id, `replay-${i}`, meta.version - 1);
      assert.equal(p.variant?.axes?.clause, undefined, id);
      assert.deepEqual(p, generateProblem(id, `replay-${i}`, meta.version - 1));
    }
  }
});

test("clients must support every response surface in a mixed family", () => {
  for (const id of ids) {
    const t = templates.find((t) => t.id === id)!;
    assert.ok(clientCanDraw(t, { responseCapabilities, figureCapabilities }));
    for (const cap of t.requiredResponseCapabilities ?? [])
      assert.equal(
        clientCanDraw(t, {
          responseCapabilities: responseCapabilities.filter((c) => c !== cap),
          figureCapabilities,
        }),
        false,
        `${id} ${cap}`,
      );
  }
});

test("long division identifies the actual returning remainder and exact repeating block", () => {
  assert.deepEqual(decimalExpansion(5, 12).remainders, [2, 8, 8]);
  assert.equal(decimalExpansion(5, 12).text, "0.41\\overline{6}");
  assert.equal(decimalExpansion(1, 7).text, "0.\\overline{142857}");
  assert.equal(decimalExpansion(3, 8).text, "0.375");
  assert.equal(decimalExpansion(-7, 9).text, "-0.\\overline{7}");
  for (const p of sample("fraction-to-decimal-long-division", 300)) {
    if (p.public.response.kind !== "structured-work") continue;
    const answers = JSON.parse(p.answer) as string[][];
    const wrong = structuredClone(answers);
    wrong[0]![1] = String(Number(wrong[0]![1]) + 1);
    assert.equal(
      gradeAnswer(p, JSON.stringify(wrong)),
      false,
      "a wrong remainder must fail",
    );
  }
});

test("each three-side bank entry has exactly one lattice vertex above its base", () => {
  for (const [b, x, y, ac, bc] of triangleConstructionBank) {
    const solutions: number[][] = [];
    for (let u = 0; u <= 16; u++)
      for (let v = 1; v <= 16; v++)
        if (u * u + v * v === ac * ac && (u - b) ** 2 + v * v === bc * bc)
          solutions.push([u, v]);
    assert.deepEqual(solutions, [[x, y]]);
  }
  for (const p of sample("triangle-construct-plot", 300)) {
    const [[x, y]] = JSON.parse(p.answer) as [number, number][];
    assert.ok(y! > 0);
    assert.equal(gradeAnswer(p, JSON.stringify([[x, 0]])), false);
    assert.equal(
      gradeAnswer(p, JSON.stringify([[x, -y!]])),
      false,
      "prompt explicitly requires above AB",
    );
  }
});

test("circle derivation's plotted point lies on its given circle", () => {
  let count = 0,
    both = 0,
    negative = 0,
    radical = 0;
  for (const p of sample("circle-equation", 650)) {
    if (p.variant?.axes?.clause !== "derive-from-center-radius") continue;
    count++;
    const f = p.public.figure;
    assert.equal(f?.kind, "scene");
    if (f?.kind !== "scene") continue;
    const circle = f.scene.elements.find((e) => e.type === "circle")!;
    assert.equal(circle.type, "circle");
    if (circle.type !== "circle") continue;
    const point = f.scene.elements.filter((e) => e.type === "point")[1]!;
    assert.equal(point.type, "point");
    if (point.type !== "point") continue;
    const [h, k] = circle.center,
      [x, y] = point.at;
    assert.ok(Math.abs((x - h) ** 2 + (y - k) ** 2 - circle.r ** 2) < 1e-9);
    assert.ok(x > h && y > k);
    if (h && k) both++;
    if (h < 0 || k < 0) negative++;
    if (!Number.isInteger(circle.r)) radical++;
  }
  assert.ok(count >= 300);
  assert.ok(both / count >= 0.6);
  assert.ok(negative / count >= 0.5);
  assert.ok(radical / count > 0.2 && radical / count < 0.4);
});

test("angle and story figures lay out on phone-sized scenes", () => {
  for (const id of [
    "turn-degrees",
    "circle-equation",
    "right-triangle",
    "right-triangle-missing-leg",
    "angle-recognize",
    "signed-jumps",
  ]) {
    for (const p of sample(id, 35)) {
      const scenes =
        p.public.response.kind === "figure-choice"
          ? p.public.response.options.map((o) => o.scene)
          : p.public.figure?.kind === "scene"
            ? [p.public.figure.scene]
            : [];
      for (const scene of scenes) {
        const laid = layoutScene({
          ...scene,
          width: Math.min(scene.width ?? 320, 320),
        });
        assert.ok(laid.items.length > 0);
        assert.ok(Number.isFinite(laid.width) && Number.isFinite(laid.height));
      }
    }
  }
});

test("whole-angle addition remains frequent and is included in equation choices", () => {
  // A larger fixed sample measures a 1/3 probability without treating a
  // 28/100 random draw as evidence that the whole-angle task is absent.
  const adjacent = sample("adjacent-angles", 1000);
  const whole = adjacent.filter((p) =>
    p.public.prompt.includes("They do not overlap."),
  );
  assert.ok(whole.length >= 300, `${whole.length} whole-angle items`);
  assert.ok(
    sample("adjacent-angle-equation", 100).some(
      (p) => p.variant?.axes?.clause === "whole-unknown",
    ),
  );
});

test("clause hints name givens without stating answers; teaching text typesets", () => {
  const texts: { owner: string; where: string; text: string }[] = [];
  const hintIssues: string[] = [];
  const add = (owner: string, where: string, text: string) =>
    texts.push({ owner, where, text });
  const collect = (owner: string, where: string, value: unknown): void => {
    if (typeof value === "string") add(owner, where, value);
    else if (Array.isArray(value))
      value.forEach((v, i) => collect(owner, `${where}.${i}`, v));
    else if (value && typeof value === "object")
      for (const [key, v] of Object.entries(value))
        if (
          ![
            "id",
            "templateIds",
            "terms",
            "kind",
            "senses",
            "noLink",
            "scene",
            "grid",
            "given",
            "pointLabels",
            "pointCount",
            "ordered",
            "connect",
            "bank",
            "layout",
            "mode",
            "type",
            "validation",
          ].includes(key)
        )
          collect(owner, `${where}.${key}`, v);
  };
  for (const id of ids) {
    if (fixedHint(id)) hintIssues.push(`${id}: fixed hint`);
    if (unnamedGivens(id)) hintIssues.push(`${id}: unnamed givens`);
    const ps = hintSample(id);
    for (const p of ps) {
      if (revealsAnswer(p, figureEncodesAnswer(ps)))
        hintIssues.push(`${id}: reveals answer: ${p.hint}`);
      add(id, "prompt", p.public.prompt);
      add(id, "hint", p.hint);
      collect(id, "explanation", p.explanation);
      collect(id, "response", p.public.response);
    }
  }
  for (const [id, method] of Object.entries(clauseMethods))
    collect(id, "method", method);
  for (const [id, principle] of Object.entries(clausePrinciples))
    add(id, "principle", principle);
  for (const lesson of clauseLessons)
    collect(`lesson:${lesson.id}`, "lesson", lesson);
  const contexts = ownerContexts(texts),
    issues = texts.flatMap((t) =>
      typographyIssues(t.text, contexts.get(t.owner)).map(
        (i) => `${t.owner} ${t.where}: ${i.rule}: ${t.text}`,
      ),
    );
  assert.deepEqual([...new Set([...hintIssues, ...issues])], []);
});

test("independent prompt and figure oracle verifies every clause surface", () => {
  const problems = ids
    .flatMap((id) => sample(id, 160))
    .filter((p) => p.variant?.axes?.clause);
  const review = spawnSync(
    "python3",
    ["scripts/clause_variants_math_oracle.py", "--jsonl"],
    {
      input: problems.map((p) => JSON.stringify(p)).join("\n"),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(review.status, 0, `${review.stdout}\n${review.stderr}`);
  assert.equal(JSON.parse(review.stdout).cases, problems.length);
  const routed = spawnSync(
    "python3",
    [
      "-c",
      `import importlib.util, json, sys
sys.path.insert(0, 'scripts')
spec = importlib.util.spec_from_file_location('review', 'scripts/independent-math-review.py')
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)
for line in sys.stdin:
    problem = json.loads(line)
    assert review.is_clause_variant(problem['public']), problem['public']['templateId']
    assert review.solve_family(problem['public']) == review.solve_clause_variant(problem['public'])
    review.review_clause_variant(problem)
`,
    ],
    {
      input: problems.map((p) => JSON.stringify(p)).join("\n"),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(routed.status, 0, routed.stderr);
});

test("a future base revision preserves the clause introduction and saved problem IDs", () => {
  for (const id of Object.keys(clauseEntries)) {
    const meta = templates.find((template) => template.id === id)!;
    const introduced = clauseEntries[id]!.introducedVersion;
    const futureVersion = meta.version + 3;
    const future = withClauseMetadata({ ...meta, version: futureVersion });
    assert.equal(future.version, futureVersion, id);
    assert.equal(future.reprintsFrom, meta.reprintsFrom, id);
    let reviewed = 0;
    for (let i = 0; i < 40; i++) {
      const seed = `future-base-reprint-${i}`;
      const original = withTemplateVersion(introduced, () =>
        generateClauseVariant(meta, seed),
      );
      if (!original) continue;
      reviewed++;
      assert.deepEqual(
        withTemplateVersion(introduced, () =>
          generateClauseVariant(future, seed),
        ),
        original,
        `${id}: saved clause revision`,
      );
      assert.equal(
        withTemplateVersion(introduced - 1, () =>
          generateClauseVariant(future, seed),
        ),
        undefined,
        `${id}: pre-clause revision`,
      );
    }
    assert.ok(reviewed > 0, id);
  }
});
