import { expect, test } from "vitest";
import {
  backUrl,
  nextUrl,
  setupSteps,
  stepUrl,
  target,
  withFrom,
} from "../setup/FamilySetup";

/*
 * CP-4 M4: "Add a place" keeps where it was added from on every step of a
 * parent's setup, forward, back and through redirects, so Cancel and Back
 * always lead there; the place is validated by the one return contract.
 */

const FROM = "/me";
const enc = encodeURIComponent(FROM);
const steps = setupSteps("parent", {
  account: { givenName: null, familyName: null },
} as never);
const props = (index: number, from?: string) =>
  ({ kind: "parent", index, steps, from }) as never;

test("each step's next address keeps from: name → kids → who's first", () => {
  expect(nextUrl(props(0, FROM))).toBe(`/start/parent?from=${enc}`);
  expect(nextUrl(props(1, FROM))).toBe(`/start/parent/ready?from=${enc}`);
});

test("Back keeps from, to the step before and to the starter", () => {
  expect(backUrl("parent", steps, 0, FROM)).toBe(`/start?from=${enc}`);
  expect(backUrl("parent", steps, 1, FROM)).toBe(
    `/start/parent/name?from=${enc}`,
  );
  expect(backUrl("parent", steps, 2, FROM)).toBe(`/start/parent?from=${enc}`);
});

test("redirects between steps keep from", () => {
  expect(stepUrl("parent", "name", FROM)).toBe(
    `/start/parent/name?from=${enc}`,
  );
  expect(stepUrl("parent", "ready", FROM)).toBe(
    `/start/parent/ready?from=${enc}`,
  );
  expect(stepUrl("tutor", "join", FROM)).toBe(`/start/tutor/join?from=${enc}`);
});

test("a first run has no from, and a from that isn't a place is dropped", () => {
  expect(nextUrl(props(0))).toBe("/start/parent");
  expect(backUrl("parent", steps, 0)).toBe("/start");
  for (const hostile of [
    "//x.example",
    "/school/invite",
    "/start/parent",
    "https://x.example/me",
  ])
    expect(withFrom("/start/parent", hostile)).toBe("/start/parent");
  // A place's view keys come along; anything else and the fragment don't.
  expect(
    withFrom("/start", "/family/f?sort=name:ascending&token=x#secret"),
  ).toBe(
    `/start?from=${encodeURIComponent("/family/f?sort=name%3Aascending")}`,
  );
});

test("a step's address reaches the router as a path and a search, never a query in the path", () => {
  expect(target(stepUrl("parent", "name", FROM))).toEqual({
    to: "/start/parent/name",
    search: { from: FROM },
  });
  expect(target(stepUrl("parent", ""))).toEqual({
    to: "/start/parent",
    search: {},
  });
});
