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

test("once the screen shows: the named learner, a profile by its practice, /me's own; practicing as a profile stays", () => {
  expect(committedChoice(me, "/practice", { learner: "pip" }, "wren")).toBe(
    "pip",
  );
  // A profile by its practice's address.
  expect(committedChoice(me, "/practice/grade-4", {}, "wren")).toBe("grade-4");
  // An older ?profile= is its alias row's, never a choice here.
  expect(
    committedChoice(me, "/practice", { profile: "grade-4" }, "wren"),
  ).toBe("jonah");
  expect(committedChoice(me, "/learners/pip/workbooks", {}, "wren")).toBe(
    "pip",
  );
  expect(committedChoice(me, "/me", {}, "wren")).toBe("jonah");
  // /me is the adult's own: it ends practicing as a profile.
  expect(committedChoice(me, "/me", {}, "grade-4")).toBe("jonah");
  // While practicing as a profile, a shared screen that names nobody is its.
  expect(committedChoice(me, "/pathways", {}, "grade-4")).toBeUndefined();
  // Q-209: an unnamed shared learning screen is the adult's own (self).
  expect(committedChoice(me, "/pathways", {}, "wren")).toBe("jonah");
  expect(committedChoice(me, "/practice", {}, "jonah")).toBeUndefined();
  // A family's child, by their own address.
  const family = "52050f4a-8e35-877c-a381-66a9dd6829e2";
  expect(
    committedChoice(me, `/family/${family}/kids/pip/pathways`, {}, "wren"),
  ).toBe("pip");
  // An account with no practice of its own has no self: the choice stands.
  const parent = { ...me, adultPractice: { eligible: true, learner: null } };
  expect(
    committedChoice(parent as SignedInMe, "/pathways", {}, "wren"),
  ).toBeUndefined();
  // Someone not theirs: the device's choice stands.
  expect(
    committedChoice(me, "/practice", { learner: "stranger" }, "wren"),
  ).toBeUndefined();
  expect(
    committedChoice(me, "/school/o/classes/c/today", {}, "wren"),
  ).toBeUndefined();
});
