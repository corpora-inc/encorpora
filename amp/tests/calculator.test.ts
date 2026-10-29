import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculatorAllowed,
  evaluate,
  formatResult,
} from "../src/math/calculator";
import { templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { gradeNumber } from "../src/learning/frontier";

const nodes = new Map(skills.map((s) => [s.id, s]));
function allowed(id: string) {
  const template = templates.find((t) => t.id === id);
  assert(template, `Unknown template: ${id}`);
  const skill = nodes.get(template.skillId);
  assert(skill, `Missing skill for ${id}`);
  // Use the same skill grade as signed-in and trial practice.
  return calculatorAllowed(
    template,
    skill.strand,
    gradeNumber[skill.gradeBand],
  );
}

test("the calculator evaluates SAT-style arithmetic without eval", () => {
  assert.equal(evaluate("(-4)^2 + 6(-4) + 4"), -4);
  assert.equal(evaluate("0.95 × 183"), 173.85);
  assert.equal(evaluate("2 + 3 × 4"), 14);
  assert.equal(evaluate("2^3^2"), 512);
  assert.equal(evaluate("-2^2"), -4);
  assert.equal(evaluate("√(9) + 1"), 4);
  assert.equal(formatResult(evaluate("2π")), "6.283185307");
  assert.equal(evaluate("10 ÷ 4"), 2.5);
  assert.equal(evaluate("3−1"), 2);
  for (const bad of ["2 +", "(1", "1)", "alert(1)", "1 ÷ 0", "2..3"])
    assert.throws(() => evaluate(bad), bad);
});

test("calculator policy: off where computation is the skill, on for SAT-style work", () => {
  for (const id of [
    "multiply-facts",
    "add-fractions",
    "decimal-multiplication",
    "integer-power",
    "operation-order",
    "integer-addition",
    "count-objects",
  ])
    assert.equal(allowed(id), false, id);
  for (const id of [
    "percent-of",
    "function-evaluation",
    "right-triangle",
    "mean-data",
    "linear-equation",
    "quadratic-vertex",
  ])
    assert.equal(allowed(id), true, id);
});

test("applied tasks can use a calculator despite arithmetic strands or younger grades", () => {
  for (const id of [
    "price-count-chain", // Same decimal skill as the protected drills below.
    "budget-category-balance",
    "gross-net-pay",
    "purchase-change", // Grade 3: choose the operations, then compute.
    "whole-pack-ribbon-choice", // Whole packs must still be interpreted.
    "conversion-chain-story", // Grade 4: compose several unit conversions.
    "staar-measure-chains",
    "rectangle-chain-blanks",
    "division-remainder-story", // A decimal quotient is not the answer.
    "signed-changes-sum",
    "share-remainder-fractions",
    "dot-plot-arithmetic",
    "dot-plot-mean",
    "mean-missing-value",
    "dot-plot-mad",
    "dot-plot-iqr",
    "median-data",
    "range-data",
    "interquartile-range-data",
  ])
    assert.equal(allowed(id), true, id);
});

test("applied exceptions do not unlock facts, algorithms, estimation or exact arithmetic", () => {
  for (const id of [
    "multiply-facts",
    "decimal-addition",
    "decimal-multiplication",
    "integer-addition",
    "add-fractions",
    "divide-fractions",
    "fraction-term-chain",
    "decimal-rename-chain",
    "bag-totals-chain",
    "estimate-reasonableness",
    "scientific-to-standard",
    "integer-power",
    "operation-order",
    "simplify-square-root",
    "complete-square-monic",
  ])
    assert.equal(allowed(id), false, id);
});
