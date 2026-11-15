import { expect, test } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";
import type { FamilyPlaces } from "../../../../family/projection-contracts";
import {
  addressedIdentity,
  childAddress,
  childPath,
  learningIdentity,
} from "../identity";
import { canonicalLearning, childFamily } from "../learner-urls";
import { childTabs, meTabs } from "../tabs";

/*
 * Q-209: one canonical address per learner's screen
 * (docs/architecture/spaces.md, "Learning screens"). Yourself is unnamed,
 * a family's child is in the path, a practice profile keeps `?profile=`,
 * and `?learner=` is only an older link that is sent to its canonical
 * address.
 */

const FAMILY = "52050f4a-8e35-877c-a381-66a9dd6829e2";
const SHARED = "6d0f4f6c-1111-4c1c-9a0a-000000000001";
const SHARED_ID = "6d0f4f6c-1111-4c1c-9a0a-0000000000ff";
const child = (id: string, name: string) => ({
  id,
  name,
  birthYear: 2017,
  entitlement: { active: true, plan: null, endsAt: null },
});
const me = (own: string | null) =>
  ({
    signedIn: true,
    account: { id: "amp|jonah", email: null, emailVerified: true },
    learners: [child("pip", "Pip"), child("wren", "Wren")],
    family: { learners: [] },
    familyClass: {
      orgId: FAMILY,
      classId: "c1",
      className: "Jonah’s class",
      notice: false,
    },
    secondParentOf: [
      {
        orgId: SHARED,
        classId: "c2",
        className: "Kai’s class",
        learners: [child("kai", "Kai")],
      },
    ],
    adultPractice: {
      eligible: true,
      learner: own ? { id: own, name: "Jonah", active: true } : null,
    },
    practiceProfiles: [{ id: "grade-4", label: "Grade 4" }],
  }) as unknown as SignedInMe;
const places = {
  families: [
    { familyId: FAMILY, orgId: FAMILY, role: "holder" },
    { familyId: SHARED_ID, orgId: SHARED, role: "second-parent" },
  ],
  next: null,
} as unknown as FamilyPlaces;
const canonical = (
  href: string,
  account: SignedInMe,
  selected: string | null = null,
) => {
  const url = new URL(href, "https://amp.invalid");
  return canonicalLearning(
    url.pathname,
    url.searchParams,
    account,
    places,
    selected,
  );
};

test("a child's address names them; yourself is unnamed", () => {
  const pip = `/family/${FAMILY}/kids/pip`;
  expect(childPath(FAMILY, "pip")).toBe(pip);
  expect(childPath(FAMILY, "pip", "pathways")).toBe(`${pip}/pathways`);
  expect(childAddress(`${pip}/inventory`)).toEqual({
    family: FAMILY,
    learner: "pip",
    screen: "inventory",
  });
  expect(childAddress(pip)?.screen).toBe("overview");
  expect(childAddress(`/family/${FAMILY}/map`)).toBeNull();
  expect(addressedIdentity(`${pip}/pathways`)).toEqual({
    kind: "learner",
    id: "pip",
  });
  // The path outranks any older key.
  expect(addressedIdentity(`${pip}/pathways`, { learner: "wren" })?.id).toBe(
    "pip",
  );
  // Unnamed shared learning screens are the adult's own.
  for (const path of ["/pathways", "/inventory", "/practice", "/overview"])
    expect(learningIdentity(path, {}, "jonah")).toEqual({
      kind: "learner",
      id: "jonah",
    });
  // A profile is still a profile; a family's screens are never "self".
  expect(
    learningIdentity("/practice", { profile: "grade-4" }, "jonah"),
  ).toEqual({ kind: "profile", id: "grade-4" });
  expect(learningIdentity(`/family/${FAMILY}`, {}, "jonah")).toBeNull();
  expect(learningIdentity("/me/profiles", {}, "jonah")).toBeNull();
  // No practice of their own: no self.
  expect(learningIdentity("/pathways", {}, null)).toBeNull();
});

