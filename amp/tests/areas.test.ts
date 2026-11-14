import assert from "node:assert/strict";
import test from "node:test";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import {
  ACROSS_AREAS,
  areaIds,
  areaOf,
  areas,
  crossCuttingAreas,
  crossCuttingStrands,
  byArea,
  easiestFirst,
  strandAreas,
} from "../src/curriculum/areas";
import { skillDifficulty } from "../src/learning/item-calibration";

test("the five areas, in the founder's order", () => {
  assert.deepEqual(
    areas.map((area) => area.title),
    [
      "Number & operations",
      "Algebra",
      "Geometry",
      "Measurement",
      "Data & probability",
    ],
  );
});

test("every skill in the catalogue resolves to exactly one of the five areas", () => {
  for (const skill of skills) {
    const area = areaOf(skill);
    assert(areaIds.includes(area), `${skill.id}: ${area}`);
    // One source: a strand's own area, or a reviewed row, never both.
    const sources = [
      strandAreas[skill.strand],
      crossCuttingAreas[skill.id],
    ].filter(Boolean);
    assert.equal(sources.length, 1, `${skill.id} has ${sources.length}`);
  }
});

test("modeling and reasoning are not areas: each of their skills is reviewed", () => {
  for (const strand of crossCuttingStrands)
    assert.equal(strandAreas[strand], undefined, strand);
  const crossCutting = skills.filter((skill) =>
    (crossCuttingStrands as readonly string[]).includes(skill.strand),
  );
  assert.deepEqual(
    crossCutting.map((skill) => skill.id).sort(),
    Object.keys(crossCuttingAreas).sort(),
    "the reviewed table lists exactly the modeling and reasoning skills",
  );
  assert.throws(() => areaOf({ id: "unreviewed", strand: "modeling" }));
});

test("no skill comes before a prerequisite in the same grade and area", () => {
  const nodes = new Map(skills.map((skill) => [skill.id, skill]));
  const difficulty = (skill: (typeof skills)[number]) =>
    skillDifficulty(skill.id, templates, nodes) ?? Infinity;
  // Everything a skill builds on, through any area or grade.
  const ancestors = (id: string, found = new Set<string>()) => {
    for (const parent of nodes.get(id)?.prerequisites ?? [])
      if (!found.has(parent)) {
        found.add(parent);
        ancestors(parent, found);
      }
    return found;
  };
  let groups = 0;
  for (const band of new Set(skills.map((skill) => skill.gradeBand)))
    for (const area of areaIds) {
      const list = skills.filter(
        (skill) => skill.gradeBand === band && areaOf(skill) === area,
      );
      if (!list.length) continue;
      groups++;
      const ordered = easiestFirst(list, skills, difficulty);
      assert.deepEqual(
        ordered.map((skill) => skill.id).sort(),
        list.map((skill) => skill.id).sort(),
      );
      ordered.forEach((skill, i) => {
        const before = ancestors(skill.id);
        for (const later of ordered.slice(i + 1))
          assert(
            !before.has(later.id),
            `${band} ${area}: ${skill.id} is listed before ${later.id}, which it builds on`,
          );
      });
    }
  assert(groups > 40);
});

test("every skill has a difficulty on the engine's scale", () => {
  const nodes = new Map(skills.map((skill) => [skill.id, skill]));
  for (const skill of skills) {
    const value = skillDifficulty(skill.id, templates, nodes);
    assert(Number.isFinite(value), skill.id);
  }
});

test("level rows: strands under their areas, families never see modeling or reasoning", () => {
  const rows = [
    "modeling",
    "probability",
    "measurement",
    "fractions",
    "ratio",
    "number",
    "reasoning",
    "algebra",
  ].map((id) => ({ id }));
  const family = byArea(rows);
  assert.deepEqual(
    family.map((row) => [row.id, row.heading ?? "", !!row.nested]),
    [
      ["number", "Number & operations", true],
      ["fractions", "", true],
      ["algebra", "Algebra", true],
      ["ratio", "", true],
      // An area whose one row is its namesake needs no heading over it.
      ["measurement", "", false],
      ["probability", "Data & probability", true],
    ],
  );
  const teacher = byArea(rows, { crossCutting: true });
  assert.deepEqual(
    teacher.slice(-2).map((row) => [row.id, row.heading ?? ""]),
    [
      ["modeling", ACROSS_AREAS],
      ["reasoning", ""],
    ],
  );
});
