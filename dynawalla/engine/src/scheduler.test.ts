/**
 * Named invariant tests.
 *
 * TEST_STRATEGY.md: every scheduler invariant in ADAPTIVE_LEARNING.md is its own
 * test with a name that matches the invariant's wording, so an invariant cannot be
 * deleted from the code without a test disappearing loudly.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { BATCH_SIZE, ROLLING_WINDOW } from "./constants.ts";
import { P_TARGET_DEFAULT, frustrationFloor } from "./controller.ts";
import { fromRatio } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";
import { checkInterleaving, checkSequence, detectFatigue } from "./scheduler.ts";
import type { PlannedCard, Pool } from "./scheduler.ts";

let counter = 0;

function card(overrides: Partial<PlannedCard> = {}): PlannedCard {
  counter += 1;
  const skillId = overrides.skillId ?? "dw.add.regroup.subtract-multidigit";
  return {
    cardId: `card-${String(counter)}`,
    skillId,
    level: 0,
    formId: "free-entry",
    seed: counter,
    pool: "FRONTIER" as Pool,
    intent: "steady",
    pHat: P_TARGET_DEFAULT,
    operation: "sub",
    itemKey: `${skillId}#${String(counter)}`,
    ...overrides,
  };
}

function rules(violations: readonly { rule: string }[]): string[] {
  return violations.map((violation) => violation.rule);
}

test("invariant: at most two consecutive cards from one skill", () => {
  const ok = [card({ skillId: "a" }), card({ skillId: "a" }), card({ skillId: "b" })];
  assert.deepEqual(rules(checkInterleaving(ok)), []);
  const bad = [card({ skillId: "a" }), card({ skillId: "a" }), card({ skillId: "a" })];
  assert.ok(rules(checkInterleaving(bad)).includes("max-consecutive-same-skill"));
});

test("invariant: a brand-new skill gets a blocked debut of three or four items", () => {
  const debut = [
    card({ skillId: "new" }),
    card({ skillId: "new" }),
    card({ skillId: "new" }),
    card({ skillId: "b", operation: "add" }),
  ];
  assert.deepEqual(rules(checkInterleaving(debut, { reachableSkills: 1, debutSkill: "new" })), []);
  assert.ok(rules(checkInterleaving(debut, { reachableSkills: 1 })).includes("max-consecutive-same-skill"));
  const tooLong = Array.from({ length: 5 }, () => card({ skillId: "new" }));
  assert.ok(
    rules(checkInterleaving(tooLong, { reachableSkills: 1, debutSkill: "new" })).includes("max-consecutive-same-skill"),
    "a blocked debut is three or four items, not five",
  );
});

test("invariant: at most three cards of one operation per batch", () => {
  const batch = Array.from({ length: 4 }, (_unused, index) =>
    card({ skillId: `skill-${String(index)}`, operation: "mul" }),
  );
  assert.ok(rules(checkInterleaving(batch)).includes("max-per-operation"));
  const mixed = [
    card({ skillId: "a", operation: "mul" }),
    card({ skillId: "b", operation: "sub" }),
    card({ skillId: "c", operation: "mul" }),
    card({ skillId: "d", operation: "add" }),
  ];
  assert.deepEqual(rules(checkInterleaving(mixed)), []);
});

test("invariant: at least three distinct skills once three are reachable", () => {
  const two = [card({ skillId: "a" }), card({ skillId: "b" }), card({ skillId: "a" })];
  assert.deepEqual(rules(checkInterleaving(two, { reachableSkills: 2 })), []);
  assert.ok(rules(checkInterleaving(two, { reachableSkills: 3 })).includes("min-distinct-skills"));
});

test("invariant: repair items are at most a quarter of a batch (A-12)", () => {
  const batch = Array.from({ length: BATCH_SIZE }, (_unused, index) =>
    card({
      skillId: `skill-${String(index % 4)}`,
      operation: ["add", "sub", "mul", "div"][index % 4] ?? "add",
      pool: index < 2 ? "REPAIR" : "FRONTIER",
    }),
  );
  assert.deepEqual(rules(checkInterleaving(batch)), []);
  const heavy = batch.map((entry, index) => (index < 3 ? { ...entry, pool: "REPAIR" as Pool } : entry));
  assert.ok(rules(checkInterleaving(heavy)).includes("max-repair-share"));
});

test("invariant: never re-serve an identical item within six cards", () => {
  const repeated = card({ itemKey: "same" });
  const near = [repeated, card(), card(), { ...card(), itemKey: "same" }];
  assert.ok(rules(checkSequence(near, [true, true, true, true], P_TARGET_DEFAULT)).includes("no-repeat-window"));
  const far = [repeated, ...Array.from({ length: 6 }, () => card()), { ...card(), itemKey: "same" }];
  assert.ok(!rules(checkSequence(far, far.map(() => true), P_TARGET_DEFAULT)).includes("no-repeat-window"));
});

test("invariant: never two consecutive items below pTarget − 0.20", () => {
  const hard = frustrationFloor(P_TARGET_DEFAULT) - 1;
  const two = [card({ pHat: hard as Fix }), card({ pHat: hard as Fix })];
  assert.ok(rules(checkSequence(two, [false, false], P_TARGET_DEFAULT)).includes("no-two-hard-in-a-row"));
  const spaced = [card({ pHat: hard as Fix }), card(), card({ pHat: hard as Fix })];
  assert.ok(!rules(checkSequence(spaced, [false, true, false], P_TARGET_DEFAULT)).includes("no-two-hard-in-a-row"));
});

test("invariant: more than two failures in five forces a confidence card", () => {
  const five = Array.from({ length: 5 }, () => card({ skillId: "a" }));
  const outcomes = [false, false, false, true, true];
  assert.ok(rules(checkSequence(five, outcomes, P_TARGET_DEFAULT)).includes("failure-relief"));
  const relieved = five.map((entry, index) => (index === 3 ? { ...entry, intent: "confidence" as const } : entry));
  assert.ok(!rules(checkSequence(relieved, outcomes, P_TARGET_DEFAULT)).includes("failure-relief"));
});

test("invariant: after three failures a skill is benched for the session", () => {
  const cards = [
    card({ skillId: "a" }),
    card({ skillId: "a" }),
    card({ skillId: "a" }),
    card({ skillId: "a" }),
  ];
  assert.ok(
    rules(checkSequence(cards, [false, false, false, false], P_TARGET_DEFAULT)).includes("bench-after-failures"),
  );
  const benched = cards.slice(0, 3);
  assert.ok(!rules(checkSequence(benched, [false, false, false], P_TARGET_DEFAULT)).includes("bench-after-failures"));
});

test("invariant: never end a session on a failure", () => {
  const cards = [card(), card()];
  assert.ok(
    rules(checkSequence(cards, [true, false], P_TARGET_DEFAULT, { sessionEnded: true })).includes("never-end-on-failure"),
  );
  assert.ok(
    !rules(checkSequence(cards, [false, true], P_TARGET_DEFAULT, { sessionEnded: true })).includes("never-end-on-failure"),
  );
  assert.ok(
    !rules(checkSequence(cards, [true, false], P_TARGET_DEFAULT, { sessionEnded: false })).includes("never-end-on-failure"),
  );
});

test("invariant: at most 40% of a rolling 50-item window from one skill", () => {
  // Tripling practice on one problem type had no effect on 1-week or 4-week test
  // scores. Without this cap, a child who is good at times tables gets times
  // tables for ever.
  const skewed = Array.from({ length: ROLLING_WINDOW }, (_unused, index) =>
    card({ skillId: index % 2 === 0 ? "a" : `b-${String(index)}` }),
  );
  assert.ok(rules(checkSequence(skewed, skewed.map(() => true), P_TARGET_DEFAULT)).includes("max-window-share"));
  const spread = Array.from({ length: ROLLING_WINDOW }, (_unused, index) =>
    card({ skillId: `skill-${String(index % 5)}` }),
  );
  assert.ok(!rules(checkSequence(spread, spread.map(() => true), P_TARGET_DEFAULT)).includes("max-window-share"));
});

test("fatigue: any two indicators, and never one", () => {
  const none = {
    latencyRising: false,
    accuracyNowPoints: 80,
    accuracyFirstThirdPoints: 82,
    minutesElapsed: 10,
    personalSessionMinutes: 20,
  };
  assert.equal(detectFatigue(none), false);
  assert.equal(detectFatigue({ ...none, latencyRising: true }), false, "one indicator is not fatigue");
  assert.equal(detectFatigue({ ...none, accuracyNowPoints: 55 }), false);
  assert.equal(detectFatigue({ ...none, latencyRising: true, accuracyNowPoints: 55 }), true);
  assert.equal(detectFatigue({ ...none, latencyRising: true, minutesElapsed: 25 }), true);
  assert.equal(detectFatigue({ ...none, accuracyNowPoints: 62, minutesElapsed: 25 }), true);
});

test("scheduler: a healthy batch of eight trips no rule", () => {
  const batch = Array.from({ length: BATCH_SIZE }, (_unused, index) =>
    card({
      skillId: `skill-${String(index % 4)}`,
      operation: ["add", "sub", "mul", "div"][index % 4] ?? "add",
      pool: index === 0 ? "REPAIR" : "FRONTIER",
      pHat: fromRatio(80, 100),
      intent: index === 0 ? "confidence" : "steady",
    }),
  );
  assert.deepEqual(rules(checkInterleaving(batch, { reachableSkills: 4 })), []);
  assert.deepEqual(rules(checkSequence(batch, batch.map(() => true), P_TARGET_DEFAULT)), []);
});
