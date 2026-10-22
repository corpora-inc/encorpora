import { expect, test } from "vitest";
import type { Me, SignedInMe } from "../../../../account/contracts";
import { startDestination } from "../guard";

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
