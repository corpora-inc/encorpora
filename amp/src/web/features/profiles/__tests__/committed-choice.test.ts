import { expect, test } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";
import { committedChoice } from "../practice-mode";

const child = (id: string, name: string) => ({
  id,
  name,
  birthYear: 2017,
  entitlement: { active: true, plan: null, endsAt: null },
});
const me = {
  signedIn: true,
  account: { id: "amp|jonah", email: null, emailVerified: true },
  learners: [child("pip", "Pip"), child("wren", "Wren")],
  family: { learners: [] },
  adultPractice: {
    eligible: true,
    learner: { id: "jonah", name: "Jonah", active: true },
  },
  practiceProfiles: [{ id: "grade-4", label: "Grade 4" }],
} as unknown as SignedInMe;

test("once the screen shows: the named learner, the profile first, /me's own, a stray profile put down", () => {
  expect(committedChoice(me, "/practice", { learner: "pip" }, "wren")).toBe(
    "pip",
  );
  expect(
    committedChoice(
      me,
      "/practice",
      { profile: "grade-4", learner: "pip" },
      "wren",
    ),
  ).toBe("grade-4");
  expect(committedChoice(me, "/learners/pip/workbooks", {}, "wren")).toBe(
    "pip",
  );
  expect(committedChoice(me, "/me", {}, "wren")).toBe("jonah");
  expect(committedChoice(me, "/pathways", {}, "grade-4")).toBe("jonah");
  // Nobody named, or someone not theirs: the device's choice stands.
  expect(committedChoice(me, "/pathways", {}, "wren")).toBeUndefined();
  expect(
    committedChoice(me, "/practice", { learner: "stranger" }, "wren"),
  ).toBeUndefined();
  expect(
    committedChoice(me, "/school/o/classes/c/today", {}, "wren"),
  ).toBeUndefined();
});
