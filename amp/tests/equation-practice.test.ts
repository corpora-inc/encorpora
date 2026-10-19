import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { equationTemplates } from "../src/math/equation-practice";
import { equationWorksheet } from "../src/content/equation-worksheets";
import { Figure } from "../src/web/Figure";

test("equation and inequality items are deterministic, valid and gradable", () => {
  for (const t of equationTemplates)
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(t.id, `eq-${i}`);
      assert.deepEqual(p, generateProblem(t.id, `eq-${i}`));
      assert.deepEqual(generatedProblemSchema.parse(p), p);
      assert.equal(
        gradeAnswer(p, p.answer),
        true,
        `${t.id}: ${p.public.prompt}`,
      );
      if (p.public.response.kind === "choice") {
        assert.equal(p.public.response.options.length, 4);
        for (const o of p.public.response.options)
          if (o.id !== p.answer) assert.equal(gradeAnswer(p, o.id), false);
      }
      if (p.public.figure)
        assert.ok(
          renderToStaticMarkup(
            React.createElement(Figure, { figure: p.public.figure }),
          ).includes("aria-label"),
        );
    }
});

test("balance figures draw a level balance whose block weight is the answer", () => {
  for (const id of ["balance-one-step", "balance-two-step"])
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(id, `balance-${i}`);
      const f = p.public.figure;
      assert.ok(f && f.kind === "balance-scale");
      const x = Number(p.answer);
      assert.equal(f.groups * (f.blocks * x + f.units), f.right);
      const svg = renderToStaticMarkup(
        React.createElement(Figure, { figure: f }),
      );
      assert.equal(
        svg.split('data-x-block="true"').length - 1,
        f.groups * f.blocks,
      );
      assert.equal(
        svg.split('data-cube="true"').length - 1,
        f.groups * f.units + f.right,
      );
    }
});

test("the correct choice is not identifiable by its position", () => {
  for (const t of equationTemplates.filter(
    (t) =>
      t.requiredResponseCapability && t.id !== "inequality-number-line-choice",
  )) {
    const positions = new Set<string>();
    for (let i = 0; i < 80; i++)
      positions.add(generateProblem(t.id, `pos-${i}`).answer);
    assert.equal(positions.size, 4, t.id);
  }
});

test("every worksheet covers the assessed forms in twelve distinct items", () => {
  for (const t of equationTemplates)
    for (const edition of ["1", "2", "3"]) {
      const sheet = equationWorksheet(t.id, t.id, edition);
      assert.equal(sheet.length, 12);
      assert.equal(
        new Set(
          sheet.map((p) => JSON.stringify([p.public.prompt, p.public.figure])),
        ).size,
        12,
      );
    }
});
