import assert from "node:assert/strict";
import test from "node:test";
import type { SignedInMe } from "../src/account/contracts.js";
import type { FamilyProjection } from "../src/family/projection-contracts.js";
import {
  canOn,
  ownClassOf,
  resolveSpace,
} from "../src/web/features/spaces/resolve.js";
import { shellFrame } from "../src/web/features/navigation/shell-frame.js";
import { spaceOfPath } from "../src/web/features/spaces/space.js";
import { placeGroups } from "../src/web/features/spaces/places.js";
import { landingFamily } from "../src/web/features/family/redirects.js";

/*
 * The Family space at its own address (docs/architecture/spaces.md, P2):
 * `/family/<family>/…` resolves from the family projection that address
 * names, shows only that family's own children, and never another family,
 * a class's other students or a tutoring group's children.
 */

const ID = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = ID(1);
const A_CLASS = ID(2);
const B = ID(3);
const B_CLASS = ID(4);
const HOSTED = ID(5);

const caps = (
  over: Partial<FamilyProjection["children"][number]["capabilities"]> = {},
) => ({
  readProgress: true,
  readWorkbooks: true,
  createWorkbook: true,
  recordWorkbook: true,
  practiceHere: true,
  continuePurchase: true,
  purchase: true,
  rename: true,
  changeBirthYear: true,
  changePracticeSettings: true,
  manageConsent: true,
  delete: true,
  readGrades: true,
  editGrades: true,
  manageDevices: true,
  ...over,
});
const kid = (
  id: string,
  name: string,
  over: Partial<FamilyProjection["children"][number]> = {},
): FamilyProjection["children"][number] => ({
  id,
  name,
  birthYear: 2016,
  gradeLevel: 4,
  access: {
    grants: [],
    hasAccess: true,
    canPractice: true,
    learningAllowed: true,
    freeAllowance: {
      problems: { total: 100, used: 0, remaining: 100 },
      workbooks: { total: 0, earned: 0, made: 0, available: 0, nextAt: null },
    },
  } as FamilyProjection["children"][number]["access"],
  week: { minutes: 0, problems: 0, lastPracticed: null },
  nextUp: { kind: "adaptive-practice", learnerId: id, task: null },
  capabilities: caps(),
  classes: [],
  paths: {
    progress: "",
    workbooks: null,
    practiceHere: null,
    continue: `/continue/${id}`,
  },
  ...over,
});
const projection = (
  family: string,
  role: "holder" | "second-parent",
  children: FamilyProjection["children"],
  over: Partial<FamilyProjection> = {},
): FamilyProjection => ({
  familyId: family,
  displayName: family === A ? "Pell family" : "Lund family",
  role,
  teachingPlace: null,
  capabilities: {
    readFamily: true,
    addChildren: role === "holder",
    manageConsent: role === "holder",
    manageBilling: role === "holder",
    inviteSecondParent: role === "holder",
    manageSecondParent: role === "holder",
    readTeaching: true,
  },
  children,
  today: {
    date: "2026-11-14",
    tasks: [],
    week: {
      from: "2026-11-09",
      minutes: 0,
      problems: 0,
      skills: 0,
      objectives: 0,
      working: 0,
      students: children.length,
    },
  },
  ...over,
});
const me = (over: Partial<SignedInMe> = {}) =>
  ({
    signedIn: true,
    account: { id: "amp|holder", email: null, emailVerified: true },
    consent: { status: "active", method: null },
    learners: [],
    family: { learners: [] },
    next: "practice",
    ...over,
  }) as unknown as SignedInMe;
// Holder of A (Pip, Wren; and a tutored child Zed in A's class), second
// parent of B (Kai).
const power = me({
  learners: [
    { id: "pip", name: "Pip" },
    { id: "wren", name: "Wren" },
  ] as SignedInMe["learners"],
  familyClass: {
    orgId: A,
    classId: A_CLASS,
    className: "Pell class",
    notice: false,
  },
  secondParentOf: [
    {
      orgId: B,
      classId: B_CLASS,
      className: "Lund class",
      learners: [{ id: "kai", name: "Kai" }] as SignedInMe["learners"],
    },
  ],
});
const adult = (account: SignedInMe) =>
  ({ kind: "adult", me: account, learnerId: null }) as const;
