import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SignedInMe } from "../src/account/contracts.js";
import type { ClassResource, OrgResource } from "../src/schools/contracts.js";
import {
  resolveSpace,
  type SpaceDescriptor,
  type SpaceMatch,
  type SpaceResources,
  type SpaceSession,
} from "../src/web/features/spaces/resolve.js";
import { spaceOfPath, SPACES } from "../src/web/features/spaces/space.js";
import { spaceWords } from "../src/web/features/spaces/words.js";

/*
 * The resolution truth table (docs/architecture/spaces.md): every session
 * kind, every role, the power user, every route family, and the states a
 * stale, refused or mismatched resource leaves behind.
 */

const ID = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const FAMILY = ID(1);
const FAMILY_CLASS = ID(2);
const OTHER_FAMILY = ID(3);
const OTHER_FAMILY_CLASS = ID(4);
const SCHOOL = ID(5);
const ROOM = ID(6);
const ROOM_TWO = ID(7);
const DISTRICT = ID(8);
const TUTOR_FAMILY = ID(9);
const TUTOR_CLASS = ID(10);

const child = (id: string, name: string) => ({
  id,
  name,
  birthYear: 2017,
  entitlement: { active: true, plan: null, endsAt: null },
});

function me(overrides: Partial<SignedInMe> = {}): SignedInMe {
  return {
    signedIn: true,
    account: { id: "amp|adult", email: null, emailVerified: true },
    consent: { status: "active", method: null },
    learners: [],
    family: {
      consent: {
        status: "active",
        policyVersion: null,
        recordedAt: null,
        withdrawnAt: null,
      },
      learners: [],
      retained: {
        identity: "",
        financial: "",
        backups: "",
        privacyAuditDays: 0,
      },
    },
    next: "practice",
    ...overrides,
  } as SignedInMe;
}

/** Jonah: Pip and Wren's holder, his own practice, a teacher at Alder
 * Grove, and the second parent of the Lund family. */
const power = me({
  learners: [child("pip", "Pip"), child("wren", "Wren")],
  familyClass: {
    orgId: FAMILY,
    classId: FAMILY_CLASS,
    className: "Pell family",
    notice: false,
  },
  secondParentOf: [
    {
      orgId: OTHER_FAMILY,
      classId: OTHER_FAMILY_CLASS,
      className: "Lund family",
      learners: [child("kai", "Kai")],
    },
  ],
  staffOf: [{ orgId: SCHOOL, orgName: "Alder Grove", role: "teacher" }],
  adultPractice: {
    eligible: true,
    learner: { id: "jonah", name: "Jonah", active: true },
  },
  practiceProfiles: [
    {
      id: "profile-4",
      label: "Grade 4",
    } as NonNullable<SignedInMe["practiceProfiles"]>[number],
  ],
});
const holder = me({
  learners: [child("pip", "Pip"), child("wren", "Wren")],
  familyClass: {
    orgId: FAMILY,
    classId: FAMILY_CLASS,
    className: "Pell family",
    notice: false,
  },
});
const secondParent = me({
  secondParentOf: power.secondParentOf,
});
const adultOnly = me({
  adultPractice: {
    eligible: true,
    learner: { id: "rowan", name: "Rowan", active: true },
  },
});
const staffOnly = me({
  staffOf: [{ orgId: SCHOOL, orgName: "Alder Grove", role: "admin" }],
});

function org(
  overrides: Partial<OrgResource> & Pick<OrgResource, "id" | "kind">,
): OrgResource {
  return {
    name: "Alder Grove",
    parentId: null,
    timezone: "America/New_York",
    roles: [],
    can: [],
    ...overrides,
  };
}
const klass = (id: string, orgId: string, name: string, studentCount = 20) =>
  ({
    id,
    orgId,
    sessionId: ID(99),
    name,
    courseBands: [],
    gradingKind: "year",
    joinCode: "ABCDEF",
    studentCount,
    teachers: [],
  }) satisfies ClassResource;

const ADMIN_CAN = [
  "org.read",
  "classes.read",
  "staff.read",
  "overview.read",
  "license.read",
  "calendar.read",
  "privacy.read",
  "activity.read",
  "settings.read",
  "integrations.read",
] as const;
const FAMILY_CAN = [
  "org.read",
  "classes.read",
  "calendar.read",
  "settings.read",
  "staff.read",
] as const;

const school = (overrides: Partial<OrgResource> = {}) =>
  org({ id: SCHOOL, kind: "school", can: [...ADMIN_CAN], ...overrides });
const familyOrg = (id = FAMILY, name = "Pell family") =>
  org({ id, kind: "family", name, can: [...FAMILY_CAN] });

