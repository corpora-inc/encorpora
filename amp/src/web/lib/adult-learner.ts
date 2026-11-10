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

/** One of the adult's practice profiles (docs/families.md), by id. */
export function practiceProfile(
  me: SignedInMe | null | undefined,
  learnerId: string | null | undefined,
) {
  return (
    (learnerId &&
      me?.practiceProfiles?.find((profile) => profile.id === learnerId)) ||
    null
  );
}

/** The adult is practicing as one of their profiles: someone else's level,
 * on their own account, touching nobody's record. */
export function practicingAsProfile(
  me: SignedInMe | null | undefined,
  learnerId: string | null | undefined,
): boolean {
  return !!practiceProfile(me, learnerId);
}

/** A practice profile shaped as the family's learners are: its label is its
 * name. It is the adult's own practice, never one of `me.learners`. */
export function profileLearner(
  me: SignedInMe | null | undefined,
  learnerId: string | null | undefined,
): (Learner & { adult: true; profile: true }) | null {
  const profile = practiceProfile(me, learnerId);
  if (!profile) return null;
  const entry = me?.family.learners.find((l) => l.id === profile.id);
  return {
    id: profile.id,
    name: profile.label,
    birthYear: null,
    entitlement: {
      active: entry?.canPractice === true,
      plan: null,
      endsAt: null,
    },
    adult: true,
    profile: true,
  };
}

/** Every learner this account practices as: the family's, then its own,
 * then its practice profiles. */
export function practiceLearners(me: SignedInMe | null | undefined): Learner[] {
  const own = adultLearner(me);
  const profiles = (me?.practiceProfiles ?? []).map((profile) =>
    profileLearner(me, profile.id)!,
  );
  return [...(me?.learners ?? []), ...(own ? [own] : []), ...profiles];
}

/** The adult is practicing as themselves: their own learner is the one chosen. */
export function practicingAsAdult(
  me: SignedInMe | null | undefined,
  learnerId: string | null | undefined,
): boolean {
  return !!learnerId && me?.adultPractice?.learner?.id === learnerId;
}
