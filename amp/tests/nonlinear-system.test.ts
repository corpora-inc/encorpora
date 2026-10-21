import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { generateProblem } from "../src/math/engine";
import {
  nonlinearSystemTemplates,
  nonlinearSystemCase,
} from "../src/math/nonlinear-system-practice";
import { skills } from "../src/curriculum/catalog";
import { templateGrade, planMixedPractice } from "../src/server/mixed-practice";
import { templateGrade as experimentalGrade } from "../src/learning/item-calibration";
import { publicProblemSchema } from "../src/math/contracts";
import { publicationHtml } from "../src/content/publications";
import { nonlinearSystemLessons } from "../src/content/nonlinear-system-lessons";

const nodes = new Map(skills.map((s) => [s.id, s]));
test("nonlinear systems bridge graph reading, linear systems and quadratics in small difficulty steps", () => {
  assert.deepEqual(
    nonlinearSystemTemplates.map((t) => templateGrade(t, nodes)),
    [10.5, 11, 11.5],
  );
  for (const t of nonlinearSystemTemplates)
    assert.equal(templateGrade(t, nodes), experimentalGrade(t, nodes));
  assert.ok(
    nodes.get("nonlinear-systems")!.prerequisites.includes("linear-systems"),
  );
  assert.ok(
    nodes
      .get("nonlinear-systems")!
      .prerequisites.includes("quadratic-equations"),
  );
  assert.ok(
    nodes
      .get("nonlinear-systems")!
      .prerequisites.includes("nonlinear-intersection-reading"),
  );
  assert.ok(
    nodes
      .get("nonlinear-intersection-count")!
      .prerequisites.includes("quadratic-formula"),
  );
  assert.throws(() =>
    templateGrade(
      { ...nonlinearSystemTemplates[0]!, difficultyOffset: NaN },
      nodes,
    ),
  );
  assert.throws(() =>
    templateGrade(
      { ...nonlinearSystemTemplates[0]!, difficultyOffset: 2 },
      nodes,
    ),
  );
  const choices = planMixedPractice({
    templates: [...nonlinearSystemTemplates],
    skills,
    attempts: [],
    evidence: [],
    count: 3,
    seed: "pathway",
    frontier: {
      expected: 11,
      overall: { level: 11, sd: 1, answered: 30, independent: 30 },
      strands: {},
    },
  });
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map((c) => c.template.id)).size, 3);
});

test("independent prompt-based oracle verifies all three families and corrupt evidence", () => {
  const cases = nonlinearSystemTemplates.flatMap((t) =>
    Array.from({ length: 256 }, (_, i) => generateProblem(t.id, `thread-${i}`)),
  );
  cases.forEach((p) => publicProblemSchema.parse(p.public));
  const tags = new Set(
    nonlinearSystemTemplates
      .flatMap((t) =>
        Array.from(
          { length: 256 },
          (_, i) => nonlinearSystemCase(t.id, `thread-${i}`).tags,
        ),
      )
      .flat(),
  );
  for (const tag of [
    "count-0",
    "count-1",
    "count-2",
    "smaller",
    "larger",
    "x",
    "y",
    "a--2",
    "a-2",
  ])
    assert.ok(tags.has(tag), tag);
  const result = spawnSync(
    "python3",
    [
      "-c",
      "import sys,json; sys.path.insert(0, 'scripts'); from nonlinear_system_math_oracle import review_nonlinear_system_problem,review_nonlinear_system_fixtures; review_nonlinear_system_fixtures(); rows=json.load(sys.stdin); [review_nonlinear_system_problem(p) for p in rows]; print(len(rows))",
    ],
    {
      input: JSON.stringify(cases),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "768");
});

test("new lesson builds from meaning and example to a matching visual and formal statement in print", () => {
  const html = publicationHtml(nonlinearSystemLessons[0]!, "lesson");
  const headings = [
    "Two rules, the same point",
    "A worked example",
    "See the same solutions",
    "The general rule",
  ];
  for (let i = 1; i < headings.length; i++)
    assert.ok(html.indexOf(headings[i - 1]!) < html.indexOf(headings[i]!));
  assert.ok(html.includes("svg"));
});
