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
import {
  clientCanDraw,
  figureCapabilities,
  responseCapabilities,
} from "../src/math/contracts";
import { templates } from "../src/math/engine";

/* The rule a parent is told: a grade is covered when the child has earned
   two thirds of its skills, or as many harder ones, in at least three areas,
   and practice reaches one grade past the highest covered grade. The first
   tests work the mechanism on a small catalog with a share of one half; the
   last three hold the shipped share against the real catalog. */

const rules: CoverageRules = {
  share: 0.5,
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

test("a grade is covered by its share of skills (here one half), or as many harder ones, in enough areas", () => {
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

test("the bar is a share of the grade's own list", () => {
  const cases: [size: number, share: number, need: number][] = [
    [17, 0.5, 9],
    [27, 0.5, 14],
    [39, 0.5, 20],
    [18, 0.5, 9],
    [9, 0.5, 5],
    [1, 0.5, 1],
    [27, 1 / 3, 9],
    [27, 2 / 3, 18],
    // Thirds of a list that divides by three come out whole.
    [18, 2 / 3, 12],
    [36, 2 / 3, 24],
    [39, 2 / 3, 26],
    [17, 2 / 3, 12],
    [32, 2 / 3, 22],
    // Never nothing: one skill at least.
    [27, 0, 1],
  ];
  for (const [size, share, need] of cases)
    assert.equal(coverageNeed(size, share), need, `${size} skills at ${share}`);
  const evidence = earned("g3-0", "g3-1", "g3-2", "g3-5");
  assert.equal(cover(evidence, 3, { step: 2 }).ceiling, 5);
  assert.equal(cover(evidence, 3, { share: 0.75 }).covered, null);
  assert.equal(cover(evidence, 3, { areas: 4 }).covered, null);
  assert.equal(cover(evidence, 3, { areas: 1 }).covered, 3);
});

test("the bar is set by what the learner can be asked", () => {
  const only = (...ids: string[]) => new Set(ids);
  const ask = (
    evidence: { skillId: string; independentCorrect?: number }[],
    askable: ReadonlySet<string>,
    start = 3,
  ) => gradeCoverage({ start, skills: catalog, askable, evidence, rules });
  // A client that can show four of grade 3's eight skills, in two areas:
  // half of four is two, and two areas are all there are.
  const narrow = only(
    "g3-0",
    "g3-5",
    "g3-1",
    "g3-6",
    ...catalog.filter((skill) => skill.grade !== 3).map((skill) => skill.id),
  );
  assert.deepEqual(ask(earned("g3-0"), narrow), { covered: null, ceiling: 3 });
  assert.deepEqual(ask(earned("g3-0", "g3-1"), narrow), {
    covered: 3,
    ceiling: 4,
  });
  // The same two skills do not cover the grade for a client that shows all
  // of it.
  assert.equal(cover(earned("g3-0", "g3-1")).covered, null);
  // What was earned on another client still counts.
  assert.deepEqual(ask(earned("g3-2", "g3-3"), narrow), {
    covered: 3,
    ceiling: 4,
  });
  // A grade the client can show nothing of is passed over: it cannot be
  // covered, and it does not hold the learner.
  const without4 = only(
    ...catalog.filter((skill) => skill.grade !== 4).map((skill) => skill.id),
  );
  assert.deepEqual(ask([], without4, 4), { covered: null, ceiling: 5 });
  assert.deepEqual(ask(earned("g3-0", "g3-1", "g3-2", "g3-5"), without4), {
    covered: 3,
    ceiling: 5,
  });
  // Nothing above to pass on to: the ceiling stays.
  const upTo5 = only(
    ...catalog.filter((skill) => skill.grade <= 5).map((skill) => skill.id),
  );
  assert.deepEqual(ask(earned("g5-0", "g5-1", "g5-2", "g5-3"), upTo5, 5), {
    covered: 5,
    ceiling: 6,
  });
  // Nothing askable at all: the start.
  assert.deepEqual(ask([], only()), { covered: null, ceiling: 3 });
});

test("a skill with no grade is left out, and never switches coverage off", () => {
  const odd = [
    ...catalog,
    { id: "no-grade", grade: Number.NaN, area: "number" },
    {
      id: "undefined-grade",
      grade: undefined as unknown as number,
      area: "data",
    },
  ];
  assert.deepEqual(
    gradeCoverage({
      start: 3,
      skills: odd,
      evidence: earned("g3-0", "g3-1", "g3-2", "g3-5", "no-grade"),
      rules,
    }),
    { covered: 3, ceiling: 4 },
  );
  // An empty catalog, and a start past the catalog: the start.
  assert.deepEqual(
    gradeCoverage({ start: 3, skills: [], evidence: [], rules }),
    { covered: null, ceiling: 3 },
  );
  assert.deepEqual(cover([], 20), { covered: null, ceiling: 20 });
  // A start between grades covers from the next whole grade.
  assert.deepEqual(cover(earned("g3-0", "g3-1", "g3-2", "g3-5"), 2.6), {
    covered: 3,
    ceiling: 4,
  });
  assert.deepEqual(cover([], 2.6), { covered: null, ceiling: 2.6 });
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

test("the bar for each grade of the catalog: two thirds of its skills", () => {
  const { coverage } = DEFAULT_PRACTICE_POLICY;
  assert.deepEqual(
    { ...coverage },
    { enabled: true, share: 2 / 3, areas: 3, step: 1, probeRise: 1 },
  );
  // [skills the grade has, skills that cover it, areas they must span].
  const expected: [size: number, need: number, areas: number][] = [
    [17, 12, 3], // K
    [18, 12, 3],
    [22, 15, 3],
    [27, 18, 3],
    [23, 16, 3],
    [18, 12, 3],
    [27, 18, 3],
    [22, 15, 3],
    [20, 14, 3],
    [32, 22, 3], // Algebra 1
    [39, 26, 2], // Geometry: geometry, and data and probability
    [36, 24, 3], // Algebra 2
    [35, 24, 3], // Precalculus
  ];
  expected.forEach(([size, need, broad], grade) => {
    const own = real.filter((skill) => skill.grade === grade);
    assert.equal(own.length, size, `grade ${grade} size`);
    assert.equal(
      coverageNeed(own.length, coverage.share),
      need,
      `grade ${grade}`,
    );
    assert.equal(
      Math.min(coverage.areas, new Set(own.map((skill) => skill.area)).size),
      broad,
      `grade ${grade} areas`,
    );
  });
});

test("no grade can hold a learner, on a client that draws everything or nothing: each is covered by two thirds of what can be asked", () => {
  const { coverage } = DEFAULT_PRACTICE_POLICY;
  const clients = {
    "draws everything": {
      responseCapabilities: [...responseCapabilities],
      figureCapabilities: [...figureCapabilities],
    },
    "declares nothing": { responseCapabilities: [], figureCapabilities: [] },
  };
  for (const [name, client] of Object.entries(clients)) {
    const askable = new Set(
      templates
        .filter((template) => clientCanDraw(template, client))
        .map((template) => template.skillId),
    );
    let ceiling = 0;
    for (let grade = 0; grade <= 12; grade++) {
      const own = real.filter(
        (skill) => skill.grade === grade && askable.has(skill.id),
      );
      const cover = (picked: readonly (typeof own)[number][]) =>
        gradeCoverage({
          start: grade,
          skills: real,
          askable,
          evidence: picked.map((skill) => ({
            skillId: skill.id,
            independentCorrect: 1,
          })),
          rules: coverage,
        });
      if (!own.length) {
        // Nothing to ask: the grade is passed over while more lies above.
        assert.ok(
          cover([]).ceiling > grade || grade === 12,
          `${name} ${grade}`,
        );
        continue;
      }
      ceiling = grade;
      const byArea = new Map<string, typeof own>();
      for (const skill of own)
        byArea.set(skill.area, [...(byArea.get(skill.area) ?? []), skill]);
      const broad = Math.min(coverage.areas, byArea.size);
      const need = Math.max(broad, coverageNeed(own.length, coverage.share));
      assert.ok(
        need <= own.length,
        `${name} ${grade}: ${need} of ${own.length}`,
      );
      // One skill from each of the smallest areas, the rest from anywhere:
      // the mix of areas in practice provides the first, any work the rest.
      const lists = [...byArea.values()].sort((a, b) => a.length - b.length);
      const picked = lists.slice(0, broad).map((list) => list[0]!);
      for (const skill of own)
        if (picked.length < need && !picked.includes(skill)) picked.push(skill);
      assert.equal(picked.length, need, `${name} ${grade}`);
      const done = cover(picked);
      assert.equal(done.covered, grade, `${name}: grade ${grade} is covered`);
      assert.ok(done.ceiling > grade, `${name}: grade ${grade} ceiling`);
      // One skill short is not enough.
      assert.equal(
        cover(picked.slice(0, -1)).covered,
        null,
        `${name} ${grade}: one short`,
      );
    }
    assert.equal(ceiling, 12, `${name}: something to ask at the top`);
  }
});
