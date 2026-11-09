import { expect, test } from "vitest";
import {
  accountTabs,
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
});

test("the starter and Continue with AMP sit on the app frame", () => {
  for (const path of ["/start", "/start/parent", "/start/school"])
    expect(shellFrame(path), path).toEqual({ kind: "plain" });
  expect(shellFrame("/continue/learner-1")).toEqual({
    kind: "account",
    active: "access",
  });
  // The steps around it keep their own frame.
  for (const path of ["/start/purchase", "/start/verify-email", "/start/x"])
    expect(shellFrame(path), path).toBeNull();
});

test("screens with frames of their own stay outside it", () => {
  for (const path of [
    "/sign-in",
    "/start/plan",
    "/try",
    "/try/practice",
    "/me/start",
    "/join/ABC123",
    "/school/x/classes/y/today",
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
