import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { equalGroupsDefinitions } from "../src/content/equal-groups-definitions.js";
import {
  equalGroupsRequirements,
  validateEqualGroupsCoverage,
} from "../src/content/equal-groups-coverage.js";
import {
  generateEqualGroupsProblem,
  equalGroupsTemplates,
} from "../src/math/equal-groups-practice.js";
import { generateProblem, templates } from "../src/math/engine.js";
import {
  generatedProblemSchema,
  semanticFigureSchema,
} from "../src/math/contracts.js";
import { EqualGroupsFigure } from "../src/web/EqualGroupsFigure.js";

test("twenty bounded families have registry, component, and exact book support without mastery promotion", () => {
  assert.equal(equalGroupsDefinitions.length, 20);
  validateEqualGroupsCoverage();
  for (const t of equalGroupsTemplates) {
    assert.equal(templates.filter((x) => x.id === t.id).length, 1);
    assert.deepEqual(
      generateProblem(t.id, "registry"),
      generateEqualGroupsProblem(t.id, "registry"),
    );
  }
  assert.ok(
    equalGroupsRequirements.every(
      (r) => r.status === "planned" || r.remainingRequirements.length > 40,
    ),
  );
  for (const id of [
    "fluent-recall",
    "estimation",
    "multidigit-division",
    "pattern-generation",
  ])
    assert.equal(
      equalGroupsRequirements.find((r) => r.id === `equal-groups.${id}`)
        ?.status,
      "planned",
    );
});
test("10240 instances preserve deterministic public givens, bounds, units, and edge cases", () => {
  const edges = new Set<string>();
  for (const d of equalGroupsDefinitions)
    for (let i = 0; i < 512; i++) {
      const p = generateEqualGroupsProblem(d.id, `bounds-${i}`);
      generatedProblemSchema.parse(p);
      assert.deepEqual(p, generateEqualGroupsProblem(d.id, `bounds-${i}`));
      assert.ok(
        Number.isSafeInteger(Number(p.answer)) && Number(p.answer) >= 0,
      );
      assert.ok(p.public.prompt.length <= 190);
      assert.ok(!("answer" in p.public));
      assert.ok(p.explanation.length >= 2 && p.hint.length > 20);
      if (p.answer === "0") edges.add(d.id + ".zero");
      if (d.id === "kit-leftovers" && Number(p.answer) > 0)
        edges.add("leftover.positive");
      if (d.id === "zero-one-groups" && Number(p.answer) > 0)
        edges.add("identity.positive");
      const f = p.public.figure;
      if (f?.kind === "grouped-counters") {
        assert.ok(Math.ceil(f.total / f.groupSize) <= 8);
        if (f.total % f.groupSize === 0) edges.add("groups.exact");
        else edges.add("groups.partial");
      }
      if (d.id === "small-array-total" && f?.kind === "unit-array")
        assert.ok(f.rows <= 5 && f.columns <= 5);
    }
  for (const edge of [
    "kit-leftovers.zero",
    "pairing-leftover.zero",
    "zero-one-groups.zero",
    "unknown-dividend.zero",
    "delivery-then-use.zero",
    "purchase-change.zero",
    "leftover.positive",
    "identity.positive",
    "groups.exact",
    "groups.partial",
  ])
    assert.ok(edges.has(edge), edge);
  assert.throws(() => generateEqualGroupsProblem("full-kits", ""));
  assert.throws(() => generateEqualGroupsProblem("missing", "seed"));
});
test("array geometry tiles equal squares once and split regions retain the full count", () => {
  for (const rows of [1, 3, 10])
    for (const columns of [1, 5, 10]) {
      const figure = {
        kind: "unit-array" as const,
        rows,
        columns,
        ...(rows > 1 ? { splitAfterRow: rows - 1 } : {}),
      };
      semanticFigureSchema.parse(figure);
      const html = renderToStaticMarkup(
        React.createElement(EqualGroupsFigure, { figure }),
      );
      const cells = [
        ...html.matchAll(
          /<rect data-unit-cell="(\d+)" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g,
        ),
      ];
      assert.equal(cells.length, rows * columns);
      const locations = new Set(cells.map((c) => c[2] + "," + c[3]));
      assert.equal(locations.size, cells.length);
      for (const c of cells)
        assert.equal(c[4], c[5], "One cell must remain square");
      assert.equal((html.match(/>A<\/text>/g) ?? []).length, rows > 1 ? 1 : 0);
      assert.equal((html.match(/>B<\/text>/g) ?? []).length, rows > 1 ? 1 : 0);
    }
});
test("counter boxes preserve exact filled count and equal capacity without printing the quotient", () => {
  for (const groupSize of [2, 5, 8])
    for (const total of [1, groupSize, groupSize + 1, groupSize * 8]) {
      const figure = {
        kind: "grouped-counters" as const,
        total,
        groupSize,
        unit: "items",
      };
      semanticFigureSchema.parse(figure);
      const html = renderToStaticMarkup(
        React.createElement(EqualGroupsFigure, { figure }),
      );
      assert.equal((html.match(/data-filled="yes"/g) ?? []).length, total);
      const slots = Math.ceil(total / groupSize) * groupSize;
      assert.equal((html.match(/data-group-slot=/g) ?? []).length, slots);
      assert.equal(
        (html.match(/data-filled="no"/g) ?? []).length,
        slots - total,
      );
      assert.equal((html.match(/<text/g) ?? []).length, 1);
      assert.match(html, /Filled: items · Outline: empty/);
    }
  for (const invalid of [
    { kind: "unit-array", rows: 2, columns: 3, splitAfterRow: 2 },
    { kind: "unit-array", rows: 2.5, columns: 3 },
    { kind: "grouped-counters", total: 17, groupSize: 2, unit: "items" },
    { kind: "grouped-counters", total: 8, groupSize: 0, unit: "items" },
  ])
    assert.equal(semanticFigureSchema.safeParse(invalid).success, false);
});
