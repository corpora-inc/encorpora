import { expect, test } from "vitest";
import type { Me, SignedInMe } from "../../../../account/contracts";
import { homePlace, placeOfPath, placesFor, startDestination } from "../guard";

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
    next: "choose-plan",
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

test("an unconfirmed parent practices free and confirms the address on the way into the plan", () => {
  const unconfirmed = (next: SignedInMe["next"]) =>
    me({
      next,
      account: {
        id: "parent",
        email: "parent@example.test",
        emailVerified: false,
        confirmationRequired: true,
      },
    });
  expect(table(unconfirmed("try"))).toEqual({
    "/start": "/try",
    "/start/verify-email": null,
    "/start/plan": "/start/verify-email",
    "/start/purchase": "/start/verify-email",
    "/start/consent": "/start/verify-email",
    "/start/name": "/try",
    "/start/birth-year": "/try",
  });
  // A plan chosen before sign-up leads to the confirmation step first.
  expect(startDestination(unconfirmed("try"), "/start", true)).toBe(
    "/start/verify-email",
  );
  expect(table(unconfirmed("choose-plan"))["/start"]).toBe(
    "/start/verify-email",
  );
});

test("a parent without consent chooses a plan first; consent is never a forced detour", () => {
  expect(table(me({ next: "choose-plan" }))).toEqual({
    "/start": "/start/plan",
    "/start/verify-email": "/start/plan",
    "/start/plan": null,
    "/start/purchase": null,
    "/start/consent": null,
    "/start/name": "/start/plan",
    "/start/birth-year": "/start/plan",
  });
});

test("after verified payment the parent adds the learner; checkout steps close", () => {
  expect(
    table(
      me({
        next: "add-learner",
        consent: { status: "active", method: "monetary-transaction" },
      }),
    ),
  ).toEqual({
    "/start": "/start/name",
    "/start/verify-email": "/start/name",
    "/start/plan": "/start/name",
    "/start/purchase": null,
    "/start/consent": "/start/name",
    "/start/name": null,
    "/start/birth-year": null,
  });
});

test("a consented family with unlicensed learners buys per learner in billing", () => {
  expect(
    table(
      me({
        next: "choose-plan",
        consent: { status: "active", method: "verified" },
      }),
    ),
  ).toEqual({
    "/start": "/purchase",
    "/start/verify-email": "/purchase",
    "/start/plan": "/purchase",
    "/start/purchase": "/purchase",
    "/start/consent": "/purchase",
    "/start/name": null,
    "/start/birth-year": null,
  });
});

test("a practicing family may add another learner; everything else opens practice", () => {
  expect(
    table(
      me({
        next: "practice",
        consent: { status: "active", method: "monetary-transaction" },
      }),
    ),
  ).toEqual({
    "/start": "/practice",
    "/start/verify-email": "/practice",
    "/start/plan": "/practice",
    "/start/purchase": "/practice",
    "/start/consent": "/practice",
    "/start/name": null,
    "/start/birth-year": null,
  });
});

test("a signed-in parent without a purchase gets the free trial; plan steps open only when they choose to buy", () => {
  expect(table(me({ next: "try" }))).toEqual({
    "/start": "/try",
    "/start/verify-email": "/start/plan",
    "/start/plan": null,
    "/start/purchase": null,
    "/start/consent": null,
    "/start/name": "/try",
    "/start/birth-year": "/try",
  });
  // Chose a plan on the paywall before signing up: continue to it from
  // any step, including after email verification.
  for (const step of ["/start", "/start/verify-email", "/start/name"])
    expect(startDestination(me({ next: "try" }), step, true)).toBe(
      "/start/plan",
    );
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
    expect(startDestination(me(), path, false, true)).toBe(
      path === "/start/consent" ? null : "/start/consent",
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
    startDestination(me({ consent, next: "try" }), "/start", false, true),
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

test("an email gift routes around checkout but never around verification or consent", () => {
  const gift = me({
    next: "accept-gift",
    availableAccessGrant: {
      id: "b24d441b-38d5-42ec-ae99-dbe186b1ffba",
      months: 12,
      claimBy: null,
    },
  });
  for (const path of [
    "/start",
    "/start/plan",
    "/start/purchase",
    "/start/name",
    "/start/birth-year",
  ]) {
    expect(startDestination(gift, path)).toBe("/access");
  }
  expect(startDestination(gift, "/start/consent")).toBeNull();
  const ready = {
    ...gift,
    consent: { status: "active" as const, method: "fixture" },
  };
  expect(startDestination(ready, "/start/name")).toBeNull();
  expect(startDestination(ready, "/start/birth-year")).toBeNull();
  expect(startDestination(ready, "/start/consent")).toBe("/start/name");
  expect(startDestination(ready, "/start/purchase", true)).toBe("/access");
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
test("staff with no learners start at their school, not the parent trial", () => {
  const staff = me({ staffOf, next: "try" });
  expect(startDestination(staff, "/")).toBe("/school");
  expect(startDestination(staff, "/start/plan")).toBe("/school");
});
test("staff can still buy for a family, and a parent who teaches stays a parent", () => {
  const staff = me({ staffOf, next: "try" });
  expect(startDestination(staff, "/start/plan", true)).toBeNull();
  const learner = {
    id: "jordan",
    name: "Jordan",
    birthYear: 2015,
    entitlement: { active: true, plan: "annual", endsAt: null },
  };
  expect(
    startDestination(
      me({ staffOf, learners: [learner], next: "practice" }),
      "/",
    ),
  ).toBe("/practice");
  expect(
    startDestination(
      me({
        staffOf,
        next: "add-learner",
        consent: { status: "active", method: "verified" },
      }),
      "/",
    ),
  ).toBe("/start/name");
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

test("a teacher with a free assessment under way keeps it at `/`, and the school a tap away", () => {
  const teacher = me({
    staffOf: [school(alder, "Alder Street School")],
    trial: true,
    next: "try",
  });
  expect(startDestination(teacher, "/")).toBe("/try");
  expect(startDestination(teacher, "/start/plan")).toBeNull();
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
  const one = me({ staffOf: [school(alder, "Alder Street School")] });
  expect(startDestination(one, "/")).toBe("/school");
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
  const founder = me({ staffOf: [pending], trial: true, next: "try" });
  expect(startDestination(founder, "/")).toBe("/try");
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
  const admin = me({ staffOf: [pending] });
  expect(homePlace(admin, null)).toBe(`school:${alder}`);
  expect(homePlace(admin, `school:${alder}`)).toBe(`school:${alder}`);
  expect(startDestination(admin, "/")).toBe("/school");
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
    "/try/practice",
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
