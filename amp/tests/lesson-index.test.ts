import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { templates } from "../src/math/engine";
import { buildLessonIndex } from "../src/content/lesson-index-build";

const committed = readFileSync(
  new URL("../src/web/features/pathways/lesson-index.json", import.meta.url),
  "utf8",
);

test("the lesson layer's index matches the engine's problem types", () => {
  // Compared as data, so a formatter's line breaks never fail it.
  assert.deepEqual(
    Object.entries(JSON.parse(committed)),
    Object.entries(buildLessonIndex()),
    "src/web/features/pathways/lesson-index.json is out of date: run `npm run build:lesson-index` in amp/ and commit it.",
  );
});

test("every problem type is in it once, with its title and skill", () => {
  const index = JSON.parse(committed) as Record<string, [string, string]>;
  assert.equal(Object.keys(index).length, templates.length);
  for (const type of templates)
    assert.deepEqual(index[type.id], [type.title, type.skillId], type.id);
});
