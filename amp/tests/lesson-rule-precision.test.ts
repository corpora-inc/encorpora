import assert from "node:assert/strict";
import test from "node:test";
import { blocksText } from "../src/content/lesson-text.js";
import { lessonUnits, renderUnit } from "../src/content/lesson-units.js";
import { glossary } from "../src/glossary/index.js";

/** Lesson rules must hold in every case they describe (issue #1781 final
 * sweep): each test pins one rule that once overstated or dropped a case. */
const units = new Map(lessonUnits().map((u) => [u.id, u]));
const unitText = (id: string) => {
  const unit = units.get(id);
  assert.ok(unit, `no lesson unit ${id}`);
  return renderUnit(unit)
    .parts.map((p) => blocksText(p.blocks))
    .join("\n");
};

test("compare with pi one decimal place past the closest choice: four places tie 3.1416", () => {
  const text = unitText("compare-to-pi-select-lesson");
  assert.doesNotMatch(text, /at least four decimal places/);
  assert.match(text, /one more decimal place than the closest choice/);
  // The rule's own example: rounded to four places, pi and 3.1416 tie;
  // written to five places without rounding, they differ.
  assert.equal(Math.PI.toFixed(4), "3.1416");
  assert.ok(Math.trunc(Math.PI * 1e5) / 1e5 < 3.1416);
});

test("a sinusoid's multiplier keeps its sign, and cosine and sine are defined", () => {
  const text = unitText("sinusoid-model");
  assert.doesNotMatch(text, /multiply by \$A\$, and add/);
  assert.doesNotMatch(text, /then multiply and add \$k\$/);
  assert.match(
    text,
    /\$-A\\cos\(Bt\)\+k\$/,
    "the principle names the -A cos form",
  );
  assert.match(text, /Cosine, written cos, is the point's sideways position/);
  // h(t) = -14cos(pi t/4) + 16 at boarding: the sign is what gives 2, not 30.
  assert.equal(-14 * Math.cos(0) + 16, 2);
});

test("matrix multiplication is explained before the inverse uses it", () => {
  const text = unitText("matrix-inverse-determinant");
  const product = text.indexOf("multiply row by column");
  assert.ok(product >= 0);
  assert.ok(product < text.indexOf("times its inverse"));
  // The example entry: row (2, 1) with column (5, 1).
  assert.equal(2 * 5 + 1 * 1, 11);
});

test("comparing degrees does not promise a horizontal asymptote", () => {
  const text = unitText("rational-function-features");
  assert.doesNotMatch(text, /tells where the graph levels off\./);
  assert.doesNotMatch(text, /tells which flat line/);
  assert.match(text, /If the top's degree is larger, there is no such line/);
});

test("eye-height adjustments say what is subtracted from what", () => {
  const text = unitText("trig-context-triangle");
  assert.doesNotMatch(text, /Subtract when the triangle reaches down/);
  assert.match(text, /eye height minus that upright side/);
});

test("rules cover their edge cases: same length, exact hour, digit-sum rules only", () => {
  assert.match(unitText("longer-heavier-holds-more"), /same length/);
  const clock = unitText("clock-minute-match");
  assert.doesNotMatch(clock, /last hour it has passed/);
  assert.match(clock, /points right at a number, that number is the hour/);
  const digits = unitText("divisibility-rules");
  assert.doesNotMatch(
    digits,
    /To find a hidden digit, add the digits you can see\. Then/,
  );
  assert.match(digits, /To find a hidden digit for 3 or 9/);
  assert.doesNotMatch(unitText("number-line-separation"), /0 in the middle/);
});

test("a sign error can leave the middle coefficient unchanged", () => {
  // (x+2)(x-2) and (-x-2)(x-2) both have x coefficient 0.
  const middle = (p: number, q: number, r: number, s: number) => p * s + q * r;
  assert.equal(middle(1, 2, 1, -2), middle(-1, -2, 1, -2));
  assert.match(
    unitText("equivalent-trinomial-select-lesson"),
    /sign error in one factor can change it/,
  );
});

test("matching months do not prove a fixed expense; profit assumes every item made is sold", () => {
  const expense = unitText("fixed-variable-expense-table");
  assert.doesNotMatch(expense, /counts as fixed/);
  assert.doesNotMatch(expense, /the expense is fixed\. If any month/);
  assert.doesNotMatch(expense, /at least two months that differ/);
  assert.match(unitText("profit-cost-breakeven"), /every item made is sold/);
});

test("vector angle rules exclude the zero vector, and the factor card limits 'no remainder' to whole numbers", () => {
  const vectors = unitText("vector-dot-product");
  assert.doesNotMatch(vectors, /\nA zero dot product means/);
  const factor = glossary.find((e) => e.id === "factor-number");
  assert.ok(factor);
  assert.match(factor.plain, /For whole numbers, a factor/);
});
