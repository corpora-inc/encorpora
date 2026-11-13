import { expect, test } from "vitest";
import type { Me, SignedInMe } from "../../../../account/contracts";
import {
  homePlace,
  isStarterPath,
  placeOfPath,
  placesFor,
  startDestination,
} from "../guard";

function me(overrides: Partial<SignedInMe> = {}): SignedInMe {
  return {
    signedIn: true,
    account: {
      id: "parent",
      email: "parent@example.test",
      emailVerified: true,
    },
    consent: { status: "none", method: null },
    learners: [],
    family: {
      consent: {
        status: "not-recorded",
        policyVersion: null,
        recordedAt: null,
        withdrawnAt: null,
      },
      learners: [],
      retained: {
        identity: "",
        financial: "",
        backups: "",
        privacyAuditDays: 30,
      },
    },
    next: "start",
    ...overrides,
  };
}
const steps = [
  "/start",
  "/start/verify-email",
  "/start/plan",
  "/start/purchase",
  "/start/consent",
  "/start/name",
  "/start/birth-year",
];
function table(value: Me) {
  return Object.fromEntries(
    steps.map((path) => [path, startDestination(value, path)]),
  );
}

test("signed-out visitors go to sign in from every step", () => {
  expect(Object.values(table({ signedIn: false, next: "sign-in" }))).toEqual(
    steps.map(() => "/sign-in"),
  );
});

test("a new account answers the starter; every old first-run step leads there", () => {
  const fresh = me({ next: "start" });
  expect(table(fresh)).toEqual({
    "/start": null,
    "/start/verify-email": "/start",
    "/start/plan": "/start",
    "/start/purchase": null,
    "/start/consent": "/start",
    "/start/name": "/start",
    "/start/birth-year": "/start",
  });
  // `/` sends a new account to the starter.
  expect(startDestination(fresh, "/")).toBe("/start");
  // Each answer has its own URL on the same screen; an unknown one doesn't.
  for (const choice of ["myself", "parent", "tutor", "teacher", "school"])
    expect(startDestination(fresh, `/start/${choice}`)).toBeNull();
  expect(isStarterPath("/start/parent/")).toBe(true);
  expect(isStarterPath("/start/plan")).toBe(false);
  expect(isStarterPath("/start/anything")).toBe(false);
});

test("anyone with a place may open the starter to add one; old steps go home", () => {
  const family = me({
    next: "practice",
    learners: [
      {
        id: "fox",
        name: "Fox",
        birthYear: 2016,
        entitlement: {
          active: true,
          licensed: false,
          plan: null,
          endsAt: null,
        },
      },
    ],
  });
  expect(startDestination(family, "/start")).toBeNull();
  expect(startDestination(family, "/start/teacher")).toBeNull();
  expect(startDestination(family, "/")).toBeNull();
  for (const path of [
    "/start/plan",
    "/start/consent",
    "/start/name",
    "/start/birth-year",
    "/start/verify-email",
  ])
    expect(startDestination(family, path), path).toBe("/");
  // Stripe's enrollment return always reads the purchase itself.
  expect(startDestination(family, "/start/purchase")).toBeNull();
});

test("after a verified payment no learner holds, the parent chooses who it is for", () => {
  expect(
    table(
      me({
        next: "add-learner",
        consent: { status: "active", method: "monetary-transaction" },
      }),
    ),
  ).toEqual({
    "/start": null,
    "/start/verify-email": "/start/name",
    "/start/plan": "/start/name",
    "/start/purchase": null,
    "/start/consent": "/start/name",
    "/start/name": null,
    "/start/birth-year": null,
  });
});

test("a parent approving another family's child pays first; the plan before any learner is theirs", () => {
  const approving = me({ next: "start", familyApproval: { id: "approval" } });
  expect(startDestination(approving, "/")).toBe("/family/approvals/approval");
  expect(startDestination(approving, "/start/plan")).toBeNull();
  expect(
    startDestination(
      {
        ...approving,
        account: { ...approving.account, confirmationRequired: true },
      },
      "/start/plan",
    ),
  ).toBe("/start/verify-email");
  // With consent the approval page approves.
  expect(
    startDestination(
      {
        ...approving,
        next: "practice",
        consent: { status: "active", method: "monetary-transaction" },
      },
      "/start/plan",
    ),
  ).toBe("/family/approvals/approval");
});

