import { expect, test } from "vitest";
import { resolveSpace } from "../resolve";
import { blockedBy, holdFrame, nextHeld, sessionIdentity } from "../hold";

const SCHOOL = "33333333-3333-4333-8333-333333333333";
const ROOM = "44444444-4444-4444-8444-444444444444";
const path = `/school/${SCHOOL}/classes/${ROOM}/today`;
const session = { kind: "adult" as const, me: null, learnerId: null };
const org = {
  id: SCHOOL,
  kind: "school" as const,
  name: "Alder Grove",
  parentId: null,
  timezone: "UTC",
  roles: ["teacher" as const],
  can: ["org.read" as const],
  teaches: [ROOM],
};
const year = {
  past: false,
  orgId: SCHOOL,
  path: [SCHOOL],
  can: ["students.read", "signin.read"],
};
const ready = resolveSpace({ pathname: path }, session, {
  org,
  year,
  covered: 3,
});
const loading = resolveSpace({ pathname: path }, session, {});
const refused = resolveSpace({ pathname: path }, session, { org: null });
const first = sessionIdentity({ accountId: "amp|a", token: "one" });
const second = sessionIdentity({ accountId: "amp|a", token: "two" });

test("the same place in the same session keeps its frame while it answers again", () => {
  expect(ready.actions).toEqual(["start-class"]);
  expect(holdFrame(nextHeld(ready, first), loading, first)).toBe(ready);
});

test("CP-2 r2 M1: the same account signed in again never gets the old frame or its actions", () => {
  const shown = holdFrame(nextHeld(ready, first), loading, second);
  expect(shown).toBe(loading);
  expect(shown?.actions).toEqual([]);
});

test("never another account's, another place's, or past a refusal", () => {
  const held = nextHeld(ready, first);
  expect(
    holdFrame(
      held,
      loading,
      sessionIdentity({ accountId: "amp|b", token: "one" }),
    ),
  ).toBe(loading);
  expect(holdFrame(held, refused, first)).toBe(refused);
  const elsewhere = resolveSpace(
    { pathname: `/school/${SCHOOL}` },
    session,
    {},
  );
  expect(holdFrame(held, elsewhere, first)).toBe(elsewhere);
  expect(nextHeld(refused, first)).toBeNull();
});

test("CP-2 r2 H2: the content guard keeps out a refused or failed place", () => {
  expect(blockedBy(refused)).toBe("unavailable");
  expect(
    blockedBy(resolveSpace({ pathname: path }, session, { failed: true })),
  ).toBe("failed");
  expect(blockedBy(ready)).toBeNull();
  expect(blockedBy(loading)).toBeNull();
  const foreign = resolveSpace(
    { pathname: "/pathways", search: { learner: "stranger" } },
    { kind: "adult", me: null, learnerId: "pip" },
  );
  expect(blockedBy(foreign)).toBe("unavailable");
});