const adult = (account: SignedInMe | null, learnerId: string | null = null) =>
  ({ kind: "adult", me: account, learnerId }) satisfies SpaceSession;
const at = (pathname: string, extra: Partial<SpaceMatch> = {}): SpaceMatch => ({
  pathname,
  ...extra,
});
const classPath = (orgId: string, classId: string, leaf = "today") =>
  `/school/${orgId}/classes/${classId}/${leaf}`;
const ids = (space: SpaceDescriptor) => space.tabs.map((tab) => tab.id);
const destinations = (space: SpaceDescriptor) =>
  space.destinations.map((entry) => entry.label);
function expectSpace<S extends SpaceDescriptor["space"]>(
  space: SpaceDescriptor,
  kind: S,
): asserts space is Extract<SpaceDescriptor, { space: S }> {
  assert.equal(space.space, kind);
}

test("sessions: none is public, a student always wins, an adult resolves the route", () => {
  for (const path of ["/", "/practice", classPath(SCHOOL, ROOM), "/me"])
    expectSpace(resolveSpace(at(path), { kind: "none" }), "public");
  const student = me({
    account: {
      id: "school:person",
      email: null,
      emailVerified: false,
      kind: "student",
    },
    learners: [child("ana", "Ana")],
    school: { orgName: "Alder Grove", levels: "shown", standings: true },
  });
  for (const path of [
    "/practice",
    "/overview",
    classPath(FAMILY, FAMILY_CLASS),
    "/me",
    "/family/security",
  ]) {
    const space = resolveSpace(at(path), { kind: "student", me: student });
    expectSpace(space, "student");
    assert.equal(space.learner?.name, "Ana");
    // Nothing of a parent's or a class's.
    for (const destination of space.destinations)
      assert.ok(["practice", "standings"].includes(destination.id));
  }
  assert.deepEqual(
    resolveSpace(at("/practice"), { kind: "student", me: student }).actions,
    ["sign-out"],
  );
});

test("a parent's cookie beside a student's session never brings the parent's chrome", () => {
  // The device's `/me` is still the parent's from before the handover.
  const space = resolveSpace(
    at(classPath(FAMILY, FAMILY_CLASS)),
    { kind: "student", me: holder },
    { org: familyOrg(), year: { past: false } },
  );
  expectSpace(space, "student");
  assert.deepEqual(space.tabs, []);
  assert.ok(!destinations(space).some((label) => label.includes("Pip")));
  assert.equal(space.place, null);
});

test("holder: their family is Family, named by its org, with only their children", () => {
  const space = resolveSpace(
    at(classPath(FAMILY, FAMILY_CLASS)),
    adult(holder, "wren"),
    {
      org: familyOrg(),
      classes: [klass(FAMILY_CLASS, FAMILY, "Pell family", 2)],
      year: { past: false },
    },
  );
  expectSpace(space, "family");
  assert.equal(space.status, "ready");
  assert.equal(space.relation, "holder");
  assert.equal(space.family.id, FAMILY);
  assert.equal(space.label, "Pell family");
  assert.equal(space.place, "home");
  assert.deepEqual(ids(space), [
    "today",
    "map",
    "workbooks",
    "time",
    "report-cards",
    "roster",
    "settings",
  ]);
  assert.deepEqual(
    space.tabs.filter((tab) => tab.phone).map((tab) => tab.id),
    ["today", "map", "workbooks", "time"],
  );
  assert.equal(space.learner?.id, "wren");
  assert.deepEqual(
    space.learners.map((learner) => learner.id),
    ["pip", "wren"],
  );
  // The child's practice is named as the child's, never "Practice".
  assert.deepEqual(destinations(space), [
    "Today",
    "Let Wren practice",
    "Wren’s progress",
  ]);
  assert.equal(space.words.learner, "child");
  assert.equal(space.words.people, "People");
});

test("second parent: the family they belong to, its children read-only, never her own practice", () => {
  const space = resolveSpace(
    at(classPath(OTHER_FAMILY, OTHER_FAMILY_CLASS)),
    adult(secondParent),
    { org: familyOrg(OTHER_FAMILY, "Lund family"), year: { past: false } },
  );
  expectSpace(space, "family");
  assert.equal(space.relation, "second-parent");
  assert.equal(space.place, `family:${OTHER_FAMILY}`);
  assert.deepEqual(
    space.learners.map((learner) => learner.id),
    ["kai"],
  );
  // Kai practices from the family's Today ("Let Kai practice here").
  assert.deepEqual(destinations(space), ["Today", "Kai’s progress"]);
});

