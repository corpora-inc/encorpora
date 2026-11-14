import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";
import { AppError } from "../../../lib/AppError";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";
import { useLearnerStore } from "../../../learner-store";
import { isRedirect } from "@tanstack/react-router";
import {
  adoptPracticeMode,
  canonicalLearnerAddress,
  carriedKeys,
} from "../practice-mode";

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
  useLearnerStore.getState().select("wren");
});
afterEach(() => queryClient.clear());
const at = (search: Record<string, unknown>) => ({
  pathname: "/practice",
  search,
});

test("CP-2 r2 H2: a route guard never chooses (a preload or a pending navigation runs it too)", async () => {
  await adoptPracticeMode(at({ learner: "pip" }));
  await adoptPracticeMode(at({ profile: "grade-4" }));
  expect(useLearnerStore.getState().learnerId).toBe("wren");
});

test("CP-2 r2 H2: no route guard in the router chooses a learner", () => {
  const router = readFileSync("src/web/app/router.tsx", "utf8");
  // The workbook guard and /me's did; the shell adopts after the screen shows.
  expect(router).not.toMatch(/useLearnerStore\.getState\(\)\.select\(/);
});

test("CP-2 H2: a learner or profile this account doesn't read is unavailable, not the previous one", async () => {
  for (const search of [{ learner: "someone-else" }, { profile: "revoked" }]) {
    const opened = adoptPracticeMode(at(search));
    await expect(opened).rejects.toBeInstanceOf(AppError);
    await expect(opened).rejects.toMatchObject({ kind: "permission" });
  }
  expect(useLearnerStore.getState().learnerId).toBe("wren");
});

test("CP-2 H2: one identity travels between learning screens", () => {
  const here = (search: Record<string, unknown>) => ({
    pathname: "/pathways",
    search,
  });
  const there = { pathname: "/practice", search: {} };
  // Q-209: a learner never travels (yourself is unnamed; a child's screens
  // name them in their path); only a practice profile does.
  expect(carriedKeys(here({ learner: "pip" }), there, [])).toBeNull();
  expect(
    carriedKeys(here({ profile: "grade-4", from: "/me" }), there, []),
  ).toEqual({ profile: "grade-4", from: "/me" });
  expect(
    carriedKeys(here({ profile: "grade-4" }), there, ["learner"]),
  ).toBeNull();
  expect(carriedKeys(here({ learner: "pip" }), there, ["profile"])).toBeNull();
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

test("Q-209: an older ?learner= address is sent to its canonical one, and nobody is chosen", async () => {
  queryClient.setQueryData(
    ["account", session.accountId, "families", "places"],
    {
      families: [{ familyId: "fam", orgId: "fam", role: "holder" }],
      next: null,
    },
  );
  const redirected = async (pathname: string, searchStr: string) => {
    try {
      await canonicalLearnerAddress({ pathname, searchStr });
      return null;
    } catch (thrown) {
      expect(isRedirect(thrown)).toBe(true);
      return (thrown as { options: { href: string } }).options.href;
    }
  };
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
  expect(useLearnerStore.getState().learnerId).toBe("wren");
});
