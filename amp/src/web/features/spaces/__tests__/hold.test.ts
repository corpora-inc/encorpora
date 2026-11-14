import { expect, test } from "vitest";
import { resolveSpace } from "../resolve";
import { holdFrame, nextHeld } from "../hold";

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
};
const ready = resolveSpace({ pathname: path }, session, {
  org,
  year: { past: false },
});
const loading = resolveSpace({ pathname: path }, session, {});
const refused = resolveSpace({ pathname: path }, session, { org: null });

test("CP-2 M1: the same place for the same account keeps its frame while it answers again", () => {
  const held = nextHeld(ready, "amp|a");
  expect(holdFrame(held, loading, "amp|a")).toBe(ready);
});

test("never another account's, another place's, or past a refusal", () => {
  const held = nextHeld(ready, "amp|a");
  expect(holdFrame(held, loading, "amp|b")).toBe(loading);
  expect(holdFrame(held, refused, "amp|a")).toBe(refused);
  const elsewhere = resolveSpace(
    { pathname: `/school/${SCHOOL}` },
    session,
    {},
  );
  expect(holdFrame(held, elsewhere, "amp|a")).toBe(elsewhere);
  expect(nextHeld(refused, "amp|a")).toBeNull();
});
