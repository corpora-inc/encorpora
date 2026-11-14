import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultPracticeSettings,
  practiceChangeSchema,
  practiceSettingsSchema,
  type PracticeChange,
  type PracticeSettings,
} from "../src/learning/practice-settings";
import { changePractice } from "../src/server/practice-settings";
import type { LearnerTransaction } from "../src/server/repository";
import { studentLevels } from "../src/schools/student-me";

/*
 * "Show grade level": a grown-up's switch on a child's settings, stored with
 * the learner. It decides what the child sees as themselves, on any device,
 * together with a school's own policy: hidden when either says so.
 */

test("every learner starts with grade levels shown, stored state included", () => {
  assert.equal(defaultPracticeSettings().gradeLevelShown, true);
  // A state saved before the switch existed reads as on.
  const saved = practiceSettingsSchema.parse({
    revision: 3,
    epoch: 1,
    workingTogether: false,
    focusSkillId: null,
    strandStarts: {},
  });
  assert.equal(saved.gradeLevelShown, true);
});

test("hidden when the grown-up or a school says so; a family's class no longer decides", () => {
  // School homes: the school's policy and the switch together.
  assert.equal(studentLevels("shown", false, true), "shown");
  assert.equal(studentLevels("hidden", false, true), "hidden");
  assert.equal(studentLevels("shown", false, false), "hidden");
  // "Choice" was a device toggle that no longer exists: shown.
  assert.equal(studentLevels("choice", false, true), "shown");
  // A family's (or tutor's) class: the child's own switch alone.
  assert.equal(studentLevels("hidden", true, true), "shown");
  assert.equal(studentLevels("shown", true, false), "hidden");
});

test("the switch is its own change: display only, nothing else moves", async () => {
  let state: PracticeSettings = {
    ...defaultPracticeSettings(),
    revision: 4,
    epoch: 2,
    workingTogether: true,
    focusSkillId: "fraction-equivalence",
  };
  const receipts = new Map<string, PracticeChange>();
  const tx = {
    practiceChange: async (id: string) => {
      const change = receipts.get(id);
      return change ? { change, result: state } : undefined;
    },
    practiceSettings: async () => state,
    savePracticeChange: async (
      change: PracticeChange,
      result: PracticeSettings,
    ) => {
      receipts.set(change.requestId, change);
      state = result;
    },
  } as unknown as LearnerTransaction;
  const change = practiceChangeSchema.parse({
    kind: "gradeLevel",
    shown: false,
    requestId: "6f1d1c33-3f73-4f5b-9f52-6d4c1f3f6a10",
    revision: 4,
  });
  const next = await changePractice(tx, change);
  assert.equal(next.gradeLevelShown, false);
  assert.equal(next.revision, 5);
  assert.equal(next.epoch, 2);
  assert.equal(next.workingTogether, true);
  assert.equal(next.focusSkillId, "fraction-equivalence");
  // A retry with the same request changes nothing more.
  assert.deepEqual(await changePractice(tx, change), next);
  assert.throws(() =>
    practiceChangeSchema.parse({
      kind: "gradeLevel",
      requestId: "6f1d1c33-3f73-4f5b-9f52-6d4c1f3f6a10",
      revision: 5,
    }),
  );
});
