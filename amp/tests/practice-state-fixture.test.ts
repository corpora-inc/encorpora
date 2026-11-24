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

test("a look the learner chose, and Colorful a grown-up turned off, apply as the server's", () => {
  const own = practiceStateFixture({
    ...defaultPracticeSettings(),
    look: "bold",
  });
  assert.equal(own.effectiveLook, "bold");
  assert.equal(own.lookLocked, false);
  const off = practiceStateSchema.parse(
    practiceStateFixture(
      { ...defaultPracticeSettings(), look: "bold", colorfulAllowed: false },
      12,
    ),
  );
  assert.deepEqual(
    [off.effectiveLook, off.lookLocked, off.lookLockedBy, off.look],
    ["calm", true, "adult", "bold"],
  );
  assert.equal(off.points, 12);
});