test("funded entry requires confirmation and active consent before learner details", () => {
  for (const path of steps) {
    const unconfirmed = me({
      account: {
        id: "parent",
        email: "parent@example.test",
        emailVerified: false,
        confirmationRequired: true,
      },
    });
    expect(startDestination(unconfirmed, path, false, true)).toBe(
      path === "/start/verify-email" ? null : "/start/verify-email",
    );
    // A new account with no learner yet chooses who it's for on the program's
    // page (themselves, or a child); a child's details still need consent.
    expect(startDestination(me(), path, false, true)).toBe(
      path === "/start/consent"
        ? null
        : path === "/start/name" || path === "/start/birth-year"
          ? "/start/consent"
          : "/purchase/arkansas-efa",
    );
  }
  expect(
    startDestination(
      { signedIn: false, next: "sign-in" },
      "/start/name",
      false,
      true,
    ),
  ).toBe("/sign-in");
});
test("funded setup returns to Arkansas purchase without requiring a Stripe checkout", () => {
  const consent = { status: "active" as const, method: "verified" };
  expect(
    startDestination(me({ consent, next: "start" }), "/start", false, true),
  ).toBe("/start/name");
  const learner = {
    id: "sample",
    name: "Sample",
    birthYear: 2016,
    entitlement: { active: false, plan: null, endsAt: null },
  };
  const parent = me({ consent, learners: [learner] });
  expect(startDestination(parent, "/start/consent", false, true)).toBe(
    "/purchase/arkansas-efa",
  );
  expect(startDestination(parent, "/start/birth-year", false, true)).toBeNull();
  expect(
    startDestination(
      me({
        consent: { status: "withdrawn", method: null },
        learners: [learner],
      }),
      "/start/birth-year",
      false,
      true,
    ),
  ).toBe("/start/consent");
});

test("funded learner setup returns to its selected state without a card purchase", () => {
  const consent = { status: "active" as const, method: "verified" };
  const learner = {
    id: "sample",
    name: "Sample",
    birthYear: 2016,
    entitlement: { active: false, plan: null, endsAt: null },
  };
  for (const slug of [
    "arkansas-efa",
    "new-hampshire-efa",
    "arizona-esa",
  ] as const) {
    expect(
      startDestination(
        me({ consent, learners: [learner] }),
        "/start/consent",
        false,
        slug,
      ),
    ).toBe(`/purchase/${slug}`);
    expect(
      startDestination(me({ consent, learners: [] }), "/start", false, slug),
    ).toBe("/start/name");
    expect(
      startDestination(
        me({
          consent: { status: "withdrawn", method: null },
          learners: [learner],
        }),
        "/start",
        false,
        slug,
      ),
    ).toBe("/start/consent");
  }
});

test("an adult buying for herself goes to the program, never through parent consent or a child's setup", () => {
  const own = {
    eligible: false,
    learner: { id: "own", name: "Student", active: true },
  };
  const myself = me({ adultPractice: own, next: "practice" });
  for (const slug of ["arizona-esa", "arkansas-efa"] as const) {
    for (const path of ["/start", `/purchase/${slug}`, "/start/plan"])
      expect(startDestination(myself, path, false, slug)).toBe(
        `/purchase/${slug}`,
      );
    // Adding a child from there still asks for consent first.
    expect(startDestination(myself, "/start/consent", false, slug)).toBeNull();
    expect(startDestination(myself, "/start/name", false, slug)).toBe(
      "/start/consent",
    );
  }
  // Confirming the email still comes first.
  expect(
    startDestination(
      {
        ...myself,
        account: { ...myself.account, confirmationRequired: true },
      },
      "/start",
      false,
      "arizona-esa",
    ),
  ).toBe("/start/verify-email");
});

