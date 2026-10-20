import { test } from "node:test";
import assert from "node:assert/strict";
import { templates } from "../src/math/engine";
import { guessChanceOf } from "../src/math/guess-chance";
import { clientCanDraw, figureCapabilities } from "../src/math/contracts";
import type { OpenerSlots } from "../src/learning/placement";
import {
  paired,
  simulatePlacement,
  type Run,
} from "./placement-simulation.fixture";

// `npm run test:placement-sim`. Scene-capable openers against the
// capability-free table they replaced, on the same synthetic learners.

/** The opener table before openers could need a figure capability (#1218):
 * no geometry below grade 4 or in grades 5–7, no data in grades 1, 2, 4, 5
 * and 8, no fractions in grades 1–3. The bar the current table must clear. */
const capabilityFreeOpeners: OpenerSlots = [
  // K (and younger): count or compare numerals, join, compare lengths,
  // weights or capacity, take away.
  [
    [
      "count-objects",
      "teen-frame-compose",
      "greater-numeral",
      "numeral-for-quantity",
      "count-sequence-missing",
    ],
    ["join-within-10", "facts-to-five"],
    ["compare-lengths", "compare-weights", "compare-capacity"],
    ["take-away-within-10", "ten-frame-complement", "number-bond-missing"],
  ],
  // Grade 1: counting, facts within 10, a missing addend, then a clock or a
  // length.
  [
    ["count-objects", "teen-frame-compose"],
    ["join-within-10", "add-within-20", "count-on-back"],
    ["unknown-addend-story", "balanced-addition"],
    [
      "clock-hour-read",
      "read-clock-hour-half",
      "match-clock-half-hour",
      "measure-with-units",
      "compare-lengths",
    ],
  ],
  // Grade 2: facts within 20 or two-digit sums and differences, place value
  // and comparison, a missing addend, then coins or a clock.
  [
    [
      "add-within-20",
      "make-ten-fact",
      "add-two-digit-regroup",
      "subtract-within-20",
      "related-subtraction",
      "subtract-two-digit-regroup",
    ],
    [
      "tens-ones-model",
      "continue-count-to-120",
      "compare-two-digit",
      "compare-three-digit",
    ],
    ["unknown-addend-story", "balanced-addition"],
    [
      "coin-total",
      "pay-exact-coins",
      "minutes-past-hour",
      "read-clock-five-minutes",
      "match-clock-five-minutes",
    ],
  ],
  // Grade 3: regrouping or tens products, three-digit place value, a story,
  // a bar chart.
  [
    [
      "add-with-regrouping",
      "add-two-digit-regroup",
      "add-three-digit",
      "mental-ten-hundred",
      "multiply-by-tens",
    ],
    [
      "place-value-digit",
      "hundreds-model",
      "compare-three-digit",
      "round-to-ten",
      "round-to-hundred",
    ],
    ["two-step-change", "delivery-then-use"],
    ["bar-chart-total", "bar-chart-difference"],
  ],
  // Grade 4: multiplication facts, fractions of a whole, area, division.
  [
    [
      "multiply-facts",
      "add-multidigit",
      "multiply-by-tens",
      "multiply-by-one-digit",
    ],
    [
      "fraction-model",
      "fraction-unit-count",
      "compare-like-denominators",
      "compare-like-numerators",
    ],
    ["rectangle-area"],
    ["divide-facts", "share-or-group", "divide-by-one-digit"],
  ],
  // Grade 5: decimals (grade 4 tenths and hundredths), fractions, factors or
  // place value, multidigit multiplication or division.
  [
    ["compare-decimals-hundredths", "decimal-grid-read"],
    [
      "compare-fractions",
      "compare-unlike-fractions",
      "equivalent-numerator",
      "whole-times-fraction",
    ],
    [
      "factor-partner",
      "multidigit-digit-value",
      "compare-multidigit",
      "multiply-power-of-ten",
    ],
    ["multiply-by-one-digit", "multiply-multidigit", "divide-by-one-digit"],
  ],
  // Grade 6: decimals, expressions and equations, fractions, the mean.
  [
    [
      "decimal-addition",
      "decimal-multiplication",
      "compare-decimals-thousandths",
    ],
    [
      "operation-order",
      "integer-power",
      "one-step-equation",
      "dependent-variable-value",
    ],
    ["multiply-fractions", "fraction-of-quantity", "add-fractions"],
    ["mean-data", "mean-missing-value"],
  ],
  // Grade 7: powers and equations, unit rates, the mean or a sample estimate, distance on a number line.
  [
    ["integer-power", "two-step-equation", "dependent-variable-value"],
    ["unit-price", "fraction-unit-rate", "unit-rate"],
    ["mean-data", "mean-missing-value", "sample-proportion-estimate"],
    ["number-line-distance", "opposite-on-line", "greatest-common-factor"],
  ],
  // Grade 8: signed and real numbers, unit rates, probability and circles.
  [
    ["integer-addition", "root-between-integers", "scientific-to-standard"],
    ["unit-price", "fraction-unit-rate"],
    ["simple-probability"],
    [
      "circle-area-coefficient",
      "circle-circumference-coefficient",
      "coordinate-distance",
      "triangle-angle-sum",
      "angle-pair-measure",
      "cylinder-volume",
    ],
  ],
  // High school: an equation or formula, the Pythagorean theorem, a linear
  // model, then a function's value or average rate of change (Algebra 1).
  [
    [
      "linear-equation",
      "both-sides-linear-equation",
      "formula-value",
      "line-slope",
    ],
    ["right-triangle"],
    ["linear-model-value"],
    ["average-rate-formula", "function-evaluation"],
  ],
];

const allFigures = [...figureCapabilities];
const clients = {
  current: {
    responseCapabilities: ["single-choice-v1"],
    figureCapabilities: allFigures,
  },
  "no scenes": {
    responseCapabilities: ["single-choice-v1"],
    figureCapabilities: allFigures.filter((c) => c !== "scenes-v1"),
  },
};

test("simulated placement: scene openers place no worse or slower, with or without scenes", (t) => {
  const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
  for (const [name, client] of Object.entries(clients)) {
    const catalog = templates.filter((template) =>
      clientCanDraw(template, client),
    );
    const before = simulatePlacement({
      catalog,
      guessOf: guessChanceOf,
      seeds,
      openers: capabilityFreeOpeners,
    });
    const after = simulatePlacement({ catalog, guessOf: guessChanceOf, seeds });
    const compare = (pick: (run: Run) => number | null) =>
      paired(before.runs, after.runs, pick);
    const overall = compare((run) => run.overallError);
    const strand = compare((run) => run.strandError);
    const worst = compare((run) => run.worstOverestimate);
    const toPlace = compare((run) => run.toPlace);
    for (const [label, { runs: _runs, ...means }] of Object.entries({
      before,
      after,
    }))
      t.diagnostic(`${name} ${label} ${JSON.stringify(means)}`);
    t.diagnostic(
      `${name} after − before: ${JSON.stringify({ overall, strand, worst, toPlace })}`,
    );
    assert.ok(overall.noWorse, `${name} ${JSON.stringify(overall)}`);
    assert.ok(strand.noWorse, `${name} ${JSON.stringify(strand)}`);
    assert.ok(worst.noWorse, `${name} ${JSON.stringify(worst)}`);
    assert.ok(toPlace.noWorse, `${name} ${JSON.stringify(toPlace)}`);
  }
});
