import assert from "node:assert/strict";
import test from "node:test";
import { validateBalanceAlignments } from "../books/balance-and-change/alignments.js";
import { validateEqualGroupsAlignments } from "../books/equal-groups-workshop/alignments.js";
import { validateMeasurementAlignments } from "../books/measure-border-cover/alignments.js";
import { validateNumberAlignments } from "../books/number-builders/alignments.js";
import { validateRatioAlignments } from "../books/in-the-same-proportion/alignments.js";
import { skills, standards } from "../src/curriculum/catalog.js";
import { templates } from "../src/math/engine.js";

for (const [name, validate] of [
  ["algebra", validateBalanceAlignments],
  ["equal groups", validateEqualGroupsAlignments],
  ["measurement", validateMeasurementAlignments],
  ["early number", validateNumberAlignments],
  ["ratio", validateRatioAlignments],
] as const) {
  test(`${name} instruction survives a narrower generated-practice crosswalk`, () => {
    // A practice audit can remove a link without removing the book's
    // explanation or paper task. The book must neither lose that teaching
    // relationship nor put the rejected link back into assessment coverage.
    const practiceSkills = skills.map((skill) => ({
      ...skill,
      alignments: [],
    }));
    const before = structuredClone(practiceSkills);
    assert.doesNotThrow(() => validate(practiceSkills, templates, standards));
    assert.deepEqual(practiceSkills, before);
  });
}