test("the app's own tabs never carry ?learner=", () => {
  for (const tab of [...meTabs("jonah"), ...meTabs(null)])
    expect(tab.search).toBeUndefined();
  expect(meTabs("jonah").map((tab) => tab.path)).toEqual([
    "practice",
    "me",
    "learners/jonah/workbooks",
    "pathways",
    "inventory",
    "me/profiles",
  ]);
  // A profile's tabs keep the profile: it is the adult's own mode.
  expect(meTabs("jonah", "grade-4")[0]?.search).toEqual({
    profile: "grade-4",
  });
  expect(childTabs(FAMILY, "pip").map((tab) => tab.path)).toEqual([
    `family/${FAMILY}/kids/pip`,
    `family/${FAMILY}/kids/pip/pathways`,
    `family/${FAMILY}/kids/pip/inventory`,
  ]);
});

test("a child's family: the holder's, or the one they are the second parent of", () => {
  expect(childFamily(me(null), "pip", places)).toBe(FAMILY);
  expect(childFamily(me(null), "kai", places)).toBe(SHARED_ID);
  // Before the places answer, the family's class org (the same id today).
  expect(childFamily(me(null), "kai", null)).toBe(SHARED);
  expect(childFamily(me(null), "stranger", places)).toBeNull();
});

test("an older ?learner= link goes to its canonical address", () => {
  const adult = me("jonah");
  const pip = `/family/${FAMILY}/kids/pip`;
  // Yourself: the same screen, unnamed.
  expect(canonical("/pathways?learner=jonah&topic=frac", adult)).toBe(
    "/pathways?topic=frac",
  );
  expect(canonical("/practice?learner=jonah", adult)).toBe("/practice");
  // A child: their own screen in their family, keeping the map's own view.
  expect(
    canonical("/pathways?learner=pip&topic=frac&open=skill%3Ax", adult),
  ).toBe(`${pip}/pathways?topic=frac&open=skill%3Ax`);
  expect(canonical("/inventory?learner=pip&collection=all", adult)).toBe(
    `${pip}/inventory?collection=all`,
  );
  // Their Overview and practice are their page (practice is their own
  // session, started there).
  expect(canonical("/overview?learner=pip", adult)).toBe(pip);
  expect(canonical("/progress?learner=pip", adult)).toBe(pip);
  expect(canonical("/practice?learner=pip&skill=s", adult)).toBe(pip);
  // A second parent's child: the family they share.
  expect(canonical("/inventory?learner=kai", adult)).toBe(
    `/family/${SHARED_ID}/kids/kai/inventory`,
  );
  // A profile outranks ?learner=: the key is dropped.
  expect(canonical("/practice?profile=grade-4&learner=pip", adult)).toBe(
    "/practice?profile=grade-4",
  );
  // Someone this account doesn't read: it stays, and the screen says it
  // isn't available (never another learner).
  expect(canonical("/pathways?learner=stranger", adult)).toBeNull();
  // Lessons and books are the curriculum's: no child's address of their own.
  expect(canonical("/lessons/x?learner=pip", adult)).toBeNull();
  // Canonical already.
  expect(canonical("/pathways", adult)).toBeNull();
  expect(canonical("/practice?profile=grade-4", adult)).toBeNull();
});

test("a parent with no practice of their own: an unnamed map names the child it shows", () => {
  const parent = me(null);
  const pip = `/family/${FAMILY}/kids/pip`;
  const wren = `/family/${FAMILY}/kids/wren`;
  // The device's choice, if it is their child; else their first.
  expect(canonical("/pathways", parent, "wren")).toBe(`${wren}/pathways`);
  expect(canonical("/inventory", parent, "nobody")).toBe(`${pip}/inventory`);
  expect(canonical("/overview", parent, "wren")).toBe(wren);
  // Practice stays where it is (the legacy practice host).
  expect(canonical("/practice", parent, "wren")).toBeNull();
  // An adult with their own practice is themselves there.
  expect(canonical("/pathways", me("jonah"), "wren")).toBeNull();
});
