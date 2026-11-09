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
  expect(shellFrame("/try/map")).toEqual({
    kind: "progress",
    active: "overview",
  });
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
  expect(shellFrame("/lessons/fractions")).toEqual({ kind: "plain" });
  expect(shellFrame("/school/invite")).toEqual({ kind: "plain" });
});

test("screens with frames of their own stay outside it", () => {
  for (const path of [
    "/sign-in",
    "/start/plan",
    "/try",
    "/try/practice",
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
  expect(progressTabs("trial")[0]!.path).toBe("try/map");
  expect(progressTabs("trial")[1]!.search).toEqual({ context: "trial" });
  expect(overviewPath("learner")).toBe("/overview");
  expect(accountTabs.map((tab) => tab.label)).toEqual([
    "Profile & sign-in",
    "Family",
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
  expect(shellFrame("/learners/child/workbooks/2026-11-09/results")).toEqual({
    kind: "plain",
  });
});

test("school sub-screens map to seven tabs and respect capabilities", () => {
  for (const [leaf, active] of [
    ["import", "classes"],
    ["students/id", "classes"],
    ["experience", "classes"],
    ["integrations", "staff"],
    ["year", "calendar"],
    ["schools", "overview"],
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
