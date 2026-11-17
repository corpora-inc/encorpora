import { expect, test } from "vitest";
import { shellFrame } from "../shell-frame";
import { phoneTabs } from "../../../ui/Tabs";
import {
  classroomTabs,
  familyTabs,
  learnerTabs,
  schoolTabs,
} from "../../spaces/tabs";

test("each group's screens share one frame and name their tab", () => {
  expect(shellFrame("/overview")).toEqual({
    kind: "progress",
    active: "overview",
  });
  expect(shellFrame("/me")).toEqual({ kind: "progress", active: "overview" });
  expect(shellFrame("/pathways/fraction-sums")).toEqual({
    kind: "progress",
    active: "pathways",
  });
  expect(shellFrame("/inventory")).toEqual({
    kind: "progress",
    active: "inventory",
  });
  expect(shellFrame("/consent")).toEqual({
    kind: "account",
    active: "account",
  });
  expect(shellFrame("/practice")).toEqual({ kind: "practice" });
  expect(shellFrame("/lessons/fractions")).toEqual({
    kind: "plain",
    practice: true,
  });
  expect(shellFrame("/school/invite")).toEqual({ kind: "plain" });
  expect(shellFrame("/school/start")).toEqual({ kind: "plain" });
  expect(shellFrame("/school/connect")).toEqual({ kind: "plain" });
  expect(shellFrame("/school/adopt")).toEqual({ kind: "plain" });
});

test("the starter and the pay flow sit on the app frame", () => {
  for (const path of [
    "/start",
    "/start/parent",
    "/start/school",
    "/start/parent/practice",
    "/start/tutor/join",
  ])
    expect(shellFrame(path), path).toEqual({ kind: "plain" });
  for (const path of [
    "/pay/learner-1",
    "/pay/learner-1/card",
    "/pay/learner-1/esa/plan",
    "/pay/learner-1/esa/invoice/invoice-1",
  ])
    expect(shellFrame(path), path).toEqual({ kind: "plain" });
  // The steps around it keep their own frame.
  for (const path of ["/start/purchase", "/start/verify-email", "/start/x"])
    expect(shellFrame(path), path).toBeNull();
});

test("screens with frames of their own stay outside it", () => {
  for (const path of [
    "/sign-in",
    "/start/plan",
    "/me/start",
    "/join/ABC123",
    "/school/new",
    "/schools",
    "/family/approve",
    "/family/approvals/123",
    "/purchase/arizona-esa",
    "/standings",
  ])
    expect(shellFrame(path), path).toBeNull();
});

test("a learner's record has one row of tabs; the account is one page with none", () => {
  expect(learnerTabs().map((tab) => tab.path)).toEqual([
    "overview",
    "pathways",
    "inventory",
  ]);
  // The account and the overlays over it share one frame, with no tabs.
  for (const path of [
    "/account",
    "/account/security",
    "/account/billing",
    "/account/privacy",
    "/account/delete-account",
  ])
    expect(shellFrame(path), path).toEqual({
      kind: "account",
      active: "account",
    });
  // Practice at a level's hub is the drawer's entry, never a tab (Q-3).
  expect(shellFrame("/me/profiles")).toEqual({ kind: "plain" });
});

test("class sub-screens retain their tab and existing URLs", () => {
  for (const [leaf, active] of [
    ["today", "today"],
    ["start", "today"],
    ["report-cards", "gradebook"],
    ["cards", "roster"],
    ["import", "roster"],
    // What children see is a section of the class's Settings (ia.md).
    ["experience", "settings"],
    ["workbooks/2026-11-09", "workbooks"],
  ]) {
    expect(shellFrame(`/school/org/classes/class/${leaf}`)).toMatchObject({
      kind: "class",
      org: "org",
      classId: "class",
      active,
    });
  }
  expect(shellFrame("/school/org/classes/class/report-cards")).toMatchObject({
    leaf: "report-cards",
  });
  // A learner's workbooks open from Overview: the record's tabs, Overview
  // marked (the adult's own are My practice's Workbooks tab).
  for (const path of [
    "/learners/child/workbooks",
    "/learners/child/workbooks/2026-11-09",
    "/learners/child/workbooks/2026-11-09/results",
  ])
    expect(shellFrame(path), path).toEqual({
      kind: "progress",
      active: "overview",
    });
  // A student's record opened from a class keeps that class's tabs.
  expect(shellFrame("/school/org/students/kai", "class")).toEqual({
    kind: "class",
    org: "org",
    classId: "class",
    active: "map",
    leaf: "map",
    board: false,
  });
  expect(shellFrame("/school/org/students/kai")).toMatchObject({
    kind: "school",
  });
});

test("school sub-screens map to their own tabs", () => {
  for (const [leaf, active] of [
    ["import", "classes"],
    ["students/id", "classes"],
    ["experience", "settings"],
    ["year", "settings"],
    ["integrations", "integrations"],
    ["calendar", "calendar"],
    ["license", "license"],
    ["privacy", "privacy"],
    ["schools", "schools"],
  ]) {
    expect(shellFrame(`/school/org/${leaf}`)).toMatchObject({
      kind: "school",
      active,
    });
  }
});

test.each(["district", "network"] as const)(
  "review regression: %s has its own Schools tab when overview is permitted",
  (kind) => {
    const org = { id: "org", kind, can: ["overview.read" as const] };
    expect(schoolTabs(org)).toContainEqual({
      id: "schools",
      label: "Schools",
      path: "school/org/schools",
    });
    expect(schoolTabs({ ...org, can: [] })).toEqual([]);
    expect(
      schoolTabs({ ...org, kind: "school" }).some(
        (tab) => tab.id === "schools",
      ),
    ).toBe(false);
  },
);

// A solo school's authorized administrator still reaches its staff
// (CP-1 review, R7): only the overview and activity collapse into the class.
test("review regression: a lone school hides Overview and Activity, never readable Staff", () => {
  const org = {
    id: "org",
    kind: "school" as const,
    can: [
      "overview.read",
      "staff.read",
      "activity.read",
      "calendar.read",
      "privacy.read",
    ] as (
      | "overview.read"
      | "staff.read"
      | "activity.read"
      | "calendar.read"
      | "privacy.read"
    )[],
  };
  expect(schoolTabs(org, { lone: true }).map((tab) => tab.id)).toEqual([
    "staff",
    "calendar",
    "privacy",
  ]);
  expect(schoolTabs(org).map((tab) => tab.id)).toEqual([
    "overview",
    "staff",
    "calendar",
    "privacy",
    "activity",
  ]);
});

test("a phone's tabs: each space's own four", () => {
  const ids = (items: readonly { id: string }[]) => items.map((tab) => tab.id);
  expect(ids(phoneTabs(classroomTabs("org", "class")))).toEqual([
    "today",
    "map",
    "gradebook",
    "roster",
  ]);
  expect(ids(phoneTabs(familyTabs("org", "class", { learners: 3 })))).toEqual([
    "today",
    "map",
    "workbooks",
    "time",
  ]);
  // A tutor's larger group has Grades, under More on a phone.
  expect(ids(phoneTabs(familyTabs("org", "class", { learners: 12 })))).toEqual([
    "today",
    "map",
    "workbooks",
    "time",
  ]);
  expect(ids(familyTabs("org", "class", { past: true }))).toEqual([
    "time",
    "report-cards",
  ]);
  expect(ids(classroomTabs("org", "class", { past: true }))).toEqual([
    "gradebook",
    "time",
  ]);
});