const familyA = projection(
  A,
  "holder",
  [kid("pip", "Pip"), kid("wren", "Wren")],
  {
    teachingPlace: {
      classId: A_CLASS,
      displayName: "Pell class",
      scope: "whole-class",
      path: `/api/v1/families/${A}/teaching`,
    },
  },
);

test("a family's address is its own frame, Today at its root and a child's page under it", () => {
  assert.equal(spaceOfPath(`/family/${A}`), "family");
  assert.equal(spaceOfPath(`/family/${A}/kids/pip`), "family");
  assert.equal(spaceOfPath("/family/learners"), "account");
  assert.deepEqual(shellFrame(`/family/${A}`), {
    kind: "family",
    family: A,
    active: "today",
    leaf: "",
  });
  assert.equal(
    (shellFrame(`/family/${A}/kids/pip`) as { active: string }).active,
    "today",
  );
  assert.equal(
    (shellFrame(`/family/${A}/reports/grades`) as { active: string }).active,
    "reports",
  );
  assert.equal(shellFrame("/family")?.kind, "plain");
});

test("holder: the family's own children only, its tabs, its name, its children as rows", () => {
  const space = resolveSpace(
    { pathname: `/family/${A}`, space: "family" },
    adult(power),
    {
      family: familyA,
    },
  );
  assert.equal(space.space, "family");
  if (space.space !== "family") return;
  assert.equal(space.status, "ready");
  assert.equal(space.relation, "holder");
  assert.equal(space.label, "Pell family");
  assert.equal(space.place, "home");
  assert.deepEqual(
    space.learners.map((child) => child.id),
    ["pip", "wren"],
  );
  assert.deepEqual(
    space.tabs.map((tab) => tab.id),
    ["today", "map", "workbooks", "time", "reports", "people", "settings"],
  );
  assert.deepEqual(
    space.tabs.filter((tab) => tab.phone).map((tab) => tab.id),
    ["today", "map", "workbooks", "time"],
  );
  assert.deepEqual(
    space.tabs.map((tab) => tab.label),
    ["Today", "Map", "Workbooks", "Time", "Report cards", "People", "Settings"],
  );
  assert.deepEqual(
    space.destinations.map((entry) => [entry.label, entry.path]),
    [
      ["Today", `family/${A}`],
      ["Pip", `family/${A}/kids/pip`],
      ["Wren", `family/${A}/kids/wren`],
    ],
  );
  assert.equal(space.class?.id, A_CLASS);
  // No "Practice" in the bar: the adult's own practice is My practice.
  assert.deepEqual(space.actions, []);
});

test("a child's page marks that child, and only one of the family's own", () => {
  const space = resolveSpace(
    { pathname: `/family/${A}/kids/wren`, space: "family" },
    adult(power),
    { family: familyA },
  );
  if (space.space !== "family") throw new Error(space.space);
  assert.equal(space.learner?.id, "wren");
  assert.equal(
    space.destinations.find((entry) => entry.current)?.label,
    "Wren",
  );
  const stranger = resolveSpace(
    { pathname: `/family/${A}/kids/zed`, space: "family" },
    adult(power),
    { family: familyA },
  );
  if (stranger.space !== "family") throw new Error(stranger.space);
  assert.equal(stranger.learner, null);
});

