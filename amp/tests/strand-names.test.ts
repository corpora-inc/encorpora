import { test } from "node:test";
import assert from "node:assert/strict";
import { templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { strandNames } from "../src/web/BirthYearPrompt";

// The Lessons index, Home frontiers and trial map list only strands named
// here: a template in an unnamed strand cannot be browsed to.
test("every practice template's strand has a display name", () => {
  const nodes = new Map(skills.map((skill) => [skill.id, skill]));
  const unnamed = templates
    .map((t) => `${nodes.get(t.skillId)?.strand ?? "number"}: ${t.id}`)
    .filter((entry) => !(entry.split(":")[0]! in strandNames));
  assert.deepEqual(unnamed, []);
});
