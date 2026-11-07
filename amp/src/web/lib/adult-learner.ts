import type { SignedInMe } from "../../account/contracts";

type Learner = SignedInMe["learners"][number];

/** The account holder's own learner (docs/families.md), shaped as the family's
 * learners are, or null. It is its own place, never one of `me.learners`. */
export function adultLearner(
  me: SignedInMe | null | undefined,
): (Learner & { adult: true }) | null {
  const own = me?.adultPractice?.learner;
  return own
    ? {
        id: own.id,
        name: own.name,
        birthYear: null,
        entitlement: { active: own.active, plan: null, endsAt: null },
        adult: true,
      }
    : null;
}

/** Every learner this account practices as: the family's, then its own. */
export function practiceLearners(me: SignedInMe | null | undefined): Learner[] {
  const own = adultLearner(me);
  return [...(me?.learners ?? []), ...(own ? [own] : [])];
}

/** The adult is practicing as themselves: their own learner is the one chosen. */
export function practicingAsAdult(
  me: SignedInMe | null | undefined,
  learnerId: string | null | undefined,
): boolean {
  return !!learnerId && me?.adultPractice?.learner?.id === learnerId;
}
