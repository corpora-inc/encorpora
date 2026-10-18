import { problemLesson } from "../src/content/problem-lessons";
import test from "node:test";
import assert from "node:assert/strict";
import { templates } from "../src/math/engine";
import {
  teachingMaterial,
  teachingSurface,
} from "../src/server/trial-material";

test("every teaching family supplies four distinct questions separate from worked answers, or declines selection", () => {
  let supported = 0,
    declined = 0;
  for (const template of templates) {
    const material = teachingMaterial(template.id, "distinctness-check");
    if (!material) {
      declined++;
      continue;
    }
    supported++;
    const seen = new Set(
      [material.lesson.example, ...material.examples].map(teachingSurface),
    );
    for (const problem of material.problems) {
      const key = teachingSurface(problem.public);
      assert.equal(seen.has(key), false, template.id);
      seen.add(key);
    }
    assert.equal(material.problems.length, 4);
    const used = material.problems.map((p) => p.public);
    const next = teachingMaterial(template.id, "distinctness-check", used);
    for (const problem of next?.problems ?? []) {
      assert.ok(
        !used.some(
          (old) =>
            teachingSurface(
              problemLesson(old.templateId, old.seed, old.prompt).example,
            ) === teachingSurface(problem.public),
        ),
        template.id,
      );
      assert.ok(
        !used.some(
          (old) => teachingSurface(old) === teachingSurface(problem.public),
        ),
        template.id,
      );
    }
  }
  assert.ok(supported > 100, "visited the actual catalog");
  assert.ok(declined > 0, "finite families exercise fallback selection");
});

test("surface matching ignores JSONB object-key order", () => {
  assert.equal(
    teachingSurface({
      prompt: "Count",
      figure: { kind: "counters", count: 3 },
    }),
    teachingSurface({
      prompt: "Count",
      figure: { count: 3, kind: "counters" },
    }),
  );
});
