import { expect, test } from "vitest";
import type { PlaceGroup } from "../../spaces/places";
import { launches } from "../destination";

const me = (over: Record<string, unknown> = {}) =>
  ({
    signedIn: true,
    account: { id: "a", kind: "adult" },
    next: "practice",
    learners: [],
    ...over,
  }) as never;
const groups: PlaceGroup[] = [
  {
    id: "family",
    label: "Family",
    entries: [
      { id: "home", name: "Your family", detail: "Ada", path: "family/f1" },
    ],
  },
  {
    id: "teaching",
    label: "Teaching",
    entries: [
      {
        id: "school:s1",
        name: "Grade 5 Math",
        detail: "Teacher",
        path: "school/s1",
      },
    ],
  },
  {
    id: "practice",
    label: "Practice",
    entries: [
      { id: "me", name: "Dana", detail: "", path: "me" },
      {
        id: "level",
        name: "Practice at a level",
        detail: "",
        path: "me/level",
      },
    ],
  },
];

test("`/` offers the place last used first, each at its own address", () => {
  const all = launches(me(), groups, "school:s1");
  expect(all.map((entry) => [entry.label, entry.path])).toEqual([
    ["Open Grade 5 Math", "school/s1"],
    ["Open Your family", "family/f1"],
    ["Continue practicing", "me"],
  ]);
});

test("nothing remembered: the first place, in its group's order", () => {
  expect(launches(me(), groups, null)[0]!.path).toBe("family/f1");
});

test("a new account starts; a student's device practices", () => {
  expect(launches(me({ next: "start" }), [], null)).toMatchObject([
    { id: "start", action: "Get started", path: "start" },
  ]);
  expect(
    launches(me({ account: { id: "s", kind: "student" } }), groups, null)[0],
  ).toMatchObject({ label: "Continue practicing", path: "practice" });
});

test("a waiting gift opens first only while no child has access", () => {
  const gift = launches(me({ next: "accept-gift" }), groups, null)[0]!;
  expect(gift.path).toBe("access");
  const covered = launches(
    me({
      next: "accept-gift",
      learners: [{ entitlement: { active: true } }],
    }),
    groups,
    null,
  )[0]!;
  expect(covered.path).toBe("family/f1");
});
