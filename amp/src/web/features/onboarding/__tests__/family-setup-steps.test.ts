import { expect, test } from "vitest";
import { setupStepIds, setupSteps } from "../setup/FamilySetup";

const named = { account: { givenName: "Ada", familyName: "Okafor" } };
const unnamed = { account: { givenName: null, familyName: null } };
const ids = (steps: readonly { id: string }[]) => steps.map((step) => step.id);

test("a parent goes straight to their kids, then who practices first: a name is never a step", () => {
  // Nothing requires a parent's name before a child practices; it is asked
  // where it is shown (Account), never as a gate.
  expect(ids(setupSteps("parent", unnamed as never))).toEqual(["", "ready"]);
  expect(ids(setupSteps("parent", named as never))).toEqual(["", "ready"]);
});

test("an old name-step link still resolves to the setup", () => {
  expect(setupStepIds("parent")).toContain("name");
});

test("the parent path has no code, board or second-parent step", () => {
  expect(setupStepIds("parent")).not.toContain("practice");
  expect(setupStepIds("parent")).not.toContain("second-parent");
  expect(setupStepIds("parent")).not.toContain("join");
});

test("a tutor's setup in flight keeps its steps", () => {
  expect(ids(setupSteps("tutor", unnamed as never))).toEqual([
    "",
    "join",
    "ready",
  ]);
});
