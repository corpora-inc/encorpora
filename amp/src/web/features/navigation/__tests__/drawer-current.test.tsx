import "./drawer-harness";
import { afterEach, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { SignedInMe } from "../../../../account/contracts";
import DrawerContents from "../DrawerContents";
import { resolveSpace } from "../../spaces/resolve";
import { harness } from "./drawer-harness";

afterEach(cleanup);

const account = {
  signedIn: true,
  account: { id: "amp|r", email: null, emailVerified: true },
  learners: [],
  family: { learners: [] },
  adultPractice: {
    eligible: true,
    learner: { id: "me", name: "Me", active: true },
  },
} as unknown as SignedInMe;
harness.learningView.mockReturnValue({
  account,
  session: { data: {} },
  viewOnly: false,
});
const current = (pathname: string, learner?: string) => {
  const space = resolveSpace(
    { pathname, ...(learner ? { learner } : {}) },
    { kind: "adult", me: account, learnerId: "me" },
  );
  render(<DrawerContents close={() => {}} space={space} />);
  const names = [...document.querySelectorAll('a[aria-current="page"]')].map(
    (link) => link.getAttribute("aria-label"),
  );
  cleanup();
  return names;
};

test("exactly one item is current, the most specific for the route", () => {
  expect(current("/me/profiles")).toEqual(["Profiles"]);
  expect(current("/me")).toEqual(["Levels"]);
  expect(current("/practice")).toEqual(["Practice"]);
  expect(current("/learners/me/workbooks/2026-11-10", "me")).toEqual([
    "Workbooks",
  ]);
  // A step with its own way back (trying a level) marks none.
  expect(current("/me/profiles/new")).toEqual([]);
});
