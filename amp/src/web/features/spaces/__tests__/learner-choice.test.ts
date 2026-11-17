import { expect, test } from "vitest";
import type { Me } from "../../../../account/contracts";
import { learnerChoice } from "../learner-choice";
import { addressedIdentity, practicePath } from "../identity";
import { practiceLearnerFor } from "../../profiles/practice-mode";

const kid = (id: string) => ({ id, name: id.toUpperCase() });
const parent = { accountId: "amp|parent", token: "t" };
const me = (over: Record<string, unknown> = {}) =>
  ({
    signedIn: true,
    account: { id: parent.accountId, kind: "parent" },
    learners: [kid("aug"), kid("maya")],
    ...over,
  }) as unknown as Me;

test("a handed child's session never has a chooser", () => {
  const child = { accountId: "school:aug", token: "st_x" };
  const student = me({
    account: { id: child.accountId, kind: "student" },
    learners: [kid("aug")],
  });
  expect(learnerChoice(child, student, "aug")).toEqual({
    learners: [],
    canChoose: false,
  });
});

test("one learner is no choice", () => {
  const one = learnerChoice(parent, me({ learners: [kid("aug")] }), "aug");
  expect(one.canChoose).toBe(false);
});

test("a parent with two children chooses between them", () => {
  const two = learnerChoice(parent, me(), "aug");
  expect(two.canChoose).toBe(true);
  expect(two.learners.map((entry) => entry.id)).toEqual(["aug", "maya"]);
});

test("a second parent's family's children count, once each", () => {
  const shared = me({
    learners: [kid("aug")],
    secondParentOf: [{ learners: [kid("aug"), kid("ivy")] }],
  });
  const choice = learnerChoice(parent, shared, "aug");
  expect(choice.learners.map((entry) => entry.id)).toEqual(["aug", "ivy"]);
  expect(choice.canChoose).toBe(true);
});

test("the adult's own screen (or a profile's) is theirs: no chooser", () => {
  const adult = me({
    adultPractice: { learner: { id: "self" } },
    practiceProfiles: [{ id: "grade-4" }],
  });
  expect(learnerChoice(parent, adult, "self").canChoose).toBe(false);
  expect(learnerChoice(parent, adult, "grade-4").canChoose).toBe(false);
  expect(learnerChoice(parent, adult, "maya").canChoose).toBe(true);
});

test("signed out, or another account's /me, offers nothing", () => {
  expect(learnerChoice(null, me(), null).canChoose).toBe(false);
  const other = me({ account: { id: "amp|other", kind: "parent" } });
  expect(learnerChoice(parent, other, null).canChoose).toBe(false);
});

test("practice names its learner in its path", () => {
  expect(practicePath("a b")).toBe("/practice/a%20b");
  expect(addressedIdentity("/practice/aug")).toEqual({
    kind: "learner",
    id: "aug",
  });
  expect(addressedIdentity("/practice")).toBeNull();
});

test("bare /practice resolves to one learner, decided once", () => {
  // A student: their own learner, whatever the link said.
  const student = me({
    account: { id: "school:aug", kind: "student" },
    learners: [kid("aug")],
  }) as Extract<Me, { signedIn: true }>;
  expect(practiceLearnerFor(student, "maya", null)).toBe("aug");
  const parentMe = me() as Extract<Me, { signedIn: true }>;
  // An older link's ?learner= names it.
  expect(practiceLearnerFor(parentMe, "maya", "aug")).toBe("maya");
  // Otherwise the current child, else the first.
  expect(practiceLearnerFor(parentMe, null, "maya")).toBe("maya");
  expect(practiceLearnerFor(parentMe, null, "gone")).toBe("aug");
  // The adult's own practice is theirs.
  const adult = me({
    adultPractice: { learner: { id: "self" } },
  }) as Extract<Me, { signedIn: true }>;
  expect(practiceLearnerFor(adult, null, "maya")).toBe("self");
  // Nobody to practice.
  expect(
    practiceLearnerFor(
      me({ learners: [] }) as Extract<Me, { signedIn: true }>,
      null,
      null,
    ),
  ).toBeNull();
});
