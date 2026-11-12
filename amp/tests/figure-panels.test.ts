import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import { panelChoice } from "../src/math/figure-panels";
import type { PublicProblem } from "../src/math/contracts";

/** The single choices whose options are the lettered panels of their own
 * figure, so the screen lets the learner tap the panels (FigurePanelChoice).
 * Each figure kind here marks its panels for the screen to find. */
const panelTemplates = {
  "classify-triangle-by-sides": "Triangle",
  "find-named-shape": "Shape",
  "polygon-with-angles": "Shape",
  "find-quadrilateral": "Shape",
  "complete-the-shape": "Piece",
  "coin-name-and-cent-value": "Set",
  "clock-minute-match": "Clock",
  "match-clock-half-hour": "Clock",
  "match-clock-five-minutes": "Clock",
  "compare-money-sets": "Set",
  "pay-exact-coins": "Set",
  "find-equal-shares": "Shape",
  "find-equal-thirds": "Shape",
  "correct-unit-measure": "Picture",
  "inequality-number-line-choice": "Number line",
} as const;

test("lettered figure panels are the choices, one to one", () => {
  for (const [id, noun] of Object.entries(panelTemplates)) {
    let found = 0;
    for (let i = 0; i < 40; i++) {
      const p = generateProblem(id, `panels-${i}`);
      const choice = panelChoice(p.public);
      if (!choice) continue;
      found++;
      assert.equal(choice.noun, noun, id);
      const r = p.public.response;
      assert.equal(r.kind, "choice");
      if (r.kind !== "choice") continue;
      // Every option, in order, with the response's own ids: the answer
      // and grading never change.
      assert.deepEqual(
        choice.options.map((o) => o.id),
        r.options.map((o) => o.id),
        id,
      );
      assert.ok(
        choice.options.some((o) => o.id === p.answer),
        `${id}: the answer is a panel`,
      );
      for (const o of choice.options)
        assert.equal(o.label, `${noun} ${o.letter}`, id);
    }
    assert.ok(found > 0, `${id}: no panel choice in 40 seeds`);
  }
});

test("other choices keep their list", () => {
  const base = generateProblem("find-named-shape", "panels-0").public;
  assert.ok(panelChoice(base));
  const relabel = (labels: string[], figure = base.figure): PublicProblem => ({
    ...base,
    figure,
    response: {
      kind: "choice",
      label: "Choose one answer",
      options: labels.map((label, i) => ({ id: `option-${"abcd"[i]}`, label })),
    },
  });
  // Statements, a letter missing from the figure, two nouns, a repeated
  // letter, no figure.
  assert.equal(panelChoice(relabel(["3", "4", "5", "6"])), null);
  assert.equal(panelChoice(relabel(["A", "B", "C", "E"])), null);
  assert.equal(
    panelChoice(relabel(["Shape A", "Shape B", "Figure C", "Shape D"])),
    null,
  );
  assert.equal(panelChoice(relabel(["A", "B", "C", "C"])), null);
  assert.equal(panelChoice(relabel(["A", "B", "C"])), null);
  const { figure: _figure, ...unfigured } = relabel(["A", "B", "C", "D"]);
  assert.equal(panelChoice(unfigured), null);
  // Letters that name points on one number line are not panels.
  for (let i = 0; i < 20; i++) {
    const p = generateProblem("probability-on-number-line", `panels-${i}`);
    assert.equal(panelChoice(p.public), null);
  }
});
