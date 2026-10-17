import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  fractionPracticeTemplates,
  generateFractionPracticeProblem,
  fractionPracticeDefinitions,
} from "../src/math/fraction-practice.js";
import { generateProblem, templates } from "../src/math/engine.js";
import {
  generatedProblemSchema,
  semanticFigureSchema,
} from "../src/math/contracts.js";
import {
  fractionPracticeBindings,
  fractionRequirements,
  validateFractionPracticeCoverage,
} from "../src/content/fraction-practice-coverage.js";
import { Figure } from "../src/web/Figure.js";

function value(answer: string) {
  const [n, d = "1"] = answer.split("/");
  return Number(n) / Number(d);
}

test("21 fraction families have stable public engine and book/skill/component bindings", () => {
  assert.equal(fractionPracticeTemplates.length, 21);
  assert.equal(fractionPracticeBindings.length, 21);
  assert.equal(fractionRequirements.length, 38);
  validateFractionPracticeCoverage();
  for (const template of fractionPracticeTemplates) {
    assert.equal(templates.filter((t) => t.id === template.id).length, 1);
    assert.equal(
      fractionPracticeBindings.filter((b) => b.templateId === template.id)
        .length,
      1,
    );
    assert.deepEqual(
      generateProblem(template.id, "binding"),
      generateFractionPracticeProblem(template.id, "binding"),
    );
    assert.ok(
      fractionPracticeBindings.find((b) => b.templateId === template.id)!
        .componentIds.length > 0,
    );
  }
  assert.ok(
    fractionRequirements.every(
      (row) =>
        row.status !== "partial-practice" ||
        row.remainingRequirements.length > 30,
    ),
  );
  for (const sourceId of [
    "4.NF.C.5",
    "4.NF.C.6",
    "4.NF.C.7",
    "5.NF.B.4.b",
    "5.NF.B.5.a",
    "5.NF.B.5.b",
  ])
    assert.equal(
      fractionRequirements.find((r) => r.sourceId === sourceId)?.status,
      "planned",
    );
});

test("10752 deterministic instances preserve bounds, response semantics, and required edges", () => {
  const seen = new Set<string>();
  for (const definition of fractionPracticeDefinitions)
    for (let seed = 0; seed < 512; seed++) {
      const problem = generateFractionPracticeProblem(
        definition.id,
        `domain-${seed}`,
      );
      generatedProblemSchema.parse(problem);
      assert.ok(
        problem.public.prompt.length <= 190,
        "Prompt is concise for phone practice",
      );
      assert.ok(
        value(problem.answer) >= 0 && Number.isFinite(value(problem.answer)),
      );
      assert.ok(!("answer" in problem.public));
      assert.ok(problem.explanation.length >= 2 && problem.hint.length > 0);
      if (problem.public.response.kind === "number")
        assert.ok(Number.isInteger(value(problem.answer)));
      const f = problem.public.figure;
      if (definition.grade === "3" && f) {
        if (f.kind === "fraction-strips")
          assert.ok([2, 3, 4, 6, 8].includes(f.parts));
        if (f.kind === "rational-line")
          assert.ok([2, 3, 4, 6, 8].includes(f.denominator));
      }
      if (
        definition.id === "fraction-line-position" &&
        value(problem.answer) > 1
      )
        seen.add("beyond-one");
      if (
        definition.id === "like-fraction-difference" &&
        value(problem.answer) === 0
      )
        seen.add("zero-difference");
      if (definition.id === "fraction-group-count") {
        if (value(problem.answer) < 1) seen.add("less-than-group");
        if (!Number.isInteger(value(problem.answer))) seen.add("partial-group");
        if (Number.isInteger(value(problem.answer))) seen.add("full-groups");
        assert.match(problem.public.response.label, /Containerfuls/);
      }
      if (
        definition.id === "whole-sharing-fraction" &&
        value(problem.answer) > 1
      )
        seen.add("improper-share");
      if (definition.id === "unit-fraction-share")
        assert.match(problem.public.response.label, /Liters per person/);
      if (definition.id === "mixed-fraction-difference") {
        const [w, n, d, v, a, b] = problem.public.prompt
          .match(/\d+/g)!
          .map(Number);
        assert.ok(
          n! < a! && a! < d! && b === d,
          "Both mixed parts proper and regrouping necessary",
        );
        assert.equal(value(problem.answer), (w! * d! + n! - v! * d! - a!) / d!);
        seen.add("regroup");
      }
    }
  for (const edge of [
    "beyond-one",
    "zero-difference",
    "less-than-group",
    "partial-group",
    "full-groups",
    "improper-share",
    "regroup",
  ])
    assert.ok(seen.has(edge), edge);
});

