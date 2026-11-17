import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";
import { AppError } from "../../../lib/AppError";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";
import { useLearnerStore } from "../../../learner-store";
import { learningIdentity, selfOf } from "../../spaces/identity";
import { adoptPracticeMode, olderLearningHref } from "../practice-mode";

const session = { accountId: "amp|jonah", token: "t" };
const child = (id: string, name: string) => ({
  id,
  name,
  birthYear: 2017,
  entitlement: { active: true, plan: null, endsAt: null },
});
const me = {
  signedIn: true,
  account: { id: session.accountId, email: null, emailVerified: true },
  learners: [child("pip", "Pip"), child("wren", "Wren")],
  family: { learners: [] },
  adultPractice: {
    eligible: true,
    learner: { id: "jonah", name: "Jonah", active: true },
  },
  practiceProfiles: [{ id: "grade-4", label: "Grade 4" }],
} as unknown as SignedInMe;
beforeEach(() => {
  queryClient.setQueryData(sessionOptions.queryKey, session);
  queryClient.setQueryData(meOptions(session).queryKey, me as never);
  useLearnerStore.getState().select(session.accountId, "wren");
});
afterEach(() => queryClient.clear());
const at = (search: Record<string, unknown>) => ({
  pathname: "/practice",
  search,
});

test("CP-2 r2 H2: a route guard never chooses (a preload or a pending navigation runs it too)", async () => {
  await adoptPracticeMode(at({ learner: "pip" }));
  await adoptPracticeMode(at({ profile: "grade-4" }));
  expect(useLearnerStore.getState().learners[session.accountId]).toBe("wren");
});

test("CP-2 r2 H2: no route guard in the router chooses a learner", () => {
  const router = readFileSync("src/web/app/router.tsx", "utf8");
  // The workbook guard and /me's did; the shell adopts after the screen shows.
  expect(router).not.toMatch(/useLearnerStore\.getState\(\)\.select\(/);
});

test("CP-2 H2: a learner or profile this account doesn't read is unavailable, not the previous one", async () => {
  for (const location of [
    at({ learner: "someone-else" }),
    // A profile is practiced at its own address, as the adult's learner.
    { pathname: "/practice/revoked", search: {} },
  ]) {
    const opened = adoptPracticeMode(location);
    await expect(opened).rejects.toBeInstanceOf(AppError);
    await expect(opened).rejects.toMatchObject({ kind: "permission" });
  }
  // The account's own profile, by its practice's address, opens.
  await adoptPracticeMode({ pathname: "/practice/grade-4", search: {} });
  expect(useLearnerStore.getState().learners[session.accountId]).toBe("wren");
});

test("practicing as a profile is its address and the current learner, never a query string", () => {
  // Its practice names it, as a profile.
  expect(learningIdentity("/practice/grade-4", {}, null, me)).toEqual({
    kind: "profile",
    id: "grade-4",
  });
  // While it is the current learner, the shared screens that name nobody
  // are its; otherwise they are the adult's own.
  expect(learningIdentity("/pathways", {}, selfOf(me, "grade-4"), me)).toEqual(
    { kind: "profile", id: "grade-4" },
  );
  expect(learningIdentity("/pathways", {}, selfOf(me, "pip"), me)).toEqual({
    kind: "learner",
    id: "jonah",
  });
  // An older ?profile= names nobody: its alias row reads it
  // (app/legacy-aliases.ts).
  expect(learningIdentity("/pathways", { profile: "grade-4" }, null, me)).toBe(
    null,
  );
});

test("Q-209: an older ?learner= address is sent to its canonical one, and nobody is chosen", async () => {
  queryClient.setQueryData(
    ["account", session.accountId, "families", "places"],
    {
      families: [{ familyId: "fam", orgId: "fam", role: "holder" }],
      next: null,
    },
  );
  const redirected = async (pathname: string, searchStr: string) =>
    (await olderLearningHref({ pathname, searchStr })) ?? null;
  // Yourself: unnamed. A child: their own address, in their family.
  expect(await redirected("/pathways", "?learner=jonah")).toBe("/pathways");
  expect(await redirected("/pathways", "?learner=pip&topic=frac")).toBe(
    "/family/fam/kids/pip/pathways?topic=frac",
  );
  expect(await redirected("/overview", "?learner=wren")).toBe(
    "/family/fam/kids/wren",
  );
  // Canonical already, or someone not theirs (unavailable, shown by the
  // screen): no redirect.
  expect(await redirected("/pathways", "")).toBeNull();
  expect(await redirected("/pathways", "?learner=someone-else")).toBeNull();
  expect(useLearnerStore.getState().learners[session.accountId]).toBe("wren");
});
