import assert from "node:assert/strict";
import test from "node:test";
import {
  answersToEstimate,
  answersToServe,
  simulateClimb,
  type ClimbRun,
} from "./climb-simulation.fixture";

/* A wrong starting guess costs a few problems, not the free allowance
   (founder, 2026-11-10). The whole table, over many seeds, is
   `npx tsx scripts/simulate-climb.ts`; these are two of its cases with one
   fixed seed each, through the real planner, estimator and grader. */

const PROBLEMS = 30;
const TARGET = 15;
const trace = (run: ClimbRun) =>
  run.steps
    .map(
      (step, i) =>
        `${i + 1}:${step.grade}${step.correct ? "✓" : "✗"}→${step.level}`,
    )
    .join(" ");
/** Practice works near the level, and the estimate has come within half a
 * grade of it, within the target. */
function assertReaches(run: ClimbRun, level: number) {
  const served = answersToServe(run);
  const estimated = answersToEstimate(run, level, 0.5, 1);
  assert.ok(
    served !== null &&
      served <= TARGET &&
      estimated !== null &&
      estimated <= TARGET,
    `near level from problem ${served}, estimate within ±0.5 after ${estimated}: ${trace(run)}`,
  );
}

test("an adult working at grade 10 who starts at grade 2 reaches their level within 15 problems", () => {
  const run = simulateClimb({ level: 10 }, { seed: "adult", count: PROBLEMS });
  assert.equal(run.start, 2);
  assertReaches(run, 10);
});

test("a struggling 7th grader working at grade 4 comes down to their level within 15 problems", () => {
  const run = simulateClimb(
    { level: 4, birthYear: 2013 },
    { seed: "seventh", count: PROBLEMS },
  );
  assert.equal(run.start, 7);
  assertReaches(run, 4);
});
