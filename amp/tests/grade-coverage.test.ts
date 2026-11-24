import assert from "node:assert/strict";
import test from "node:test";
import { skills } from "../src/curriculum/catalog";
import {
  coverageArea,
  gradeCoverage,
  type CoverageRules,
  type CoverageSkill,
} from "../src/learning/coverage";
import { gradeNumber } from "../src/learning/frontier";
import { DEFAULT_PRACTICE_POLICY } from "../src/learning/practice-policy";
import { templates } from "../src/math/engine";

/* The rule a parent is told: a grade is covered when the child has earned
   twelve of its skills (or harder ones) in at least three areas, and practice
   reaches one grade past the highest covered grade. */

const rules: CoverageRules = {
  skills: 4,
  areas: 3,
  step: 1,
  probeRise: 1,
};
const areas = ["number", "algebra", "geometry", "measurement", "data"];
/** Six skills a grade from grade 2 to grade 6, spread over the five areas;
 * grade 6 has only two areas. */
const catalog: CoverageSkill[] = [2, 3, 4, 5, 6].flatMap((grade) =>
  Array.from({ length: 6 }, (_, i) => ({
    id: `g${grade}-${i}`,
    grade,
    area: grade === 6 ? areas[i % 2]! : areas[i % 5]!,
  })),
);
const earned = (...ids: string[]) =>
  ids.map((skillId) => ({ skillId, independentCorrect: 1 }));
const cover = (
  evidence: { skillId: string; independentCorrect?: number }[],
  start = 3,
  own: Partial<CoverageRules> = {},
) =>
  gradeCoverage({
    start,
    skills: catalog,
    evidence,
    rules: { ...rules, ...own },
  });

test("a grade is covered by enough earned skills in enough areas, and practice reaches one grade past it", () => {
  const cases: {
    name: string;
    evidence: { skillId: string; independentCorrect?: number }[];
    covered: number | null;
    ceiling: number;
  }[] = [
    { name: "nothing earned", evidence: [], covered: null, ceiling: 3 },
    {
      name: "three skills: one short",
      evidence: earned("g3-0", "g3-1", "g3-2"),
      covered: null,
      ceiling: 3,
    },
    {
      name: "four skills in three areas",
      evidence: earned("g3-0", "g3-1", "g3-2", "g3-5"),
      covered: 3,
      ceiling: 4,
    },
    {
      name: "four skills in two areas: not broad",
      evidence: earned("g3-0", "g3-5", "g4-0", "g4-5"),
      covered: null,
      ceiling: 3,
    },
    {
      name: "last year's skills do not cover this year",
      evidence: earned("g2-0", "g2-1", "g2-2", "g2-3", "g2-4", "g2-5"),
      covered: null,
      ceiling: 3,
    },
    {
      name: "tried or helped, never right alone: not earned",
      evidence: ["g3-0", "g3-1", "g3-2", "g3-3"].map((skillId) => ({
        skillId,
        independentCorrect: 0,
      })),
      covered: null,
      ceiling: 3,
    },
    {
      name: "harder skills count toward the grade below",
      evidence: earned("g3-0", "g4-1", "g4-2", "g4-3"),
      covered: 3,
      ceiling: 4,
    },
    {
      name: "the next grade covered too",
      evidence: earned("g3-0", "g4-0", "g4-1", "g4-2", "g4-3"),
      covered: 4,
      ceiling: 5,
    },
    {
      name: "the highest covered grade counts, whatever lies between",
      evidence: earned("g5-0", "g5-1", "g5-2", "g5-3"),
      covered: 5,
      ceiling: 6,
    },
    {
      name: "a grade with two areas needs only those two",
      evidence: earned("g6-0", "g6-1", "g6-2", "g6-3"),
      covered: 6,
      ceiling: 7,
    },
    {
      name: "a skill outside the catalog counts for nothing",
      evidence: earned("g3-0", "g3-1", "g3-2", "retired-skill"),
      covered: null,
      ceiling: 3,
    },
  ];
  for (const { name, evidence, covered, ceiling } of cases)
    assert.deepEqual(cover(evidence), { covered, ceiling }, name);
});

test("coverage counts from the starting grade: the grades below it never raise the ceiling", () => {
  const all = earned(...catalog.map((skill) => skill.id));
  assert.deepEqual(cover([], 5), { covered: null, ceiling: 5 });
  assert.deepEqual(cover(earned("g3-0", "g3-1", "g3-2", "g3-5"), 5), {
    covered: null,
    ceiling: 5,
  });
  assert.deepEqual(cover(all, 5), { covered: 6, ceiling: 7 });
  // Past the catalog there is nothing to cover.
  assert.deepEqual(cover(all, 7), { covered: null, ceiling: 7 });
});

test("the step and the counts are the policy's", () => {
  const evidence = earned("g3-0", "g3-1", "g3-2", "g3-5");
  assert.equal(cover(evidence, 3, { step: 2 }).ceiling, 5);
  assert.equal(cover(evidence, 3, { skills: 5 }).covered, null);
  assert.equal(cover(evidence, 3, { areas: 4 }).covered, null);
  assert.equal(cover(evidence, 3, { areas: 1 }).covered, 3);
});

test("a skill's area is its strand's, its reviewed one, or the strand itself", () => {
  assert.equal(coverageArea({ id: "x", strand: "fractions" }), "number");
  assert.equal(coverageArea({ id: "x", strand: "probability" }), "data");
  assert.equal(
    coverageArea({ id: "geometric-proof", strand: "reasoning" }),
    "geometry",
  );
  assert.equal(coverageArea({ id: "x", strand: "made-up" }), "made-up");
});

test("no grade of the catalog can hold a learner: each can be covered from the problems its ceiling allows", () => {
  const { coverage } = DEFAULT_PRACTICE_POLICY;
  assert.equal(coverage.enabled, true);
  const asked = new Set(templates.map((template) => template.skillId));
  const real = skills
    .filter((skill) => asked.has(skill.id))
    .map((skill) => ({
      id: skill.id,
      grade: gradeNumber[skill.gradeBand],
      area: coverageArea(skill),
    }));
  for (let grade = 0; grade <= 12; grade++) {
    // While a grade is the ceiling, working problems are of that grade and a
    // stretch problem of the next: those are the skills that can be earned.
    const reachable = real.filter(
      (skill) =>
        skill.grade >= grade && skill.grade <= grade + coverage.probeRise,
    );
    const own = new Set(
      real.filter((skill) => skill.grade === grade).map((skill) => skill.area),
    );
    assert.ok(own.size > 0, `grade ${grade} has skills`);
    assert.ok(
      reachable.length >= coverage.skills,
      `grade ${grade}: ${reachable.length} skills in reach`,
    );
    assert.ok(
      new Set(reachable.map((skill) => skill.area)).size >=
        Math.min(coverage.areas, own.size),
      `grade ${grade}: areas in reach`,
    );
    const done = gradeCoverage({
      start: grade,
      skills: real,
      evidence: reachable.map((skill) => ({
        skillId: skill.id,
        independentCorrect: 1,
      })),
      rules: coverage,
    });
    assert.ok(
      done.covered !== null && done.covered >= grade,
      `grade ${grade} is covered by its reachable skills`,
    );
  }
});
