import test from "node:test";
import assert from "node:assert/strict";
import { checkTemplate } from "./fixtures/regents-check";
import { templates } from "../src/math/engine";

test("arithmetic distant term", () => {
  checkTemplate("arithmetic-distant-term", {
    variants: [
      "increasing-whole",
      "decreasing-whole",
      "increasing-decimal",
      "decreasing-decimal",
    ],
  });
});
test("geometric signed term", () => {
  checkTemplate("geometric-signed-term", {
    variants: [
      "negative-terms",
      "negative-first-and-ratio",
      "positive-first-negative-ratio",
    ],
    axes: { given: ["listed-terms", "first-and-rule"] },
  });
});
test("registered", () => {
  for (const id of ["arithmetic-distant-term", "geometric-signed-term"])
    assert.ok(templates.some((t) => t.id === id));
});