test("each child's rights are a learner target of their own", () => {
  const space = resolveSpace(
    { pathname: `/family/${B}`, space: "family" },
    adult(power),
    {
      family: projection(B, "second-parent", [
        kid("kai", "Kai", {
          capabilities: caps({
            rename: false,
            purchase: false,
            continuePurchase: false,
            manageConsent: false,
            delete: false,
          }),
        }),
      ]),
    },
  );
  assert.ok(canOn(space, { kind: "learner", id: "kai" }, "practiceHere"));
  assert.ok(!canOn(space, { kind: "learner", id: "kai" }, "rename"));
  assert.ok(!canOn(space, { kind: "learner", id: "kai" }, "purchase"));
  assert.ok(!canOn(space, { kind: "learner", id: "pip" }, "practiceHere"));
  const holder = resolveSpace(
    { pathname: `/family/${A}`, space: "family" },
    adult(power),
    {
      family: familyA,
    },
  );
  assert.ok(canOn(holder, { kind: "learner", id: "pip" }, "rename"));
  assert.ok(canOn(holder, { kind: "org", id: A }, "inviteSecondParent"));
});

test("second parent of B: B's children, B's name, never A's children or A's class", () => {
  const space = resolveSpace(
    { pathname: `/family/${B}`, space: "family" },
    adult(power),
    {
      family: projection(B, "second-parent", [
        kid("kai", "Kai", {
          classes: [
            {
              id: B_CLASS,
              name: "Lund class",
              orgId: B,
              personId: ID(81),
              hostedByFamily: true,
              canOpen: true,
            },
          ],

          capabilities: caps({
            readWorkbooks: false,
            continuePurchase: false,
            purchase: false,
            rename: false,
            delete: false,
            manageConsent: false,
          }),
        }),
      ]),
    },
  );
  if (space.space !== "family") throw new Error(space.space);
  assert.equal(space.relation, "second-parent");
  assert.equal(space.place, `family:${B}`);
  assert.equal(space.label, "Lund family");
  assert.deepEqual(
    space.learners.map((child) => child.id),
    ["kai"],
  );
  assert.equal(space.class?.id, B_CLASS);
  // Workbooks are the holder's to make: no tab that would be refused.
  assert.ok(!space.tabs.some((tab) => tab.id === "workbooks"));
});

test("a late, refused or other family's projection never describes this family", () => {
  const loading = resolveSpace(
    { pathname: `/family/${B}`, space: "family" },
    adult(power),
    {
      family: familyA,
    },
  );
  if (loading.space !== "family") throw new Error(loading.space);
  assert.equal(loading.status, "loading");
  assert.deepEqual(loading.learners, []);
  assert.deepEqual(loading.tabs, []);
  const refused = resolveSpace(
    { pathname: `/family/${B}`, space: "family" },
    adult(power),
    {
      family: null,
    },
  );
  if (refused.space !== "family") throw new Error(refused.space);
  assert.equal(refused.status, "unavailable");
  assert.deepEqual(refused.destinations, []);
  assert.equal(refused.place, null);
});

test("a hosted-only parent: their children, no class, no devices", () => {
  const hosted = me({
    learners: [{ id: "ivy", name: "Ivy" }] as SignedInMe["learners"],
  });
  const space = resolveSpace(
    { pathname: `/family/${HOSTED}`, space: "family" },
    adult(hosted),
    {
      family: projection(HOSTED, "holder", [
        kid("ivy", "Ivy", {
          capabilities: caps({
            manageDevices: false,
            readGrades: false,
            editGrades: false,
          }),
        }),
      ]),
    },
  );
  if (space.space !== "family") throw new Error(space.space);
  assert.equal(space.status, "ready");
  assert.equal(space.class, null);
  assert.deepEqual(
    space.learners.map((child) => child.id),
    ["ivy"],
  );
});

test("a tutoring group is a teaching place of its own, never the family", () => {
  const space = resolveSpace(
    { pathname: `/family/${A}/group`, space: "family" },
    adult(power),
    {
      family: familyA,
    },
  );
  assert.equal(space.space, "classroom");
  assert.equal(space.place, `group:${A}`);
  assert.match(space.label ?? "", /^Tutoring group/);
  const none = resolveSpace(
    { pathname: `/family/${B}/group`, space: "family" },
    adult(power),
    {
      family: projection(B, "second-parent", []),
    },
  );
  if (none.space !== "classroom") throw new Error(none.space);
  assert.equal(none.status, "unavailable");
});

