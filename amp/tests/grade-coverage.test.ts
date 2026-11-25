import assert from "node:assert/strict";
import test from "node:test";
import { skills } from "../src/curriculum/catalog";
import {
  coverageArea,
  coverageNeed,
  gradeCoverage,
  type CoverageRules,
  type CoverageSkill,
} from "../src/learning/coverage";
import { gradeNumber } from "../src/learning/frontier";
import { DEFAULT_PRACTICE_POLICY } from "../src/learning/practice-policy";
import { templates } from "../src/math/engine";

/* The rule a parent is told: a grade is covered when the child has earned
   half of its skills, or as many harder ones, in at least three areas, and
   practice reaches one grade past the highest covered grade. */

const rules: CoverageRules = {
  share: 0.5,
  skills: 2,
  areas: 3,
  step: 1,
  probeRise: 1,
};
const areas = ["number", "algebra", "geometry", "measurement", "data"];
/** Eight skills a grade from grade 2 to grade 5, spread over the five areas;
 * grade 6 has four skills in two areas. Half of a grade is four, of grade 6
 * two. */
const catalog: CoverageSkill[] = [
  ...[2, 3, 4, 5].flatMap((grade) =>
    Array.from({ length: 8 }, (_, i) => ({
      id: `g${grade}-${i}`,
      grade,
      area: areas[i % 5]!,
    })),
  ),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `g6-${i}`,
    grade: 6,
    area: areas[i % 2]!,
  })),
];
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

