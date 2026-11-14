import "./drawer-harness";
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { SignedInMe } from "../../../../account/contracts";
import DrawerContents from "../DrawerContents";
import { resolveSpace } from "../../spaces/resolve";
import { harness } from "./drawer-harness";

afterEach(cleanup);

const FAMILY = "11111111-1111-4111-8111-111111111111";
const CLASS = "22222222-2222-4222-8222-222222222222";
const SCHOOL = "33333333-3333-4333-8333-333333333333";
const ROOM = "44444444-4444-4444-8444-444444444444";
const kid = (id: string, name: string) => ({
  id,
  name,
  birthYear: 2017,
  entitlement: { active: true, plan: null, endsAt: null },
});
const account = {
  signedIn: true,
  account: { id: "amp|j", email: null, emailVerified: true },
  learners: [kid("pip", "Pip"), kid("wren", "Wren")],
  family: { learners: [] },
  familyClass: {
    orgId: FAMILY,
    classId: CLASS,
    className: "Pell family",
    notice: false,
  },
  staffOf: [{ orgId: SCHOOL, orgName: "Alder Grove", role: "teacher" }],
  adultPractice: {
    eligible: true,
    learner: { id: "jonah", name: "Jonah", active: true },
  },
} as unknown as SignedInMe;
harness.learningView.mockReturnValue({
  account,
  session: { data: {} },
  viewOnly: false,
});
harness.groups.value = [{ id: "family", label: "Family", entries: [] }];
const links = () =>
  [...document.querySelectorAll('nav[aria-label="AMP navigation"] a')].map(
    (link) => link.getAttribute("aria-label"),
  );
const sections = () =>
  [...document.querySelectorAll("nav, section")].map((node) =>
    node.getAttribute("aria-label"),
  );

test("Family: its own children and destinations, then the switcher, then the account", () => {
  const space = resolveSpace(
    { pathname: `/school/${FAMILY}/classes/${CLASS}/today` },
    { kind: "adult", me: account, learnerId: "wren" },
    {
      org: {
        id: FAMILY,
        kind: "family",
        name: "Pell family",
        parentId: null,
        timezone: "UTC",
        roles: [],
        can: [],
      },
      year: { past: false },
    },
  );
  render(<DrawerContents close={() => {}} space={space} />);
  expect(sections()).toEqual([
    "Who is practicing",
    "AMP navigation",
    "Your places",
    "Account",
  ]);
  expect(links()).toEqual(["Today", "Let Wren practice", "Wren’s progress"]);
  // The child's screens name the child in their address.
  expect(
    screen
      .getByRole("link", { name: "Let Wren practice" })
      .getAttribute("href"),
  ).toBe("/practice?learner=wren");
  expect(screen.getByRole("option", { name: "Pip" })).toBeTruthy();
  expect(screen.getByTestId("switcher").dataset.current).toBe("home");
  expect(
    screen.getByRole("link", { name: "Family & account" }).getAttribute("href"),
  ).toBe("/family");
  expect(screen.getByTestId("curriculum")).toBeTruthy();
});

test("Classroom: the class, no family learner, no practice settings", () => {
  const space = resolveSpace(
    { pathname: `/school/${SCHOOL}/classes/${ROOM}/today` },
    { kind: "adult", me: account, learnerId: "pip" },
    {
      org: {
        id: SCHOOL,
        kind: "school",
        name: "Alder Grove",
        parentId: null,
        timezone: "UTC",
        roles: ["teacher"],
        can: ["org.read", "classes.read"],
        teaches: [ROOM],
      },
      classes: [
        {
          id: ROOM,
          orgId: SCHOOL,
          sessionId: ROOM,
          name: "Grade 4 Math",
          courseBands: [],
          gradingKind: "year",
          joinCode: "ABCDEF",
          studentCount: 20,
          teachers: [],
        },
      ],
      year: { past: false },
    },
  );
  render(<DrawerContents close={() => {}} space={space} />);
  expect(screen.queryByText("Pip")).toBeNull();
  expect(screen.queryByRole("link", { name: /practice/i })).toBeNull();
  expect(links()).toEqual(["Grade 4 Math"]);
  expect(screen.queryByTestId("curriculum")).toBeNull();
  expect(screen.getByTestId("switcher").dataset.current).toBe(
    `class:${SCHOOL}:${ROOM}`,
  );
  expect(
    screen.getByRole("link", { name: "Account" }).getAttribute("href"),
  ).toBe("/account/security");
});

test("My practice: never the family's class or a child (audit #8)", () => {
  harness.pathname.value = "/me";
  const space = resolveSpace(
    { pathname: "/me" },
    { kind: "adult", me: account, learnerId: "pip" },
  );
  render(<DrawerContents close={() => {}} space={space} />);
  expect(links()).toEqual(["Practice", "Levels", "Workbooks", "Profiles"]);
  expect(
    screen.getByRole("link", { name: "Levels" }).getAttribute("aria-current"),
  ).toBe("page");
  expect(screen.queryByText("Pip")).toBeNull();
  expect(screen.queryByRole("link", { name: /class/i })).toBeNull();
  expect(screen.queryByRole("link", { name: "Family & account" })).toBeNull();
});