test("diagram contracts reject impossible counts, duplicate markers, and off-grid values", () => {
  for (const figure of [
    {
      kind: "rational-line",
      denominator: 0,
      maxWhole: 3,
      points: [{ numerator: 1, label: "P" }],
      unit: "whole",
    },
    {
      kind: "rational-line",
      denominator: 4,
      maxWhole: 3,
      points: [{ numerator: 13, label: "P" }],
      unit: "whole",
    },
    {
      kind: "rational-line",
      denominator: 4,
      maxWhole: 3,
      points: [{ numerator: 1.5, label: "P" }],
      unit: "whole",
    },
    {
      kind: "rational-line",
      denominator: 4,
      maxWhole: 3,
      points: [
        { numerator: 1, label: "P" },
        { numerator: 2, label: "P" },
      ],
      unit: "whole",
    },
    {
      kind: "rational-line",
      denominator: 4,
      maxWhole: 3,
      points: [
        { numerator: 1, label: "A" },
        { numerator: 1, label: "B" },
      ],
      unit: "whole",
    },
    {
      kind: "fraction-strips",
      parts: 4,
      wholes: 2,
      rows: [{ selected: 9, label: "amount" }],
      unit: "whole",
    },
    {
      kind: "fraction-strips",
      parts: 4,
      wholes: 2,
      rows: [{ selected: -1, label: "amount" }],
      unit: "whole",
    },
    {
      kind: "fraction-strips",
      parts: 4,
      wholes: 0,
      rows: [{ selected: 0, label: "amount" }],
      unit: "whole",
    },
  ])
    assert.equal(semanticFigureSchema.safeParse(figure).success, false);
});

test("SVG geometry preserves fractional unit lengths and shaded counts without answer labels", () => {
  for (const id of [
    "fraction-line-position",
    "fraction-distance-gap",
    "fraction-unit-count",
    "fraction-group-count",
  ])
    for (let seed = 0; seed < 128; seed++) {
      const figure = generateFractionPracticeProblem(id, `render-${seed}`)
        .public.figure!;
      const svg = renderToStaticMarkup(React.createElement(Figure, { figure }));
      assert.match(svg, /viewBox=/);
      assert.match(svg, /role="img"/);
      if (figure.kind === "rational-line") {
        assert.equal(
          (svg.match(/data-tick=/g) ?? []).length,
          figure.denominator * figure.maxWhole + 1,
        );
        const circles = [...svg.matchAll(/data-point="([PAB])" cx="([^"]+)"/g)];
        assert.equal(circles.length, figure.points.length);
        circles.forEach((c) => {
          const point = figure.points.find((p) => p.label === c[1])!;
          const inferred = ((Number(c[2]) - 24) / 312) * figure.maxWhole;
          assert.ok(
            Math.abs(inferred - point.numerator / figure.denominator) < 1e-12,
          );
        });
        const visibleLabels = [
          ...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g),
        ].map((m) => m[1]);
        assert.ok(
          visibleLabels.every((label) => !label!.includes("/")),
          "Only whole numbers and letter point labels",
        );
      } else if (figure.kind === "fraction-strips") {
        assert.equal(
          (svg.match(/data-piece=/g) ?? []).length,
          figure.parts * figure.wholes * figure.rows.length,
        );
        assert.equal(
          (svg.match(/data-shaded="true"/g) ?? []).length,
          figure.rows.reduce((sum, row) => sum + row.selected, 0),
        );
        assert.equal(
          (svg.match(/data-whole=/g) ?? []).length,
          figure.wholes * figure.rows.length,
        );
        const widths = [
          ...svg.matchAll(/data-piece="\d+"[^>]+\swidth="([^"]+)"/g),
        ].map((m) => Number(m[1]));
        assert.ok(
          widths.every(
            (w) => Math.abs(w * figure.parts * figure.wholes - 312) < 1e-10,
          ),
        );
      }
    }
});

test("coverage fails closed on stale book pages, skills, source links, and unsupported claims", () => {
  const first = fractionPracticeBindings[0]!;
  for (const bad of [
    { ...first, pageIds: ["missing"] },
    { ...first, skillId: "missing" },
    { ...first, templateId: "missing" },
    { ...first, componentIds: ["missing"] },
  ])
    assert.throws(() => validateFractionPracticeCoverage([bad]));
  assert.throws(() =>
    validateFractionPracticeCoverage(fractionPracticeBindings, [
      { ...fractionRequirements[0]!, templateIds: ["missing"] },
    ]),
  );
  assert.throws(() => generateFractionPracticeProblem("missing", "seed"));
  assert.throws(() => generateFractionPracticeProblem("unit-piece-size", ""));
});

test("component inventory includes every numbered and lettered source requirement in the declared domains", () => {
  const expected = [
    ...[1, 2, 3].map((n) => `3.NF.A.${n}`),
    ...["a", "b"].map((s) => `3.NF.A.2.${s}`),
    ...["a", "b", "c", "d"].map((s) => `3.NF.A.3.${s}`),
    "4.NF.A.1",
    "4.NF.A.2",
    "4.NF.B.3",
    "4.NF.B.4",
    "4.NF.C.5",
    "4.NF.C.6",
    "4.NF.C.7",
    ...["a", "b", "c", "d"].map((s) => `4.NF.B.3.${s}`),
    ...["a", "b", "c"].map((s) => `4.NF.B.4.${s}`),
    "5.NF.A.1",
    "5.NF.A.2",
    ...[3, 4, 5, 6, 7].map((n) => `5.NF.B.${n}`),
    ...["a", "b"].flatMap((s) => [`5.NF.B.4.${s}`, `5.NF.B.5.${s}`]),
    ...["a", "b", "c"].map((s) => `5.NF.B.7.${s}`),
    "6.NS.A.1",
  ];
  assert.deepEqual(
    fractionRequirements.map((r) => r.sourceId).sort(),
    expected.sort(),
  );
  assert.throws(
    () => validateFractionPracticeCoverage(fractionPracticeBindings.slice(1)),
    /Every fraction family/,
  );
});