test("family co-teacher: the family's place, none of its children as theirs", () => {
  const space = resolveSpace(
    at(classPath(TUTOR_FAMILY, TUTOR_CLASS)),
    adult(adultOnly),
    {
      org: familyOrg(TUTOR_FAMILY, "Lund co-op"),
      classes: [klass(TUTOR_CLASS, TUTOR_FAMILY, "Lund co-op", 12)],
      year: { past: false },
    },
  );
  expectSpace(space, "family");
  assert.equal(space.relation, "co-teacher");
  assert.deepEqual(space.learners, []);
  assert.equal(space.learner, null);
  assert.equal(space.place, `school:${TUTOR_FAMILY}`);
  // A larger group keeps its gradebook, under More.
  assert.ok(ids(space).includes("gradebook"));
  assert.ok(!space.tabs.find((tab) => tab.id === "gradebook")?.phone);
});

test("a family's tabs never look like a classroom's", () => {
  const family = resolveSpace(
    at(classPath(FAMILY, FAMILY_CLASS)),
    adult(holder),
    { org: familyOrg(), year: { past: false } },
  );
  const room = resolveSpace(at(classPath(SCHOOL, ROOM)), adult(staffOnly), {
    org: school({ teaches: [ROOM] }),
    classes: [klass(ROOM, SCHOOL, "Grade 4 Math")],
    year: { past: false },
  });
  assert.notDeepEqual(ids(family), ids(room));
  assert.notDeepEqual(
    family.tabs.map((tab) => tab.label),
    room.tabs.map((tab) => tab.label),
  );
  assert.notEqual(family.words.tabs, room.words.tabs);
});

test("classroom roles: teacher, aide, viewer and admin each reach the class as themselves", () => {
  const resources = (overrides: Partial<OrgResource>): SpaceResources => ({
    org: school(overrides),
    classes: [
      klass(ROOM, SCHOOL, "Grade 4 Math"),
      klass(ROOM_TWO, SCHOOL, "Grade 5 Math"),
    ],
    year: { past: false },
  });
  const cases = [
    [
      {
        roles: ["teacher"],
        teaches: [ROOM],
        can: ["org.read", "classes.read"],
      },
      "teacher",
    ],
    [{ roles: ["aide"], can: ["org.read", "classes.read"] }, "aide"],
    [{ roles: ["viewer"], can: ["org.read", "overview.read"] }, "viewer"],
    [{ roles: ["admin"] }, "admin"],
  ] as const;
  for (const [overrides, role] of cases) {
    const space = resolveSpace(
      at(classPath(SCHOOL, ROOM)),
      adult(staffOnly),
      resources(overrides as unknown as Partial<OrgResource>),
    );
    expectSpace(space, "classroom");
    assert.equal(space.role, role, role);
    assert.equal(space.label, "Grade 4 Math · Alder Grove");
    assert.deepEqual(ids(space), [
      "today",
      "map",
      "gradebook",
      "roster",
      "time",
      "workbooks",
      "settings",
    ]);
    assert.deepEqual(
      space.tabs.filter((tab) => tab.phone).map((tab) => tab.label),
      ["Today", "Map", "Grades", "Students"],
    );
    // Its capabilities are the org's, named as the org's.
    assert.deepEqual(space.capabilities[0]?.target, {
      kind: "org",
      id: SCHOOL,
    });
    assert.equal(space.words.learner, "student");
    assert.ok(!("learner" in space));
  }
});

test("Start class only for a real class with practice running, never in a past year", () => {
  const base = {
    org: school({ teaches: [ROOM] }),
    classes: [klass(ROOM, SCHOOL, "Grade 4 Math")],
  };
  const space = (resources: SpaceResources) =>
    resolveSpace(at(classPath(SCHOOL, ROOM)), adult(staffOnly), resources);
  assert.deepEqual(
    space({ ...base, year: { past: false }, covered: 3 }).actions,
    ["start-class"],
  );
  assert.deepEqual(
    space({ ...base, year: { past: false }, covered: 0 }).actions,
    [],
  );
  const past = space({ ...base, year: { past: true }, covered: 3 });
  assert.deepEqual(past.actions, []);
  assert.deepEqual(ids(past), ["gradebook", "time"]);
  const demo = space({
    ...base,
    org: school({ demo: true, teaches: [ROOM] }),
    year: { past: false },
  });
  assert.deepEqual(demo.actions, ["demo-setup"]);
});

