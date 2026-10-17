import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  elementaryTemplates,
  elementaryGrades,
  generateElementaryProblem,
} from "../src/math/elementary.js";
import { templates, generateProblem } from "../src/math/engine.js";
import {
  generatedProblemSchema,
  semanticFigureSchema,
} from "../src/math/contracts.js";
import { elementaryLessons } from "../src/content/elementary-lessons.js";
import { elementaryRequirements } from "../src/content/elementary-coverage.js";
import { skills, standards } from "../src/curriculum/catalog.js";
import { Figure } from "../src/web/Figure.js";
import { publicationHtml } from "../src/content/publications.js";

test("24 elementary families have grade-specific catalog, lesson and public engine bindings", () => {
  assert.equal(elementaryTemplates.length, 24);
  assert.equal(elementaryLessons.length, 12);
  assert.equal(new Set(elementaryTemplates.map((t) => t.id)).size, 24);
  for (const template of elementaryTemplates) {
    assert.ok(skills.some((skill) => skill.id === template.skillId));
    assert.ok(templates.some((t) => t.id === template.id));
    assert.ok(["K", "1", "2"].includes(elementaryGrades[template.id]!));
    assert.equal(
      elementaryLessons.filter((l) => l.templateIds.includes(template.id))
        .length,
      1,
    );
    assert.deepEqual(
      generateProblem(template.id, "registry"),
      generateElementaryProblem(template.id, "registry"),
    );
  }
});

test("bounded public models validate across 12288 variants, with important edge cases observed", () => {
  const seen = new Set<string>();
  for (const template of elementaryTemplates)
    for (let seed = 0; seed < 512; seed++) {
      const problem = generateElementaryProblem(template.id, `domain-${seed}`);
      generatedProblemSchema.parse(problem);
      const answer = Number(problem.answer);
      assert.ok(Number.isInteger(answer) && answer >= 0 && answer <= 1000);
      assert.ok(problem.public.prompt.length < 185, "Phone prompt is bounded");
      assert.ok(!("answer" in problem.public));
      assert.ok(problem.hint.length > 0 && problem.explanation.length >= 2);
      const figure = problem.public.figure;
      if (figure?.kind === "ten-frame") {
        assert.ok(figure.first + figure.second <= figure.capacity);
        if (figure.first + figure.second === 10) seen.add("full-frame");
      }
      if (figure?.kind === "base-ten") {
        if (figure.tens === 0) seen.add("zero-tens");
        if (figure.ones === 0) seen.add("zero-ones");
        if (figure.ones >= 10) seen.add("exchange-ones");
        if (figure.tens >= 10) seen.add("exchange-tens");
      }
      if (template.id === "subtract-with-regrouping") {
        const [a, b] = problem.public.prompt.match(/\d+/g)!.map(Number);
        assert.equal(answer, a! - b!);
        if (Math.floor(a! / 10) % 10 === 0) seen.add("borrow-across-zero");
      }
      if (template.id === "add-with-regrouping") {
        const [a, b] = problem.public.prompt.match(/\d+/g)!.map(Number);
        assert.equal(answer, a! + b!);
        if ((Math.floor(a! / 10) % 10) + (Math.floor(b! / 10) % 10) + 1 >= 10)
          seen.add("carry-hundred");
      }
      if (template.id === "skip-count-missing" && answer === 1000)
        seen.add("count1000");
      if (template.id === "continue-count-to-120" && answer === 120)
        seen.add("count120");
      if (template.id === "take-away-within-10" && answer === 0)
        seen.add("nothing-left");
    }
  for (const expected of [
    "full-frame",
    "zero-tens",
    "zero-ones",
    "exchange-ones",
    "exchange-tens",
    "borrow-across-zero",
    "carry-hundred",
    "count1000",
    "count120",
    "nothing-left",
  ])
    assert.ok(seen.has(expected), expected);
});

test("semantic schemas reject impossible frames and oversized or fractional base-ten models", () => {
  for (const model of [
    { kind: "ten-frame", first: 8, second: 4, capacity: 10 },
    { kind: "ten-frame", first: 1, second: 0, capacity: 15 },
    { kind: "ten-frame", first: -1, second: 0, capacity: 10 },
    { kind: "base-ten", hundreds: 9, tens: 19, ones: 19 },
    { kind: "base-ten", hundreds: 1, tens: 1.5, ones: 2 },
    { kind: "base-ten", hundreds: 0, tens: 20, ones: 0 },
  ])
    assert.equal(semanticFigureSchema.safeParse(model).success, false);
  assert.equal(
    semanticFigureSchema.safeParse({
      kind: "base-ten",
      hundreds: 2,
      tens: 13,
      ones: 14,
    }).success,
    true,
  );
});

