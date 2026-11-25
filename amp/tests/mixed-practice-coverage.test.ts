import assert from "node:assert/strict";
import test from "node:test";
import { skills } from "../src/curriculum/catalog";
import {
  estimateFrontier,
  gradeNumber,
  type Frontier,
} from "../src/learning/frontier";
import {
  DEFAULT_PRACTICE_POLICY,
  FAST_CLIMB_PRACTICE_POLICY,
  createPracticePolicy,
  practiceParameters,
} from "../src/learning/practice-policy";
import { coverageArea } from "../src/learning/coverage";
import { templates } from "../src/math/engine";
import { projectSkillEvidence } from "../src/server/evidence";
import {
  frontierCatalog,
  newLearnerFrontier,
  readLearnerFrontier,
} from "../src/server/learner-frontier";
import {
  planMixedPractice,
  templateGrade,
  workingCoverage,
} from "../src/server/mixed-practice";
import type { Outcome } from "../src/server/repository";
import {
  paceEngines,
  paceLearners,
  simulatePace,
} from "./placement-pace.fixture";

/* What the planner offers a learner who starts from their grade: nothing
   past the grade until it is covered, then one grade further at a time. */

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const gradeOf = (templateId: string) =>
  templateGrade(
    templates.find((t) => t.id === templateId)!,
    nodes,
  );
const epoch = Date.parse("2026-10-19T12:00:00Z");
const outcome = (templateId: string, i: number, correct = true): Outcome => ({
  id: `a${i}`,
  problemId: `p${i}`,
  requestId: `r${i}`,
  skillId: templates.find((t) => t.id === templateId)!.skillId,
  templateId,
  response: "",
  correct,
  assisted: false,
  explanation: [],
  answer: "",
  createdAt: new Date(epoch + i * 40_000).toISOString(),
});
const frontierOf = (
  start: number,
  attempts: readonly Outcome[],
  gradeStart: boolean,
) =>
  estimateFrontier({
    start,
    gradeStart,
    observations: attempts,
    now: epoch + attempts.length * 40_000,
    ...frontierCatalog,
  });
/** One problem type from each of `count` skills of a grade, spread over the
 * areas in turn. */
function familiesOf(grade: number, count: number, areas?: readonly string[]) {
  const own = skills.filter(
    (skill) =>
      gradeNumber[skill.gradeBand] === grade &&
      (!areas || areas.includes(coverageArea(skill))) &&
      templates.some((t) => t.skillId === skill.id),
  );
  const byArea = new Map<string, typeof own>();
  for (const skill of own)
    byArea.set(coverageArea(skill), [
      ...(byArea.get(coverageArea(skill)) ?? []),
      skill,
    ]);
  const picked: string[] = [];
  for (let round = 0; picked.length < count; round++) {
    let any = false;
    for (const list of byArea.values()) {
      const skill = list[round];
      if (!skill || picked.length >= count) continue;
      any = true;
      picked.push(templates.find((t) => t.skillId === skill.id)!.id);
    }
    if (!any) throw new Error(`grade ${grade} has fewer than ${count} skills`);
  }
  return picked;
}
/** The grades of the next problem over many seeds. */
function offered(options: {
  frontier: Frontier;
  attempts: readonly Outcome[];
  policy?: typeof DEFAULT_PRACTICE_POLICY;
  chosen?: boolean;
  pool?: typeof templates;
  seeds?: number;
}) {
  return Array.from({ length: options.seeds ?? 40 }, (_, seed) => {
    const [choice] = planMixedPractice({
      policy: options.policy,
      templates: options.pool ?? templates,
      skills,
      attempts: options.attempts.slice(-12),
      evidence: projectSkillEvidence(options.attempts),
      frontier: options.frontier,
      count: 1,
      seed: `seed-${seed}`,
      now: epoch + options.attempts.length * 40_000,
      learnerKey: "learner",
      chosen: options.chosen,
    });
    return {
      id: choice!.template.id,
      grade: gradeOf(choice!.template.id),
      purpose: choice!.selection?.purpose,
    };
  });
}
const top = (choices: readonly { grade: number }[]) =>
  Math.max(...choices.map((choice) => choice.grade));