test("school and district tabs follow the server's capabilities exactly", () => {
  const admin = resolveSpace(at(`/school/${SCHOOL}`), adult(staffOnly), {
    org: school({ roles: ["admin"] }),
    classes: [klass(ROOM, SCHOOL, "A"), klass(ROOM_TWO, SCHOOL, "B")],
  });
  expectSpace(admin, "school");
  assert.deepEqual(ids(admin), [
    "overview",
    "classes",
    "staff",
    "license",
    "calendar",
    "privacy",
    "activity",
    "settings",
    "integrations",
  ]);
  assert.deepEqual(
    admin.tabs.filter((tab) => tab.phone).map((tab) => tab.label),
    ["Overview", "Classes", "Staff", "License"],
  );
  const viewer = resolveSpace(at(`/school/${SCHOOL}`), adult(staffOnly), {
    org: school({
      roles: ["viewer"],
      can: ["org.read", "classes.read", "overview.read"],
    }),
  });
  assert.deepEqual(ids(viewer), ["overview", "classes"]);
  const district = resolveSpace(
    at(`/school/${DISTRICT}/schools`),
    adult(staffOnly),
    {
      org: org({
        id: DISTRICT,
        kind: "district",
        name: "Lake District",
        can: [...ADMIN_CAN],
      }),
    },
  );
  assert.ok(ids(district).includes("schools"));
  assert.equal(district.active, "schools");
  // A one-class school is its class: no overview or activity. Its staff
  // stay, for whoever may read them.
  const lone = resolveSpace(at(`/school/${SCHOOL}/classes`), adult(staffOnly), {
    org: school({ solo: true }),
    classes: [klass(ROOM, SCHOOL, "A")],
  });
  assert.deepEqual(ids(lone), [
    "classes",
    "staff",
    "license",
    "calendar",
    "privacy",
    "settings",
    "integrations",
  ]);
  for (const [leaf, active] of [
    ["license", "license"],
    ["calendar", "calendar"],
    ["privacy", "privacy"],
    ["integrations", "integrations"],
    ["year", "settings"],
    ["sign-in-help", "staff"],
    ["students", "classes"],
  ])
    assert.equal(
      resolveSpace(at(`/school/${SCHOOL}/${leaf}`), adult(staffOnly), {
        org: school(),
      }).active,
      active,
      leaf,
    );
});

test("late, refused and mismatched resources never describe another place", () => {
  // An answer for another org (a late response after switching): loading.
  const late = resolveSpace(at(classPath(SCHOOL, ROOM)), adult(staffOnly), {
    org: org({ id: DISTRICT, kind: "district", can: [...ADMIN_CAN] }),
    year: { past: false },
  });
  expectSpace(late, "classroom");
  assert.equal(late.status, "loading");
  assert.deepEqual(late.tabs, []);
  // Refused or gone (an ended role): unavailable, nothing to open.
  const refused = resolveSpace(at(classPath(SCHOOL, ROOM)), adult(staffOnly), {
    org: null,
  });
  expectSpace(refused, "classroom");
  assert.equal(refused.status, "unavailable");
  assert.deepEqual(refused.tabs, []);
  assert.deepEqual(refused.destinations, []);
  const yearRefused = resolveSpace(
    at(classPath(SCHOOL, ROOM)),
    adult(staffOnly),
    {
      org: school(),
      year: null,
    },
  );
  assert.equal((yearRefused as { status: string }).status, "unavailable");
  // A holder's family address naming a class that isn't the family's: never
  // swapped for the family's own class.
  const mismatch = resolveSpace(
    at(classPath(FAMILY, ROOM_TWO)),
    adult(holder),
    {
      org: familyOrg(),
      year: { past: false },
    },
  );
  expectSpace(mismatch, "family");
  assert.equal(mismatch.status, "unavailable");
  assert.deepEqual(mismatch.tabs, []);
  assert.deepEqual(mismatch.destinations, []);
  assert.equal(mismatch.class?.id, ROOM_TWO);
  // Before its org answers, the account's own relationship already knows a
  // family: no flash of a classroom's chrome.
  const early = resolveSpace(
    at(classPath(FAMILY, FAMILY_CLASS)),
    adult(holder),
  );
  expectSpace(early, "family");
  assert.equal(early.status, "loading");
});

test("role loss: the same route with the role gone keeps no tab and no action", () => {
  const before = resolveSpace(at(`/school/${SCHOOL}`), adult(staffOnly), {
    org: school(),
  });
  const after = resolveSpace(at(`/school/${SCHOOL}`), adult(staffOnly), {
    org: school({ roles: [], can: ["org.read"] }),
  });
  assert.ok(before.tabs.length > 3);
  assert.deepEqual(ids(after), []);
});

