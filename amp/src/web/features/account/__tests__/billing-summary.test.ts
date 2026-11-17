import { expect, test } from "vitest";
import { planLines } from "../BillingSummary";

const learner = (
  name: string,
  extra: Record<string, unknown> = {},
): Parameters<typeof planLines>[0][number] =>
  ({
    id: name.toLowerCase(),
    name,
    deletedAt: null,
    access: [],
    stripeLinked: false,
    ...extra,
  }) as Parameters<typeof planLines>[0][number];

const paid = (end: string) => ({
  hasAccess: true,
  access: [
    {
      channel: "stripe",
      status: "active",
      startsAt: "2026-01-01",
      endsAt: end,
    },
  ],
});

test("children with the same plan share one line; free children say what is left", () => {
  const lines = planLines([
    learner("Pip", paid("2027-07-01T12:00:00Z")),
    learner("Wren", paid("2027-07-01T12:00:00Z")),
    learner("Theo", {
      hasAccess: false,
      freeAllowance: { problems: { total: 100, used: 37, remaining: 63 } },
    }),
  ]);
  expect(lines).toEqual([
    "AMP for Pip and Wren · through Jul 1, 2027",
    "Free · 63 problems left for Theo",
  ]);
});

test("the adult's own learner is you", () => {
  expect(
    planLines([
      learner("Avery", {
        adult: true,
        hasAccess: false,
        freeAllowance: { problems: { total: 100, used: 99, remaining: 1 } },
      }),
    ]),
  ).toEqual(["Free · 1 problem left for you"]);
});
