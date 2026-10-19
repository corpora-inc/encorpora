import { test } from "node:test";
import assert from "node:assert/strict";
import { templates } from "../src/math/engine";
import { guessChance, guessChanceOf } from "../src/math/guess-chance";
import { simulatePlacement } from "./placement-simulation.fixture";

// Fast smoke check for the inner loop. The paired 900-learner comparison of
// the two estimators runs as `npm run test:placement-sim` (CI on main).
test("guessing-aware placement leaves typed-only learners untouched", () => {
  const typed = templates.filter((template) => guessChance(template) === 0);
  const seeds = [1];
  const before = simulatePlacement({ catalog: typed, guessOf: () => 0, seeds });
  const after = simulatePlacement({
    catalog: typed,
    guessOf: guessChanceOf,
    seeds,
  });
  assert.equal(after.learners, 30);
  assert.deepEqual(after.runs, before.runs);
});

test("choice items are a real part of placement", () => {
  const mixed = simulatePlacement({
    catalog: templates,
    guessOf: guessChanceOf,
    seeds: [1],
  });
  assert.ok(mixed.choiceShare > 0.15, JSON.stringify(mixed.choiceShare));
});