test("shared learning routes: the route's learner, a profile, then the device's choice", () => {
  // Explicit in the address: whoever another tab chose.
  const named = resolveSpace(
    at("/pathways", { search: { learner: "pip" } }),
    adult(power, "wren"),
  );
  expectSpace(named, "family");
  assert.equal(named.learner?.id, "pip");
  assert.equal(named.label, "Pip");
  assert.deepEqual(
    named.tabs.map((tab) => tab.search),
    [{ learner: "pip" }, { learner: "pip" }, { learner: "pip" }],
  );
  // The route's own `$learnerId`.
  const workbooks = resolveSpace(
    at("/learners/kai/workbooks", { learner: "kai" }),
    adult(power, "pip"),
  );
  expectSpace(workbooks, "family");
  assert.equal(workbooks.family.id, OTHER_FAMILY);
  assert.equal(workbooks.relation, "second-parent");
  // A profile in the address is the adult's own practice.
  const profile = resolveSpace(
    at("/practice", { search: { profile: "profile-4" } }),
    adult(power, "pip"),
  );
  expectSpace(profile, "me");
  assert.equal(profile.mode, "profile");
  assert.equal(profile.label, "Grade 4");
  // A learner who isn't this account's is nobody's here: never another child.
  const foreign = resolveSpace(
    at("/overview", { search: { learner: "stranger" } }),
    adult(power, "pip"),
  );
  expectSpace(foreign, "me");
  assert.equal(foreign.learner, null);
  assert.deepEqual(foreign.tabs, []);
  // Without any: the device's choice.
  const chosen = resolveSpace(at("/overview"), adult(power, "wren"));
  expectSpace(chosen, "family");
  assert.equal(chosen.learner?.id, "wren");
});

test("Back and two tabs: the same inputs always describe the same place", () => {
  const match = at("/inventory", { search: { learner: "pip" } });
  const a = resolveSpace(match, adult(power, "pip"));
  const b = resolveSpace(match, adult(power, "wren"));
  assert.deepEqual(a, b);
  const there = at(classPath(SCHOOL, ROOM));
  const resources = {
    org: school({ teaches: [ROOM] }),
    classes: [klass(ROOM, SCHOOL, "Grade 4 Math")],
    year: { past: false },
  };
  assert.deepEqual(
    resolveSpace(there, adult(power), resources),
    resolveSpace(there, adult(power), resources),
  );
});

test("power user: each place looks right on its own terms, and nothing follows them", () => {
  const mine = resolveSpace(at("/me"), adult(power, "pip"));
  expectSpace(mine, "me");
  assert.equal(mine.label, "My practice");
  assert.deepEqual(ids(mine), [
    "practice",
    "levels",
    "workbooks",
    "pathways",
    "inventory",
    "profiles",
  ]);
  assert.deepEqual(destinations(mine), [
    "Practice",
    "Levels",
    "Workbooks",
    "Profiles",
  ]);
  // Audit #8: My practice never carries the family's class or a child.
  assert.ok(!JSON.stringify(mine.destinations).includes(FAMILY));
  assert.equal(mine.learner?.id, "jonah");
  const family = resolveSpace(
    at(classPath(FAMILY, FAMILY_CLASS)),
    adult(power, "jonah"),
    {
      org: familyOrg(),
      year: { past: false },
    },
  );
  expectSpace(family, "family");
  assert.equal(family.learner?.id, "pip");
  assert.ok(!destinations(family).includes("Practice"));
  const room = resolveSpace(at(classPath(SCHOOL, ROOM)), adult(power, "pip"), {
    org: school({
      roles: ["teacher"],
      teaches: [ROOM],
      can: ["org.read", "classes.read"],
    }),
    classes: [klass(ROOM, SCHOOL, "Grade 4 Math")],
    year: { past: false },
  });
  expectSpace(room, "classroom");
  assert.ok(!("learner" in room));
  assert.ok(!JSON.stringify(room).includes("Pip"));
  // Their class, and the school's classes (other classes, earlier years).
  assert.deepEqual(destinations(room), ["Grade 4 Math", "School"]);
  const other = resolveSpace(
    at(classPath(OTHER_FAMILY, OTHER_FAMILY_CLASS)),
    adult(power, "pip"),
    { org: familyOrg(OTHER_FAMILY, "Lund family"), year: { past: false } },
  );
  expectSpace(other, "family");
  assert.equal(other.relation, "second-parent");
  assert.deepEqual(
    other.learners.map((learner) => learner.id),
    ["kai"],
  );
});

test("me: Practice, Levels and Workbooks on a phone; the rest under More", () => {
  const space = resolveSpace(
    at("/learners/rowan/workbooks", { learner: "rowan" }),
    adult(adultOnly, "rowan"),
  );
  expectSpace(space, "me");
  assert.equal(space.active, "workbooks");
  assert.deepEqual(
    space.tabs.filter((tab) => tab.phone).map((tab) => tab.label),
    ["Practice", "Levels", "Workbooks"],
  );
  assert.deepEqual(space.actions, []);
  assert.equal(
    resolveSpace(at("/me/profiles"), adult(adultOnly)).active,
    "profiles",
  );
  assert.deepEqual(
    resolveSpace(at("/practice"), adult(adultOnly, "rowan")).actions,
    ["profile-back"],
  );
});

