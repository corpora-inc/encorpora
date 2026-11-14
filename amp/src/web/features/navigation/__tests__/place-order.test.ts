import { expect, test } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";
import type { PlacesResource } from "../../../../schools/contracts";
import { currentPlace, placeGroups } from "../../spaces/places";

const ID = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const me = {
  signedIn: true,
  account: { id: "amp|p", email: null, emailVerified: true },
  consent: { status: "active", method: null },
  learners: [
    {
      id: "kai",
      name: "Kai",
      birthYear: 2015,
      entitlement: { active: true, plan: null, endsAt: null },
    },
    {
      id: "lia",
      name: "Lia",
      birthYear: 2018,
      entitlement: { active: true, plan: null, endsAt: null },
    },
  ],
  familyClass: {
    orgId: ID(1),
    classId: ID(2),
    className: "Okafor family",
    notice: false,
  },
  secondParentOf: [
    { orgId: ID(3), classId: ID(4), className: "Lund family", learners: [] },
  ],
  staffOf: [{ orgId: ID(5), orgName: "Alder Grove", role: "teacher" }],
  adultPractice: {
    eligible: true,
    learner: { id: "me", name: "Me", active: true },
  },
} as unknown as SignedInMe;
const places: PlacesResource = {
  orgs: [
    {
      id: ID(5),
      kind: "school",
      name: "Alder Grove",
      parentId: null,
      roles: ["teacher"],
      solo: false,
      lone: false,
    },
    {
      id: ID(6),
      kind: "district",
      name: "Lake District",
      parentId: null,
      roles: ["viewer"],
      solo: false,
      lone: false,
    },
    {
      id: ID(7),
      kind: "family",
      name: "Rivera co-op",
      parentId: null,
      roles: ["teacher"],
      solo: false,
      lone: false,
    },
    {
      id: ID(8),
      kind: "school",
      name: "Birch Hill",
      parentId: null,
      roles: ["admin"],
      solo: true,
      lone: true,
    },
  ],
  schools: [{ id: ID(9), name: "Cedar Elementary", parentId: ID(6) }],
  classes: [
    {
      id: ID(10),
      orgId: ID(5),
      orgName: "Alder Grove",
      name: "Grade 4 Math",
      role: "teacher",
    },
    {
      id: ID(11),
      orgId: ID(5),
      orgName: "Alder Grove",
      name: "Grade 5 Math",
      role: "aide",
    },
    {
      id: ID(12),
      orgId: ID(8),
      orgName: "Birch Hill",
      name: "Room 3",
      role: "teacher",
    },
  ],
  more: false,
};

test("Family, Teaching, My practice: every authorised place with its role", () => {
  const groups = placeGroups(me, places);
  expect(groups.map((group) => group.label)).toEqual([
    "Family",
    "Teaching",
    "My practice",
  ]);
  const rows = (index: number) =>
    groups[index]!.entries.map((entry) => `${entry.name} · ${entry.detail}`);
  expect(rows(0)).toEqual([
    "Okafor family · 2 children",
    "Lund family · Second parent",
    "Rivera co-op · Co-teacher",
  ]);
  expect(rows(1)).toEqual([
    "Alder Grove · Teacher",
    "Grade 4 Math · Teacher",
    "Grade 5 Math · Aide",
    "Lake District · Viewer",
    "Cedar Elementary · Viewer, Lake District",
    // A one-class school is its class.
    "Room 3 · Teacher",
  ]);
  expect(rows(2)).toEqual([
    "My practice · Your levels and practice",
    "Practice at a level · Any grade, any pace",
  ]);
});

test("the current place: itself, else its class's school", () => {
  const groups = placeGroups(me, places);
  expect(currentPlace(groups, "home")?.name).toBe("Okafor family");
  expect(currentPlace(groups, `class:${ID(5)}:${ID(99)}`)?.name).toBe(
    "Alder Grove",
  );
  expect(currentPlace(groups, null)).toBeNull();
});

test("without the places read, the schools /me names stand in", () => {
  const groups = placeGroups(me, null);
  expect(groups[1]!.entries.map((entry) => entry.name)).toEqual([
    "Alder Grove",
  ]);
});
