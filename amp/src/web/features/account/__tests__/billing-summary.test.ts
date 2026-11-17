import { expect, test } from "vitest";
import { managesPlan, planLines } from "../BillingSummary";

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

test("a plan is managed by its family's holder, never by a parent who is only a second parent", () => {
  const me = (learners: unknown[]) =>
    ({ family: { learners } }) as unknown as Parameters<typeof managesPlan>[0];
  const kids = [learner("Pip", paid("2027-07-01T12:00:00Z"))];
  // The holder of a family with learners manages its plan.
  expect(managesPlan(me(kids), false)).toBe(true);
  // Only another family's second parent: the server refuses their
  // purchases (family_holder_only), so nothing is offered.
  expect(managesPlan(me(kids), true)).toBe(false);
  // No learners: no plan to manage.
  expect(managesPlan(me([]), false)).toBe(false);
});
