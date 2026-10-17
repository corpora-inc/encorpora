import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculatorAllowed,
  evaluate,
  formatResult,
} from "../src/math/calculator";
import { templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { templateGrade } from "../src/server/mixed-practice";

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
  const nodes = new Map(skills.map((s) => [s.id, s]));
  const allowed = (id: string) => {
    const t = templates.find((x) => x.id === id)!;
    return calculatorAllowed(
      t,
      nodes.get(t.skillId)?.strand,
      templateGrade(t, nodes),
    );
  };
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