test("account: its own neutral addresses and the old ones, never family chrome", () => {
  for (const path of [
    "/account/security",
    "/account/billing/records",
    "/account/privacy/export",
    "/family/security",
    "/family/access",
    "/family/privacy",
  ]) {
    const space = resolveSpace(at(path), adult(holder));
    expectSpace(space, "account");
    assert.equal(space.scope, "settings", path);
    assert.deepEqual(
      space.tabs.map((tab) => tab.path),
      [
        "account/security",
        "family/learners",
        "account/billing",
        "account/privacy",
      ],
    );
    assert.equal(space.label, "Account");
    assert.deepEqual(space.destinations, []);
  }
  for (const [path, scope] of [
    ["/start", "starter"],
    ["/start/parent", "starter"],
    ["/school/start", "setup"],
    ["/school/connect", "setup"],
    ["/school/new", "setup"],
    ["/purchase/arizona-esa", "steps"],
    ["/access", "steps"],
  ] as const) {
    const space = resolveSpace(at(path), adult(power));
    expectSpace(space, "account");
    assert.equal(space.scope, scope, path);
  }
});

test("links with their own authority are entries, never an ambient workspace", () => {
  for (const [path, entry] of [
    ["/school/invite", "invite"],
    ["/family/approve", "approval"],
    ["/family/approvals/abc", "approval"],
    ["/schools/continue", "buyer"],
    ["/p", "page"],
    ["/join/ABC123", "student-entry"],
    ["/c", "student-entry"],
  ] as const) {
    const space = resolveSpace(at(path), adult(power));
    expectSpace(space, "public");
    assert.equal(space.entry, entry, path);
    assert.deepEqual(space.tabs, []);
    assert.deepEqual(space.destinations, []);
    assert.equal(space.place, null);
  }
});

test("every route family has its space", () => {
  const table: [string, string][] = [
    ["/", "learner"],
    ["/practice", "learner"],
    ["/overview", "learner"],
    ["/progress", "learner"],
    ["/pathways/fractions", "learner"],
    ["/inventory", "learner"],
    ["/lessons/abc", "learner"],
    ["/books/x", "learner"],
    ["/learners/a/workbooks/2026-11-09", "learner"],
    ["/continue/a", "learner"],
    ["/profile/birth-year", "learner"],
    ["/me", "me"],
    ["/me/start", "me"],
    ["/me/profiles/new", "me"],
    ["/join", "student"],
    ["/join/ABC/def", "student"],
    ["/c", "student"],
    ["/standings", "student"],
    ["/sign-in", "public"],
    ["/sign-up", "public"],
    ["/reset-password", "public"],
    ["/schools", "public"],
    ["/schools/trust", "public"],
    ["/schools/continue", "public"],
    ["/p", "public"],
    ["/design", "public"],
    ["/dev/personas", "public"],
    ["/school/invite", "public"],
    ["/family/approve", "public"],
    ["/family/approvals/x", "public"],
    ["/school", "account"],
    ["/school/new", "account"],
    ["/school/start", "account"],
    ["/school/connect", "account"],
    ["/school/adopt", "account"],
    ["/start", "account"],
    ["/start/plan", "account"],
    ["/family", "account"],
    ["/family/learners/new", "account"],
    ["/family/security/delete", "account"],
    ["/account/security", "account"],
    ["/account/security/delete", "account"],
    ["/account/billing/purchases", "account"],
    ["/account/ready", "account"],
    ["/access", "account"],
    ["/purchase/annual", "account"],
    ["/invoice/arizona-esa", "account"],
    ["/consent", "account"],
    [`/school/${SCHOOL}`, "school"],
    [`/school/${SCHOOL}/staff`, "school"],
    [`/school/${SCHOOL}/students/x/work/y`, "school"],
    [classPath(SCHOOL, ROOM), "classroom"],
    [classPath(SCHOOL, ROOM, "workbooks/2026-11-09"), "classroom"],
  ];
  for (const [path, space] of table)
    assert.equal(spaceOfPath(path), space, path);
});