test("a parent's children still need consent before a funded purchase", () => {
  const learner = {
    id: "child",
    name: "Child",
    birthYear: 2016,
    entitlement: { active: false, plan: null, endsAt: null },
  };
  for (const path of ["/start", "/purchase/arizona-esa", "/start/name"])
    expect(
      startDestination(me({ learners: [learner] }), path, false, "arizona-esa"),
    ).toBe("/start/consent");
});

test("a gift for an adult on her own goes to the gift, never to a child's setup", () => {
  const myself = me({
    next: "accept-gift",
    adultPractice: {
      eligible: false,
      learner: { id: "own", name: "Student", active: true },
    },
    availableAccessGrant: {
      id: "b24d441b-38d5-42ec-ae99-dbe186b1ffba",
      months: 1,
      claimBy: null,
    },
  });
  for (const path of ["/start/plan", "/start/name", "/start/birth-year", "/"])
    expect(startDestination(myself, path)).toBe("/access");
});

test("an email gift routes around checkout but never around verification or consent", () => {
  const gift = me({
    next: "accept-gift",
    availableAccessGrant: {
      id: "b24d441b-38d5-42ec-ae99-dbe186b1ffba",
      months: 12,
      claimBy: null,
    },
  });
  for (const path of ["/start/plan", "/start/name", "/start/birth-year"]) {
    expect(startDestination(gift, path)).toBe("/access");
  }
  // The starter adds a place; Stripe's return reads its own purchase.
  expect(startDestination(gift, "/start")).toBeNull();
  expect(startDestination(gift, "/start/purchase")).toBeNull();
  expect(startDestination(gift, "/start/consent")).toBeNull();
  const ready = {
    ...gift,
    consent: { status: "active" as const, method: "fixture" },
  };
  expect(startDestination(ready, "/start/name")).toBeNull();
  expect(startDestination(ready, "/start/birth-year")).toBeNull();
  expect(startDestination(ready, "/start/consent")).toBe("/start/name");

  expect(
    startDestination(
      { ...gift, account: { ...gift.account, confirmationRequired: true } },
      "/start/name",
    ),
  ).toBe("/start/verify-email");
});

const staffOf = [
  { orgId: "school", orgName: "Alder Street School", role: "teacher" as const },
];
test("staff open their school from `/`; the starter stays open to add a family", () => {
  const staff = me({ staffOf, next: "practice" });
  expect(startDestination(staff, "/")).toBeNull();
  expect(homePlace(staff, null)).toBe("school:school");
  expect(startDestination(staff, "/start/parent")).toBeNull();
  expect(startDestination(staff, "/start/plan")).toBe("/");
});

/* One account, several roles: a parent, a free assessment and school staff. */
const alder = "9b1d3f4e-2c8a-4b6e-9f10-6a7b8c9d0e1f";
const birch = "1e2d3c4b-5a69-4788-8a9b-0c1d2e3f4a5b";
const school = (
  orgId: string,
  orgName: string,
  extra: { setupPending?: true } = {},
) => ({ orgId, orgName, role: "admin" as const, ...extra });
const jordan = {
  id: "jordan",
  name: "Jordan",
  birthYear: 2015,
  entitlement: { active: true, plan: "annual", endsAt: null },
};

test("a teacher who tutors keeps their family class at `/`, and the school a tap away", () => {
  const teacher = me({
    staffOf: [school(alder, "Alder Street School")],
    familyClass: {
      orgId: birch,
      classId: birch,
      className: "Casey’s class",
      notice: false,
    },
    next: "practice",
  });
  expect(startDestination(teacher, "/")).toBeNull();
  expect(startDestination(teacher, "/start/plan")).toBe("/");
  expect(homePlace(teacher, null)).toBe("home");
  expect(placesFor(teacher)).toEqual(["home", `school:${alder}`]);
  // Last worked at the school: `/` goes back there.
  expect(homePlace(teacher, `school:${alder}`)).toBe(`school:${alder}`);
  expect(homePlace(teacher, "home")).toBe("home");
});