test("a grade is covered by half its skills, or as many harder ones, in enough areas", () => {
  const cases: {
    name: string;
    evidence: { skillId: string; independentCorrect?: number }[];
    covered: number | null;
    ceiling: number;
  }[] = [
    { name: "nothing earned", evidence: [], covered: null, ceiling: 3 },
    {
      name: "three of the grade's eight: one short of half",
      evidence: earned("g3-0", "g3-1", "g3-2"),
      covered: null,
      ceiling: 3,
    },
    {
      name: "half the grade, in three areas",
      evidence: earned("g3-0", "g3-1", "g3-2", "g3-5"),
      covered: 3,
      ceiling: 4,
    },
    {
      name: "half the grade, in two areas: not broad",
      evidence: earned("g3-0", "g3-5", "g3-1", "g3-6"),
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
      name: "a stretch does not make the grade cheaper: three of its own and three harder is neither",
      evidence: earned("g3-0", "g3-1", "g3-2", "g4-0", "g4-1", "g4-2"),
      covered: null,
      ceiling: 3,
    },
    {
      name: "as many harder skills as half the grade cover it without any of its own",
      evidence: earned("g4-0", "g4-1", "g4-2", "g5-3"),
      covered: 3,
      ceiling: 4,
    },
    {
      name: "harder skills in two areas: not broad",
      evidence: earned("g4-0", "g4-5", "g4-1", "g4-6"),
      covered: null,
      ceiling: 3,
    },
    {
      name: "the grade and the next, each by its own half",
      evidence: earned(
        "g3-0",
        "g3-1",
        "g3-2",
        "g3-3",
        "g4-0",
        "g4-1",
        "g4-2",
        "g4-3",
      ),
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
      name: "a grade with two areas needs only those two, and half of its four skills",
      evidence: earned("g6-0", "g6-1"),
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

test("the bar is a share of the grade's own list, never below the floor", () => {
  const cases: [size: number, share: number, floor: number, need: number][] = [
    [17, 0.5, 8, 9],
    [27, 0.5, 8, 14],
    [39, 0.5, 8, 20],
    [18, 0.5, 8, 9],
    [10, 0.5, 8, 8],
    [4, 0.5, 8, 8],
    [27, 1 / 3, 8, 9],
    [27, 2 / 3, 8, 18],
    [27, 0, 12, 12],
  ];
  for (const [size, share, floor, need] of cases)
    assert.equal(
      coverageNeed(size, { share, skills: floor }),
      need,
      `${size} skills at ${share}, floor ${floor}`,
    );
  const evidence = earned("g3-0", "g3-1", "g3-2", "g3-5");
  assert.equal(cover(evidence, 3, { step: 2 }).ceiling, 5);
  assert.equal(cover(evidence, 3, { share: 0.75 }).covered, null);
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

const asked = new Set(templates.map((template) => template.skillId));
const real = skills
  .filter((skill) => asked.has(skill.id))
  .map((skill) => ({
    id: skill.id,
    grade: gradeNumber[skill.gradeBand],
    area: coverageArea(skill),
  }));

test("the bar for each grade of the catalog: half its skills", () => {
  const { coverage } = DEFAULT_PRACTICE_POLICY;
  assert.deepEqual(
    { ...coverage },
    {
      enabled: true,
      share: 0.5,
      skills: 8,
      areas: 3,
      step: 1,
      probeRise: 1,
    },
  );
  // [skills the grade has, skills that cover it, areas they must span].
  const expected: [size: number, need: number, areas: number][] = [
    [17, 9, 3], // K
    [18, 9, 3],
    [22, 11, 3],
    [27, 14, 3],
    [23, 12, 3],
    [18, 9, 3],
    [27, 14, 3],
    [22, 11, 3],
    [20, 10, 3],
    [32, 16, 3], // Algebra 1
    [39, 20, 2], // Geometry: geometry, and data and probability
    [36, 18, 3], // Algebra 2
    [35, 18, 3], // Precalculus
  ];
  expected.forEach(([size, need, broad], grade) => {
    const own = real.filter((skill) => skill.grade === grade);
    assert.equal(own.length, size, `grade ${grade} size`);
    assert.equal(coverageNeed(own.length, coverage), need, `grade ${grade}`);
    assert.equal(
      Math.min(coverage.areas, new Set(own.map((skill) => skill.area)).size),
      broad,
      `grade ${grade} areas`,
    );
  });
});

test("no grade of the catalog can hold a learner: each is covered by half of its own skills", () => {
  const { coverage } = DEFAULT_PRACTICE_POLICY;
  for (let grade = 0; grade <= 12; grade++) {
    const own = real.filter((skill) => skill.grade === grade);
    const need = coverageNeed(own.length, coverage);
    assert.ok(need <= own.length, `grade ${grade}: ${need} of ${own.length}`);
    // The half that is hardest to make broad: one area at a time, largest
    // first. Even that half spans the areas the grade asks for, once the
    // learner has also met one skill from each smaller area, which the mix
    // of areas in practice provides.
    const byArea = new Map<string, typeof own>();
    for (const skill of own)
      byArea.set(skill.area, [...(byArea.get(skill.area) ?? []), skill]);
    const broad = Math.min(coverage.areas, byArea.size);
    const lists = [...byArea.values()].sort((a, b) => a.length - b.length);
    // One skill from each of the smallest areas, the rest from anywhere.
    const picked = lists.slice(0, broad).map((list) => list[0]!);
    for (const skill of own)
      if (picked.length < need && !picked.includes(skill)) picked.push(skill);
    assert.equal(picked.length, need, `grade ${grade}`);
    const done = gradeCoverage({
      start: grade,
      skills: real,
      evidence: picked.map((skill) => ({
        skillId: skill.id,
        independentCorrect: 1,
      })),
      rules: coverage,
    });
    assert.equal(done.covered, grade, `grade ${grade} is covered by its half`);
    assert.equal(done.ceiling, grade + 1);
    // One skill short is not enough.
    assert.equal(
      gradeCoverage({
        start: grade,
        skills: real,
        evidence: picked
          .slice(0, -1)
          .map((skill) => ({ skillId: skill.id, independentCorrect: 1 })),
        rules: coverage,
      }).covered,
      null,
      `grade ${grade}: one short`,
    );
  }
});
