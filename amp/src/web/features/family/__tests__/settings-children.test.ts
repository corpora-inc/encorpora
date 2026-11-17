import { expect, test } from "vitest";
import { childMeta, childSheet } from "../settings/Children";
import type { FamilyChild } from "../api";

const child = (access: Partial<FamilyChild["access"]>, birthYear = 2017) =>
  ({
    id: "pip",
    name: "Pip",
    birthYear,
    access: {
      grants: [],
      hasAccess: false,
      canPractice: true,
      learningAllowed: true,
      freeAllowance: { problems: { total: 100, used: 37, remaining: 63 } },
      ...access,
    },
  }) as unknown as FamilyChild;

test("a child's row says when they were born and what lets them practice", () => {
  expect(childMeta(child({}))).toBe("Born 2017 · 63 free problems left");
  expect(
    childMeta(
      child({
        hasAccess: true,
        grants: [
          {
            channel: "stripe",
            status: "active",
            startsAt: "2026-07-01T12:00:00Z",
            endsAt: "2027-06-30T12:00:00Z",
          },
        ],
      }),
    ),
  ).toBe("Born 2017 · Active through Jun 30, 2027");
  expect(childMeta(child({}, null as unknown as number))).toMatch(
    /^Birth year not set/,
  );
});

test("each child's settings sheet is named for them", () => {
  expect(childSheet("pip")).toBe("child:pip");
});
