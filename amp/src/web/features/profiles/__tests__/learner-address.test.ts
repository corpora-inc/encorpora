import { afterEach, beforeEach, expect, test } from "vitest";
import { AppError } from "../../../lib/AppError";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";
import { useLearnerStore } from "../../../learner-store";
import { adoptPracticeMode, carriedKeys } from "../practice-mode";

const session = { accountId: "amp|jonah", token: "t" };
const child = (id: string, name: string) => ({
  id,
  name,
  birthYear: 2017,
  entitlement: { active: true, plan: null, endsAt: null },
});
beforeEach(() => {
  queryClient.setQueryData(sessionOptions.queryKey, session);
  queryClient.setQueryData(meOptions(session).queryKey, {
    signedIn: true,
    account: { id: session.accountId, email: null, emailVerified: true },
    learners: [child("pip", "Pip"), child("wren", "Wren")],
    family: { learners: [] },
    adultPractice: {
      eligible: true,
      learner: { id: "jonah", name: "Jonah", active: true },
    },
    practiceProfiles: [{ id: "grade-4", label: "Grade 4" }],
  } as never);
  useLearnerStore.getState().select("wren");
});
afterEach(() => queryClient.clear());
const at = (search: Record<string, unknown>) => ({
  pathname: "/practice",
  search,
});

test("CP-2 H2: a preload never changes whose screen is on view", async () => {
  await adoptPracticeMode(at({ learner: "pip" }), true);
  expect(useLearnerStore.getState().learnerId).toBe("wren");
  await adoptPracticeMode(at({ profile: "grade-4" }), true);
  expect(useLearnerStore.getState().learnerId).toBe("wren");
  // Opening it does.
  await adoptPracticeMode(at({ learner: "pip" }));
  expect(useLearnerStore.getState().learnerId).toBe("pip");
});

test("CP-2 H2: a learner this account doesn't read is unavailable, not the previous one", async () => {
  const opened = adoptPracticeMode(at({ learner: "someone-else" }));
  await expect(opened).rejects.toBeInstanceOf(AppError);
  await expect(opened).rejects.toMatchObject({ kind: "permission" });
  expect(useLearnerStore.getState().learnerId).toBe("wren");
});

test("an empty ?learner= names nobody: the device's choice stands", async () => {
  await adoptPracticeMode(at({ learner: "" }));
  expect(useLearnerStore.getState().learnerId).toBe("wren");
});

test("CP-2 H2: a profile outranks ?learner= when both are in the address", async () => {
  await adoptPracticeMode(at({ profile: "grade-4", learner: "pip" }));
  expect(useLearnerStore.getState().learnerId).toBe("grade-4");
});

test("CP-2 H2: one identity travels between learning screens", () => {
  const here = (search: Record<string, unknown>) => ({
    pathname: "/pathways",
    search,
  });
  const there = { pathname: "/practice", search: {} };
  expect(carriedKeys(here({ learner: "pip" }), there, [])).toEqual({
    learner: "pip",
  });
  expect(
    carriedKeys(here({ profile: "grade-4", from: "/me" }), there, []),
  ).toEqual({ profile: "grade-4", from: "/me" });
  // A destination naming its own learner drops the profile, and the reverse.
  expect(
    carriedKeys(here({ profile: "grade-4" }), there, ["learner"]),
  ).toBeNull();
  expect(carriedKeys(here({ learner: "pip" }), there, ["profile"])).toBeNull();
  // Never onto a screen that isn't a learning screen.
  expect(
    carriedKeys(here({ learner: "pip" }), { pathname: "/me", search: {} }, []),
  ).toBeNull();
});

test("CP-2 M4: adding a place keeps its return through every starter step", () => {
  const start = (pathname: string, search: Record<string, unknown> = {}) => ({
    pathname,
    search,
  });
  expect(
    carriedKeys(
      start("/start", { from: "/school/o" }),
      start("/start/parent"),
      [],
    ),
  ).toEqual({ from: "/school/o" });
  expect(
    carriedKeys(
      start("/start/parent/children", { from: "/school/o" }),
      start("/start/parent"),
      [],
    ),
  ).toEqual({ from: "/school/o" });
  expect(
    carriedKeys(start("/start", { from: "/school/o" }), start("/me"), []),
  ).toBeNull();
});