test("every typed route declares its space, and the declaration matches its address", () => {
  const sample = (path: string) =>
    path
      .replace("$org", SCHOOL)
      .replace("$class", ROOM)
      .replace(/\$[A-Za-z]+/g, "x")
      .replace(/\/\$$/, "/x")
      .replace("${path}", "/staff");
  let checked = 0;
  for (const file of ["router.tsx", "school-routes.tsx"]) {
    const source = readFileSync(
      new URL(`../src/web/app/${file}`, import.meta.url),
      "utf8",
    );
    const pattern =
      /path: [`"]([^`"]+)[`"],\n\s+staticData: \{[^}]*space: "([a-z]+)"/g;
    for (const [, path, declared] of source.matchAll(pattern)) {
      assert.ok(path!.startsWith("/"), path);
      assert.equal(spaceOfPath(sample(path!)), declared, path);
      checked++;
    }
    // A top-level route with an address declares one.
    for (const [, path] of source.matchAll(
      /getParentRoute: \(\) => root,\n\s+path: [`"]([^`"]+)[`"],\n(?!\s+staticData)/g,
    ))
      assert.fail(`${file}: ${path} declares no space`);
  }
  assert.ok(checked > 60, `checked ${checked}`);
});

test("every space has its words, and a family's never say student", () => {
  for (const space of SPACES) assert.ok(spaceWords(space).tabs !== undefined);
  const family = Object.values(spaceWords("family")).join(" ").toLowerCase();
  assert.ok(!/\bstudents?\b/.test(family));
  assert.ok(!/\bclass\b/.test(family));
  const room = Object.values(spaceWords("classroom")).join(" ").toLowerCase();
  assert.ok(!/\b(child|children|kids)\b/.test(room));
});

test("a one-class school's admin reaches the school from the class; its own pilot teacher does not", () => {
  const lone = (can: readonly string[], roles: OrgResource["roles"]) =>
    resolveSpace(at(classPath(SCHOOL, ROOM)), adult(staffOnly), {
      org: school({
        solo: true,
        roles,
        teaches: [ROOM],
        can: can as OrgResource["can"],
      }),
      classes: [klass(ROOM, SCHOOL, "Grade 4 Math")],
      year: { past: false },
    });
  const admin = lone(ADMIN_CAN, ["admin"]);
  expectSpace(admin, "classroom");
  // The class and its school, by name, a one-class school too (R16).
  assert.equal(admin.label, "Grade 4 Math · Alder Grove");
  assert.equal(admin.role, "teacher");
  const above = admin.destinations.find((entry) => entry.id === "school");
  assert.ok(above, "the school is a destination");
  // `/school/<org>` would open the class again: its first tab instead.
  assert.equal(above.path, `school/${SCHOOL}/classes`);
  assert.equal(above.detail, "Alder Grove");
  const pilot = lone(
    [
      "org.read",
      "classes.read",
      "students.read",
      "calendar.read",
      "settings.read",
    ],
    ["teacher"],
  );
  expectSpace(pilot, "classroom");
  assert.deepEqual(destinations(pilot), ["Grade 4 Math"]);
  assert.equal(pilot.label, "Grade 4 Math · Alder Grove");
  // A phone's bar names the class alone; the drawer says its school.
  assert.equal(pilot.shortLabel, "Grade 4 Math");
  assert.equal(pilot.destinations[0]?.detail, "Alder Grove");
  assert.equal(
    admin.destinations[0]?.detail,
    undefined,
    "its School row says it",
  );
});

test("an admin or viewer inspecting a class keeps their own role; only teaching makes them its teacher", () => {
  for (const role of ["admin", "viewer"] as const) {
    const space = resolveSpace(at(classPath(SCHOOL, ROOM)), adult(staffOnly), {
      org: school({ roles: [role], teaches: [] }),
      classes: [
        klass(ROOM, SCHOOL, "Grade 4 Math"),
        klass(ROOM_TWO, SCHOOL, "B"),
      ],
      year: { past: false },
      covered: 3,
    });
    expectSpace(space, "classroom");
    assert.equal(space.role, role);
    // Start class is the class's teacher's, on the server's terms: never
    // offered on the strength of oversight.
    assert.ok(destinations(space).includes("School"));
  }
});

