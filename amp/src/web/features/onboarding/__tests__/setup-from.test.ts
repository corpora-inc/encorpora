import { expect, test } from "vitest";
import { backUrl, nextUrl, setupSteps, stepUrl } from "../setup/FamilySetup";

/*
 * Each step of a parent's setup is its own path, and only a path: no query
 * string rides along (founder, 2026-11-16). Back is the step before, or the
 * question; Next the step after.
 */

const steps = setupSteps("parent", {
  account: { givenName: null, familyName: null },
} as never);
const props = (index: number) => ({ kind: "parent", index, steps }) as never;

test("each step's next address: kids → who's first", () => {
  expect(nextUrl(props(0))).toBe("/start/parent/ready");
});

test("Back goes to the step before, and from the first to the question", () => {
  expect(backUrl("parent", steps, 0)).toBe("/start");
  expect(backUrl("parent", steps, 1)).toBe("/start/parent");
});

test("step addresses are paths only", () => {
  expect(stepUrl("parent", "")).toBe("/start/parent");
  expect(stepUrl("parent", "ready")).toBe("/start/parent/ready");
  expect(stepUrl("tutor", "join")).toBe("/start/tutor/join");
});
