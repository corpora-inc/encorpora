import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generateProblem, templates } from "../src/math/engine";
import { semanticFigureSchema } from "../src/math/contracts";
import {
  dataDisplayKinds,
  type DataDisplayFigure,
} from "../src/math/data-display-models";
import { isPorted } from "../src/math/scene/legacy";
import { Figure } from "../src/web/Figure";
import { dataIllustrations } from "../src/content/data-display-illustrations";

const dataTemplates = templates.filter((t) =>
  [0, 1, 2].some((i) =>
    dataDisplayKinds.has(
      generateProblem(t.id, `kind-${i}`).public.figure?.kind ?? "",
    ),
  ),
);
const figures = (id: string, n = 120) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `chart-${i}`))
    .map((p) => p.public.figure)
    .filter((f): f is DataDisplayFigure => !!f && dataDisplayKinds.has(f.kind));

test("every chart-bearing template declares the data-display capability", () => {
  assert.ok(dataTemplates.length >= 5);
  for (const t of dataTemplates)
    assert.equal(t.requiredFigureCapability, "data-displays-v1", t.id);
});

test("charts draw through scenes with a description and role colors only", () => {
  for (const t of dataTemplates)
    for (const figure of figures(t.id, 20)) {
      assert.ok(semanticFigureSchema.safeParse(figure).success, t.id);
      assert.ok(isPorted(figure), `${figure.kind} draws through scenes`);
      const svg = renderToStaticMarkup(React.createElement(Figure, { figure }));
      assert.match(svg, /class="figure scene-figure/, t.id);
      assert.match(svg, new RegExp(`data-kind="${figure.kind}"`), t.id);
      assert.doesNotMatch(svg, /#[0-9a-f]{3,8}\b|rgb\(/i, t.id);
      assert.match(svg, /role="img" aria-label="[^"]{20,}"/);
    }
  for (const figure of Object.values(dataIllustrations))
    assert.ok(semanticFigureSchema.safeParse(figure).success);
});

test("unreadable charts are rejected", () => {
  const bad: unknown[] = [
    {
      kind: "scaled-bar-graph",
      categories: [
        { label: "A", value: 7 },
        { label: "B", value: 10 },
      ],
      step: 10,
      max: 60,
      unit: "cans",
    },
    {
      kind: "scaled-bar-graph",
      categories: [
        { label: "A", value: 10 },
        { label: "B", value: 10 },
      ],
      step: 5,
      max: 75,
      unit: "cans",
    },
    {
      kind: "picture-graph",
      categories: [
        { label: "A", count: 7 },
        { label: "B", count: 10 },
      ],
      key: 5,
      unit: "students",
    },
    { kind: "sort-shapes", shapes: ["circle", "hexagon", "square"] },
  ];
  for (const figure of bad)
    assert.equal(semanticFigureSchema.safeParse(figure).success, false);
});
