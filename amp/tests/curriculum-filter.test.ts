import assert from "node:assert/strict";
import { test } from "node:test";
import { curriculumFilter } from "../src/web/features/practice/curriculum-filter";
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
  assert.deepEqual(curriculumFilter("?template=divide-by-one-digit", catalog), {
    skill: "divide",
    template: "divide-by-one-digit",
  });
  assert.deepEqual(curriculumFilter("?skill=divide", catalog), {
    skill: "divide",
  });
  assert.deepEqual(curriculumFilter("?strand=geometry", catalog), {
    strand: "geometry",
  });
});
test("a mismatched or unknown curriculum link cannot silently start a different focused series", () => {
  for (const search of [
    "?skill=triangles&template=divide-by-one-digit",
    "?skill=missing",
    "?template=missing",
    "?strand=missing",
  ])
    assert.deepEqual(curriculumFilter(search, catalog), {});
});