test("CP-2 H2: one learner per address, the same order as adoption", () => {
  // A profile outranks ?learner=: the frame is the profile's, not Pip's.
  const both = resolveSpace(
    at("/practice", { search: { profile: "profile-4", learner: "pip" } }),
    adult(power, "wren"),
  );
  expectSpace(both, "me");
  assert.equal(both.mode, "profile");
  assert.equal(both.learner?.id, "profile-4");
  // A profile's tabs are the profile's own: its levels, its address.
  const tabs = resolveSpace(
    at("/pathways", { search: { profile: "profile-4" } }),
    adult(power, "pip"),
  );
  assert.deepEqual(
    tabs.tabs.map((tab) => [tab.id, tab.path, tab.search ?? null]),
    [
      ["practice", "practice", { profile: "profile-4" }],
      ["levels", "me/profiles/profile-4", null],
      ["pathways", "pathways", { profile: "profile-4" }],
      ["inventory", "inventory", { profile: "profile-4" }],
      ["profiles", "me/profiles", null],
    ],
  );
  // A learner this account doesn't read is unavailable, never another.
  const foreign = resolveSpace(
    at("/practice", { search: { learner: "stranger" } }),
    adult(power, "wren"),
  );
  expectSpace(foreign, "me");
  assert.equal(foreign.status, "unavailable");
  assert.equal(foreign.learner, null);
  assert.deepEqual(foreign.tabs, []);
});

test("CP-2 H4: their own child hosted in another family's class stays theirs", () => {
  const hosted = me({ learners: [child("pip", "Pip")] });
  const space = resolveSpace(
    at("/overview", { search: { learner: "pip" } }),
    adult(hosted, null),
  );
  expectSpace(space, "family");
  assert.equal(space.learner?.id, "pip");
  assert.equal(space.label, "Pip");
  assert.equal(space.family.id, null);
  assert.deepEqual(
    space.learners.map((learner) => learner.id),
    ["pip"],
  );
});

test("CP-2 H4: a class is framed only under its own org", () => {
  const resources = (year: SpaceResources["year"]): SpaceResources => ({
    org: school({ roles: ["admin"] }),
    classes: [],
    year,
  });
  // The server says the class belongs elsewhere: unavailable, no tabs.
  const elsewhere = resolveSpace(
    at(classPath(SCHOOL, ROOM)),
    adult(staffOnly),
    resources({ past: false, orgId: DISTRICT, path: [DISTRICT] }),
  );
  expectSpace(elsewhere, "classroom");
  assert.equal(elsewhere.status, "unavailable");
  assert.deepEqual(elsewhere.tabs, []);
  assert.equal(elsewhere.label, null);
  // Its own org, or one above it: ready, named by the server's answer even
  // past the first page of the class list.
  const own = resolveSpace(
    at(classPath(SCHOOL, ROOM)),
    adult(staffOnly),
    resources({
      past: false,
      orgId: SCHOOL,
      path: [DISTRICT, SCHOOL],
      name: "Grade 4 Math",
      can: ["classes.read", "signin.read", "grades.write"],
    }),
  );
  expectSpace(own, "classroom");
  assert.equal(own.status, "ready");
  assert.equal(own.class.name, "Grade 4 Math");
  // Its capabilities are the class's own, beside the org's.
  assert.deepEqual(
    own.capabilities.map((entry) => entry.target),
    [
      { kind: "org", id: SCHOOL },
      { kind: "class", id: ROOM },
    ],
  );
  assert.deepEqual(own.capabilities[1]!.can, [
    "classes.read",
    "signin.read",
    "grades.write",
  ]);
  // A family co-teacher's class in another org is unavailable too.
  const family = resolveSpace(
    at(classPath(TUTOR_FAMILY, TUTOR_CLASS)),
    adult(adultOnly),
    {
      org: familyOrg(TUTOR_FAMILY, "Lund co-op"),
      year: { past: false, orgId: SCHOOL, path: [SCHOOL] },
    },
  );
  expectSpace(family, "family");
  assert.equal(family.status, "unavailable");
  assert.deepEqual(family.tabs, []);
});

test("CP-2 H4: a role from above reads as what it may do here; Start needs the board", () => {
  const inherited = (can: string[]) =>
    resolveSpace(at(classPath(SCHOOL, ROOM)), adult(staffOnly), {
      org: school({ roles: [], can: can as OrgResource["can"] }),
      classes: [klass(ROOM, SCHOOL, "Grade 4 Math")],
      year: { past: false, orgId: SCHOOL, path: [SCHOOL] },
    });
  const admin = inherited(["org.read", "overview.read", "staff.manage"]);
  expectSpace(admin, "classroom");
  assert.equal(admin.role, "admin");
  const viewer = inherited(["org.read", "overview.read"]);
  expectSpace(viewer, "classroom");
  assert.equal(viewer.role, "viewer");
  // Practice is running, but this person can't open its sign-in board.
  const noBoard = resolveSpace(at(classPath(SCHOOL, ROOM)), adult(staffOnly), {
    org: school({ teaches: [ROOM] }),
    classes: [klass(ROOM, SCHOOL, "Grade 4 Math")],
    year: { past: false, orgId: SCHOOL, path: [SCHOOL], can: ["classes.read"] },
    covered: 3,
  });
  assert.deepEqual(noBoard.actions, []);
});
