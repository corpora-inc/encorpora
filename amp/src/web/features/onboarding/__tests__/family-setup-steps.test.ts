import { expect, test } from "vitest";
import { setupStepIds, setupSteps } from "../setup/FamilySetup";

const named = { account: { givenName: "Ada", familyName: "Okafor" } };
const unnamed = { account: { givenName: null, familyName: null } };
const ids = (steps: readonly { id: string }[]) => steps.map((step) => step.id);

test("a parent without a name answers it first, then their kids, then who practices first", () => {
  expect(ids(setupSteps("parent", unnamed as never))).toEqual([
    "name",
    "",
    "ready",
  ]);
});

test("a parent whose name is on file skips the name step", () => {
  expect(ids(setupSteps("parent", named as never))).toEqual(["", "ready"]);
  // A blank name is no name.
  expect(
    ids(setupSteps("parent", { account: { givenName: "  " } } as never)),
  ).toEqual(["name", "", "ready"]);
});

test("once this setup asked the name, the step stays listed after it's saved", () => {
  expect(ids(setupSteps("parent", named as never, true))).toEqual([
    "name",
    "",
    "ready",
  ]);
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
