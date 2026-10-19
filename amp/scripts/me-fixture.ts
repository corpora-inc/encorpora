import type { FamilySummary } from "../src/family/contracts";
/** Synthetic server contract for isolated browser fixtures. */
export function fixtureMe(family: FamilySummary, identity = "fixture") {
  const active = ["active", "development"].includes(family.consent.status);
  return {
    signedIn: true as const,
    account: {
      id: identity,
      email: "parent@example.test",
      emailVerified: true,
    },
    consent: { status: active ? "active" : "none", method: null },
    family,
    learners: family.learners
      .filter((learner) => !learner.deletedAt)
      .map((learner) => ({
        id: learner.id,
        name: learner.name,
        birthYear: learner.birthYear ?? null,
        entitlement: {
          active: learner.canPractice ?? false,
          plan: null,
          endsAt: null,
        },
      })),
    next: !active
      ? "choose-plan"
      : family.learners.length
        ? "practice"
        : "add-learner",
  };
}
