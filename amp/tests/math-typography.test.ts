import { test } from "node:test";
import assert from "node:assert/strict";
import { corpusIssues, typographyIssues } from "./fixtures/math-typography";
import { generateProblem } from "../src/math/engine";
import { pending } from "./fixtures/math-typography-pending";

// Every symbol, variable, expression and equation a learner reads is typeset
// as math (src/content/AGENTS.md, "Mathematical typography").
const rules = (text: string, context = {}, plain = false) => [
  ...new Set(typographyIssues(text, context, plain).map((i) => i.rule)),
];

test("the gate catches the circle problem the founder saw", () => {
  const prompt =
    "A circle has a diameter of 10 cm. Its circumference is $a\\pi$ cm. What is a?";
  assert.deepEqual(rules(prompt), ["bare lowercase letter"]);
  // The label names no math of its own; the problem's prompt does.
  assert.deepEqual(rules("Exact coefficient a", { variables: new Set("a") }), [
    "bare lowercase letter",
  ]);
  assert.deepEqual(
    rules(
      "Circumference = π × diameter. The coefficient a is the number multiplying pi.",
      { variables: new Set("a") },
    ),
    ["the word pi", "π outside math", "bare lowercase letter"],
  );
  for (const text of [
    "ask only for a.",
    "Write C for circumference.",
    "the diameter d",
    "the sector area as S.",
    "and write L for arc length.",
  ])
    assert.ok(rules(text, { variables: new Set("a") }).length, text);
});

test("the fixed circle problem passes", () => {
  const p = generateProblem("circle-circumference-coefficient", "founder");
  for (const text of [p.public.prompt, p.public.response.label, p.hint])
    assert.deepEqual(rules(text, { variables: new Set("a") }), [], text);
});

test("the gate accepts ordinary prose", () => {
  const variables = new Set(["a", "A", "x"]);
  for (const text of [
    "A circle has a radius of 3 cm.",
    "What is a fraction? It names a part of a whole.",
    "I think the answer is a whole number.",
    "Is Store A or Store B the better buy? Store A sells a pack of 6.",
    "Shapes A and B have four sides. Choice C is a triangle.",
    "A rectangle 8 m wide has an L-shaped notch; an L- or T-shaped face.",
    "The ratio $\\pi$ (pi) compares circumference to diameter.",
    "Divide by 2: $r = 12 \\div 2 = 6$ cm, so $a = 10$, e.g. a radius.",
    // Both typesetters set a plain formula with an operation as math.
    "Divide by 2: r = 12 ÷ 2 = 6 cm.",
  ])
    assert.deepEqual(rules(text, { variables }), [], text);
});

test("the gate flags each kind of bare mathematics", () => {
  const cases: [string, string][] = [
    ["Keep pi exact.", "the word pi"],
    ["Pi is about 3.14.", "the word pi"],
    ["The area is 9π square centimeters.", "π outside math"],
    ["Point P is 3 right.", "bare uppercase letter"],
    ["the x-axis", "bare lowercase letter"],
    ["Find k.", "bare lowercase letter"],
    ["What is $a\\pi$? Find a", "bare lowercase letter"],
  ];
  for (const [text, rule] of cases)
    assert.ok(rules(text).includes(rule), `${text} → ${rule}`);
  assert.ok(rules("Find $x$", {}, true).includes("TeX in a plain-text title"));
  assert.ok(rules("Keep π exact", {}, true).includes("π outside math"));
});

test("learner text typesets every symbol, variable and formula", () => {
  const issues = corpusIssues();
  const unexpected = [...issues]
    .filter(([owner]) => !pending.has(owner))
    .map(([owner, list]) => `## ${owner}\n${list.slice(0, 6).join("\n")}`);
  assert.deepEqual(
    unexpected,
    [],
    "Wrap each variable in $…$, write $\\pi$ for pi, and keep titles free of math (src/content/AGENTS.md)",
  );
  // The pending list only shrinks: remove each owner once it passes.
  const clean = [...pending].filter((owner) => !issues.has(owner));
  assert.deepEqual(clean, [], "Remove these from math-typography-pending.ts");
});
