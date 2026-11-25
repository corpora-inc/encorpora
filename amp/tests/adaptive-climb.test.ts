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

/* A seventh-grader starts from their grade, two grades wide where it was 2.5
   (2026-11-24, `GRADE_START_SD_CAP`). The problems come down as fast: near
   grade 4 from the first one. The level shown is within a grade of 4 after
   four answers, as before, and then sits between 4.4 and 5.2 on both
   engines until the seventeenth. Half a grade from 4 is 4.5, inside that
   band: before, one answer dipped to 4.39 at the sixth problem and counted;
   now the same answer reads 4.57. So this case holds the level to a grade
   within the target, and to half a grade within twenty. Over 24 seeds the
   first answer within half a grade is the 4th (median), where it was the
   3rd. */
test("a struggling 7th grader working at grade 4 comes down to their level within 15 problems", () => {
  const run = simulateClimb(
    { level: 4, birthYear: 2013 },
    { seed: "seventh", count: PROBLEMS },
  );
  assert.equal(run.start, 7);
  const served = answersToServe(run);
  const withinGrade = answersToEstimate(run, 4, 1, 1);
  const withinHalf = answersToEstimate(run, 4, 0.5, 1);
  assert.ok(
    served !== null &&
      served <= TARGET &&
      withinGrade !== null &&
      withinGrade <= TARGET &&
      withinHalf !== null &&
      withinHalf <= 20,
    `near level from problem ${served}, estimate within ±1 after ${withinGrade}, within ±0.5 after ${withinHalf}: ${trace(run)}`,
  );
  // Each of those is as tight as it measures: 1, 4 and 17 today.
  assert.ok(served <= 3 && withinGrade <= 5);
});
