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

const child = (id: string, name: string) => ({
  id,
  name,
  birthYear: 2017,
  gradeLevel: 3,
  access: {
    grants: [],
    hasAccess: true,
    canPractice: true,
    learningAllowed: true,
    freeAllowance: {
      problems: { total: 100, used: 0, remaining: 100 },
      workbooks: { total: 0, earned: 0, made: 0, available: 0, nextAt: null },
    },
  },
  week: { minutes: 0, problems: 0, lastPracticed: null },
  nextUp: { kind: "adaptive-practice", learnerId: id, task: null },
  capabilities: {},
  classes: [],
  paths: { progress: "", workbooks: null, practiceHere: null, continue: null },
});

test("Family: Today and its own children as rows, then the switcher, then the account", () => {
  const space = resolveSpace(
    { pathname: `/family/${FAMILY}`, space: "family" },
    { kind: "adult", me: account, learnerId: "wren" },
    {
      family: {
        familyId: FAMILY,
        displayName: "Pell family",
        role: "holder",
        teachingPlace: null,
        capabilities: {},
        children: [child("pip", "Pip"), child("wren", "Wren")],
        today: { date: "2026-11-14", tasks: [], week: {} },
      } as never,
    },
  );
  render(<DrawerContents close={() => {}} space={space} />);
  // No child picker: the children are rows, each opening their page.
  expect(sections()).toEqual(["AMP navigation", "Your places", "Account"]);
  expect(links()).toEqual(["Today", "Pip", "Wren"]);
  expect(
    screen.getByRole("link", { name: "Wren" }).getAttribute("href"),
  ).toBe(`/family/${FAMILY}/kids/wren`);
  expect(screen.queryByRole("option", { name: "Pip" })).toBeNull();
  expect(screen.getByTestId("switcher").dataset.current).toBe("home");
  // One account for every space; the family's settings are its own tab.
  expect(screen.queryByRole("link", { name: "Family & account" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Account" }).getAttribute("href"),
  ).toBe("/account/security");
  // Device preferences: one quiet section of switches.
  expect(document.querySelector("[data-this-device]")).toBeTruthy();
  expect(screen.getByRole("switch", { name: "Sound" })).toBeTruthy();
  expect(screen.queryByText("Show grade numbers")).toBeNull();
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

test("School: the school itself, no learner, the switcher names it", () => {
  const space = resolveSpace(
    { pathname: `/school/${SCHOOL}` },
    { kind: "adult", me: account, learnerId: "pip" },
    {
      org: {
        id: SCHOOL,
        kind: "school",
        name: "Alder Grove",
        parentId: null,
        timezone: "UTC",
        roles: ["admin"],
        can: ["org.read", "overview.read", "classes.read"],
      },
      classes: [],
    },
  );
  render(<DrawerContents close={() => {}} space={space} />);
  expect(links()).toEqual(["Alder Grove"]);
  expect(screen.queryByText("Pip")).toBeNull();
  expect(screen.getByTestId("switcher").dataset.current).toBe(
    `school:${SCHOOL}`,
  );
});

test("Account: no space's destinations, the switcher and the account", () => {
  const space = resolveSpace(
    { pathname: "/account/security" },
    { kind: "adult", me: account, learnerId: "pip" },
  );
  render(<DrawerContents close={() => {}} space={space} />);
  expect(links()).toEqual([]);
  expect(
    screen.getByRole("link", { name: "Account" }).getAttribute("aria-current"),
  ).toBe("page");
  expect(screen.queryByTestId("curriculum")).toBeNull();
});

test("Student: their practice and board, never a parent's switcher or account", () => {
  const student = {
    ...account,
    account: {
      id: "school:ana",
      email: null,
      emailVerified: false,
      kind: "student",
    },
    learners: [kid("ana", "Ana")],
    school: { orgName: "Alder Grove", levels: "shown", standings: true },
  } as unknown as SignedInMe;
  harness.learningView.mockReturnValueOnce({
    account: student,
    session: { data: {} },
    viewOnly: false,
  });
  harness.groups.value = [];
  const space = resolveSpace(
    { pathname: "/overview" },
    { kind: "student", me: student },
  );
  render(<DrawerContents close={() => {}} space={space} />);
  expect(links()).toEqual(["Practice", "Standings, Your class’s board"]);
  expect(screen.getByText("Ana")).toBeTruthy();
  expect(screen.queryByTestId("switcher")).toBeNull();
  expect(screen.queryByRole("link", { name: /account/i })).toBeNull();
  harness.groups.value = [{ id: "family", label: "Family", entries: [] }];
});
