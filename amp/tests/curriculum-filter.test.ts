import assert from "node:assert/strict";
import { test } from "node:test";
import { focusFilter } from "../src/web/features/practice/curriculum-filter";
const catalog = {
  skills: [
    { id: "divide", strand: "operations" },
    { id: "triangles", strand: "geometry" },
  ],
  templates: [
    { id: "divide-by-one-digit", skillId: "divide" },
    { id: "triangle-area", skillId: "triangles" },
  ],
};
test("a problem type carries its actual skill, while a skill leaves the whole skill available", () => {
  assert.deepEqual(focusFilter({ template: "divide-by-one-digit" }, catalog), {
    skill: "divide",
    template: "divide-by-one-digit",
  });
  assert.deepEqual(focusFilter({ skill: "divide" }, catalog), {
    skill: "divide",
  });
  assert.deepEqual(focusFilter({ strand: "geometry" }, catalog), {
    strand: "geometry",
  });
});
test("a mismatched or unknown practice focus cannot silently start a different focused series", () => {
  for (const focus of [
    { skill: "triangles", template: "divide-by-one-digit" },
    { skill: "missing" },
    { template: "missing" },
    { strand: "missing" },
  ])
    assert.deepEqual(focusFilter(focus, catalog), {});
});