test("a student's session on a parent's device never resolves a family", () => {
  const space = resolveSpace(
    { pathname: `/family/${A}`, space: "family" },
    {
      kind: "student",
      me: me({
        account: {
          id: "school:p",
          email: null,
          emailVerified: false,
          kind: "student",
        } as SignedInMe["account"],
        learners: [{ id: "pip", name: "Pip" }] as SignedInMe["learners"],
      }),
    },
    { family: familyA },
  );
  assert.equal(space.space, "student");
});

test("the switcher names each family as the family, with a tutoring group under Teaching", () => {
  const groups = placeGroups(power, null, {
    families: [
      {
        familyId: A,
        displayName: "Pell family",
        role: "holder",
        teachingPlace: familyA.teachingPlace,
        capabilities: { readFamily: true, readTeaching: true },
      },
      {
        familyId: B,
        displayName: "Lund family",
        role: "second-parent",
        teachingPlace: null,
        capabilities: { readFamily: true, readTeaching: false },
      },
    ],
    next: null,
  });
  const family = groups.find((group) => group.id === "family")!;
  assert.deepEqual(
    family.entries.map((entry) => [entry.id, entry.name, entry.path]),
    [
      ["home", "Pell family", `family/${A}`],
      [`family:${B}`, "Lund family", `family/${B}`],
    ],
  );
  const teaching = groups.find((group) => group.id === "teaching")!;
  assert.deepEqual(
    teaching.entries.map((entry) => [entry.id, entry.name, entry.path]),
    [[`group:${A}`, "Tutoring group", `family/${A}/group`]],
  );
  // Never a class's name for a family.
  assert.ok(!family.entries.some((entry) => /class/i.test(entry.name)));
});

test("/family opens the holder's own family, else the one they belong to, else a chooser", () => {
  const place = (
    familyId: string,
    role: "holder" | "second-parent" | "co-teacher",
  ) => ({
    familyId,
    displayName: "",
    role,
    teachingPlace: null,
    capabilities: { readFamily: role !== "co-teacher", readTeaching: false },
  });
  assert.equal(
    landingFamily({
      families: [place(B, "second-parent"), place(A, "holder")],
      next: null,
    }),
    A,
  );
  assert.equal(
    landingFamily({ families: [place(B, "second-parent")], next: null }),
    B,
  );
  assert.equal(
    landingFamily({
      families: [place(B, "second-parent"), place(HOSTED, "second-parent")],
      next: null,
    }),
    null,
  );
  assert.equal(
    landingFamily({ families: [place(B, "co-teacher")], next: null }),
    null,
  );
  assert.equal(landingFamily(null), null);
});

test("a family's id need not be its class's org: the class comes from the projection", () => {
  const ORG = ID(77);
  const legacy = me({
    learners: [{ id: "pip", name: "Pip" }] as SignedInMe["learners"],
    familyClass: {
      orgId: ORG,
      classId: A_CLASS,
      className: "Pell class",
      notice: false,
    },
  });
  const data = projection(A, "holder", [
    kid("pip", "Pip", {
      classes: [
        {
          id: A_CLASS,
          name: "Pell class",
          orgId: ORG,
          personId: ID(80),
          hostedByFamily: true,
          canOpen: true,
        },
      ],
    }),
  ]);
  assert.deepEqual(ownClassOf(legacy, A, data), {
    id: A_CLASS,
    name: "Pell class",
    org: ORG,
  });
  // A holder before any child: their own family class.
  assert.deepEqual(ownClassOf(legacy, A, projection(A, "holder", [])), {
    id: A_CLASS,
    name: "Pell class",
    org: ORG,
  });
  // Never another family's class by an id that happens to match.
  assert.equal(ownClassOf(legacy, B, projection(B, "second-parent", [])), null);
  const space = resolveSpace(
    { pathname: `/family/${A}`, space: "family" },
    adult(legacy),
    { family: data },
  );
  if (space.space !== "family") throw new Error(space.space);
  assert.equal(space.class?.id, A_CLASS);
});
