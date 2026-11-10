import { expect, test } from "vitest";
import {
  accountTabs,
  classTabs,
  schoolTabs,
  overviewPath,
  progressTabs,
  shellFrame,
} from "../shell-frame";

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
  expect(shellFrame("/family/security")).toEqual({
    kind: "account",
    active: "security",
  });
  expect(shellFrame("/family/learners/new")).toEqual({
    kind: "account",
    active: "learners",
  });
  expect(shellFrame("/family/access/records")).toEqual({
    kind: "account",
    active: "access",
  });
  expect(shellFrame("/purchase/annual")).toEqual({
    kind: "account",
    active: "access",
  });
  expect(shellFrame("/consent")).toEqual({
    kind: "account",
    active: "privacy",
  });
  expect(shellFrame("/practice")).toEqual({ kind: "practice" });
  expect(shellFrame("/lessons/fractions")).toEqual({
    kind: "plain",
    practice: true,
  });
  expect(shellFrame("/school/invite")).toEqual({ kind: "plain" });
});

test("the starter and Continue with AMP sit on the app frame", () => {
  for (const path of [
    "/start",
    "/start/parent",
    "/start/school",
    "/start/parent/practice",
    "/start/tutor/join",
  ])
    expect(shellFrame(path), path).toEqual({ kind: "plain" });
  expect(shellFrame("/continue/learner-1")).toEqual({ kind: "plain" });
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

test("the Overview tab follows whose progress it is; the URLs never move", () => {
  expect(progressTabs("learner").map((tab) => tab.path)).toEqual([
    "overview",
    "pathways",
    "inventory",
  ]);
  expect(progressTabs("own")[0]!.path).toBe("me");

  expect(overviewPath("learner")).toBe("/overview");
  expect(accountTabs.map((tab) => tab.label)).toEqual([
    "Sign-in",
    "Learners",
    "Billing",
    "Privacy",
  ]);
});

test("class sub-screens retain their tab and existing URLs", () => {
  for (const [leaf, active] of [
    ["today", "today"],
    ["start", "today"],
    ["report-cards", "gradebook"],
    ["cards", "roster"],
    ["experience", "roster"],
    ["workbooks/2026-11-09", "workbooks"],
  ]) {
    expect(shellFrame(`/school/org/classes/class/${leaf}`)).toMatchObject({
      kind: "class",
      org: "org",
      classId: "class",
      active,
    });
  }
  expect(classTabs("org", "class").map((tab) => tab.label)).toEqual([
    "Today",
    "Map",
    "Grades",
    "Time",
    "Workbooks",
    "Students",
    "Settings",
  ]);
  // A learner's workbooks are on the Progress frame (My practice's
  // Workbooks tab for the adult's own).
  for (const path of [
    "/learners/child/workbooks",
    "/learners/child/workbooks/2026-11-09",
    "/learners/child/workbooks/2026-11-09/results",
  ])
    expect(shellFrame(path), path).toEqual({
      kind: "progress",
      active: "workbooks",
    });
  // A family's or tutor's class: Grades only past six learners.
  expect(
    classTabs("org", "class", false, true, 12).map((tab) => tab.label),
  ).toEqual([
    "Today",
    "Map",
    "Grades",
    "Time",
    "Workbooks",
    "People",
    "Settings",
  ]);
  expect(
    classTabs("org", "class", false, true, 2).map((tab) => tab.label),
  ).toEqual(["Today", "Map", "Time", "Workbooks", "People", "Settings"]);
  // A student's record opened from a class keeps that class's tabs.
  expect(shellFrame("/school/org/students/kai", "class")).toEqual({
    kind: "class",
    org: "org",
    classId: "class",
    active: "map",
    board: false,
  });
  expect(shellFrame("/school/org/students/kai")).toMatchObject({
    kind: "school",
  });
  expect(progressTabs("own", "adult-1").map((tab) => tab.label)).toEqual([
    "Overview",
    "Pathways",
    "Inventory",
    "Workbooks",
  ]);
  expect(progressTabs("learner", "adult-1")).toHaveLength(3);
});

test("school sub-screens map to seven tabs and respect capabilities", () => {
  for (const [leaf, active] of [
    ["import", "classes"],
    ["students/id", "classes"],
    ["experience", "classes"],
    ["integrations", "staff"],
    ["year", "calendar"],
    ["schools", "schools"],
  ]) {
    expect(shellFrame(`/school/org/${leaf}`)).toMatchObject({
      kind: "school",
      active,
    });
  }
  const org = {
    id: "org",
    name: "School",
    kind: "school" as const,
    parentId: null,
    timezone: "UTC",
    roles: [],
    can: ["classes.read", "calendar.read"] as const,
  };
  expect(
    schoolTabs({ ...org, can: [...org.can] }, 2).map((tab) => tab.label),
  ).toEqual(["Classes", "Calendar"]);
  const family = {
    ...org,
    kind: "family" as const,
    can: ["classes.read", "calendar.read", "staff.read"] as const,
  };
  expect(
    schoolTabs({ ...family, can: [...family.can] }, 1).map((tab) => tab.label),
  ).toEqual(["Classes", "Calendar"]);
  expect(classTabs("org", "class", true).map((tab) => tab.id)).toEqual([
    "gradebook",
    "time",
  ]);
});

test.each(["district", "network"] as const)(
  "review regression: %s has its own Schools tab when overview is permitted",
  (kind) => {
    const org = {
      id: "org",
      name: "District",
      kind,
      parentId: null,
      timezone: "UTC",
      roles: [],
      can: ["overview.read"] as ["overview.read"],
    };
    expect(schoolTabs(org, 2)).toContainEqual({
      id: "schools",
      label: "Schools",
      path: "school/org/schools",
    });
    expect(shellFrame("/school/org/schools")).toMatchObject({
      active: "schools",
    });
    expect(schoolTabs({ ...org, can: [] }, 2)).toEqual([]);
    expect(
      schoolTabs({ ...org, kind: "school" }, 2).some(
        (tab) => tab.id === "schools",
      ),
    ).toBe(false);
  },
);

test("review regression: a lone school hides Overview, Staff and Activity", () => {
  const org = {
    id: "org",
    name: "Just my class",
    kind: "school" as const,
    parentId: null,
    timezone: "UTC",
    roles: ["admin"] as ["admin"],
    solo: true,
    can: [
      "overview.read",
      "staff.read",
      "activity.read",
      "calendar.read",
      "privacy.read",
    ] as [
      "overview.read",
      "staff.read",
      "activity.read",
      "calendar.read",
      "privacy.read",
    ],
  };
  expect(schoolTabs(org, 1).map((tab) => tab.id)).toEqual([
    "calendar",
    "privacy",
  ]);
  expect(schoolTabs(org, 2).map((tab) => tab.id)).toEqual([
    "overview",
    "staff",
    "calendar",
    "privacy",
    "activity",
  ]);
});