test("a new third grader who gets the first four right is next offered grade 3, or a stretch from grade 4", () => {
  const openers = familiesOf(3, 4).map((id, i) => outcome(id, i));
  // Five answers in, a working problem; six in, a stretch.
  const fifth = [...openers];
  const sixth = [...openers, outcome(familiesOf(3, 5)[4]!, 4)];
  for (const [attempts, limit] of [
    [fifth, 3.5],
    [sixth, 4.5],
  ] as const) {
    const after = offered({
      frontier: frontierOf(3, attempts, true),
      attempts,
    });
    assert.ok(top(after) <= limit, `${attempts.length} in: ${top(after)}`);
    assert.ok(
      after.every((choice) => choice.grade >= 2),
      "and never far below the grade",
    );
  }
  // The engine before reached past grade 4 on the same answers.
  const before = offered({
    frontier: frontierOf(3, sixth, false),
    attempts: sixth,
    policy: FAST_CLIMB_PRACTICE_POLICY,
  });
  assert.ok(top(before) >= 5, `before: ${top(before)}`);
});

test("the ceiling is the starting grade until it is covered, then one grade past the highest covered grade", () => {
  const answered = (ids: readonly string[]) =>
    ids.map((id, i) => outcome(id, i));
  // Grade 3 has 27 skills, so 14 cover it; grade 4 has 23, so 12.
  const cases: {
    name: string;
    attempts: Outcome[];
    covered: number | null;
    ceiling: number;
  }[] = [
    { name: "no answers", attempts: [], covered: null, ceiling: 3 },
    {
      name: "thirteen grade 3 skills",
      attempts: answered(familiesOf(3, 13)),
      covered: null,
      ceiling: 3,
    },
    {
      name: "fourteen grade 3 skills across the areas",
      attempts: answered(familiesOf(3, 14)),
      covered: 3,
      ceiling: 4,
    },
    {
      name: "fourteen grade 3 skills, all in number",
      attempts: answered(familiesOf(3, 14, ["number"])),
      covered: null,
      ceiling: 3,
    },
    {
      name: "seven of grade 3 and seven of grade 4: neither half",
      attempts: answered([...familiesOf(3, 7), ...familiesOf(4, 7)]),
      covered: null,
      ceiling: 3,
    },
    {
      name: "fourteen of grade 4 alone: grade 4, and grade 3 by harder skills",
      attempts: answered(familiesOf(4, 14)),
      covered: 4,
      ceiling: 5,
    },
    {
      name: "fourteen of grade 3, then twelve of grade 4",
      attempts: answered([...familiesOf(3, 14), ...familiesOf(4, 12)]),
      covered: 4,
      ceiling: 5,
    },
    {
      name: "fourteen of grade 3, all answered wrong",
      attempts: familiesOf(3, 14).map((id, i) => outcome(id, i, false)),
      covered: null,
      ceiling: 3,
    },
  ];
  for (const { name, attempts, covered, ceiling } of cases) {
    const frontier = frontierOf(3, attempts, true);
    assert.deepEqual(
      workingCoverage({
        frontier,
        skills,
        evidence: projectSkillEvidence(attempts),
      }),
      { covered, ceiling },
      name,
    );
    // Whatever the estimate says, a working problem stays within a grade of
    // the ceiling and a stretch within a grade and a half.
    const choices = offered({ frontier, attempts, seeds: 20 });
    assert.ok(
      choices.every(
        (choice) =>
          choice.grade <= ceiling + (choice.purpose === "probe" ? 1.5 : 1),
      ),
      `${name}: ${top(choices)} against ${ceiling}`,
    );
  }
});

