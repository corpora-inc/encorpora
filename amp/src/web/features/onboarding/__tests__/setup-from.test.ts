import { expect, test } from "vitest";
import { nextUrl, setupSteps, stepUrl } from "../setup/FamilySetup";

/*
 * Each step of a parent's setup is its own path, and only a path: no query
 * string rides along (founder, 2026-11-16). The stepper links each done
 * step to its address; Next goes to the step after.
 */

const steps = setupSteps("parent", {
  account: { givenName: null, familyName: null },
} as never);
const props = (index: number) => ({ kind: "parent", index, steps }) as never;

test("each step's next address: kids → who's first", () => {
  expect(nextUrl(props(0))).toBe("/start/parent/ready");
});

test("step addresses are paths only", () => {
  expect(stepUrl("parent", "")).toBe("/start/parent");
  expect(stepUrl("parent", "ready")).toBe("/start/parent/ready");
  expect(stepUrl("tutor", "join")).toBe("/start/tutor/join");
});
