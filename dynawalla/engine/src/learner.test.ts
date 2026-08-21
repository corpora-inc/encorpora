/**
 * Cold start, the codec, and the state budget — including the arithmetic in
 * ADAPTIVE_LEARNING.md's own itemisation, which an earlier draft got wrong by
 * enough to bust its own acceptance bound.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { BUDGET, BUDGET_TOTAL_BYTES, STATE_LIMIT_BYTES, coldStart, decodeLearner, emptyLearner, encodeLearner, stateSizeBytes } from "./learner.ts";
import { COLD_START_MIN_P, MAX_EVENTS, MAX_ROLLUPS, MAX_TRACKED_BUGS, ROLLING_WINDOW } from "./constants.ts";
import { harnessCatalog } from "./harness/catalog.ts";
import { preferredForm } from "./catalog.ts";
import { format, fromRatio } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";
import { predictP } from "./skill.ts";
import { fsrsScheduler } from "./fsrs.ts";
import { NEW_SKILL_STATE } from "./types.ts";
import type { LearnerState } from "./types.ts";

const catalog = harnessCatalog();

test("the state budget sums to what the document states, and clears the gate", () => {
  const total = BUDGET.reduce((sum, row) => sum + row.bytes * row.count, 0);
  assert.equal(total, BUDGET_TOTAL_BYTES);
  assert.equal(BUDGET_TOTAL_BYTES, 37_136, "the itemisation no longer matches ADAPTIVE_LEARNING.md");
  assert.ok(BUDGET_TOTAL_BYTES < STATE_LIMIT_BYTES);
  // The two knobs that busted the first draft: a 2,000-event ring and 730 daily
  // rollups totalled ~116 KiB.
  assert.equal(MAX_EVENTS, 512);
  assert.equal(MAX_ROLLUPS, 180);
});

test("cold start seeds every skill at or one band above the child's grade, and no further", () => {
  const learner = coldStart(catalog, 2, 0);
  const seeded = Object.keys(learner.skills).length;
  assert.ok(seeded > 0 && seeded < catalog.skills.length, `${String(seeded)} of ${String(catalog.skills.length)}`);
  for (const skill of catalog.skills) {
    const state = learner.skills[skill.id];
    if (skill.gradeNominal - 2 > 1) assert.equal(state, undefined, `${skill.id} was seeded past the band`);
    else assert.ok(state !== undefined, `${skill.id} was not seeded`);
  }
  assert.equal(learner.answered, 0);
});

test("cold start: the easiest level of a seeded skill clears the floor the rules imply", () => {
  // The two documented rules conflict as written — `θ = b̄ − 0.4` caps the first
  // card at `σ(−0.4) = 0.40` while the cold-start rule asks for at least 0.55 —
  // so the seed yields to the floor. See `coldStart`.
  const learner = coldStart(catalog, 2, 0);
  for (const skill of catalog.skills) {
    const state = learner.skills[skill.id];
    const level = skill.levels[0];
    if (state === undefined || level === undefined) continue;
    if (skill.gradeNominal > 2) continue;
    const pHat = predictP(state.theta, level.b, preferredForm(level).guessFloor);
    assert.ok(pHat >= COLD_START_MIN_P, `${skill.id}: first card at ${format(pHat, 3)}`);
  }
});

function busy(): LearnerState {
  const scheduler = fsrsScheduler();
  let learner = coldStart(catalog, 2, 500);
  const facts: Record<string, ReturnType<typeof scheduler.create>> = {};
  for (let i = 0; i < 180; i++) facts[`skill:dw.add.s${String(i)}#L0#free-entry`] = scheduler.create(i);
  const bugs: Record<string, { beta: Fix; firings: number }> = {};
  for (let i = 0; i < MAX_TRACKED_BUGS; i++) bugs[`dw.add.s${String(i)}#mis.add.core`] = { beta: fromRatio(3, 1), firings: 9 };
  return {
    ...learner,
    facts,
    bugs,
    answered: 12_000,
    recent: Array.from({ length: ROLLING_WINDOW }, (_u, i) => `dw.add.s${String(i % 12).padStart(2, "0")}`),
    rollups: Array.from({ length: MAX_ROLLUPS }, (_u, day) => ({
      day,
      served: 24,
      correct: 19,
      minutes: 11,
      seconds: 640,
      fatiguedCards: 2,
    })),
    events: Array.from({ length: MAX_EVENTS }, (_u, i) => ({
      day: i,
      skillId: `dw.add.s${String(i % 12).padStart(2, "0")}`,
      level: i % 4,
      pool: "FRONTIER",
      pHat: fromRatio(80, 100),
      correct: i % 5 !== 0,
      latencyMs: 7400,
    })),
  };
}

test("EG-3: a fully loaded learner is well under 100 KB, with every ring at its cap", () => {
  const bytes = stateSizeBytes(busy());
  // Printed rather than merely asserted: the bound is a number somebody will want
  // to check against the itemisation, and the itemisation does not include the id
  // dictionary this codec has to carry.
  console.log(`      state size at every cap: ${String(bytes)} bytes (limit ${String(STATE_LIMIT_BYTES)})`);
  assert.ok(bytes < STATE_LIMIT_BYTES, `${String(bytes)} bytes`);
});

test("the codec round-trips every field, and returns null rather than throwing on rubbish", () => {
  const state = busy();
  const back = decodeLearner(encodeLearner(state));
  assert.deepEqual(back, state);
  assert.equal(decodeLearner(""), null);
  assert.equal(decodeLearner("not a state file"), null);
  assert.equal(decodeLearner(encodeLearner(state).slice(0, 40)), null);
  assert.deepEqual(decodeLearner(encodeLearner(emptyLearner(3))), emptyLearner(3));
});

test("the codec refuses an id it could not read back", () => {
  const state: LearnerState = { ...emptyLearner(0), skills: { "an id with a\u0000separator": NEW_SKILL_STATE } };
  assert.throws(() => encodeLearner(state), RangeError);
});