test("a guessed start is planned exactly as before: coverage does not apply", () => {
  const record = [
    ...familiesOf(3, 6),
    ...familiesOf(4, 4),
    ...familiesOf(5, 2),
  ].map((id, i) => outcome(id, i, i % 5 !== 3));
  for (const length of [0, 4, 8, 12]) {
    const attempts = record.slice(0, length);
    const frontier = frontierOf(3, attempts, false);
    assert.equal(frontier.gradeStart, undefined);
    assert.equal(
      workingCoverage({
        frontier,
        skills,
        evidence: projectSkillEvidence(attempts),
      }),
      null,
    );
    const ids = (policy: typeof DEFAULT_PRACTICE_POLICY) =>
      offered({ frontier, attempts, policy, seeds: 20 }).map(
        (choice) => choice.id,
      );
    assert.deepEqual(
      ids(DEFAULT_PRACTICE_POLICY),
      ids(FAST_CLIMB_PRACTICE_POLICY),
      `${length} answers`,
    );
  }
});

test("a policy saved before coverage existed leaves it off", () => {
  const { coverage: _, ...saved } = practiceParameters(
    FAST_CLIMB_PRACTICE_POLICY,
  );
  const policy = createPracticePolicy(saved);
  assert.equal(policy.coverage.enabled, false);
  const attempts = familiesOf(3, 4).map((id, i) => outcome(id, i));
  const frontier = frontierOf(3, attempts, true);
  assert.equal(
    workingCoverage({
      frontier,
      skills,
      evidence: projectSkillEvidence(attempts),
      policy,
    }),
    null,
  );
});

test("a skill someone chose is not held to the grades covered", () => {
  // A grade 5 skill for a new third grader.
  const skill = skills.find(
    (candidate) =>
      gradeNumber[candidate.gradeBand] === 5 &&
      templates.filter((t) => t.skillId === candidate.id).length >= 3,
  )!;
  const pool = templates.filter((t) => t.skillId === skill.id);
  const attempts = familiesOf(3, 4).map((id, i) => outcome(id, i));
  const frontier = frontierOf(3, attempts, true);
  const ids = (options: Partial<Parameters<typeof offered>[0]>) =>
    offered({ frontier, attempts, pool, ...options }).map(
      (choice) => choice.id,
    );
  // Chosen: what the planner offered before coverage, on the same level.
  assert.deepEqual(
    ids({ chosen: true }),
    ids({ policy: FAST_CLIMB_PRACTICE_POLICY }),
  );
  // Every problem still comes from the chosen skill either way.
  assert.ok(ids({}).every((id) => pool.some((t) => t.id === id)));
});

test("an area set easier keeps its own lower ceiling", () => {
  const attempts = [...familiesOf(5, 9), ...familiesOf(6, 14)].map((id, i) =>
    outcome(id, i),
  );
  const state = newLearnerFrontier({
    epoch: 0,
    start: 5,
    gradeStart: true,
    strandStarts: { fractions: { level: 2, revision: 1 } },
  });
  const frontier = readLearnerFrontier(state, epoch);
  // Coverage alone would allow grade 7 (grades 5 and 6 are covered).
  assert.equal(
    workingCoverage({
      frontier,
      skills,
      evidence: projectSkillEvidence(attempts),
    })!.ceiling,
    7,
  );
  const pool = templates.filter(
    (t) => nodes.get(t.skillId)?.strand === "fractions",
  );
  const choices = offered({ frontier, attempts, pool, seeds: 20 });
  // The area restarted at grade 2: its problems stay near there.
  assert.ok(top(choices) <= 4.5, `fractions reached ${top(choices)}`);
});

test("over a simulated first hour no problem passes the ceiling by more than a stretch", () => {
  for (const learner of paceLearners().filter(
    (candidate) =>
      candidate.type === "always right" || candidate.type === "four above",
  )) {
    const run = simulatePace(learner, {
      ...paceEngines.after,
      seed: "ceiling",
      count: 40,
    });
    run.steps.forEach((step, i) => {
      const ceiling =
        step.covered == null ? learner.expected : step.covered + 1;
      assert.ok(
        step.grade <= ceiling + (step.purpose === "probe" ? 1.5 : 1),
        `${learner.type} from ${learner.expected}, problem ${i + 1}: grade ${step.grade} against ${ceiling}`,
      );
    });
  }
});
