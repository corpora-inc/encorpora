/**
 * The answer path's two options, and the fatigue verdict the app runs.
 *
 * Both were shipped without a caller and without a test: `speedRewards` existed
 * only inside `apply.ts`, and the fatigue detector was called from the simulation
 * harness and nowhere else — so `context.fatigued` was permanently false in the
 * loop a child uses, and every mechanism gated on it was dead. The app now calls
 * `sessionFatigue`; this is the engine half of holding it to that.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { applyResult, sessionFatigue } from "./apply.ts";
import { harnessCatalog } from "./harness/catalog.ts";
import { coldStart } from "./learner.ts";
import { newSession, planBatch } from "./select.ts";
import type { SessionContext } from "./select.ts";
import { BATCH_SIZE } from "./constants.ts";
import type { LearnerState } from "./types.ts";

const catalog = harnessCatalog();

function firstCard(learner: LearnerState, context: SessionContext) {
  const card = planBatch(catalog, learner, context, BATCH_SIZE).cards[0];
  assert.ok(card !== undefined);
  return card;
}

/** A session's worth of outcomes: `right` correct, then `wrong` wrong. */
function outcomes(right: number, wrong: number): boolean[] {
  return [...Array.from({ length: right }, () => true), ...Array.from({ length: wrong }, () => false)];
}

test("A-17: with speed rewards off the model is told a neutral latency, and nothing reads the clock", () => {
  const learner = coldStart(catalog, 2, 0);
  const context = newSession(5, 0, learner);
  const card = firstCard(learner, context);

  const quick = applyResult(catalog, learner, context, card, { correct: true, latencyMs: 900, revisions: 0 }, [], {
    speedRewards: false,
  });
  const slow = applyResult(catalog, learner, context, card, { correct: true, latencyMs: 45_000, revisions: 0 }, [], {
    speedRewards: false,
  });
  assert.deepEqual(
    { ...quick.learner, rollups: [] },
    { ...slow.learner, rollups: [] },
    "a latency-derived path survived speedRewards: false",
  );

  // …and with them on, the same two answers are not the same evidence. Without
  // this the assertion above would pass on an engine that reads no clock at all.
  const onQuick = applyResult(catalog, learner, context, card, { correct: true, latencyMs: 900, revisions: 0 });
  const onSlow = applyResult(catalog, learner, context, card, { correct: true, latencyMs: 45_000, revisions: 0 });
  assert.notDeepEqual(
    { ...onQuick.learner, rollups: [] },
    { ...onSlow.learner, rollups: [] },
    "latency moved nothing even with speed rewards on",
  );
});

test("the fatigue verdict needs two indicators, and speed rewards off removes the latency one", () => {
  // A child three times past their own typical session length, whose accuracy has
  // fallen 30 points from the session's first third: two indicators, no latency
  // needed. `personalSessionMinutes` defaults to 3 with no rollups.
  const learner = coldStart(catalog, 2, 0);
  const tired: SessionContext = { ...newSession(7, 0, learner), outcomes: outcomes(9, 9) };
  assert.equal(sessionFatigue(learner, tired, { latencyMs: 6000, minutesElapsed: 12 }), true);

  // One indicator is not fatigue: the same accuracy drop, inside the session
  // length the child normally sustains.
  assert.equal(sessionFatigue(learner, tired, { latencyMs: 6000, minutesElapsed: 1 }), false);

  // A child answering well is not tired for having been at it a while.
  const fine: SessionContext = { ...newSession(7, 0, learner), outcomes: outcomes(18, 0) };
  assert.equal(sessionFatigue(learner, fine, { latencyMs: 6000, minutesElapsed: 12 }), false);

  // And the latency indicator, which is the one `A-17` removes. A child with
  // eight answers of history has a median to be slow against; a card four times
  // that median, with accuracy falling, is two indicators — and exactly one of
  // them once the clock is off.
  let warm = learner;
  let session = newSession(9, 0, warm);
  for (let i = 0; i < 8; i++) {
    const card = firstCard(warm, session);
    const result = applyResult(catalog, warm, session, card, {
      correct: true,
      latencyMs: 5500 + i * 150,
      revisions: 0,
    });
    warm = result.learner;
    session = result.context;
  }
  const dropping: SessionContext = { ...session, outcomes: outcomes(9, 9) };
  assert.equal(sessionFatigue(warm, dropping, { latencyMs: 26_000, minutesElapsed: 0 }), true);
  assert.equal(
    sessionFatigue(warm, dropping, { latencyMs: 26_000, minutesElapsed: 0 }, { speedRewards: false }),
    false,
    "the fatigue detector still read the clock with speed rewards off",
  );
});