test("a teacher who is also a parent opens where they last worked", () => {
  const both = me({
    staffOf: [school(alder, "Alder Street School")],
    learners: [jordan],
    consent: { status: "active", method: "verified" },
    next: "practice",
  });
  expect(homePlace(both, null)).toBe("home");
  expect(homePlace(both, "home")).toBe("home");
  expect(homePlace(both, `school:${alder}`)).toBe(`school:${alder}`);
  // A school they no longer work at is forgotten, not a dead end.
  expect(homePlace(both, `school:${birch}`)).toBe("home");
  expect(placesFor(both)).toEqual(["home", `school:${alder}`]);
});

test("staff only start at their school; with several they choose", () => {
  const one = me({
    staffOf: [school(alder, "Alder Street School")],
    next: "practice",
  });
  expect(startDestination(one, "/")).toBeNull();
  expect(homePlace(one, null)).toBe(`school:${alder}`);
  // Nothing on the family side to return to: the school it is.
  expect(homePlace(one, "home")).toBe(`school:${alder}`);
  expect(placesFor(one)).toEqual([`school:${alder}`]);
  const two = me({
    staffOf: [
      school(birch, "Birch Road School"),
      school(alder, "Alder Street School"),
    ],
  });
  expect(homePlace(two, null)).toBe("schools");
  expect(homePlace(two, `school:${birch}`)).toBe(`school:${birch}`);
  expect(placesFor(two)).toEqual([`school:${alder}`, `school:${birch}`]);
});

test("a half-finished setup never captures `/` from someone with a family side", () => {
  const pending = school(alder, "Alder Street School", { setupPending: true });
  const founder = me({
    staffOf: [pending],
    familyClass: {
      orgId: birch,
      classId: birch,
      className: "Casey’s class",
      notice: false,
    },
    next: "practice",
  });
  expect(startDestination(founder, "/")).toBeNull();
  expect(homePlace(founder, null)).toBe("home");
  expect(homePlace(founder, `school:${alder}`)).toBe("home");
  // Still in the switcher, to finish whenever they choose.
  expect(placesFor(founder)).toEqual(["home", `school:${alder}`]);
  const parent = me({
    staffOf: [pending],
    learners: [jordan],
    consent: { status: "active", method: "verified" },
    next: "practice",
  });
  expect(homePlace(parent, `school:${alder}`)).toBe("home");
  // An admin with nothing else carries on with their setup.
  const admin = me({ staffOf: [pending], next: "practice" });
  expect(homePlace(admin, null)).toBe(`school:${alder}`);
  expect(homePlace(admin, `school:${alder}`)).toBe(`school:${alder}`);
  expect(startDestination(admin, "/")).toBeNull();
});

test("each screen belongs to a place, or to neither", () => {
  expect(placeOfPath(`/school/${alder}/classes`)).toBe(`school:${alder}`);
  expect(placeOfPath(`/school/${alder.toUpperCase()}`)).toBe(`school:${alder}`);
  expect(placeOfPath("/school/new", { org: alder, step: "calendar" })).toBe(
    `school:${alder}`,
  );
  for (const path of [
    "/",
    "/practice",
    "/start/plan",
    "/family/learners",
    "/pathways/n-1",
  ])
    expect(placeOfPath(path)).toBe("home");
  for (const path of [
    "/school",
    "/school/new",
    "/school/invite",
    "/schools",
    "/sign-in",
    "/join/ABC",
    "/school/not-an-id",
  ])
    expect(placeOfPath(path)).toBeNull();
});

test("a tutor's class is their family side before any child of their own", () => {
  const tutor = me({
    next: "practice",
    familyClass: {
      orgId: alder,
      classId: birch,
      className: "Casey’s class",
      notice: false,
    },
  });
  expect(placesFor(tutor)).toEqual(["home"]);
  expect(homePlace(tutor, null)).toBe("home");
});