test("rendered units preserve counts, frame capacity and hundred-ten-one area ratios", () => {
  for (const template of elementaryTemplates)
    for (let seed = 0; seed < 24; seed++) {
      const figure = generateElementaryProblem(template.id, `draw-${seed}`)
        .public.figure;
      if (!figure) continue;
      const html = renderToStaticMarkup(
        React.createElement(Figure, { figure }),
      );
      assert.ok(html.includes('role="img"') && html.includes("aria-label="));
      assert.ok(!html.includes("NaN") && !html.includes("Infinity"));
      if (figure.kind === "ten-frame") {
        assert.equal((html.match(/data-slot=/g) ?? []).length, figure.capacity);
        assert.equal(
          (html.match(/data-counter="first"/g) ?? []).length,
          figure.first,
        );
        assert.equal(
          (html.match(/data-counter="second"/g) ?? []).length,
          figure.second,
        );
      } else if (figure.kind === "base-ten") {
        assert.equal(
          (html.match(/data-unit="hundred"/g) ?? []).length,
          figure.hundreds,
        );
        assert.equal(
          (html.match(/data-unit="ten"/g) ?? []).length,
          figure.tens,
        );
        assert.equal(
          (html.match(/data-unit="one"/g) ?? []).length,
          figure.ones,
        );
      }
    }
  const html = renderToStaticMarkup(
    React.createElement(Figure, {
      figure: { kind: "base-ten", hundreds: 1, tens: 1, ones: 1 },
    }),
  );
  const h = html.match(
      /data-unit="hundred"><rect[^>]*width="(\d+)" height="(\d+)"/,
    )!,
    t = html.match(/data-unit="ten"><rect[^>]*width="(\d+)" height="(\d+)"/)!,
    o = html.match(/data-unit="one"[^>]*width="(\d+)" height="(\d+)"/)!;
  const area = (m: RegExpMatchArray) => Number(m[1]) * Number(m[2]);
  assert.equal(area(h) / area(o), 100);
  assert.equal(area(t) / area(o), 10);
});

test("source matrix covers all33 numbered standards plus5 components and retains limitations", () => {
  const numbered = standards
    .filter((s) => /^(K|1|2)\.(OA|NBT)\./.test(s.id))
    .map((s) => s.id);
  assert.equal(numbered.length, 33);
  const components = [
    "1.NBT.B.2.a",
    "1.NBT.B.2.b",
    "1.NBT.B.2.c",
    "2.NBT.A.1.a",
    "2.NBT.A.1.b",
  ];
  assert.deepEqual(
    new Set(elementaryRequirements.map((r) => r.sourceId)),
    new Set([...numbered, ...components]),
  );
  for (const requirement of elementaryRequirements) {
    assert.ok(requirement.remainingRequirements.length > 20);
    assert.ok(["planned", "partial-practice"].includes(requirement.status));
    assert.ok(
      requirement.sourceUrl.startsWith(
        "https://www.thecorestandards.org/Math/Content/",
      ),
    );
    for (const id of requirement.templateIds)
      assert.ok(elementaryTemplates.some((t) => t.id === id));
  }
});

test("each lesson renders matching workbook and solutions with registered diagrams", () => {
  for (const lesson of elementaryLessons) {
    for (const kind of ["lesson", "workbook", "solutions"] as const) {
      const html = publicationHtml(lesson, kind);
      assert.ok(html.startsWith("<!doctype html>"));
      assert.ok(html.includes(lesson.title.replaceAll("&", "&amp;")));
      assert.ok(!html.includes("NaN") && !html.includes("undefined"));
      const count = lesson.templateIds.length * 12;
      if (kind !== "lesson")
        assert.equal((html.match(/class="exercise"/g) ?? []).length, count);
      if (kind === "workbook") assert.ok(!html.includes("Answer:"));
      if (kind === "solutions")
        assert.equal((html.match(/Answer:/g) ?? []).length, count);
    }
  }
});
