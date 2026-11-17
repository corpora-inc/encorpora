import { expect, test, vi } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";
import {
  addingPlace,
  currentChoice,
  isStarterPath,
  routeFor,
  startDestination,
} from "../guard";
import { canRemoveSaved } from "../setup/FamilySetup";
import { stepBack } from "../../../lib/return-to";

/*
 * A parent's first run (founder QA 2026-11-16): the steps are URLs, Back is
 * one step, and nothing is decided by "a family now exists". Saved kids stay
 * editable until the parent is done.
 */

const child = (id: string, extra: object = {}) =>
  ({
    id,
    name: `Child ${id}`,
    birthYear: 2017,
    entitlement: { active: true, plan: null, endsAt: null },
    ...extra,
  }) as SignedInMe["learners"][number];
function me(overrides: Partial<SignedInMe> = {}): SignedInMe {
  return {
    signedIn: true,
    account: { id: "parent", email: "p@example.test", emailVerified: true },
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
  } as SignedInMe;
}
/** A parent whose first step saved two kids: the server now says "practice". */
const saved = me({
  next: "practice",
  learners: [child("a", { removable: true }), child("b", { removable: true })],
  familyClass: { orgId: "o", classId: "c", className: "Family" },
} as Partial<SignedInMe>);

const fresh = me({ setup: { persona: null, done: false } });
const chose = me({ setup: { persona: "parent", done: false } });
/** Kids saved at step one, the first run not done: the server now says
 * "practice", which must not end the first run. */
const saving = {
  ...saved,
  setup: { persona: "parent", done: false },
} as SignedInMe;
const finished = {
  ...saved,
  setup: { persona: "parent", done: true },
} as SignedInMe;
const at = (pathname: string, search: Record<string, unknown> = {}) => ({
  pathname,
  search,
});
const FROM = "/family/00000000-0000-4000-8000-00000000000f";

test("routeFor: the first run's table, by URL and me.setup only", () => {
  const rows: [SignedInMe | null, string, Record<string, unknown>, unknown][] =
    [
      // The question and each answer's own step stay where they are.
      [fresh, "/start", {}, null],
      [saving, "/start", {}, null],
      [finished, "/start", {}, null],
      [saving, "/start/parent", {}, null],
      [saving, "/start/myself", {}, null],
      [saving, "/start/school", {}, null],
      // Who practices first needs saved kids, nothing else.
      [saving, "/start/parent/ready", {}, null],
      [finished, "/start/parent/ready", {}, null],
      [chose, "/start/parent/ready", {}, { to: "/start/parent" }],
      // Retired steps open their successors; unknown ones the first step.
      [saving, "/start/parent/practice", {}, { to: "/start/parent/ready" }],
      [
        saving,
        "/start/parent/second-parent",
        {},
        { to: "/start/parent/ready" },
      ],
      [saving, "/start/parent/name", {}, { to: "/start/parent" }],
      [saving, "/start/parent/nope", {}, { to: "/start/parent" }],
      [saving, "/start/myself/x", {}, { to: "/start/myself" }],
      [saving, "/start/nope", {}, { to: "/start" }],
      [saving, "/start/teacher", {}, { to: "/school/start" }],
      // Nothing rides along in a query string.
      [
        saving,
        "/start/parent/practice",
        { from: FROM },
        { to: "/start/parent/ready" },
      ],
      [saving, "/start/nope", { from: "//evil.example" }, { to: "/start" }],
      // An old trial link resumes a finished first run at `/`, and only that.
      [finished, "/start", { return: "free-practice" }, { to: "/" }],
      [saving, "/start", { return: "free-practice" }, null],
      [fresh, "/start", { return: "free-practice" }, null],
      // A failed /me read routes by the address alone.
      [null, "/start/parent/ready", {}, null],
      [null, "/start/nope", {}, { to: "/start" }],
      // Not the starter's.
      [saving, "/family", {}, null],
    ];
  for (const [account, path, search, expected] of rows)
    expect([path, search, routeFor(account, at(path, search))]).toEqual([
      path,
      search,
      expected,
    ]);
});

test("the old first-run guard never sends a setup step home because a family exists", () => {
  for (const path of ["/start", "/start/parent", "/start/parent/ready"]) {
    expect(isStarterPath(path)).toBe(true);
    expect(startDestination(saving, path)).toBeNull();
  }
});

test("/start is the account's own question until its first run is done, whatever is saved", () => {
  // Kids saved, Back to /start: still "What brings you to AMP?", Parent marked.
  expect(addingPlace(saving)).toBe(false);
  expect(currentChoice(saving)).toBe("parent");
  // Chose Parent, nothing saved yet.
  expect(currentChoice(chose)).toBe("parent");
  // Changed their mind: that answer is current.
  expect(
    currentChoice({ ...saving, setup: { persona: "myself", done: false } }),
  ).toBe("myself");
  expect(currentChoice(fresh)).toBeNull();
  // Done (Go to Today, a first practice): from then on it adds a place.
  expect(addingPlace(finished)).toBe(true);
  expect(currentChoice(finished)).toBeNull();
  // A provider without first-run state, with a place: adding a place.
  expect(addingPlace(saved)).toBe(true);
  // Done but with no place at all: the question again.
  expect(addingPlace(me({ setup: { persona: "myself", done: true } }))).toBe(
    false,
  );
});

test("a saved child's Remove shows only where it will work", () => {
  expect(canRemoveSaved({ removable: true }, 2)).toBe(true);
  // The family keeps one saved child: the last is edited instead.
  expect(canRemoveSaved({ removable: true }, 1)).toBe(false);
  // Practice or a purchase in their name: removed only from Privacy.
  expect(canRemoveSaved({}, 3)).toBe(false);
});

const click = (extra: object = {}) => ({
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  preventDefault: vi.fn(),
  ...extra,
});

test("in-page Back is the browser's Back when the step before is the one it names", () => {
  const history = {
    location: { state: { ampPrevious: "/start/parent" } },
    back: vi.fn(),
  };
  const event = click();
  stepBack(history, "/start/parent", event);
  expect(event.preventDefault).toHaveBeenCalled();
  expect(history.back).toHaveBeenCalledOnce();
});

test("otherwise Back follows its own address (a direct link, a refresh with no history)", () => {
  for (const state of [{}, { ampPrevious: "/family/x/today" }, null]) {
    const history = { location: { state }, back: vi.fn() };
    const event = click();
    stepBack(history, "/start/parent", event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(history.back).not.toHaveBeenCalled();
  }
  // A modified click opens the step in a new tab, as a link does.
  const history = {
    location: { state: { ampPrevious: "/start/parent" } },
    back: vi.fn(),
  };
  const event = click({ metaKey: true });
  stepBack(history, "/start/parent", event);
  expect(history.back).not.toHaveBeenCalled();
});
