import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultPracticeSettings,
  practiceStateSchema,
} from "../src/learning/practice-settings";
import { practiceStateFixture } from "../scripts/lib/practice-state-fixture";

test("the bare settings are not a practice-state answer", () => {
  assert.equal(
    practiceStateSchema.safeParse(defaultPracticeSettings()).success,
    false,
  );
});

test("the browser checks' practice-state reads as practice reads it", () => {
  const state = practiceStateSchema.parse(practiceStateFixture());
  assert.equal(state.effectiveLook, "calm");
  assert.equal(state.lookLocked, false);
  assert.equal(state.lookLockedBy, null);
  assert.equal(state.points, undefined);
});

test("a look the learner chose, and one a grown-up holds, apply as the server's", () => {
  const own = practiceStateFixture({
    ...defaultPracticeSettings(),
    look: "bold",
  });
  assert.equal(own.effectiveLook, "bold");
  assert.equal(own.lookLocked, false);
  const held = practiceStateSchema.parse(
    practiceStateFixture(
      { ...defaultPracticeSettings(), look: "bold", lookAdultLock: true },
      12,
    ),
  );
  assert.equal(held.lookLockedBy, "adult");
  assert.equal(held.points, 12);
});
