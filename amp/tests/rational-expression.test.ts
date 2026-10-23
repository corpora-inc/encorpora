import { segmentPrintText } from "../src/content/math-typesetting";
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine";
import {
  rationalExpressionCase,
  rationalExpressionTemplates,
} from "../src/math/rational-expression-practice";
import { skills } from "../src/curriculum/catalog";
import { buildCoverageManifest } from "../src/content/coverage";
import { generatedProblemSchema } from "../src/math/contracts";
import { templateGrade } from "../src/server/mixed-practice";
import { publicationHtml } from "../src/content/publications";
import { rationalExpressionLessons } from "../src/content/rational-expression-lessons";
import { sceneIllustrations } from "../src/content/scene-illustrations";

test("rational-expression choices match a separate exact polynomial/domain oracle", () => {
  const cases = rationalExpressionTemplates.flatMap((t) =>
    Array.from({ length: 512 }, (_, i) =>
      generateProblem(t.id, `rational-${i}`),
    ),
  );
  const tags = new Set(
    rationalExpressionTemplates
      .flatMap((t) =>
        Array.from(
          { length: 512 },
          (_, i) => rationalExpressionCase(t.id, `rational-${i}`).tags,
        ),
      )
      .flat(),
  );
  for (const tag of [
    "domain",
    "simplify",
    "repeated-root",
    "distinct-roots",
    "zero-excluded",
    "negative-scale",
    "positive-scale",
  ])
    assert(tags.has(tag), tag);
  for (const id of rationalExpressionTemplates.map((t) => t.id))
    assert.equal(
      new Set(
        cases.filter((c) => c.public.templateId === id).map((c) => c.answer),
      ).size,
      4,
      "answer positions vary",
    );
  for (const item of cases) {
    generatedProblemSchema.parse(item);
    assert(!("answer" in item.public));
    assert.equal(item.public.response!.kind, "choice");
    if (item.public.response.kind === "choice")
      for (const option of item.public.response.options) {
        const prose = segmentPrintText(option.label)
          .filter((s) => s.kind === "text")
          .map((s) => s.source)
          .join("");
        assert(!prose.includes("$"), `Unrendered notation in ${option.label}`);
      }
  }
  const result = spawnSync(
    "python3",
    [
      "-c",
      "import json,sys;sys.path.insert(0,'scripts');from rational_expression_math_oracle import review_rational_expression_problem,review_rational_expression_fixtures;print(json.dumps(review_rational_expression_fixtures()));rows=json.load(sys.stdin);[review_rational_expression_problem(p) for p in rows];print(len(rows))",
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1024/);
});
test("excluded inputs connect existing foundations to rational expressions without claiming general arithmetic coverage", () => {
  const nodes = new Map(skills.map((s) => [s.id, s]));
  assert.deepEqual(nodes.get("rational-expression-domain")!.prerequisites, [
    "linear-equations",
    "function-domain-range",
  ]);
  assert(
    nodes
      .get("rational-expressions")!
      .prerequisites.includes("rational-expression-domain"),
  );
  assert(
    nodes
      .get("rational-equations")!
      .prerequisites.includes("rational-expressions"),
  );
  assert.deepEqual(
    rationalExpressionTemplates.map((t) => templateGrade(t, nodes)),
    [9.5, 10.5],
  );
  const manifest = buildCoverageManifest();
  assert.equal(manifest.valid, true);
  for (const t of rationalExpressionTemplates)
    assert(
      manifest.facetMappings.some(
        (m) => m.templateId === t.id && m.extent === "partial",
      ),
    );
});
test("the worked example preserves its hole in the visual and ends with the precise domain rule", () => {
  const lesson = rationalExpressionLessons[0]!;
  const html = publicationHtml(lesson, "lesson");
  for (const [before, after] of [
    ["A worked example", "Which inputs are allowed?"],
    ["A worked example", "See the missing input"],
    ["See the missing input", "The precise rule"],
  ])
    assert(html.indexOf(before!) < html.indexOf(after!));
  const model = sceneIllustrations["rational-expression-hole"].elements[0]!;
  assert.equal(model.type, "graph");
  if (model.type === "graph")
    assert.deepEqual(model.points?.[0], {
      x: 2,
      y: 0.5,
      label: "(2, 1/2)",
      open: true,
      color: "warm",
    });
});
